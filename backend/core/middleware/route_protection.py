"""
Route Protection Middleware

Manages public and protected routes, authentication requirements
Uses centralized route configuration
"""

import logging
from typing import Callable
from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from backend.core.config import settings
from backend.core.routes_config import RouteConfig, RouteAccessLevel


logger = logging.getLogger(__name__)


class RouteProtectionMiddleware(BaseHTTPMiddleware):
    """
    Route protection middleware
    
    Uses centralized RouteConfig for all route access decisions.
    Returns clean JSON error responses instead of raising exceptions.
    
    Manages:
    - Public routes (no auth required)
    - Protected routes (auth required)
    - Admin routes (admin auth required)
    """
    
    def __init__(self, app, **kwargs):
        super().__init__(app)
        logger.info("[INIT] Route protection middleware initialized with centralized config")
    
    async def dispatch(self, request: Request, call_next: Callable) -> JSONResponse:
        """Check route protection before processing"""
        
        path = request.url.path
        method = request.method
        
        # Allow OPTIONS requests (CORS preflight)
        if method == "OPTIONS":
            return await call_next(request)
        
        # Get required access level for this route
        access_level = RouteConfig.get_route_access_level(path)
        
        # Public routes - no auth required
        if access_level == RouteAccessLevel.PUBLIC:
            return await call_next(request)
        
        # Admin routes - require admin authentication
        if access_level == RouteAccessLevel.ADMIN:
            if not self._has_admin_auth(request):
                logger.warning(
                    f"Unauthorized admin access attempt",
                    extra={"path": path, "method": method, "ip": request.client.host if request.client else "unknown"}
                )
                return self._create_error_response(
                    status_code=status.HTTP_403_FORBIDDEN,
                    error="ADMIN_ACCESS_REQUIRED",
                    message="This endpoint requires administrator authentication."
                )
        
        # Authenticated routes - require user authentication
        elif access_level == RouteAccessLevel.AUTHENTICATED:
            if not self._has_valid_auth(request):
                # For /auth/me, 401 is expected when checking auth status - don't log as warning
                if path == "/api/v1/auth/me":
                    logger.debug(
                        f"Auth check - no valid session",
                        extra={"path": path, "method": method, "ip": request.client.host if request.client else "unknown"}
                    )
                else:
                    logger.info(
                        f"Unauthorized access attempt",
                        extra={"path": path, "method": method, "ip": request.client.host if request.client else "unknown"}
                    )
                return self._create_error_response(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    error="AUTHENTICATION_REQUIRED",
                    message="Authentication required. Please log in to access this endpoint."
                )
        
        # Process request
        response = await call_next(request)
        return response
    
    def _has_valid_auth(self, request: Request) -> bool:
        """
        Check if request has valid authentication
        
        Args:
            request: FastAPI request object
            
        Returns:
            bool: True if request has valid auth token
        """
        # Check for access_token cookie first (preferred)
        if request.cookies.get("access_token"):
            return True
        
        # Fallback to Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return False
        
        # Check format (Bearer token)
        if not auth_header.startswith("Bearer "):
            return False
        
        # Token exists (actual validation happens in dependencies)
        token = auth_header.split(" ", 1)[1] if " " in auth_header else ""
        return bool(token)
    
    def _has_admin_auth(self, request: Request) -> bool:
        """
        Check if request has valid admin authentication
        
        Args:
            request: FastAPI request object
            
        Returns:
            bool: True if request has valid admin tokens
        """
        # Check cookies first (preferred), then headers (fallback)
        session_token = request.cookies.get("session_token") or request.headers.get("X-Session-Token")
        admin_token = request.cookies.get("admin_token") or request.headers.get("X-Admin-Token")
        
        return bool(session_token and admin_token)
    
    def _create_error_response(
        self,
        status_code: int,
        error: str,
        message: str
    ) -> JSONResponse:
        """
        Create a standardized error response
        
        Args:
            status_code: HTTP status code
            error: Error code
            message: Human-readable error message
            
        Returns:
            JSONResponse: Formatted error response
        """
        return JSONResponse(
            status_code=status_code,
            content={
                "error": error,
                "message": message,
                "status_code": status_code
            }
        )


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

