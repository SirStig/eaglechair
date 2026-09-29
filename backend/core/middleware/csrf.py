"""
CSRF Protection Middleware (Origin/Referer verification)

Browser sessions authenticate with httpOnly cookies, which the browser attaches
automatically - including to requests forged by other sites. For state-changing
requests that carry an auth cookie, require the request's Origin (or, if
absent, Referer) to be one of our trusted origins:

- an entry in settings.CORS_ORIGINS (the frontend origins), or
- the API's own host.

Requests without any auth cookie (e.g. login/register, or API clients using
the Authorization header) are not affected.
"""

import logging
from typing import Callable, Optional
from urllib.parse import urlsplit

from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from backend.core.config import settings
from backend.core.logging_config import security_logger
from backend.core.security import AUTH_COOKIE_NAMES

logger = logging.getLogger(__name__)

UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
_DEFAULT_PORTS = {"http": 80, "https": 443}


def normalize_origin(value: Optional[str]) -> Optional[str]:
    """
    Reduce an Origin or URL (e.g. a Referer) to "scheme://host[:port]".

    Returns None for missing, opaque ("null") or malformed values.
    """
    if not value or value == "null":
        return None
    try:
        parts = urlsplit(value.strip())
        scheme = (parts.scheme or "").lower()
        host = (parts.hostname or "").lower()
        port = parts.port
    except ValueError:
        return None
    if scheme not in _DEFAULT_PORTS or not host:
        return None
    if port and port != _DEFAULT_PORTS[scheme]:
        return f"{scheme}://{host}:{port}"
    return f"{scheme}://{host}"


def _netloc(origin: str) -> str:
    return origin.split("://", 1)[1]


class CSRFOriginMiddleware(BaseHTTPMiddleware):
    """Reject cross-site state-changing requests authenticated by cookies"""

    def __init__(self, app, path_prefix: str = "/api"):
        super().__init__(app)
        self.path_prefix = path_prefix

    @staticmethod
    def _trusted_origins() -> set[str]:
        return {o for o in (normalize_origin(v) for v in settings.CORS_ORIGINS) if o}

    @staticmethod
    def _own_hosts(request: Request) -> set[str]:
        hosts = set()
        host = request.headers.get("host")
        if host:
            hosts.add(host.lower())
        if settings.PROXY_HEADERS:
            forwarded_host = request.headers.get("x-forwarded-host")
            if forwarded_host:
                hosts.add(forwarded_host.split(",")[0].strip().lower())
        # Normalize away default ports ("api.example.com:443" == "api.example.com")
        normalized = set()
        for h in hosts:
            for suffix in (":80", ":443"):
                if h.endswith(suffix):
                    h = h[: -len(suffix)]
                    break
            normalized.add(h)
        return normalized

    def is_trusted(self, origin: str, request: Request) -> bool:
        if origin in self._trusted_origins():
            return True
        return _netloc(origin) in self._own_hosts(request)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if (
            request.method in UNSAFE_METHODS
            and request.url.path.startswith(self.path_prefix)
            and any(request.cookies.get(name) for name in AUTH_COOKIE_NAMES)
        ):
            raw_origin = request.headers.get("origin")
            source = raw_origin if raw_origin else request.headers.get("referer")
            origin = normalize_origin(source)
            if not origin or not self.is_trusted(origin, request):
                client_ip = request.client.host if request.client else "unknown"
                logger.warning(
                    f"CSRF check failed: {request.method} {request.url.path} "
                    f"origin={raw_origin!r} referer={request.headers.get('referer')!r} ip={client_ip}"
                )
                security_logger.log_suspicious_activity(
                    client_ip,
                    "Cross-site request with auth cookies rejected",
                    {"path": request.url.path, "method": request.method, "origin": source},
                )
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={
                        "error": "CSRF_VALIDATION_FAILED",
                        "message": "Request origin is not allowed.",
                        "status_code": status.HTTP_403_FORBIDDEN,
                    },
                )
        return await call_next(request)
