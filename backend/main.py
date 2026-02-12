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
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan events

    Startup: Initialize database, cache, etc.
    Shutdown: Close connections gracefully
    """
    # Startup
    logger.info("🚀 Starting EagleChair API...")

    # Try to coordinate startup tasks across workers using Redis (if available)
    # This prevents multiple workers from running DB init, CMS export, etc. simultaneously
    try:
        from backend.services.cache_service import cache_service
        import redis.asyncio as redis
        import uuid

        # Unique ID for this worker
        worker_id = str(uuid.uuid4())
        lock_acquired = False

        # Create a temporary Redis connection for the lock
        # We can't rely on cache_service.cache being ready yet
        redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

        try:
            # Try to acquire a lock for startup tasks
            # Set a timeout of 60 seconds for the lock
            lock_key = "eaglechair:startup_lock"

            # Simple distributed lock
            # We use set(nx=True) to ensure only one worker gets the lock
            if await redis_client.set(lock_key, worker_id, nx=True, ex=60):
                lock_acquired = True
                logger.info(f"[WORKER] Acquired startup lock (ID: {worker_id})")

                # --- START CRITICAL SECTION ---

                try:
                    await init_db()
                    logger.info("[OK] Database initialized")
                except Exception as e:
                    logger.error(f"❌ Database initialization failed: {e}")

                # Export CMS content to static files
                try:
                    from backend.database.base import AsyncSessionLocal
                    from backend.services.cms_admin_service import CMSAdminService

                    async with AsyncSessionLocal() as db:
                        try:
                            logger.info("📦 Exporting CMS content to static files...")
                            success = await CMSAdminService.export_all_static_content(
                                db
                            )
                            await db.commit()
                            if success:
                                logger.info("[OK] CMS content exported to frontend")
                            else:
                                logger.warning("[WARN] CMS content export had issues")
                        except Exception as e:
                            await db.rollback()
                            logger.warning(f"[WARN] Could not export CMS content: {e}")
                except Exception as e:
                    logger.warning(f"[WARN] CMS export setup failed: {e}")

                # Run cleanup of expired temporary catalog data
                try:
                    from backend.services.cleanup_service import run_cleanup

                    logger.info(
                        "🧹 Running cleanup of expired temporary catalog data..."
                    )
                    asyncio.create_task(run_cleanup())
                    logger.info("[OK] Cleanup task started in background")
                except Exception as e:
                    logger.warning(f"[WARN] Cleanup task failed to start: {e}")

                # --- END CRITICAL SECTION ---

            else:
                logger.info(
                    "[WORKER] Startup lock held by another worker - skipping one-time initialization tasks"
                )
                # Wait a bit to let the other worker finish critical DB tasks before we proceed
                # This helps avoid race conditions immediately after startup
                await asyncio.sleep(2)

        finally:
            # Release lock if we acquired it
            if lock_acquired:
                # Only delete if it's still our lock
                current_value = await redis_client.get(lock_key)
                if current_value == worker_id:
                    await redis_client.delete(lock_key)
                    logger.info(f"[WORKER] Released startup lock (ID: {worker_id})")

            await redis_client.close()

    except Exception as e:
        logger.warning(
            f"[WARN] Redis lock coordination failed, falling back to concurrent startup: {e}"
        )
        # Fallback: Run critical tasks anyway if coordination fails
        # This handles cases where Redis is down
        try:
            await init_db()
        except:
            pass

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

    logger.info(f"🎯 API v1 available at: {settings.API_V1_PREFIX}")
    logger.info("✨ EagleChair API is ready!")

    yield

    # Shutdown
    logger.info("🛑 Shutting down EagleChair API...")

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
    docs_url="/docs" if settings.DEBUG else None,  # SwaggerUI - dev mode only
    redoc_url="/redoc" if settings.DEBUG else None,  # ReDoc - dev mode only
    openapi_url="/openapi.json"
    if settings.DEBUG
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

# Mount uploads directory for user-uploaded files (images, documents, etc.)
uploads_path = Path(__file__).parent.parent / "uploads"
if uploads_path.exists():
    app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")
    logger.info("[OK] Uploads directory mounted at /uploads")
else:
    # Create uploads directory if it doesn't exist
    uploads_path.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")
    logger.info("[OK] Created and mounted uploads directory at /uploads")

# Note: /tmp directory is NOT mounted here - it's served by frontend web server
# Images are saved to FRONTEND_PATH/tmp/images/ and served via frontend

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

    # Mount data directory if it exists (for contentData.js)
    if (frontend_dist_path / "data").exists():
        # Special handling for contentData.json/js - disable caching
        from fastapi.responses import FileResponse

        @app.get(
            "/data/contentData.json",
            response_class=FileResponse,
            include_in_schema=False,
        )
        async def serve_content_data_json():
            """Serve contentData.json with no-cache headers (dynamic CMS content)"""
            content_data_file = frontend_dist_path / "data" / "contentData.json"
            if content_data_file.exists():
                return FileResponse(
                    content_data_file,
                    media_type="application/json",
                    headers={
                        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
                        "Pragma": "no-cache",
                        "Expires": "0",
                    },
                )
            return {"detail": "Content data not found"}, 404

        @app.get(
            "/data/contentData.js", response_class=FileResponse, include_in_schema=False
        )
        async def serve_content_data_js():
            """Serve contentData.js with no-cache headers (legacy format, backward compatibility)"""
            content_data_file = frontend_dist_path / "data" / "contentData.js"
            if content_data_file.exists():
                return FileResponse(
                    content_data_file,
                    media_type="application/javascript",
                    headers={
                        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
                        "Pragma": "no-cache",
                        "Expires": "0",
                    },
                )
            return {"detail": "Content data not found"}, 404

        # Mount other data files with normal caching
        app.mount(
            "/data",
            StaticFiles(directory=str(frontend_dist_path / "data")),
            name="data",
        )
        logger.info("[OK] Data directory mounted at /data")

    # Override root to serve frontend
    @app.get("/", response_class=HTMLResponse, include_in_schema=False)
    async def root():
        """Serve React SPA frontend"""
        try:
            with open(frontend_dist_path / "index.html", "r", encoding="utf-8") as f:
                return f.read()
        except Exception as e:
            logger.error(f"Error reading index.html: {e}")
            return "<h1>Frontend not available</h1>"

    @app.get("/{full_path:path}", response_class=HTMLResponse, include_in_schema=False)
    async def serve_spa(full_path: str):
        """Serve SPA for all non-API routes (enables client-side routing)"""
        # Don't intercept API routes
        if full_path.startswith("api/"):
            return {"detail": "Not found"}, 404
        # Only block docs routes in production (when they're disabled)
        if not settings.DEBUG and full_path in ["docs", "redoc", "openapi.json"]:
            return {"detail": "Not found"}, 404

        # Serve index.html for SPA routing
        try:
            with open(frontend_dist_path / "index.html", "r", encoding="utf-8") as f:
                return f.read()
        except Exception as e:
            logger.error(f"Error serving index.html: {e}")
            return "<h1>Frontend not available</h1>"

else:
    logger.warning(f"Frontend dist NOT found at {frontend_dist_path}")
    logger.warning("Build frontend with: cd frontend && npm run build")


@app.get("/api-docs", response_class=HTMLResponse, include_in_schema=False)
async def root_old():
    """
    Welcome page for EagleChair API
    """
    from backend.templates.api_docs import get_api_docs_html

    return get_api_docs_html()


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
