"""
Advanced Rate Limiting Middleware

Provides granular rate limiting for different endpoints and user types
"""

import time
import logging
from typing import Callable, Dict, Optional
from collections import defaultdict, deque
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from backend.core.config import settings
from backend.core.exceptions import RateLimitExceededError
from backend.core.logging_config import security_logger


logger = logging.getLogger(__name__)


class RateLimitConfig:
    """Rate limit configuration for different endpoint types"""
    
    # Public endpoints (no auth required)
    PUBLIC_ENDPOINTS = {
        "default": (30, 60),  # 30 requests per 60 seconds
        "/api/v1/health": (60, 60),
        "/api/v1/products": (100, 60),
        "/api/v1/categories": (100, 60),
        "/api/v1/faqs": (50, 60),
        "/api/v1/catalogs": (30, 60),
        "/api/v1/installations": (50, 60),
        "/api/v1/contact": (20, 60),
    }
    
    # Authentication endpoints
    AUTH_ENDPOINTS = {
        "/api/v1/auth/register": (5, 300),  # 5 per 5 minutes
        "/api/v1/auth/login": (10, 300),  # 10 per 5 minutes
        "/api/v1/auth/refresh": (20, 300),
        "/api/v1/admin/login": (5, 600),  # 5 per 10 minutes (strict for admin)
    }
    
    # Authenticated company users
    COMPANY_LIMITS = {
        "default": (100, 60),  # 100 requests per minute
        "/api/v1/cart": (200, 60),
        "/api/v1/quotes": (50, 60),
        "/api/v1/products": (200, 60),
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
        
        # Enable/disable rate limiting
        self.enabled = kwargs.get("enabled", settings.RATE_LIMIT_ENABLED)
        
        # Tracking
        self.request_history: Dict[str, deque] = defaultdict(lambda: deque(maxlen=1000))
        self.burst_tracker: Dict[str, list] = defaultdict(list)
        
        # Burst protection (10 requests within 1 second = burst)
        self.burst_threshold = kwargs.get("burst_threshold", 10)
        self.burst_window = kwargs.get("burst_window", 1)
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request with rate limiting"""
        
        if not self.enabled:
            return await call_next(request)
        
        # Get identifier (IP or user ID)
        identifier = self._get_identifier(request)
        current_time = time.time()
        path = request.url.path
        
        # Determine user type and get limits
        user_type = self._get_user_type(request)
        max_requests, window = self._get_rate_limit(path, user_type)
        
        # Check for burst
        if self._detect_burst(identifier, current_time):
            logger.warning(f"Burst detected from {identifier}")
            return self._rate_limit_response(0, window)
        
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
            raise RateLimitExceededError(retry_after=window)
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(max_requests)
        response.headers["X-RateLimit-Remaining"] = str(max(0, max_requests - recent_count))
        response.headers["X-RateLimit-Reset"] = str(int(current_time + window))
        
        return response
    
    def _get_identifier(self, request: Request) -> str:
        """Get unique identifier for rate limiting (IP or user ID)"""
        # Try to get user ID from auth token (if authenticated)
        auth_header = request.headers.get("Authorization", "")
        if auth_header:
            # Extract user info from token (simplified - use actual token parsing)
            # For now, use a combination of IP and auth presence
            client_ip = self._get_client_ip(request)
            return f"auth:{client_ip}"
        
        # Fall back to IP address
        return f"ip:{self._get_client_ip(request)}"
    
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
        
        # Check if admin endpoint
        if "/admin/" in path:
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
            for endpoint, (limit, window) in RateLimitConfig.AUTH_ENDPOINTS.items():
                if endpoint in path:
                    return (limit, window)
            return (10, 60)  # Default auth limit
        
        # Admin endpoints
        if user_type == "admin":
            for endpoint, (limit, window) in RateLimitConfig.ADMIN_LIMITS.items():
                if endpoint in path:
                    return (limit, window)
            return RateLimitConfig.ADMIN_LIMITS["default"]
        
        # Company/authenticated endpoints
        if user_type == "company":
            for endpoint, (limit, window) in RateLimitConfig.COMPANY_LIMITS.items():
                if endpoint in path:
                    return (limit, window)
            return RateLimitConfig.COMPANY_LIMITS["default"]
        
        # Public endpoints
        for endpoint, (limit, window) in RateLimitConfig.PUBLIC_ENDPOINTS.items():
            if endpoint in path:
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

