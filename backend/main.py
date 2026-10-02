"""
EagleChair Backend API - Main Application Entry Point

A production-ready FastAPI backend with:
- Versioned APIs (v1, v2, ...)
- Async PostgreSQL with SQLAlchemy
- Comprehensive security (JWT, HTTPS, rate limiting, security headers)
- Middleware for logging, error handling, CORS
- Redis caching support
- Fuzzy search capabilities
- Full test coverage with pytest
"""

import asyncio
import logging
import os
import re
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
import gunicorn.app.base

from backend.api import versioning
from backend.api.v1 import router as v1_router
from backend.core.config import settings
from backend.core.error_handlers import register_exception_handlers
from backend.core.logging_config import init_logging
from backend.core.middleware import setup_middleware
from backend.database.base import close_db, init_db

# Initialize logging system
init_logging()
logger = logging.getLogger(__name__)


# Identifies this deploy / process start. gunicorn_conf.py uses preload_app=True,
# so this module is imported once in the Gunicorn master before it forks: every
# worker, including ones recycled by max_requests, shares the same ID, and a
# restart (new master) gets a new one. EAGLECHAIR_BOOT_ID overrides it.
BOOT_ID = os.getenv("EAGLECHAIR_BOOT_ID") or uuid.uuid4().hex

STARTUP_LOCK_KEY = "eaglechair:startup_lock"
# Long enough for a slow init; refreshed while the work runs
STARTUP_LOCK_TTL_MS = 120_000
STARTUP_LOCK_REFRESH_SECONDS = 30
# Set after a successful init so later workers of this boot skip it
STARTUP_DONE_KEY = f"eaglechair:startup_done:{BOOT_ID}"
STARTUP_DONE_TTL_SECONDS = 30 * 24 * 3600


async def _run_startup_tasks() -> bool:
    """
    One-time startup work: DB init and CMS export.

    Returns:
        True if DB init and the CMS export both succeeded
    """
    ok = True

    try:
        await init_db()
        logger.info("[OK] Database initialized")
    except Exception:
        logger.exception("❌ Database initialization failed")
        ok = False

    # Export CMS content to static files
    try:
        from backend.database.base import AsyncSessionLocal
        from backend.services.cms_admin_service import CMSAdminService

        async with AsyncSessionLocal() as db:
            logger.info("📦 Exporting CMS content to static files...")
            if await CMSAdminService.export_all_static_content(db):
                logger.info("[OK] CMS content exported to frontend")
            else:
                logger.warning("[WARN] CMS content export failed")
                ok = False
    except Exception:
        logger.exception("[WARN] Could not export CMS content")
        ok = False


    return ok


async def _keep_startup_lock(redis_client, token: str) -> None:
    """Extend the startup lock while this worker holds it."""
    from backend.core.redis_lock import refresh_lock

    while True:
        await asyncio.sleep(STARTUP_LOCK_REFRESH_SECONDS)
        try:
            if not await refresh_lock(
                redis_client, STARTUP_LOCK_KEY, token, STARTUP_LOCK_TTL_MS
            ):
                logger.warning("[WORKER] Lost the startup lock while initializing")
                return
        except Exception as e:
            logger.warning(f"[WORKER] Could not refresh startup lock: {e}")


