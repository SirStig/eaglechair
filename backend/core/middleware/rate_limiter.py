"""
Advanced Rate Limiting Middleware

Provides granular rate limiting for different endpoints and user types
Uses centralized route configuration
"""

import logging
import time
from collections import defaultdict, deque
from typing import Callable, Dict

from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from backend.core.config import settings
from backend.core.logging_config import security_logger
from backend.core.routes_config import RouteConfig

logger = logging.getLogger(__name__)


class RateLimitConfig:
    """Rate limit configuration for different endpoint types"""
    
    # Public endpoints (no auth required)
    # Increased limits to accommodate modern SPAs with parallel API calls on page load
    PUBLIC_ENDPOINTS = {
        "default": (120, 60),  # 120 requests per 60 seconds (increased for content-heavy pages)
        "/api/v1/health": (60, 60),
        "/api/v1/products": (150, 60),  # Increased for product browsing
        "/api/v1/categories": (150, 60),
        "/api/v1/subcategories": (150, 60),
        "/api/v1/families": (150, 60),
        "/api/v1/finishes": (150, 60),
        "/api/v1/upholsteries": (150, 60),
        "/api/v1/colors": (150, 60),
        "/api/v1/faqs": (100, 60),
        "/api/v1/catalogs": (50, 60),
        "/api/v1/installations": (100, 60),
        "/api/v1/contact": (30, 60),
        "/api/v1/content": (200, 60),  # Increased - multiple content endpoints called on page load
    }
    
    # Authentication endpoints
    # In DEBUG mode, limits are more lenient for development
    @staticmethod
    def get_auth_limits():
        """Get auth endpoint limits, adjusted for DEBUG mode"""
        base_limits = {
            "/api/v1/auth/register": (10, 300),  # 10 per 5 minutes
            "/api/v1/auth/login": (60, 300),  # Increased: 60 per 5 minutes (12 per minute) for production
            "/api/v1/auth/refresh": (120, 300),  # Increased for token refresh (24 per minute)
            "/api/v1/admin/login": (30, 600),  # Increased: 30 per 10 minutes
        }
        
        if settings.DEBUG:
            # In DEBUG mode, be more lenient - 10x the limits for development
            return {
                endpoint: (limit * 10, window)
                for endpoint, (limit, window) in base_limits.items()
            }
        return base_limits
    
    # This will be accessed dynamically via get_auth_limits() in _get_rate_limit
    
    # Authenticated company users
    # Increased limits for authenticated users who need to interact with the system
    COMPANY_LIMITS = {
        "default": (200, 60),  # 200 requests per minute (increased)
        "/api/v1/quotes/cart": (300, 60),  # Cart operations need higher limits
        "/api/v1/quotes/cart/items": (300, 60),  # Specific limit for cart items
        "/api/v1/quotes/cart/merge": (50, 60),  # Merge is less frequent
        "/api/v1/cart": (300, 60),  # Legacy cart path support
        "/api/v1/quotes": (100, 60),  # Quote operations
        "/api/v1/products": (300, 60),  # Product browsing while authenticated
        "/api/v1/dashboard": (150, 60),  # Dashboard with multiple widgets
    }
    
    # Admin users
    ADMIN_LIMITS = {
        "default": (500, 60),  # 500 requests per minute (high limit)
    }


