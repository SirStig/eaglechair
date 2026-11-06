"""Restore packed JSON and multipart writes before the rest of the app reads them."""

import logging

from starlette.responses import JSONResponse

from backend.core.request_envelope import EnvelopeError, unwrap_json_body, unwrap_multipart_body

logger = logging.getLogger(__name__)

_MUTATING = frozenset({"POST", "PUT", "PATCH"})


def _content_type(scope) -> str:
    for name, value in scope.get("headers") or []:
        if name.lower() == b"content-type":
            return value.decode("latin-1")
    return ""


def _replace_headers(scope, body: bytes, content_type: str | None):
    headers = []
    saw_length = False
    for name, value in scope.get("headers") or []:
        lower = name.lower()
        if lower == b"content-length":
            headers.append((name, str(len(body)).encode("ascii")))
            saw_length = True
        elif content_type and lower == b"content-type":
            headers.append((name, content_type.encode("latin-1")))
        else:
            headers.append((name, value))
    if not saw_length:
        headers.append((b"content-length", str(len(body)).encode("ascii")))
    return headers


class RequestEnvelopeMiddleware:
    """Unpack hex-packed write bodies. Ordinary JSON is left unchanged."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope.get("method") not in _MUTATING:
            await self.app(scope, receive, send)
            return

        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            body.extend(message.get("body", b""))
            if not message.get("more_body", False):
                break

        raw = bytes(body)
        content_type = _content_type(scope)
        media_type = content_type.split(";", 1)[0].strip().lower()
        new_type = None
        try:
            if media_type == "multipart/form-data" and b"echex1:" in raw:
                new_body, new_type = await unwrap_multipart_body(raw, content_type)
            elif media_type in {"", "application/json", "text/plain"}:
                unpacked = unwrap_json_body(raw)
                new_body = raw if unpacked is None else unpacked
            else:
                new_body = raw
        except EnvelopeError:
            logger.warning("Rejected packed request body for %s", scope.get("path"))
            response = JSONResponse(
                status_code=400,
                content={"error": "INVALID_REQUEST", "message": "Could not read the request body."},
            )
            await response(scope, _closed_receive, send)
            return

        if new_body is not raw or new_type:
            scope = dict(scope)
            scope["headers"] = _replace_headers(scope, new_body, new_type)

        sent = False

        async def replay():
            nonlocal sent
            if sent:
                return {"type": "http.disconnect"}
            sent = True
            return {"type": "http.request", "body": new_body, "more_body": False}

        await self.app(scope, replay, send)


async def _closed_receive():
    return {"type": "http.disconnect"}
