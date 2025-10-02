"""
Admin Security Middleware

Enhanced security for admin endpoints with IP whitelisting and strict validation
"""

import logging
import time
from typing import Callable, Set
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from backend.core.config import settings
from backend.core.exceptions import (
    AdminAccessDeniedError,
    IPNotWhitelistedError,
    AuthenticationError
)
from backend.core.logging_config import security_logger


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
        self.admin_paths = kwargs.get("admin_paths", ["/api/v1/admin", "/admin"])
        self.require_ip_whitelist = kwargs.get("require_ip_whitelist", False)
        self.global_whitelist: Set[str] = set(kwargs.get("global_whitelist", []))
        
        # Tracking
        self.admin_activity = []
        self.suspicious_admin_attempts = {}
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process admin requests with enhanced security"""
        
        path = request.url.path
        
        # Check if this is an admin endpoint
        if not self._is_admin_endpoint(path):
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
                raise IPNotWhitelistedError()
        
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
            raise AuthenticationError("Admin authentication requires both session and admin tokens")
        
        # Additional security headers validation
        if not self._validate_security_headers(request):
            security_logger.log_suspicious_activity(
                client_ip,
                "Invalid admin security headers",
                {"path": path, "user_agent": request.headers.get("User-Agent")}
            )
            raise AdminAccessDeniedError(reason="invalid security headers")
        
        # Log admin activity
        self._log_admin_activity(request, client_ip)
        
        # Process request
        try:
            response = await call_next(request)
            
            # Add admin-specific security headers
            response.headers["X-Admin-Request"] = "true"
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            
            return response
            
        except Exception as e:
            logger.error(f"Error processing admin request from {client_ip}: {str(e)}")
            raise
    
    def _is_admin_endpoint(self, path: str) -> bool:
        """Check if path is an admin endpoint"""
        return any(admin_path in path for admin_path in self.admin_paths)
    
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
        
        # Reject requests with suspicious patterns
        suspicious_agents = ["curl", "wget", "python-requests", "postman"]
        if settings.is_production:
            for agent in suspicious_agents:
                if agent.lower() in user_agent.lower():
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


# Import time for timestamps
import time

