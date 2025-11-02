"""
Centralized Route Configuration

Single source of truth for route protection and access control
"""

from enum import Enum
from typing import Dict, List, Set


class RouteAccessLevel(str, Enum):
    """Route access levels"""
    PUBLIC = "public"          # No authentication required
    AUTHENTICATED = "authenticated"  # Any authenticated user
    ADMIN = "admin"           # Admin authentication required
    SUPER_ADMIN = "super_admin"  # Super admin only


class RouteConfig:
    """
    Centralized route configuration for all middleware
    
    This provides a single source of truth for:
    - Which routes are public
    - Which routes require authentication
    - Which routes require admin access
    - Which routes should bypass certain middleware
    """
    
    # ===== PUBLIC ROUTES =====
    # Routes accessible without authentication
    PUBLIC_ROUTES: Set[str] = {
        # Root and health
        "/",
        "/health",
        "/api/versions",
        "/api/v1",
        "/api/v1/health",
        
        # Documentation
        "/docs",
        "/redoc",
        "/openapi.json",
        "/api-docs",
        
        # Static assets
        "/favicon.ico",
        "/robots.txt",
        
        # Authentication (public endpoints)
        "/api/v1/auth/register",
        "/api/v1/auth/login",
        "/api/v1/auth/admin/login",
        "/api/v1/auth/refresh",
        "/api/v1/auth/verify-email",
        "/api/v1/auth/resend-verification",
        "/api/v1/auth/password/reset-request",
        "/api/v1/auth/password/reset",
        
        # Note: /api/v1/auth/me is intentionally NOT public - it requires authentication
        # It's used to check if user is authenticated, 401 is expected response when not logged in
        
        # Public product/catalog endpoints (exact matches)
        "/api/v1/products",
        "/api/v1/categories",
        "/api/v1/families",
        "/api/v1/subcategories",
        "/api/v1/finishes",
        "/api/v1/upholsteries",
        "/api/v1/colors",
        
        # Content routes - Traditional content (content.py)
        "/api/v1/content/faq/categories",
        "/api/v1/content/faq",
        "/api/v1/content/team",
        "/api/v1/content/about",
        "/api/v1/content/contact/locations",
        "/api/v1/content/catalogs",
        "/api/v1/content/installations",  # Installation guides from content.py
        "/api/v1/content/feedback",
        
        # Content routes - CMS content (cms_content.py)
        "/api/v1/content/site-settings",
        "/api/v1/content/hero-slides",
        "/api/v1/content/features",
        "/api/v1/content/client-logos",
        "/api/v1/content/company-values",
        "/api/v1/content/company-milestones",
        "/api/v1/content/sales-reps",
        "/api/v1/content/featured-products",
        "/api/v1/content/legal-documents",
        "/api/v1/content/warranties",
        "/api/v1/content/shipping-policies",
        "/api/v1/content/contentData.js",
    }
    
    # Public route patterns (startswith matching)
    PUBLIC_PATTERNS: List[str] = [
        # Product catalog routes
        "/api/v1/products/",
        "/api/v1/categories/",
        "/api/v1/families/",
        "/api/v1/subcategories/",
        "/api/v1/finishes/",
        "/api/v1/upholsteries/",
        "/api/v1/colors/",
        
        # Content routes with path parameters (traditional content)
        "/api/v1/content/faq/",
        "/api/v1/content/team/",
        "/api/v1/content/contact/locations/",
        "/api/v1/content/catalogs/",
        "/api/v1/content/installations/",  # Matches both installation guides and gallery
        
        # Content routes with path parameters (CMS content)
        "/api/v1/content/hero-slides/",
        "/api/v1/content/features/",
        "/api/v1/content/client-logos/",
        "/api/v1/content/company-values/",
        "/api/v1/content/company-milestones/",
        "/api/v1/content/sales-reps/",
        "/api/v1/content/installations/",  # Installation gallery
        "/api/v1/content/page-content/",
        
        # Static assets
        "/static/",
        "/assets/",
        "/uploads/",
    ]
    
    # ===== ADMIN ROUTES =====
    # Routes requiring admin authentication
    ADMIN_ROUTES: Set[str] = {
        "/api/v1/admin",
        "/api/v1/cms-admin",
    }
    
    # Admin route patterns
    ADMIN_PATTERNS: List[str] = [
        "/api/v1/admin/",      # All admin routes (products, companies, quotes, etc.)
        "/api/v1/cms-admin/",   # CMS admin routes (content management with static export)
    ]
    
    # ===== AUTHENTICATED ROUTES =====
    # All other routes require authentication
    # (enforced by default if not in public or admin lists)
    
    # ===== RATE LIMIT EXEMPTIONS =====
    # Routes that bypass rate limiting
    RATE_LIMIT_EXEMPT: Set[str] = {
        "/health",
        "/api/v1/health",
        "/docs",
        "/redoc",
        "/openapi.json",
        "/favicon.ico",
    }
    
    # ===== CSRF EXEMPTIONS =====
    # Routes that bypass CSRF protection (e.g., API endpoints using bearer tokens)
    CSRF_EXEMPT: Set[str] = {
        "/api/v1/auth/login",
        "/api/v1/auth/register",
    }
    
    # CSRF patterns
    CSRF_EXEMPT_PATTERNS: List[str] = [
        "/api/",  # All API routes use bearer tokens, not CSRF tokens
    ]
    
    # ===== LOGGING EXEMPTIONS =====
    # Routes to exclude from detailed request logging (reduce noise)
    LOGGING_EXEMPT: Set[str] = {
        "/favicon.ico",
        "/health",
        "/api/v1/health",
    }
    
    @classmethod
    def is_public_route(cls, path: str) -> bool:
        """
        Check if a route is public (no auth required)
        
        Args:
            path: Request path
            
        Returns:
            bool: True if route is public
        """
        # Exact match
        if path in cls.PUBLIC_ROUTES:
            return True
        
        # Remove trailing slash for comparison
        path_normalized = path.rstrip('/')
        if path_normalized in cls.PUBLIC_ROUTES:
            return True
        
        # Pattern match
        for pattern in cls.PUBLIC_PATTERNS:
            if path.startswith(pattern):
                return True
        
        return False
    
    @classmethod
    def is_admin_route(cls, path: str) -> bool:
        """
        Check if a route requires admin authentication
        
        Args:
            path: Request path
            
        Returns:
            bool: True if route requires admin auth
        """
        # Exact match
        if path in cls.ADMIN_ROUTES:
            return True
        
        # Pattern match
        for pattern in cls.ADMIN_PATTERNS:
            if path.startswith(pattern):
                return True
        
        return False
    
    @classmethod
    def is_authenticated_route(cls, path: str) -> bool:
        """
        Check if a route requires authentication
        
        Args:
            path: Request path
            
        Returns:
            bool: True if route requires auth
        """
        # If not public, it requires authentication
        return not cls.is_public_route(path)
    
    @classmethod
    def is_rate_limit_exempt(cls, path: str) -> bool:
        """Check if route is exempt from rate limiting"""
        return path in cls.RATE_LIMIT_EXEMPT
    
    @classmethod
    def is_csrf_exempt(cls, path: str) -> bool:
        """Check if route is exempt from CSRF protection"""
        if path in cls.CSRF_EXEMPT:
            return True
        
        for pattern in cls.CSRF_EXEMPT_PATTERNS:
            if path.startswith(pattern):
                return True
        
        return False
    
    @classmethod
    def is_logging_exempt(cls, path: str) -> bool:
        """Check if route should skip detailed logging"""
        return path in cls.LOGGING_EXEMPT
    
    @classmethod
    def get_route_access_level(cls, path: str) -> RouteAccessLevel:
        """
        Get the access level required for a route
        
        Args:
            path: Request path
            
        Returns:
            RouteAccessLevel: Required access level
        """
        if cls.is_admin_route(path):
            return RouteAccessLevel.ADMIN
        elif cls.is_public_route(path):
            return RouteAccessLevel.PUBLIC
        # SPA routing: treat any non-API, non-admin path as public (will be served by React)
        elif not path.startswith("/api/") and not path.startswith("/admin/"):
            return RouteAccessLevel.PUBLIC
        else:
            return RouteAccessLevel.AUTHENTICATED
    
    @classmethod
    def get_all_public_routes(cls) -> Dict[str, List[str]]:
        """
        Get all public routes for documentation/debugging
        
        Returns:
            dict: Public routes organized by category
        """
        return {
            "exact_matches": sorted(list(cls.PUBLIC_ROUTES)),
            "patterns": sorted(cls.PUBLIC_PATTERNS),
        }
    
    @classmethod
    def get_all_admin_routes(cls) -> Dict[str, List[str]]:
        """
        Get all admin routes for documentation/debugging
        
        Returns:
            dict: Admin routes organized by category
        """
        return {
            "exact_matches": sorted(list(cls.ADMIN_ROUTES)),
            "patterns": sorted(cls.ADMIN_PATTERNS),
        }


# Convenience functions for backward compatibility
def is_public_route(path: str) -> bool:
    """Check if route is public"""
    return RouteConfig.is_public_route(path)


def is_admin_route(path: str) -> bool:
    """Check if route requires admin auth"""
    return RouteConfig.is_admin_route(path)


def is_authenticated_route(path: str) -> bool:
    """Check if route requires authentication"""
    return RouteConfig.is_authenticated_route(path)

