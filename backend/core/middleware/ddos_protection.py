"""
DDoS Protection and Attack Prevention Middleware

Protects against DDoS attacks, suspicious patterns, and malicious requests
"""

import time
import logging
from typing import Callable, Dict, Set
from collections import defaultdict, deque
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from backend.core.config import settings
from backend.core.exceptions import IPBannedError, RateLimitExceededError, SuspiciousActivityError
from backend.core.logging_config import security_logger


logger = logging.getLogger(__name__)


class DDoSProtectionMiddleware(BaseHTTPMiddleware):
    """
    DDoS Protection Middleware
    
    Protects against:
    - Rapid-fire requests from single IP
    - Suspicious request patterns
    - Known attack signatures
    - Request flooding
    """
    
    def __init__(self, app, **kwargs):
        super().__init__(app)
        
        # Configuration
        self.window_size = kwargs.get("window_size", 60)  # Time window in seconds
        self.max_requests_per_window = kwargs.get("max_requests", 100)
        self.ban_duration = kwargs.get("ban_duration", 300)  # 5 minutes
        self.suspicious_threshold = kwargs.get("suspicious_threshold", 50)
        
        # Tracking
        self.request_counts: Dict[str, deque] = defaultdict(lambda: deque(maxlen=1000))
        self.banned_ips: Dict[str, float] = {}  # IP: ban_until_timestamp
        self.suspicious_ips: Set[str] = set()
        
        # Attack patterns
        self.attack_patterns = [
            "union select",
            "../",
            "<script",
            "javascript:",
            "eval(",
            "base64_decode",
            "cmd.exe",
            "/etc/passwd",
        ]
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request with DDoS protection"""
        
        client_ip = self._get_client_ip(request)
        current_time = time.time()
        
        # Check if IP is banned
        if self._is_banned(client_ip, current_time):
            security_logger.log_suspicious_activity(
                client_ip, 
                "Attempted access from banned IP",
                {"remaining_ban_time": int(self.banned_ips[client_ip] - current_time)}
            )
            raise IPBannedError()
        
        # Check for attack patterns in URL and headers
        if self._detect_attack_pattern(request):
            security_logger.log_suspicious_activity(
                client_ip,
                "Attack pattern detected",
                {"path": str(request.url.path), "method": request.method}
            )
            self._ban_ip(client_ip, current_time)
            raise SuspiciousActivityError()
        
        # Track request
        self.request_counts[client_ip].append(current_time)
        
        # Check request rate
        recent_requests = self._count_recent_requests(client_ip, current_time)
        
        if recent_requests > self.max_requests_per_window:
            security_logger.log_ip_banned(
                client_ip,
                f"Rate limit exceeded ({recent_requests}/{self.max_requests_per_window})",
                self.ban_duration
            )
            self._ban_ip(client_ip, current_time)
            raise RateLimitExceededError(retry_after=self.ban_duration)
        
        # Mark as suspicious if nearing limit
        if recent_requests > self.suspicious_threshold:
            self.suspicious_ips.add(client_ip)
            logger.info(f"IP marked as suspicious: {client_ip} ({recent_requests} requests)")
        
        # Process request
        try:
            response = await call_next(request)
            
            # Add security headers
            response.headers["X-RateLimit-Limit"] = str(self.max_requests_per_window)
            response.headers["X-RateLimit-Remaining"] = str(
                max(0, self.max_requests_per_window - recent_requests)
            )
            response.headers["X-RateLimit-Window"] = str(self.window_size)
            
            return response
            
        except Exception as e:
            logger.error(f"Error processing request from {client_ip}: {str(e)}")
            raise
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address"""
        # Check for proxy headers
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        return request.client.host if request.client else "unknown"
    
    def _is_banned(self, ip: str, current_time: float) -> bool:
        """Check if IP is currently banned"""
        if ip not in self.banned_ips:
            return False
        
        ban_until = self.banned_ips[ip]
        if current_time >= ban_until:
            # Ban expired
            del self.banned_ips[ip]
            if ip in self.suspicious_ips:
                self.suspicious_ips.remove(ip)
            logger.info(f"Ban expired for IP: {ip}")
            return False
        
        return True
    
    def _ban_ip(self, ip: str, current_time: float):
        """Ban an IP address"""
        self.banned_ips[ip] = current_time + self.ban_duration
        self.suspicious_ips.add(ip)
        security_logger.log_ip_banned(ip, "DDoS protection triggered", self.ban_duration)
        logger.warning(f"Banned IP: {ip} until {time.ctime(self.banned_ips[ip])}")
    
    def _count_recent_requests(self, ip: str, current_time: float) -> int:
        """Count requests from IP within time window"""
        if ip not in self.request_counts:
            return 0
        
        cutoff_time = current_time - self.window_size
        
        # Remove old requests
        while self.request_counts[ip] and self.request_counts[ip][0] < cutoff_time:
            self.request_counts[ip].popleft()
        
        return len(self.request_counts[ip])
    
    def _detect_attack_pattern(self, request: Request) -> bool:
        """Detect common attack patterns in request"""
        # Check URL path
        path = str(request.url.path).lower()
        for pattern in self.attack_patterns:
            if pattern in path:
                return True
        
        # Check query parameters
        query = str(request.url.query).lower()
        for pattern in self.attack_patterns:
            if pattern in query:
                return True
        
        # Check User-Agent for suspicious patterns
        user_agent = request.headers.get("User-Agent", "").lower()
        suspicious_agents = ["sqlmap", "nikto", "nmap", "masscan", "bot", "crawler", "spider"]
        
        # Allow legitimate bots but block attack tools
        attack_tools = ["sqlmap", "nikto", "nmap", "masscan", "metasploit", "burp"]
        for tool in attack_tools:
            if tool in user_agent:
                return True
        
        # Check for missing or suspicious User-Agent
        if not user_agent or len(user_agent) < 10:
            return True
        
        return False
    
    def cleanup_old_data(self):
        """Cleanup old tracking data (call periodically)"""
        current_time = time.time()
        
        # Remove expired bans
        expired_ips = [ip for ip, ban_time in self.banned_ips.items() if current_time >= ban_time]
        for ip in expired_ips:
            del self.banned_ips[ip]
            if ip in self.suspicious_ips:
                self.suspicious_ips.remove(ip)
        
        # Clear old request counts
        cutoff = current_time - (self.window_size * 2)
        for ip in list(self.request_counts.keys()):
            while self.request_counts[ip] and self.request_counts[ip][0] < cutoff:
                self.request_counts[ip].popleft()
            
            if not self.request_counts[ip]:
                del self.request_counts[ip]

