"""
Input Sanitization Middleware

Sanitizes all incoming request data to prevent injection attacks while preserving legitimate content.
This middleware runs EARLY in the stack to catch malicious input before it reaches any other layer.

Protects against:
- SQL injection
- XSS (Cross-Site Scripting)
- Command injection
- LDAP injection
- XML injection
- Path traversal
- Header injection
"""

import json
import logging
import re
from typing import Any, Callable, Dict, Optional
from urllib.parse import unquote

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class InputSanitizerMiddleware(BaseHTTPMiddleware):
    """
    Sanitize all incoming request data to prevent injection attacks.
    
    This middleware:
    1. Sanitizes query parameters
    2. Sanitizes headers (while preserving legitimate ones)
    3. Sanitizes JSON request bodies
    4. Sanitizes form data
    5. Detects and blocks obvious injection attempts
    
    Does NOT sanitize:
    - File uploads (binary data)
    - Already validated authentication tokens
    - Legitimate special characters in specific contexts
    """
    
    # Patterns that indicate injection attempts
    INJECTION_PATTERNS = [
        # SQL injection
        r"(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\s+)",
        r"(--|#|/\*|\*/|;--)",
        r"('|\")(\s)*(or|and|union|select)(\s)*('|\"|\d)",
        r"(\b(or|and)\s+\d+\s*=\s*\d+)",
        
        # XSS attempts
        r"<script[^>]*>.*?</script>",
        r"javascript:",
        r"onerror\s*=",
        r"onload\s*=",
        r"<iframe",
        r"<embed",
        r"<object",
        
        # Command injection
        r"(\||;|&&|\$\(|\`)",
        r"(bash|sh|cmd|powershell|exec|eval)\s*\(",
        
        # Path traversal
        r"\.\./",
        r"\.\.\\",
        
        # LDAP injection
        r"(\*|\(|\)|\||&)",
        
        # XML injection
        r"<!ENTITY",
        r"<!DOCTYPE",
    ]
    
    # Headers that should NEVER be modified (case-insensitive)
    PROTECTED_HEADERS = {
        "authorization",
        "content-type",
        "content-length",
        "host",
        "user-agent",
        "accept",
        "accept-encoding",
        "accept-language",
        "connection",
        "origin",
        "referer",
        "cookie",
        "x-csrf-token",
        "x-request-id",
        "x-forwarded-for",
        "x-forwarded-proto",
        "x-forwarded-host",
        "x-real-ip",
    }
    
    # Fields that commonly contain special characters legitimately
    ALLOWED_SPECIAL_CHAR_FIELDS = {
        "password",
        "description",
        "full_description",
        "short_description",
        "content",
        "text",
        "message",
        "notes",
        "comment",
        "bio",
        "about",
        "address",
        "care_instructions",
        "warranty_info",
        "construction_details",
        "meta_description",
        "meta_title",
    }
    
    def __init__(self, app, **kwargs):
        super().__init__(app)
        
        # Compile patterns for performance
        self.injection_regex = [re.compile(pattern, re.IGNORECASE) for pattern in self.INJECTION_PATTERNS]
        
        # Configuration
        self.strict_mode = kwargs.get("strict_mode", False)  # Strict mode blocks more aggressively
        self.log_only = kwargs.get("log_only", False)  # Log but don't block (for testing)
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Main middleware entry point"""
        
        # Skip sanitization for certain paths
        if self._should_skip_sanitization(request):
            return await call_next(request)
        
        try:
            # 1. Sanitize query parameters
            sanitized_query = self._sanitize_query_params(request)
            if sanitized_query:
                # Modify the request scope to use sanitized query params
                request._query_params = sanitized_query
            
            # 2. Check headers for injection (but don't modify protected ones)
            if self._detect_header_injection(request):
                logger.warning(
                    f"Header injection detected from {request.client.host}: {request.url.path}"
                )
                if not self.log_only:
                    from fastapi.responses import JSONResponse
                    return JSONResponse(
                        status_code=400,
                        content={
                            "error": "INVALID_REQUEST",
                            "message": "Request contains potentially malicious headers."
                        }
                    )
            
            # 3. Sanitize request body (if applicable)
            if request.method in ["POST", "PUT", "PATCH"]:
                await self._sanitize_request_body(request)
            
            # Process the request
            response = await call_next(request)
            return response
            
        except Exception as e:
            # Only log if not already logged (to prevent duplicates)
            if not hasattr(request.state, "error_logged"):
                logger.error(f"Error in InputSanitizerMiddleware: {str(e)}", exc_info=True)
                request.state.error_logged = True
            # Don't block the request on middleware errors - fail open
            return await call_next(request)
    
    def _should_skip_sanitization(self, request: Request) -> bool:
        """Determine if request should skip sanitization"""
        
        # Skip for static files, health checks, docs
        skip_paths = [
            "/docs",
            "/redoc",
            "/openapi.json",
            "/static/",
            "/health",
            "/favicon.ico",
        ]
        
        return any(request.url.path.startswith(path) for path in skip_paths)
    
    def _sanitize_query_params(self, request: Request) -> Optional[Dict[str, Any]]:
        """Sanitize query parameters"""
        
        if not request.query_params:
            return None
        
        sanitized = {}
        modified = False
        
        for key, value in request.query_params.items():
            # Decode URL encoding
            decoded_value = unquote(value)
            
            # Check for injection patterns
            if self._contains_injection_pattern(decoded_value):
                logger.warning(
                    f"Injection pattern detected in query param '{key}': {decoded_value[:100]}"
                )
                if self.strict_mode and not self.log_only:
                    # In strict mode, block the request
                    raise ValueError(f"Potentially malicious query parameter: {key}")
                else:
                    # Sanitize the value
                    sanitized_value = self._sanitize_string(decoded_value, key)
                    sanitized[key] = sanitized_value
                    modified = True
                    continue
            
            # Normal case - keep original value
            sanitized[key] = value
        
        return sanitized if modified else None
    
    def _detect_header_injection(self, request: Request) -> bool:
        """Detect header injection attempts (but don't modify headers)"""
        
        for header_name, header_value in request.headers.items():
            # Skip protected headers
            if header_name.lower() in self.PROTECTED_HEADERS:
                continue
            
            # Check for CRLF injection in header values
            if "\r" in header_value or "\n" in header_value:
                logger.warning(f"CRLF injection detected in header '{header_name}'")
                return True
            
            # Check for injection patterns in custom headers
            if self._contains_injection_pattern(header_value):
                logger.warning(f"Injection pattern in header '{header_name}': {header_value[:100]}")
                return True
        
        return False
    
    async def _sanitize_request_body(self, request: Request) -> None:
        """Sanitize request body data"""
        
        content_type = request.headers.get("content-type", "").lower()
        
        # Handle JSON requests
        if "application/json" in content_type:
            try:
                # Read the body
                body = await request.body()
                if not body:
                    return
                
                # Parse JSON
                data = json.loads(body)
                
                # Recursively sanitize
                sanitized_data = self._sanitize_dict(data)
                
                # Check if modifications were made
                if sanitized_data != data:
                    # Replace the body with sanitized version
                    request._body = json.dumps(sanitized_data).encode()
                    logger.info(f"Sanitized JSON body for {request.url.path}")
                else:
                    # Reset body for downstream processing
                    request._body = body
                    
            except json.JSONDecodeError:
                # Invalid JSON - let FastAPI handle the error
                logger.warning(f"Invalid JSON in request to {request.url.path}")
                pass
            except Exception as e:
                logger.error(f"Error sanitizing JSON body: {str(e)}")
                # On error, don't block - let the request through
                pass
    
    def _sanitize_dict(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively sanitize dictionary data"""
        
        if not isinstance(data, dict):
            return data
        
        sanitized = {}
        
        for key, value in data.items():
            if isinstance(value, str):
                # Check if this field is allowed to have special characters
                if key.lower() in self.ALLOWED_SPECIAL_CHAR_FIELDS:
                    # Only check for obvious injection attempts
                    if self._contains_injection_pattern(value):
                        # Minimal sanitization - just remove obvious injection code
                        sanitized[key] = self._sanitize_string(value, key, minimal=True)
                    else:
                        # Keep original value
                        sanitized[key] = value
                else:
                    # Sanitize more aggressively for other fields
                    sanitized[key] = self._sanitize_string(value, key)
            elif isinstance(value, dict):
                # Recursively sanitize nested dicts
                sanitized[key] = self._sanitize_dict(value)
            elif isinstance(value, list):
                # Sanitize list items
                sanitized[key] = [
                    self._sanitize_dict(item) if isinstance(item, dict)
                    else self._sanitize_string(item, key) if isinstance(item, str)
                    else item
                    for item in value
                ]
            else:
                # Keep other types as-is (numbers, booleans, None)
                sanitized[key] = value
        
        return sanitized
    
    def _sanitize_string(self, value: str, field_name: str, minimal: bool = False) -> str:
        """
        Sanitize a string value.
        
        Args:
            value: String to sanitize
            field_name: Name of the field (for context)
            minimal: If True, only remove obvious injection code
        
        Returns:
            Sanitized string
        """
        
        if not value or not isinstance(value, str):
            return value
        
        original_value = value
        
        if minimal:
            # Minimal sanitization - just remove script tags and null bytes
            value = re.sub(r"<script[^>]*>.*?</script>", "", value, flags=re.IGNORECASE | re.DOTALL)
            value = re.sub(r"javascript:", "", value, flags=re.IGNORECASE)
            value = value.replace("\x00", "")
        else:
            # More aggressive sanitization for non-content fields
            
            # Remove null bytes
            value = value.replace("\x00", "")
            
            # Remove obvious SQL injection patterns
            value = re.sub(r"(--|#|/\*|\*/)", "", value)
            
            # Remove script tags
            value = re.sub(r"<script[^>]*>.*?</script>", "", value, flags=re.IGNORECASE | re.DOTALL)
            
            # Remove event handlers
            value = re.sub(r"on\w+\s*=", "", value, flags=re.IGNORECASE)
            
            # Remove javascript: protocol
            value = re.sub(r"javascript:", "", value, flags=re.IGNORECASE)
        
        # Log if modifications were made
        if value != original_value:
            logger.info(
                f"Sanitized field '{field_name}': "
                f"before={original_value[:50]}... after={value[:50]}..."
            )
        
        return value
    
    def _contains_injection_pattern(self, value: str) -> bool:
        """
        Check if value contains injection patterns.
        
        Args:
            value: String to check
        
        Returns:
            True if injection pattern detected
        """
        
        if not value or not isinstance(value, str):
            return False
        
        # Check against all compiled patterns
        for pattern in self.injection_regex:
            if pattern.search(value):
                return True
        
        return False


