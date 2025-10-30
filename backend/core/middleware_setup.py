"""
EagleChair Middleware Setup Module

Configures and sets up all middleware for the application
"""

import logging
import time
from typing import Callable

from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware

from backend.core.config import settings
from backend.core.exceptions import BaseAppException
from backend.core.logging_config import request_logger, security_logger
from backend.core.middleware.admin_security import AdminSecurityMiddleware
from backend.core.middleware.ddos_protection import DDoSProtectionMiddleware
from backend.core.middleware.rate_limiter import AdvancedRateLimiter
from backend.core.middleware.request_validator import RequestValidationMiddleware
from backend.core.middleware.route_protection import RouteProtectionMiddleware
from backend.core.middleware.session_manager import SessionManager

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add security headers to all responses
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline';"
        )
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        
        return response


class HTTPSRedirectMiddleware(BaseHTTPMiddleware):
    """
    Middleware to redirect HTTP to HTTPS in production
    
    NOTE: Disabled when behind reverse proxy (DreamHost) - proxy handles HTTPS
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip HTTPS redirect when behind reverse proxy
        # The proxy (Apache/Nginx) already handles HTTPS termination
        if settings.HTTPS_REDIRECT and not settings.DEBUG and not settings.PROXY_HEADERS:
            if request.url.scheme == "http":
                url = request.url.replace(scheme="https")
                return JSONResponse(
                    status_code=status.HTTP_301_MOVED_PERMANENTLY,
                    content={"detail": "Redirecting to HTTPS"},
                    headers={"Location": str(url)}
                )
        
        return await call_next(request)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to log all requests with timing information
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        from backend.core.logging_config import request_logger
        
        start_time = time.time()
        client_ip = request.client.host if request.client else "unknown"
        
        # Process request
        try:
            response = await call_next(request)
            
            # Calculate processing time
            process_time = time.time() - start_time
            response.headers["X-Process-Time"] = str(process_time)
            
            # Log using request logger
            request_logger.log_request(
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                duration=process_time,
                ip_address=client_ip,
                request_id=response.headers.get("X-Request-ID")
            )
            
            return response
            
        except Exception as exc:
            # Log failed requests
            process_time = time.time() - start_time
            logger.error(
                f"Request failed: {request.method} {request.url.path}",
                exc_info=True,
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "duration": process_time,
                    "ip": client_ip
                }
            )
            raise


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """
    Middleware for global error handling
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        try:
            return await call_next(request)
        except Exception as exc:
            logger.exception(
                f"Unhandled exception: {str(exc)}",
                extra={
                    "path": request.url.path,
                    "method": request.method,
                }
            )
            
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "detail": "Internal server error" if not settings.DEBUG else str(exc),
                    "type": "internal_error"
                }
            )


# Rate limiter instance
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{settings.RATE_LIMIT_PER_MINUTE}/minute"] if settings.RATE_LIMIT_ENABLED else []
)


def setup_middleware(app):
    """
    Configure all middleware for the application
    
    Middleware order (IMPORTANT - reverse order of execution):
    1. Error handling (last to catch all errors)
    2. Logging
    3. Security headers
    4. HTTPS redirect
    5. Route protection
    6. Admin security
    7. Session management
    8. Request validation
    9. Rate limiting
    10. DDoS protection (first line of defense)
    11. CORS
    12. Compression
    
    Args:
        app: FastAPI application instance
    """
    
    logger.info("Configuring middleware stack...")
    
    # ========================================================================
    # Layer 1: Performance & Optimization
    # ========================================================================
    
    # GZip compression for performance
    if settings.ENABLE_COMPRESSION:
        app.add_middleware(GZipMiddleware, minimum_size=1000)
        logger.info("[OK] GZip compression enabled")
    
    # CORS (must be early to handle preflight requests)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
        allow_methods=settings.CORS_ALLOW_METHODS,
        allow_headers=settings.CORS_ALLOW_HEADERS,
    )
    logger.info("[OK] CORS configured")
    
    # ========================================================================
    # Layer 2: Security & Attack Prevention
    # ========================================================================
    
    # DDoS Protection (first line of defense)
    app.add_middleware(
        DDoSProtectionMiddleware,
        window_size=60,
        max_requests=settings.RATE_LIMIT_PER_MINUTE * 2,  # Higher than rate limit
        ban_duration=300,
        suspicious_threshold=settings.RATE_LIMIT_PER_MINUTE
    )
    logger.info("[OK] DDoS protection enabled")
    
    # Advanced Rate Limiting
    app.add_middleware(
        AdvancedRateLimiter,
        enabled=settings.RATE_LIMIT_ENABLED
    )
    logger.info("[OK] Advanced rate limiting enabled")
    
    # Request Validation (size, content-type, format)
    app.add_middleware(
        RequestValidationMiddleware,
        max_body_size=10 * 1024 * 1024,  # 10MB
        max_file_size=50 * 1024 * 1024,  # 50MB
    )
    logger.info("[OK] Request validation enabled")
    
    # ========================================================================
    # Layer 3: Session & Authentication
    # ========================================================================
    
    # Session Management (for company accounts)
    app.add_middleware(
        SessionManager,
        session_timeout=3600,  # 1 hour
        validate_ip=True
    )
    logger.info("[OK] Session management enabled")
    
    # Admin Security (IP whitelisting, dual tokens)
    app.add_middleware(
        AdminSecurityMiddleware,
        require_ip_whitelist=False,  # Set to True in production
        global_whitelist=[]  # Add admin IPs here
    )
    logger.info("[OK] Admin security enabled")
    
    # Route Protection (public/protected routes)
    app.add_middleware(RouteProtectionMiddleware)
    logger.info("[OK] Route protection enabled")
    
    # ========================================================================
    # Layer 4: Security Headers & Redirects
    # ========================================================================
    
    # HTTPS redirect (in production)
    if settings.HTTPS_REDIRECT and not settings.DEBUG:
        app.add_middleware(HTTPSRedirectMiddleware)
        logger.info("[OK] HTTPS redirect enabled")
    
    # Security headers
    app.add_middleware(SecurityHeadersMiddleware)
    logger.info("[OK] Security headers enabled")
    
    # ========================================================================
    # Layer 5: Logging & Error Handling
    # ========================================================================
    
    # Request logging
    app.add_middleware(RequestLoggingMiddleware)
    logger.info("[OK] Request logging enabled")
    
    # Error handling (outermost layer)
    app.add_middleware(ErrorHandlingMiddleware)
    logger.info("[OK] Error handling enabled")
    
    # ========================================================================
    # Additional Configuration
    # ========================================================================
    
    # SlowAPI rate limiting (legacy, keeping for specific endpoints)
    if settings.RATE_LIMIT_ENABLED:
        app.state.limiter = limiter
        app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    
    logger.info("="*60)
    logger.info("[OK] All middleware configured successfully!")
    logger.info("="*60)

