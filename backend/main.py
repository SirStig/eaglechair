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
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

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
    
    try:
        await init_db()
        logger.info("[OK] Database initialized")
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
    
    # Export CMS content to static files on startup
    try:
        from backend.database.base import AsyncSessionLocal
        from backend.services.cms_admin_service import CMSAdminService
        
        # Use AsyncSessionLocal directly instead of get_db()
        async with AsyncSessionLocal() as db:
            try:
                logger.info("📦 Exporting CMS content to static files...")
                success = await CMSAdminService.export_all_static_content(db)
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
    
    # Warm up product search cache for fast fuzzy search (non-blocking)
    # Run in background to avoid blocking server startup if Redis is unavailable
    async def warm_cache_background():
        """Background task to warm up cache without blocking server startup"""
        try:
            from backend.services.cache_service import cache_service
            
            # Quick health check to see if Redis is available
            if not cache_service.enabled or not cache_service.cache:
                logger.info("[SKIP] Cache not enabled, skipping warm-up")
                return
            
            # Try a simple cache operation with short timeout to check connectivity
            try:
                await asyncio.wait_for(
                    cache_service.cache.get("__health_check__"),
                    timeout=2.0
                )
                logger.info("✅ Redis is available")
            except (asyncio.TimeoutError, Exception) as e:
                logger.warning(f"[WARN] Redis not available, skipping cache warm-up: {e}")
                return
            
            # Redis is available, proceed with warm-up
            from backend.database.base import AsyncSessionLocal
            from backend.services.product_service import ProductService
            
            async with AsyncSessionLocal() as db:
                try:
                    logger.info("🔍 Warming product search cache...")
                    # Add timeout to prevent indefinite blocking
                    indexed_count = await asyncio.wait_for(
                        ProductService.warm_search_cache(db),
                        timeout=30.0  # 30 second timeout
                    )
                    await db.commit()
                    logger.info(f"[OK] Product search cache ready: {indexed_count} products indexed")
                except asyncio.TimeoutError:
                    await db.rollback()
                    logger.warning("[WARN] Cache warm-up timed out after 30 seconds, continuing startup")
                except Exception as e:
                    await db.rollback()
                    logger.warning(f"[WARN] Product search cache warm-up failed: {e}")
        except Exception as e:
            logger.warning(f"[WARN] Cache warm-up background task failed: {e}")
    
    # Start warm-up as background task (non-blocking)
    asyncio.create_task(warm_cache_background())
    logger.info("[OK] Cache warm-up started in background")
    
    # Run cleanup of expired temporary catalog data on startup
    try:
        from backend.services.cleanup_service import run_cleanup
        
        logger.info("🧹 Running cleanup of expired temporary catalog data...")
        asyncio.create_task(asyncio.to_thread(run_cleanup))
        # Don't wait for cleanup to finish - let it run in background
        logger.info("[OK] Cleanup task started in background")
    except Exception as e:
        logger.warning(f"[WARN] Cleanup task failed to start: {e}")
    
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
    openapi_url="/openapi.json" if settings.DEBUG else None,  # OpenAPI JSON - dev mode only
    lifespan=lifespan,
    # Trust proxy headers when behind reverse proxy (DreamHost)
    root_path=settings.ROOT_PATH if hasattr(settings, 'ROOT_PATH') else "",
)

# Configure proxy headers for production (DreamHost reverse proxy)
if not settings.DEBUG:
    from fastapi.middleware.trustedhost import TrustedHostMiddleware
    # Trust the reverse proxy
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=settings.ALLOWED_HOSTS if hasattr(settings, 'ALLOWED_HOSTS') else ["*"]
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
    if request.method == "OPTIONS" and request.url.path.startswith("/api/v1/cms-admin/"):
        from fastapi.responses import Response
        return Response(
            status_code=200,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Authorization, X-Session-Token, X-Admin-Token, Content-Type",
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Max-Age": "86400",
            }
        )
    return await call_next(request)

# Include API versioning routes (at root /api level)
app.include_router(
    versioning.router,
    prefix="/api",
    tags=["API Versioning"]
)

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

frontend_dist_path = Path(__file__).parent.parent / "frontend" / "dist"

