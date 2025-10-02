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
# Import setup_middleware as it was moved to middleware.py in core
# For backward compatibility, we still reference it from the middleware module
import sys
import os

# Temporarily add parent directory to path to import setup_middleware
parent_dir = os.path.dirname(os.path.dirname(__file__))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

try:
    from backend.core.middleware import setup_middleware  # This will come from middleware.py
except ImportError:
    # Fallback: it must be in the core folder
    pass

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
    "setup_middleware",
]

