"""
Route Protection Middleware

Manages public and protected routes, authentication requirements
"""

import logging
from typing import Callable, Set
from fastapi import Request, Response, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from backend.core.config import settings
from backend.core.exceptions import AuthenticationError, AuthorizationError


logger = logging.getLogger(__name__)


class RouteProtectionMiddleware(BaseHTTPMiddleware):
    """
    Route protection middleware
    
    Manages:
    - Public routes (no auth required)
    - Protected routes (auth required)
    - Admin routes (admin auth required)
    - Role-based access control
    """
    
    def __init__(self, app, **kwargs):
        super().__init__(app)
        
        # Public routes (no authentication required)
        self.public_routes: Set[str] = {
            "/",
            "/api/versions",
            "/api/v1/health",
            "/api/v1/auth/register",
            "/api/v1/auth/login",
            "/api/v1/products",
            "/api/v1/categories",
            "/api/v1/finishes",
            "/api/v1/upholsteries",
            "/api/v1/faqs",
            "/api/v1/catalogs",
            "/api/v1/installations",
            "/api/v1/contact",
            "/api/v1/legal",
            "/api/v1/team",
            "/api/v1/company-info",
            "/docs",
            "/redoc",
            "/openapi.json",
        }
        
        # Patterns for public route matching
        self.public_patterns = [
            "/api/v1/products/",
            "/api/v1/categories/",
            "/api/v1/finishes/",
            "/api/v1/upholsteries/",
            "/api/v1/faqs/",
            "/api/v1/catalogs/",
            "/api/v1/installations/",
        ]
        
        # Admin-only routes
        self.admin_routes: Set[str] = {
            "/api/v1/admin",
        }
        
        # Admin patterns
        self.admin_patterns = [
            "/api/v1/admin/",
        ]
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Check route protection before processing"""
        
        path = request.url.path
        method = request.method
        
        # Allow OPTIONS requests (CORS preflight)
        if method == "OPTIONS":
            return await call_next(request)
        
        # Check if route is public
        if self._is_public_route(path):
            return await call_next(request)
        
        # Check if route is admin-only
        if self._is_admin_route(path):
            if not self._has_admin_auth(request):
                logger.warning(f"Unauthorized admin access attempt: {path}")
                raise AuthorizationError("Admin authentication required for this endpoint")
        
        # All other routes require authentication
        if not self._has_valid_auth(request):
            logger.info(f"Unauthorized access attempt: {path}")
            raise AuthenticationError("Authentication required for this endpoint")
        
        # Process request
        response = await call_next(request)
        return response
    
    def _is_public_route(self, path: str) -> bool:
        """Check if route is public"""
        # Exact match
        if path in self.public_routes:
            return True
        
        # Pattern match
        for pattern in self.public_patterns:
            if path.startswith(pattern):
                return True
        
        return False
    
    def _is_admin_route(self, path: str) -> bool:
        """Check if route is admin-only"""
        # Exact match
        if path in self.admin_routes:
            return True
        
        # Pattern match
        for pattern in self.admin_patterns:
            if path.startswith(pattern):
                return True
        
        return False
    
    def _has_valid_auth(self, request: Request) -> bool:
        """Check if request has valid authentication"""
        # Check for Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return False
        
        # Check format (Bearer token)
        if not auth_header.startswith("Bearer "):
            return False
        
        # Token exists (actual validation happens in dependencies)
        token = auth_header.split(" ", 1)[1]
        return bool(token)
    
    def _has_admin_auth(self, request: Request) -> bool:
        """Check if request has valid admin authentication"""
        # Require both session and admin tokens
        session_token = request.headers.get("X-Session-Token")
        admin_token = request.headers.get("X-Admin-Token")
        
        return bool(session_token and admin_token)


class RoleBasedAccessControl:
    """
    Helper class for role-based access control
    """
    
    # Define role hierarchy (higher number = more permissions)
    ROLES = {
        "viewer": 1,
        "editor": 2,
        "admin": 3,
        "super_admin": 4,
    }
    
    @staticmethod
    def has_permission(user_role: str, required_role: str) -> bool:
        """
        Check if user role has required permission
        
        Args:
            user_role: User's role
            required_role: Required role for action
            
        Returns:
            bool: True if user has permission
        """
        user_level = RoleBasedAccessControl.ROLES.get(user_role, 0)
        required_level = RoleBasedAccessControl.ROLES.get(required_role, 999)
        
        return user_level >= required_level
    
    @staticmethod
    def require_role(required_role: str):
        """
        Decorator for role-based access control
        
        Usage:
            @require_role("admin")
            async def admin_only_endpoint():
                pass
        """
        def decorator(func):
            async def wrapper(*args, **kwargs):
                # Get current user role from request
                # This would be implemented based on your auth system
                user_role = kwargs.get("current_user", {}).get("role", "viewer")
                
                if not RoleBasedAccessControl.has_permission(user_role, required_role):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Requires {required_role} role or higher"
                    )
                
                return await func(*args, **kwargs)
            return wrapper
        return decorator


# HTTPException already imported at top