class AdvancedRateLimiter(BaseHTTPMiddleware):
    """
    Advanced rate limiting with:
    - Per-endpoint limits
    - Per-user-type limits
    - Sliding window algorithm
    - Burst protection
    """
    
    def __init__(self, app, **kwargs):
        super().__init__(app)
        
        # Enable/disable rate limiting - disable if TESTING mode
        self.enabled = kwargs.get("enabled", settings.RATE_LIMIT_ENABLED) and not settings.TESTING
        
        # Tracking
        self.request_history: Dict[str, deque] = defaultdict(lambda: deque(maxlen=1000))
        self.burst_tracker: Dict[str, list] = defaultdict(list)
        
        # Burst protection - increased threshold to accommodate legitimate page loads
        # Modern SPAs make many parallel API calls (OPTIONS + GET for each endpoint)
        # A typical page load might have 10-30 parallel requests
        # In DEBUG mode, be much more lenient with burst detection
        if settings.DEBUG:
            self.burst_threshold = kwargs.get("burst_threshold", 200)  # Very high for development
            self.burst_window = kwargs.get("burst_window", 5)  # Longer window
        else:
            self.burst_threshold = kwargs.get("burst_threshold", 50)  # Production default
            self.burst_window = kwargs.get("burst_window", 3)  # 3 second window
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request with rate limiting"""
        
        # Disable rate limiting if TESTING mode is enabled
        if settings.TESTING:
            return await call_next(request)
        
        if not self.enabled:
            return await call_next(request)
        
        # Skip OPTIONS requests (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)
        
        path = request.url.path
        
        # Skip rate limiting for exempt routes
        if RouteConfig.is_rate_limit_exempt(path):
            return await call_next(request)
        
        # Get identifier (IP or user ID)
        # For auth endpoints, use endpoint-specific identifier to isolate from other traffic
        user_type = self._get_user_type(request)
        if user_type == "auth":
            # For auth endpoints, create endpoint-specific identifier
            # This prevents page browsing from counting against login attempts
            identifier = self._get_identifier(request, path_specific=True)
        else:
            identifier = self._get_identifier(request)
        
        current_time = time.time()
        
        # Get limits for this endpoint
        max_requests, window = self._get_rate_limit(path, user_type)
        
        # Check for burst
        if self._detect_burst(identifier, current_time):
            logger.warning(f"Burst detected from {identifier}")
            return self._create_rate_limit_response(0, window, "Burst traffic detected. Please slow down.")
        
        # Track request
        self.request_history[identifier].append(current_time)
        
        # Count recent requests
        recent_count = self._count_recent_requests(identifier, current_time, window)
        
        # Check if limit exceeded
        if recent_count > max_requests:
            security_logger.log_suspicious_activity(
                identifier,
                f"Rate limit exceeded on {path}",
                {"count": recent_count, "limit": max_requests, "window": window}
            )
            return self._create_rate_limit_response(
                max(0, max_requests - recent_count),
                window,
                f"Rate limit exceeded. Maximum {max_requests} requests per {window} seconds allowed."
            )
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(max_requests)
        response.headers["X-RateLimit-Remaining"] = str(max(0, max_requests - recent_count))
        response.headers["X-RateLimit-Reset"] = str(int(current_time + window))
        
        return response
    
    def _get_identifier(self, request: Request, path_specific: bool = False) -> str:
        """
        Get unique identifier for rate limiting (IP or user ID)
        
        Args:
            request: The request object
            path_specific: If True, include the path in the identifier (for endpoint-specific tracking)
        """
        client_ip = self._get_client_ip(request)
        
        # Try to get user ID from auth token (if authenticated)
        auth_header = request.headers.get("Authorization", "")
        if auth_header:
            # Use a combination of IP and auth presence
            base_identifier = f"auth:{client_ip}"
        else:
            # Fall back to IP address
            base_identifier = f"ip:{client_ip}"
        
        # For path-specific tracking (e.g., auth endpoints), include the path
        if path_specific:
            path = request.url.path
            return f"{base_identifier}:{path}"
        
        return base_identifier
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address"""
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        return request.client.host if request.client else "unknown"
    
    def _get_user_type(self, request: Request) -> str:
        """Determine user type from request"""
        path = request.url.path
        
        # Use centralized route config to determine user type
        if RouteConfig.is_admin_route(path):
            return "admin"
        
        # Check if authenticated
        if request.headers.get("Authorization"):
            return "company"
        
        # Check if auth endpoint
        if "/auth/" in path:
            return "auth"
        
        return "public"
    
    def _get_rate_limit(self, path: str, user_type: str) -> tuple[int, int]:
        """Get rate limit for specific endpoint and user type"""
        
        # Auth endpoints have strict limits
        if user_type == "auth":
            # Check specific endpoints first (longest match wins)
            # Get limits dynamically (handles DEBUG mode adjustment)
            auth_limits = RateLimitConfig.get_auth_limits()
            best_match = None
            best_length = 0
            for endpoint, (limit, window) in auth_limits.items():
                if endpoint in path and len(endpoint) > best_length:
                    best_match = (limit, window)
                    best_length = len(endpoint)
            if best_match:
                return best_match
            # Default auth limit - also adjusted for DEBUG
            default_limit = (10, 60) if not settings.DEBUG else (100, 60)
            return default_limit
        
        # Admin endpoints
        if user_type == "admin":
            best_match = None
            best_length = 0
            for endpoint, (limit, window) in RateLimitConfig.ADMIN_LIMITS.items():
                if endpoint in path and len(endpoint) > best_length:
                    best_match = (limit, window)
                    best_length = len(endpoint)
            if best_match:
                return best_match
            return RateLimitConfig.ADMIN_LIMITS["default"]
        
        # Company/authenticated endpoints - check most specific matches first
        if user_type == "company":
            # First check for exact matches
            if path in RateLimitConfig.COMPANY_LIMITS:
                return RateLimitConfig.COMPANY_LIMITS[path]
            
            # Then check prefix matches (longest first)
            sorted_endpoints = sorted(
                RateLimitConfig.COMPANY_LIMITS.items(),
                key=lambda x: len(x[0]),
                reverse=True
            )
            for endpoint, (limit, window) in sorted_endpoints:
                # Skip exact match (already checked) and "default"
                if endpoint == "default":
                    continue
                # Use prefix match for nested endpoints
                if path.startswith(endpoint):
                    return (limit, window)
            return RateLimitConfig.COMPANY_LIMITS["default"]
        
        # Public endpoints - check exact matches first, then prefix matches
        if path in RateLimitConfig.PUBLIC_ENDPOINTS:
            return RateLimitConfig.PUBLIC_ENDPOINTS[path]
        
        # Then check prefix matches (longest first)
        sorted_endpoints = sorted(
            RateLimitConfig.PUBLIC_ENDPOINTS.items(),
            key=lambda x: len(x[0]),
            reverse=True
        )
        for endpoint, (limit, window) in sorted_endpoints:
            # Skip exact match (already checked) and "default"
            if endpoint == "default":
                continue
            # Use prefix match for nested endpoints
            if path.startswith(endpoint):
                return (limit, window)
        
        return RateLimitConfig.PUBLIC_ENDPOINTS["default"]
    
    def _count_recent_requests(self, identifier: str, current_time: float, window: int) -> int:
        """Count requests within time window"""
        if identifier not in self.request_history:
            return 0
        
        cutoff_time = current_time - window
        
        # Remove old requests
        while self.request_history[identifier] and self.request_history[identifier][0] < cutoff_time:
            self.request_history[identifier].popleft()
        
        return len(self.request_history[identifier])
    
    def _detect_burst(self, identifier: str, current_time: float) -> bool:
        """Detect burst traffic (too many requests in very short time)"""
        # Add current request to burst tracker
        self.burst_tracker[identifier].append(current_time)
        
        # Clean old burst records
        cutoff = current_time - self.burst_window
        self.burst_tracker[identifier] = [
            t for t in self.burst_tracker[identifier] if t > cutoff
        ]
        
        # Check if burst threshold exceeded
        is_burst = len(self.burst_tracker[identifier]) > self.burst_threshold
        
        if is_burst:
            security_logger.log_suspicious_activity(
                identifier,
                "Burst traffic detected",
                {"burst_count": len(self.burst_tracker[identifier]), "threshold": self.burst_threshold}
            )
        
        return is_burst
    
    def _create_rate_limit_response(
        self,
        remaining: int,
        retry_after: int,
        message: str
    ) -> JSONResponse:
        """
        Create a standardized rate limit error response
        
        Args:
            remaining: Remaining requests
            retry_after: Seconds until rate limit resets
            message: Error message
            
        Returns:
            JSONResponse: Formatted rate limit response
        """
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "error": "RATE_LIMIT_EXCEEDED",
                "message": message,
                "status_code": status.HTTP_429_TOO_MANY_REQUESTS,
                "retry_after": retry_after
            },
            headers={
                "Retry-After": str(retry_after),
                "X-RateLimit-Remaining": str(remaining)
            }
        )