if frontend_dist_path.exists() and (frontend_dist_path / "index.html").exists():
    logger.info(f"[OK] Frontend dist found at {frontend_dist_path}")
    
    # Mount static assets
    if (frontend_dist_path / "assets").exists():
        app.mount("/assets", StaticFiles(directory=str(frontend_dist_path / "assets")), name="assets")
    
    # Mount data directory if it exists (for contentData.js)
    if (frontend_dist_path / "data").exists():
        # Special handling for contentData.js - disable caching
        from fastapi.responses import FileResponse
        
        @app.get("/data/contentData.js", response_class=FileResponse, include_in_schema=False)
        async def serve_content_data():
            """Serve contentData.js with no-cache headers (dynamic CMS content)"""
            content_data_file = frontend_dist_path / "data" / "contentData.js"
            if content_data_file.exists():
                return FileResponse(
                    content_data_file,
                    media_type="application/javascript",
                    headers={
                        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
                        "Pragma": "no-cache",
                        "Expires": "0",
                    }
                )
            return {"detail": "Content data not found"}, 404
        
        # Mount other data files with normal caching
        app.mount("/data", StaticFiles(directory=str(frontend_dist_path / "data")), name="data")
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
    return f"""
    <!DOCTYPE html>
    <html>
        <head>
            <title>{settings.APP_NAME}</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                * {{
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }}
                
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }}
                
                .container {{
                    background: white;
                    border-radius: 20px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    max-width: 800px;
                    width: 100%;
                    padding: 40px;
                }}
                
                .header {{
                    text-align: center;
                    margin-bottom: 40px;
                }}
                
                .logo {{
                    font-size: 4rem;
                    margin-bottom: 10px;
                }}
                
                h1 {{
                    color: #1a202c;
                    font-size: 2.5rem;
                    margin-bottom: 10px;
                }}
                
                .subtitle {{
                    color: #718096;
                    font-size: 1.1rem;
                }}
                
                .version {{
                    display: inline-block;
                    background: #667eea;
                    color: white;
                    padding: 5px 15px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    margin: 10px 0;
                }}
                
                .features {{
                    background: #f7fafc;
                    border-radius: 10px;
                    padding: 30px;
                    margin: 30px 0;
                }}
                
                .features h2 {{
                    color: #2d3748;
                    margin-bottom: 20px;
                    font-size: 1.5rem;
                }}
                
                .feature-grid {{
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                }}
                
                .feature-item {{
                    background: white;
                    padding: 15px;
                    border-radius: 8px;
                    border-left: 4px solid #667eea;
                }}
                
                .feature-item strong {{
                    color: #2d3748;
                    display: block;
                    margin-bottom: 5px;
                }}
                
                .feature-item span {{
                    color: #718096;
                    font-size: 0.9rem;
                }}
                
                .links {{
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                    margin-top: 30px;
                }}
                
                .link-card {{
                    display: block;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    text-decoration: none;
                    padding: 20px;
                    border-radius: 10px;
                    text-align: center;
                    transition: transform 0.2s, box-shadow 0.2s;
                }}
                
                .link-card:hover {{
                    transform: translateY(-5px);
                    box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
                }}
                
                .link-card .icon {{
                    font-size: 2rem;
                    margin-bottom: 10px;
                }}
                
                .link-card .title {{
                    font-weight: bold;
                    font-size: 1.1rem;
                    margin-bottom: 5px;
                }}
                
                .link-card .desc {{
                    font-size: 0.9rem;
                    opacity: 0.9;
                }}
                
                .footer {{
                    text-align: center;
                    margin-top: 30px;
                    color: #718096;
                    font-size: 0.9rem;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🪑</div>
                    <h1>EagleChair API</h1>
                    <p class="subtitle">Premium Chair Company Backend</p>
                    <span class="version">v{settings.APP_VERSION}</span>
                </div>
                
                <div class="features">
                    <h2>🚀 Features</h2>
                    <div class="feature-grid">
                        <div class="feature-item">
                            <strong>🔐 Security</strong>
                            <span>JWT, HTTPS, Rate Limiting</span>
                        </div>
                        <div class="feature-item">
                            <strong>⚡ Performance</strong>
                            <span>Async, Caching, Compression</span>
                        </div>
                        <div class="feature-item">
                            <strong>🔄 Versioned APIs</strong>
                            <span>v1, v2 Support</span>
                        </div>
                        <div class="feature-item">
                            <strong>🧪 Tested</strong>
                            <span>Pytest, Factories, Coverage</span>
                        </div>
                        <div class="feature-item">
                            <strong>🗄️ PostgreSQL</strong>
                            <span>Async SQLAlchemy</span>
                        </div>
                        <div class="feature-item">
                            <strong>🔍 Fuzzy Search</strong>
                            <span>Advanced Product Search</span>
                        </div>
                    </div>
                </div>
                
                <div class="links">
                    <a href="/docs" class="link-card">
                        <div class="icon">📚</div>
                        <div class="title">API Documentation</div>
                        <div class="desc">Swagger UI</div>
                    </a>
                    <a href="/redoc" class="link-card">
                        <div class="icon">📖</div>
                        <div class="title">ReDoc</div>
                        <div class="desc">Alternative Docs</div>
                    </a>
                    <a href="{settings.API_V1_PREFIX}/health" class="link-card">
                        <div class="icon">💚</div>
                        <div class="title">Health Check</div>
                        <div class="desc">System Status</div>
                    </a>
                </div>
                
                <div class="footer">
                    <p>Built with FastAPI, PostgreSQL, and ❤️</p>
                    <p>Mode: {'🔧 Development' if settings.DEBUG else '🚀 Production'}</p>
                </div>
            </div>
        </body>
    </html>
    """


if __name__ == "__main__":
    import uvicorn
    
    # Configure uvicorn for reverse proxy support
    uvicorn_config = {
        "app": "backend.main:app",
        "host": settings.HOST,
        "port": settings.PORT,
        "reload": settings.RELOAD and settings.DEBUG,
        "log_level": settings.LOG_LEVEL.lower(),
    }
    
    # Add proxy headers support for production (DreamHost VPS)
    if settings.PROXY_HEADERS:
        uvicorn_config.update({
            "proxy_headers": True,
            "forwarded_allow_ips": settings.FORWARDED_ALLOW_IPS,
        })
    
    uvicorn.run(**uvicorn_config)
