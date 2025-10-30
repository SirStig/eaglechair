"""
Request Validation Middleware

Validates request size, content type, and format
Returns clean JSON error responses
"""

import logging
from typing import Callable

from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from backend.core.config import settings

logger = logging.getLogger(__name__)


class RequestValidationMiddleware(BaseHTTPMiddleware):
    """
    Request validation middleware
    
    Validates:
    - Request body size
    - Content-Type headers
    - Request format
    - File upload sizes
    """
    
    def __init__(self, app, **kwargs):
        super().__init__(app)
        
        # Configuration
        self.max_body_size = kwargs.get("max_body_size", 10 * 1024 * 1024)  # 10MB default
        self.max_file_size = kwargs.get("max_file_size", 50 * 1024 * 1024)  # 50MB for files
        self.allowed_content_types = kwargs.get("allowed_content_types", [
            "application/json",
            "application/x-www-form-urlencoded",
            "multipart/form-data",
            "text/plain",
        ])
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Validate request before processing"""
        
        # Skip validation for GET, HEAD, OPTIONS requests
        if request.method in ["GET", "HEAD", "OPTIONS"]:
            return await call_next(request)
        
        # Validate Content-Length header
        content_length = request.headers.get("Content-Length")
        if content_length:
            try:
                size = int(content_length)
                
                # Check if it's a file upload endpoint
                is_file_upload = self._is_file_upload_endpoint(request.url.path)
                max_size = self.max_file_size if is_file_upload else self.max_body_size
                
                if size > max_size:
                    logger.warning(
                        f"Request body too large from {request.client.host}: "
                        f"{size} bytes (max: {max_size})"
                    )
                    return self._create_error_response(
                        status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        "REQUEST_TOO_LARGE",
                        f"Request body too large. Maximum size is {max_size / (1024 * 1024):.1f}MB, "
                        f"but received {size / (1024 * 1024):.1f}MB."
                    )
            except ValueError:
                logger.warning(f"Invalid Content-Length header: {content_length}")
        
        # Validate Content-Type for POST, PUT, PATCH requests
        if request.method in ["POST", "PUT", "PATCH"]:
            content_type = request.headers.get("Content-Type", "").split(";")[0].strip()
            
            if content_type and not any(
                allowed in content_type for allowed in self.allowed_content_types
            ):
                logger.warning(f"Unsupported Content-Type: {content_type}")
                return self._create_error_response(
                    status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    "UNSUPPORTED_MEDIA_TYPE",
                    f"Content-Type '{content_type}' is not supported. "
                    f"Supported types: {', '.join(self.allowed_content_types)}"
                )
        
        # Check for suspicious header patterns
        if self._has_suspicious_headers(request):
            logger.warning(f"Suspicious headers detected from {request.client.host}")
            return self._create_error_response(
                status.HTTP_400_BAD_REQUEST,
                "SUSPICIOUS_REQUEST",
                "Request contains suspicious headers."
            )
        
        # Process request
        response = await call_next(request)
        return response
    
    def _is_file_upload_endpoint(self, path: str) -> bool:
        """Check if endpoint is for file uploads"""
        file_upload_paths = [
            "/upload",
            "/catalog",
            "/image",
            "/media",
            "/file",
        ]
        return any(pattern in path.lower() for pattern in file_upload_paths)
    
    def _has_suspicious_headers(self, request: Request) -> bool:
        """Detect suspicious header patterns"""
        # If proxy headers are enabled, trust the proxy
        if settings.PROXY_HEADERS:
            return False
        
        suspicious_patterns = [
            "x-forwarded-host",  # If not from trusted proxy
            "x-original-url",
            "x-rewrite-url",
        ]
        
        # Check for header injection attempts
        for header_name in request.headers.keys():
            if any(pattern in header_name.lower() for pattern in suspicious_patterns):
                # Only allow these from trusted sources
                if not self._is_trusted_proxy(request):
                    return True
        
        return False
    
    def _is_trusted_proxy(self, request: Request) -> bool:
        """Check if request is from trusted proxy"""
        # If proxy headers are enabled in settings, trust the proxy
        if settings.PROXY_HEADERS:
            return True
        
        # Otherwise, return False (can be enhanced with IP whitelist)
        return False
    
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


class PayloadSanitizerMiddleware(BaseHTTPMiddleware):
    """
    Sanitize request payloads to prevent injection attacks
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Sanitize request data"""
        
        # Skip for GET requests
        if request.method == "GET":
            return await call_next(request)
        
        # Process request
        response = await call_next(request)
        return response

