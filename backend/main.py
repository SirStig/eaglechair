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

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import HTMLResponse

from backend.core.config import settings
from backend.core.middleware import setup_middleware
from backend.core.logging_config import init_logging
from backend.core.error_handlers import register_exception_handlers
from backend.database.base import init_db, close_db
from backend.api.v1 import router as v1_router
from backend.api import versioning


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
        logger.info("✅ Database initialized")
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
    
    # TODO: Initialize Redis cache connection
    # TODO: Initialize any other services
    
    logger.info(f"🎯 API v1 available at: {settings.API_V1_PREFIX}")
    logger.info("✨ EagleChair API is ready!")
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down EagleChair API...")
    
    try:
        await close_db()
        logger.info("✅ Database connections closed")
    except Exception as e:
        logger.error(f"❌ Error closing database: {e}")
    
    # TODO: Close Redis cache connection
    # TODO: Close any other services
    
    logger.info("👋 EagleChair API shutdown complete")


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    description=settings.APP_DESCRIPTION,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# Register exception handlers
register_exception_handlers(app)

# Setup all middleware
setup_middleware(app)

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


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def root():
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
    
    uvicorn.run(
        "backend.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.RELOAD and settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )
