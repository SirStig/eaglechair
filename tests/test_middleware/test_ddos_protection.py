"""
DDoS protection + input sanitizer middleware

Image-heavy admin pages (product grids, the media library) load hundreds of
/uploads files at once; those must not count toward the per-IP request
budget. Blocks come back as JSON responses, and the sanitizer never re-runs
a request that failed further down the stack.
"""

import httpx
import pytest
from starlette.applications import Starlette
from starlette.responses import PlainTextResponse
from starlette.routing import Route

from backend.core.middleware.ddos_protection import DDoSProtectionMiddleware
from backend.core.middleware.input_sanitizer import InputSanitizerMiddleware

UA = {"User-Agent": "Mozilla/5.0 (Macintosh) test-browser"}


def _app(calls, max_requests=5):
    async def ok(request):
        calls.append(request.url.path)
        return PlainTextResponse("ok")

    async def boom(request):
        calls.append(request.url.path)
        raise RuntimeError("handler failed")

    app = Starlette(routes=[
        Route("/api/thing", ok),
        Route("/api/boom", boom),
        Route("/uploads/images/products/{name}", ok),
    ])
    # Same order as middleware_setup: sanitizer wraps DDoS protection
    app.add_middleware(DDoSProtectionMiddleware, window_size=60, max_requests=max_requests, ban_duration=300)
    app.add_middleware(InputSanitizerMiddleware)
    return app


def _client(app):
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app, raise_app_exceptions=False), base_url="http://t")


@pytest.mark.unit
async def test_static_uploads_do_not_count_toward_limit():
    calls = []
    async with _client(_app(calls)) as client:
        for i in range(50):
            res = await client.get(f"/uploads/images/products/chair_{i}.w320.webp", headers=UA)
            assert res.status_code == 200
        res = await client.get("/api/thing", headers=UA)
    assert res.status_code == 200


@pytest.mark.unit
async def test_limit_returns_json_429_then_ban_without_running_handler():
    calls = []
    async with _client(_app(calls, max_requests=3)) as client:
        for _ in range(3):
            assert (await client.get("/api/thing", headers=UA)).status_code == 200
        over = await client.get("/api/thing", headers=UA)
        banned = await client.get("/api/thing", headers=UA)

    assert over.status_code == 429
    assert over.headers["Retry-After"] == "300"
    assert over.json()["error"]
    assert banned.status_code not in (200, 500)
    assert banned.json()["error"]
    assert len(calls) == 3  # blocked requests never reach the handler


@pytest.mark.unit
async def test_sanitizer_does_not_rerun_failed_request():
    calls = []
    async with _client(_app(calls)) as client:
        res = await client.get("/api/boom", headers=UA)
    assert res.status_code == 500
    assert calls == ["/api/boom"]
