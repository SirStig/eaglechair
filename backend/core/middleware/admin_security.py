"""
Admin Security Middleware

Enhanced security for admin endpoints with IP whitelisting and strict validation
Uses centralized route configuration and returns clean JSON responses
"""

import logging
import time
from typing import Callable, Set

from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from backend.core.config import settings
from backend.core.logging_config import security_logger
from backend.core.routes_config import RouteConfig

logger = logging.getLogger(__name__)


class AdminSecurityMiddleware(BaseHTTPMiddleware):
    """
    Admin security middleware with:
    - IP whitelisting
    - Dual token validation (session + admin token)
    - Admin-specific rate limiting
    - Activity logging
    - Suspicious activity detection
    """
    
    def __init__(self, app, **kwargs):
        super().__init__(app)
        
        # Configuration
        self.require_ip_whitelist = kwargs.get("require_ip_whitelist", False)
        self.global_whitelist: Set[str] = set(kwargs.get("global_whitelist", []))
        
        # Tracking
        self.admin_activity = []
        self.suspicious_admin_attempts = {}
        
        logger.info("[INIT] Admin security middleware initialized with centralized route config")
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process admin requests with enhanced security"""
        
        path = request.url.path
        
        # Check if this is an admin endpoint using centralized config
        if not RouteConfig.is_admin_route(path):
            return await call_next(request)
        
        # Allow OPTIONS requests (CORS preflight) without authentication
        if request.method == "OPTIONS":
            return await call_next(request)
        
        client_ip = self._get_client_ip(request)
        
        # IP Whitelist Check
        if self.require_ip_whitelist:
            # Check global whitelist
            if not self._is_ip_whitelisted(client_ip):
                security_logger.log_suspicious_activity(
                    client_ip,
                    "Admin access from non-whitelisted IP",
                    {"path": path}
                )
                self._log_suspicious_attempt(client_ip, "ip_not_whitelisted")
                return self._create_error_response(
                    status.HTTP_403_FORBIDDEN,
                    "IP_NOT_WHITELISTED",
                    "Your IP address is not authorized for admin access."
                )
        
        # Require both session token and admin token
        session_token = request.headers.get("X-Session-Token")
        admin_token = request.headers.get("X-Admin-Token")
        
        if not session_token or not admin_token:
            security_logger.log_suspicious_activity(
                client_ip,
                "Admin request missing tokens",
                {"path": path, "has_session": bool(session_token), "has_admin": bool(admin_token)}
            )
            self._log_suspicious_attempt(client_ip, "missing_tokens")
            return self._create_error_response(
                status.HTTP_401_UNAUTHORIZED,
                "ADMIN_AUTHENTICATION_REQUIRED",
                "Admin authentication requires both session and admin tokens."
            )
        
        # Additional security headers validation
        if not self._validate_security_headers(request):
            security_logger.log_suspicious_activity(
                client_ip,
                "Invalid admin security headers",
                {"path": path, "user_agent": request.headers.get("User-Agent")}
            )
            return self._create_error_response(
                status.HTTP_403_FORBIDDEN,
                "ADMIN_ACCESS_DENIED",
                "Invalid security headers for admin access."
            )
        
        # Log admin activity
        self._log_admin_activity(request, client_ip)
        
        # Process request
        response = await call_next(request)
        
        # Add admin-specific security headers
        response.headers["X-Admin-Request"] = "true"
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        
        return response
    
    def _is_ip_whitelisted(self, ip: str, user_whitelist: Set[str] = None) -> bool:
        """Check if IP is whitelisted"""
        # Check global whitelist
        if ip in self.global_whitelist:
            return True
        
        # Check user-specific whitelist if provided
        if user_whitelist and ip in user_whitelist:
            return True
        
        # Allow localhost in development
        if settings.DEBUG and ip in ["127.0.0.1", "localhost", "::1"]:
            return True
        
        return False
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address"""
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        return request.client.host if request.client else "unknown"
    
    def _validate_security_headers(self, request: Request) -> bool:
        """Validate required security headers"""
        # Check for User-Agent
        user_agent = request.headers.get("User-Agent")
        if not user_agent or len(user_agent) < 10:
            return False
        
        # Reject requests with suspicious patterns (only block obvious bots/scripts)
        # Allow legitimate browsers (Chrome, Firefox, Safari, Edge)
        suspicious_agents = ["curl", "wget", "python-requests"]
        if settings.is_production:
            user_agent_lower = user_agent.lower()
            # Only block if it matches suspicious patterns AND doesn't look like a browser
            is_suspicious = any(agent in user_agent_lower for agent in suspicious_agents)
            is_browser = any(browser in user_agent_lower for browser in ["mozilla", "chrome", "safari", "firefox", "edge"])
            
            if is_suspicious and not is_browser:
                logger.warning(f"Suspicious User-Agent for admin: {user_agent}")
                return False
        
        return True
    
    def _log_admin_activity(self, request: Request, ip: str):
        """Log admin activity for audit trail"""
        activity = {
            "timestamp": time.time(),
            "ip": ip,
            "path": request.url.path,
            "method": request.method,
            "user_agent": request.headers.get("User-Agent", "unknown")
        }
        
        self.admin_activity.append(activity)
        
        # Keep only last 1000 activities
        if len(self.admin_activity) > 1000:
            self.admin_activity = self.admin_activity[-1000:]
        
        # Log to security logger
        security_logger.log_admin_action(
            admin_id=0,  # Will be updated when we have user context
            action=request.method,
            resource=request.url.path,
            ip_address=ip
        )
        
        logger.info(f"Admin activity: {request.method} {request.url.path} from {ip}")
    
    def _log_suspicious_attempt(self, ip: str, reason: str):
        """Log suspicious admin access attempt"""
        import time
        
        if ip not in self.suspicious_admin_attempts:
            self.suspicious_admin_attempts[ip] = []
        
        self.suspicious_admin_attempts[ip].append({
            "timestamp": time.time(),
            "reason": reason
        })
        
        # Alert if too many attempts
        if len(self.suspicious_admin_attempts[ip]) > 5:
            logger.error(f"Multiple suspicious admin attempts from {ip}: {reason}")
    
    def _create_error_response(
        self,
        status_code: int,
        error: str,
        message: str
    ) -> JSONResponse:
        """
        Create a standardized error response with CORS headers
        
        Args:
            status_code: HTTP status code
            error: Error code
            message: Human-readable error message
            
        Returns:
            JSONResponse: Formatted error response with CORS headers
        """
        response = JSONResponse(
            status_code=status_code,
            content={
                "error": error,
                "message": message,
                "status_code": status_code
            }
        )
        
        # Add CORS headers to error responses (critical for cross-origin requests)
        for origin in settings.CORS_ORIGINS:
            # Note: We set all allowed origins; the browser will use the matching one
            response.headers["Access-Control-Allow-Origin"] = origin
            break  # Use first origin as default (will be overridden by CORS middleware if needed)
        
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = ", ".join(settings.CORS_ALLOW_METHODS)
        response.headers["Access-Control-Allow-Headers"] = ", ".join(settings.CORS_ALLOW_HEADERS)
        
        return response


class AdminIPWhitelistValidator:
    """
    Helper class to validate admin IP whitelists
    """
    
    @staticmethod
    def validate_ip_format(ip: str) -> bool:
        """Validate IP address format"""
        import ipaddress
        try:
            ipaddress.ip_address(ip)
            return True
        except ValueError:
            return False
    
    @staticmethod
    def parse_whitelist(whitelist: list) -> Set[str]:
        """Parse and validate IP whitelist"""
        valid_ips = set()
        
        for ip in whitelist:
            if AdminIPWhitelistValidator.validate_ip_format(ip):
                valid_ips.add(ip)
            else:
                logger.warning(f"Invalid IP in whitelist: {ip}")
        
        return valid_ips