async def _coordinated_startup() -> None:
    """
    Run the one-time startup tasks in exactly one worker per boot.

    Uses a Redis lock (atomic compare-and-delete release, refreshed while held)
    and a per-boot "done" marker so workers recycled later skip the work. If
    Redis is unavailable, runs the tasks in this worker.
    """
    from backend.core.redis_lock import new_lock_token, release_lock

    tasks_started = False
    redis_client = None
    try:
        import redis.asyncio as redis

        redis_client = redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=5,
        )

        if await redis_client.get(STARTUP_DONE_KEY):
            logger.info(
                "[WORKER] Startup tasks already done for this boot - skipping"
            )
            return

        token = new_lock_token()
        if not await redis_client.set(
            STARTUP_LOCK_KEY, token, nx=True, px=STARTUP_LOCK_TTL_MS
        ):
            logger.info(
                "[WORKER] Startup lock held by another worker - skipping one-time initialization tasks"
            )
            # Give the other worker a moment on critical DB tasks before we proceed
            await asyncio.sleep(2)
            return

        logger.info(f"[WORKER] Acquired startup lock (boot {BOOT_ID})")
        refresher = asyncio.create_task(_keep_startup_lock(redis_client, token))
        tasks_started = True
        try:
            if await _run_startup_tasks():
                await redis_client.set(STARTUP_DONE_KEY, "1", ex=STARTUP_DONE_TTL_SECONDS)
        finally:
            refresher.cancel()
            try:
                await refresher
            except asyncio.CancelledError:
                pass
            try:
                await release_lock(redis_client, STARTUP_LOCK_KEY, token)
                logger.info("[WORKER] Released startup lock")
            except Exception as e:
                logger.warning(f"[WORKER] Could not release startup lock: {e}")

    except Exception as e:
        if tasks_started:
            logger.warning(f"[WARN] Redis error after startup tasks ran: {e}")
        else:
            logger.warning(
                f"[WARN] Redis lock coordination failed, running startup tasks in this worker: {e}"
            )
            # Redis is down: run the full startup work (DB init and CMS export)
            await _run_startup_tasks()
    finally:
        if redis_client is not None:
            try:
                await redis_client.aclose()
            except Exception:
                pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan events

    Startup: Initialize database, cache, etc.
    Shutdown: Close connections gracefully
    """
    # Startup
    logger.info("🚀 Starting EagleChair API...")

    # Coordinate one-time startup tasks across workers using Redis (if available)
    await _coordinated_startup()

    # Cache warm-up is safe to run on all workers (idempotent-ish) or can be skipped
    # Actually, one worker warming it is enough.
    # We'll just let it run in background on all workers for now as it doesn't hurt much (just reads DB)
    # or keeps cache fresh.

    # Warm up product search cache for fast fuzzy search (non-blocking)
    async def warm_cache_background():
        """Background task to warm up cache without blocking server startup"""
        try:
            from backend.services.cache_service import cache_service

            # Quick health check to see if Redis is available
            if not cache_service.enabled or not cache_service.cache:
                return

            try:
                await asyncio.wait_for(
                    cache_service.cache.get("__health_check__"), timeout=2.0
                )
            except:
                return

            from backend.database.base import AsyncSessionLocal
            from backend.services.product_service import ProductService

            async with AsyncSessionLocal() as db:
                try:
                    # Random small delay to prevent all workers hitting DB exactly at same time
                    import random

                    await asyncio.sleep(random.uniform(1, 5))

                    logger.info("🔍 Warming product search cache...")
                    await asyncio.wait_for(
                        ProductService.warm_search_cache(db),
                        timeout=30.0,
                    )
                    await db.commit()
                except:
                    await db.rollback()
        except:
            pass

    # Start warm-up as background task (non-blocking)
    asyncio.create_task(warm_cache_background())

    # Per-page HTML shells + share images for crawlers (one worker at a time;
    # see services/seo_prerender.py)
    seo_task = None
    if settings.SEO_PRERENDER_ENABLED:
        from backend.services.seo_prerender import prerender_loop

        seo_task = asyncio.create_task(prerender_loop())

    logger.info(f"🎯 API v1 available at: {settings.API_V1_PREFIX}")
    logger.info("✨ EagleChair API is ready!")

    yield

    # Shutdown
    logger.info("🛑 Shutting down EagleChair API...")

    if seo_task is not None:
        seo_task.cancel()

    try:
        # Close cache connections first
        from backend.services.cache_service import cache_service

        await cache_service.close()
        logger.info("[OK] Cache connections closed")
    except Exception as e:
        logger.warning(f"[WARN] Error closing cache: {e}")

    try:
        await close_db()
        logger.info("[OK] Database connections closed")
    except Exception as e:
        logger.error(f"❌ Error closing database: {e}")

    logger.info("👋 EagleChair API shutdown complete")


# Create FastAPI application
# Only enable docs in DEBUG mode (dev mode only)
app = FastAPI(
    title=settings.APP_NAME,
    description=settings.APP_DESCRIPTION,
    version=settings.APP_VERSION,
    # docs_enabled = DEBUG and ENVIRONMENT != production
    docs_url="/docs" if settings.docs_enabled else None,  # SwaggerUI - dev mode only
    redoc_url="/redoc" if settings.docs_enabled else None,  # ReDoc - dev mode only
    openapi_url="/openapi.json"
    if settings.docs_enabled
    else None,  # OpenAPI JSON - dev mode only
    lifespan=lifespan,
    # Trust proxy headers when behind reverse proxy (DreamHost)
    root_path=settings.ROOT_PATH if hasattr(settings, "ROOT_PATH") else "",
)

# Configure proxy headers for production (DreamHost reverse proxy)
if not settings.DEBUG:
    from fastapi.middleware.trustedhost import TrustedHostMiddleware

    # Trust the reverse proxy
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=settings.ALLOWED_HOSTS
        if hasattr(settings, "ALLOWED_HOSTS")
        else ["*"],
    )

# Register exception handlers
register_exception_handlers(app)

# Setup all middleware
setup_middleware(app)


# ============================================================================
# CRITICAL FIX: Handle OPTIONS for CMS admin routes BEFORE FastAPI routing
# ============================================================================
@app.middleware("http")
async def cms_options_handler(request: Request, call_next):
    """
    Handle OPTIONS requests for CMS admin routes before FastAPI routing.

    This prevents FastAPI from trying to validate request bodies on OPTIONS requests,
    which causes 400 errors for routes with body parameters.
    """
    if request.method == "OPTIONS" and request.url.path.startswith(
        "/api/v1/cms-admin/"
    ):
        from fastapi.responses import Response
        from backend.core.config import settings

        # Get the origin from the request
        origin = request.headers.get("Origin", "")

        # Check if origin is in allowed origins
        allowed_origin = (
            origin
            if origin in settings.CORS_ORIGINS
            else settings.CORS_ORIGINS[0]
            if settings.CORS_ORIGINS
            else "*"
        )

        # If credentials are allowed, we can't use "*" - must use specific origin
        if settings.CORS_ALLOW_CREDENTIALS and allowed_origin == "*":
            # Fallback to first allowed origin if origin not in list
            allowed_origin = (
                settings.CORS_ORIGINS[0] if settings.CORS_ORIGINS else origin
            )

        return Response(
            status_code=200,
            headers={
                "Access-Control-Allow-Origin": allowed_origin,
                "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Authorization, X-Session-Token, X-Admin-Token, Content-Type",
                "Access-Control-Allow-Credentials": "true"
                if settings.CORS_ALLOW_CREDENTIALS
                else "false",
                "Access-Control-Max-Age": "86400",
            },
        )
    return await call_next(request)


# Include API versioning routes (at root /api level)
app.include_router(versioning.router, prefix="/api", tags=["API Versioning"])

# Include API v1 routes
app.include_router(
    v1_router.router,
    prefix=settings.API_V1_PREFIX,
    responses={404: {"description": "Not found"}},
)

# TODO: Include API v2 routes when ready
# app.include_router(
#     v2_routes.router,
#     prefix=settings.API_V2_PREFIX,
# )

# ============================================================================
# Static File Serving
# ============================================================================

# Mount uploads directory for user-uploaded files (images, documents, etc.).
# Use the same directory the upload routes write to (FRONTEND_PATH/uploads in
# production), otherwise files uploaded in prod are never served from here.
from backend.api.v1.routes.admin.upload import UPLOAD_BASE_DIR as uploads_path  # noqa: E402

uploads_path.mkdir(parents=True, exist_ok=True)


class _PublicUploads(StaticFiles):
    """Public uploads, except legacy quote attachments (private; see migrate_quote_attachments)."""

    async def get_response(self, path, scope):
        first = path.replace("\\", "/").lstrip("/").split("/", 1)[0]
        if first.lower() == "quotes":
            raise StarletteHTTPException(status_code=404)
        return await super().get_response(path, scope)


app.mount("/uploads", _PublicUploads(directory=str(uploads_path)), name="uploads")
logger.info(f"[OK] Uploads directory mounted at /uploads ({uploads_path})")


@app.get("/api-docs", response_class=HTMLResponse, include_in_schema=False)
async def root_old():
    """
    Welcome page for EagleChair API
    """
    from backend.templates.api_docs import get_api_docs_html

    return get_api_docs_html()


# ============================================================================
# Frontend SPA Serving
# ============================================================================

# Use FRONTEND_PATH from config
# In production: FRONTEND_PATH points to the built frontend root (already contains dist contents)
# In development: FRONTEND_PATH is "frontend", so we append /dist
if settings.FRONTEND_PATH and Path(settings.FRONTEND_PATH).is_absolute():
    # Production: FRONTEND_PATH is already the built frontend root (e.g., /home/dh_wmujeb/joshua.eaglechair.com)
    frontend_dist_path = Path(settings.FRONTEND_PATH)
else:
    # Development: Use relative path and append /dist (backend/../frontend/dist)
    frontend_path = (
        Path(settings.FRONTEND_PATH)
        if settings.FRONTEND_PATH != "frontend"
        else Path(__file__).parent.parent / "frontend"
    )
    frontend_dist_path = frontend_path / "dist"

if frontend_dist_path.exists() and (frontend_dist_path / "index.html").exists():
    logger.info(f"[OK] Frontend dist found at {frontend_dist_path}")

    # Mount static assets
    if (frontend_dist_path / "assets").exists():
        app.mount(
            "/assets",
            StaticFiles(directory=str(frontend_dist_path / "assets")),
            name="assets",
        )

    # Mount data directory (contentData.json). StaticFiles sends ETag /
    # Last-Modified and answers conditional requests with 304; the cache
    # middleware below marks it no-cache so CMS edits show up immediately.
    if (frontend_dist_path / "data").exists():
        app.mount(
            "/data",
            StaticFiles(directory=str(frontend_dist_path / "data")),
            name="data",
        )
        logger.info("[OK] Data directory mounted at /data")

    _no_cache_headers = {"Cache-Control": "no-cache"}
    # Slug-safe segments only: no "..", no dotfiles
    _SHELL_PATH_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._~-]*(/[A-Za-z0-9][A-Za-z0-9._~-]*)*$")
    _index_cache: dict = {"mtime": None, "html": None}
    _frontend_root = frontend_dist_path.resolve()

    def _index_html() -> str:
        index_file = frontend_dist_path / "index.html"
        mtime = index_file.stat().st_mtime
        if _index_cache["mtime"] != mtime:
            _index_cache["html"] = index_file.read_text(encoding="utf-8")
            _index_cache["mtime"] = mtime
        return _index_cache["html"]

    def _serve_index() -> HTMLResponse:
        try:
            return HTMLResponse(content=_index_html(), headers=_no_cache_headers)
        except Exception as e:
            logger.error(f"Error reading index.html: {e}")
            return HTMLResponse(
                content="<h1>Frontend not available</h1>",
                status_code=500,
                headers=_no_cache_headers,
            )

    @app.get("/", response_class=HTMLResponse, include_in_schema=False)
    async def root():
        """Serve React SPA frontend"""
        return _serve_index()

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        """Serve root-level build files, else the SPA (client-side routing)"""
        if full_path.startswith("api/"):
            return JSONResponse(content={"detail": "Not found"}, status_code=404)
        if not settings.docs_enabled and full_path in ["docs", "redoc", "openapi.json"]:
            return JSONResponse(content={"detail": "Not found"}, status_code=404)

        # Real files at the dist root (robots.txt, sitemap.xml, favicon.ico,
        # manifest.json, sw.js, ...). Only a single path segment, no dotfiles.
        if full_path and "/" not in full_path and not full_path.startswith("."):
            candidate = (frontend_dist_path / full_path).resolve()
            if candidate.parent == _frontend_root and candidate.is_file() and candidate.name != "index.html":
                return FileResponse(candidate)

        # Prerendered page shell (services/seo_prerender.py), same rule as .htaccess
        shell_path = full_path.strip("/")
        if shell_path and _SHELL_PATH_RE.match(shell_path):
            shell = _frontend_root / "_seo" / shell_path / "index.html"
            if shell.is_file():
                return FileResponse(shell, media_type="text/html", headers=_no_cache_headers)

        return _serve_index()

else:
    logger.warning(f"Frontend dist NOT found at {frontend_dist_path}")
    logger.warning("Build frontend with: cd frontend && npm run build")


_IMMUTABLE = "public, max-age=31536000, immutable"
# Service worker scripts must always be revalidated or updates never land.
_SW_FILES = {"/sw.js", "/registerSW.js"}


def _drop_legacy_cache_headers(response) -> None:
    for name in ("pragma", "expires"):
        if name in response.headers:
            del response.headers[name]


@app.middleware("http")
async def cache_control_frontend(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/assets/") and response.status_code == 200:
        # Vite-hashed assets are content-addressed and never change
        response.headers["Cache-Control"] = _IMMUTABLE
        _drop_legacy_cache_headers(response)
    elif path.startswith("/uploads/") and response.status_code == 200:
        # Upload filenames are unique per upload (timestamp + random suffix)
        response.headers["Cache-Control"] = _IMMUTABLE
        _drop_legacy_cache_headers(response)
        # Uploads are data: an uploaded SVG/HTML opened directly must not run
        # script on our origin (PDFs excluded; sandbox breaks the PDF viewer).
        if not path.lower().endswith(".pdf"):
            response.headers["Content-Security-Policy"] = (
                "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox"
            )
    elif path.startswith("/data/") or path in _SW_FILES:
        # Revalidate every time; ETag makes that a cheap 304
        response.headers["Cache-Control"] = "no-cache"
        _drop_legacy_cache_headers(response)
    elif not (
        path.startswith("/api")
        or path.startswith("/docs")
        or path.startswith("/redoc")
        or path.startswith("/openapi")
        or path == "/api-docs"
    ):
        content_type = response.headers.get("content-type", "")
        if content_type.startswith("text/html"):
            response.headers["Cache-Control"] = "no-cache"
        elif response.status_code == 200:
            # Root-level static files (favicon, robots.txt, manifest...)
            response.headers["Cache-Control"] = "public, max-age=86400"
        _drop_legacy_cache_headers(response)
    return response


class StandaloneApplication(gunicorn.app.base.BaseApplication):
    """
    Custom Gunicorn application to run programmatically.
    """

    def __init__(self, app, options=None):
        self.options = options or {}
        self.application = app
        super().__init__()

    def load_config(self):
        config = {
            key: value
            for key, value in self.options.items()
            if key in self.cfg.settings and value is not None
        }
        for key, value in config.items():
            self.cfg.set(key.lower(), value)

    def load(self):
        return self.application


if __name__ == "__main__":
    # Gunicorn options matching gunicorn_conf.py
    options = {
        "bind": f"{settings.HOST}:{settings.PORT}",
        "workers": 2,
        "worker_class": "backend.core.worker.AsyncioUvicornWorker",
        "timeout": 120,
        "keepalive": 5,
        "preload_app": True,
        "reload": False,
        "loglevel": settings.LOG_LEVEL.lower(),
        "accesslog": "-",
        "errorlog": "-",
        "raw_env": [f"MODE={os.getenv('MODE', 'production')}"],
    }

    StandaloneApplication(app, options).run()
