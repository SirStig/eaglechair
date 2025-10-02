"""
Session Management Middleware

Handles session management for company accounts
"""

import time
import uuid
import logging
from typing import Callable, Dict, Optional
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from backend.core.config import settings


logger = logging.getLogger(__name__)


class Session:
    """Session data structure"""
    
    def __init__(self, session_id: str, company_id: int, ip_address: str):
        self.session_id = session_id
        self.company_id = company_id
        self.ip_address = ip_address
        self.created_at = time.time()
        self.last_activity = time.time()
        self.data: Dict = {}
    
    def is_expired(self, timeout: int) -> bool:
        """Check if session is expired"""
        return (time.time() - self.last_activity) > timeout
    
    def update_activity(self):
        """Update last activity timestamp"""
        self.last_activity = time.time()
    
    def to_dict(self) -> dict:
        """Convert session to dictionary"""
        return {
            "session_id": self.session_id,
            "company_id": self.company_id,
            "ip_address": self.ip_address,
            "created_at": self.created_at,
            "last_activity": self.last_activity,
            "data": self.data
        }


class SessionManager(BaseHTTPMiddleware):
    """
    Session management for company accounts
    
    Features:
    - Session creation and validation
    - Session timeout
    - IP address validation
    - Session data storage
    """
    
    def __init__(self, app, **kwargs):
        super().__init__(app)
        
        # Configuration
        self.session_timeout = kwargs.get("session_timeout", 3600)  # 1 hour default
        self.session_cookie_name = kwargs.get("cookie_name", "eaglechair_session")
        self.validate_ip = kwargs.get("validate_ip", True)
        
        # Session storage (use Redis in production)
        self.sessions: Dict[str, Session] = {}
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request with session management"""
        
        # Try to get session from cookie or header
        session_id = self._get_session_id(request)
        session = None
        
        if session_id:
            session = self._get_session(session_id)
            
            if session:
                # Validate session
                if session.is_expired(self.session_timeout):
                    logger.info(f"Session expired: {session_id}")
                    self._delete_session(session_id)
                    session = None
                elif self.validate_ip:
                    client_ip = self._get_client_ip(request)
                    if session.ip_address != client_ip:
                        logger.warning(
                            f"IP mismatch for session {session_id}: "
                            f"{session.ip_address} != {client_ip}"
                        )
                        self._delete_session(session_id)
                        session = None
                else:
                    # Valid session - update activity
                    session.update_activity()
        
        # Attach session to request state
        request.state.session = session
        request.state.session_manager = self
        
        # Process request
        response = await call_next(request)
        
        # Update session cookie if session exists
        if session:
            response.set_cookie(
                key=self.session_cookie_name,
                value=session.session_id,
                httponly=True,
                secure=not settings.DEBUG,  # HTTPS only in production
                samesite="lax",
                max_age=self.session_timeout
            )
        
        return response
    
    def create_session(self, company_id: int, ip_address: str) -> Session:
        """Create a new session"""
        session_id = str(uuid.uuid4())
        session = Session(session_id, company_id, ip_address)
        self.sessions[session_id] = session
        
        logger.info(f"Created session {session_id} for company {company_id}")
        return session
    
    def _get_session_id(self, request: Request) -> Optional[str]:
        """Extract session ID from request"""
        # Try cookie first
        session_id = request.cookies.get(self.session_cookie_name)
        if session_id:
            return session_id
        
        # Try header
        session_id = request.headers.get("X-Session-ID")
        return session_id
    
    def _get_session(self, session_id: str) -> Optional[Session]:
        """Get session by ID"""
        return self.sessions.get(session_id)
    
    def _delete_session(self, session_id: str):
        """Delete a session"""
        if session_id in self.sessions:
            del self.sessions[session_id]
            logger.info(f"Deleted session: {session_id}")
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address"""
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        return request.client.host if request.client else "unknown"
    
    def cleanup_expired_sessions(self):
        """Remove expired sessions (call periodically)"""
        current_time = time.time()
        expired = [
            sid for sid, session in self.sessions.items()
            if (current_time - session.last_activity) > self.session_timeout
        ]
        
        for session_id in expired:
            self._delete_session(session_id)
        
        if expired:
            logger.info(f"Cleaned up {len(expired)} expired sessions")

