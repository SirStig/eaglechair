"""
EagleChair Middleware Package

Comprehensive middleware for security, rate limiting, and request management
"""

from backend.core.middleware.ddos_protection import DDoSProtectionMiddleware
from backend.core.middleware.rate_limiter import AdvancedRateLimiter, RateLimitConfig
from backend.core.middleware.request_validator import (
    RequestValidationMiddleware,
    PayloadSanitizerMiddleware
)
from backend.core.middleware.session_manager import SessionManager, Session
from backend.core.middleware.admin_security import (
    AdminSecurityMiddleware,
    AdminIPWhitelistValidator
)
from backend.core.middleware.route_protection import (
    RouteProtectionMiddleware,
    RoleBasedAccessControl
)

__all__ = [
    "DDoSProtectionMiddleware",
    "AdvancedRateLimiter",
    "RateLimitConfig",
    "RequestValidationMiddleware",
    "PayloadSanitizerMiddleware",
    "SessionManager",
    "Session",
    "AdminSecurityMiddleware",
    "AdminIPWhitelistValidator",
    "RouteProtectionMiddleware",
    "RoleBasedAccessControl",
]

