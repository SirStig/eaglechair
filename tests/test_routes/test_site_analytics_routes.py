"""
Test Site Analytics Routes

Public event ingest (/api/v1/analytics/events) and the admin traffic report
(/api/v1/admin/dashboard/analytics/traffic).
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.analytics import AnalyticsEvent
from backend.services.site_analytics_service import (
    device_from_user_agent,
    is_bot,
    normalize_path,
    referrer_host,
)

BROWSER_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0 Safari/537.36"
)
IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"
VISITOR = "visitor-aaaaaaaa"
SESSION = "session-bbbbbbbb"


def _event(event_type, **extra):
    return {"type": event_type, "visitor_id": VISITOR, "session_id": SESSION, **extra}


async def _post(client: AsyncClient, events, ua=BROWSER_UA, **kwargs):
    return await client.post(
        "/api/v1/analytics/events",
        json={"events": events},
        headers={"User-Agent": ua},
        **kwargs,
    )


async def _count(db_session: AsyncSession) -> int:
    return (await db_session.execute(select(func.count()).select_from(AnalyticsEvent))).scalar()


class TestHelpers:
    def test_bot_detection(self):
        assert is_bot(None)
        assert is_bot("Googlebot/2.1 (+http://www.google.com/bot.html)")
        assert is_bot("Mozilla/5.0 HeadlessChrome/120.0")
        assert not is_bot(BROWSER_UA)

    def test_device(self):
        assert device_from_user_agent(BROWSER_UA) == "desktop"
        assert device_from_user_agent(IPHONE_UA) == "mobile"
        assert device_from_user_agent("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)") == "tablet"

    def test_normalize_path(self):
        assert normalize_path("/products/?page=2#top") == "/products"
        assert normalize_path("/") == "/"
        assert normalize_path(None) is None

    def test_referrer_host(self):
        assert referrer_host("https://www.google.com/search?q=chairs") == "google.com"
        assert referrer_host("http://test/products", request_host="test") is None
        assert referrer_host("") is None


@pytest.mark.integration
class TestAnalyticsIngest:
    @pytest.mark.asyncio
    async def test_records_valid_events(self, async_client: AsyncClient, db_session: AsyncSession, test_chair):
        response = await _post(async_client, [
            _event("page_view", path="/products?sort=name", referrer="https://www.google.com/"),
            _event("product_view", path="/products/x", product_id=test_chair.id),
            _event("download", path="/products/x", product_id=test_chair.id,
                   resource_type="spec_sheet", resource_url="/uploads/spec.pdf", label="Spec Sheet"),
            _event("search", path="/search", label="  Barstool "),
        ])
        assert response.status_code == 204

        rows = (await db_session.execute(select(AnalyticsEvent).order_by(AnalyticsEvent.id))).scalars().all()
        assert [r.event_type for r in rows] == ["page_view", "product_view", "download", "search"]
        assert rows[0].path == "/products"
        assert rows[0].referrer == "google.com"
        assert rows[0].device == "desktop"
        assert rows[3].label == "barstool"

    @pytest.mark.asyncio
    async def test_drops_invalid_and_admin_events(self, async_client: AsyncClient, db_session: AsyncSession):
        response = await _post(async_client, [
            _event("bogus", path="/"),
            _event("page_view", path="/admin/dashboard"),
            _event("product_view", path="/products/x"),  # no product id
            {"type": "page_view", "visitor_id": "short", "session_id": SESSION, "path": "/"},
            _event("search", path="/search", label=""),
        ])
        assert response.status_code == 204
        assert await _count(db_session) == 0

    @pytest.mark.asyncio
    async def test_ignores_bots(self, async_client: AsyncClient, db_session: AsyncSession):
        response = await _post(async_client, [_event("page_view", path="/")], ua="Googlebot/2.1")
        assert response.status_code == 204
        assert await _count(db_session) == 0

    @pytest.mark.asyncio
    async def test_ignores_admin_sessions(self, async_client: AsyncClient, db_session: AsyncSession):
        async_client.cookies.set("session_token", "x")
        async_client.cookies.set("admin_token", "y")
        try:
            response = await _post(async_client, [_event("page_view", path="/")])
        finally:
            async_client.cookies.clear()
        assert response.status_code == 204
        assert await _count(db_session) == 0

    @pytest.mark.asyncio
    async def test_rejects_oversized_batch(self, async_client: AsyncClient):
        response = await _post(async_client, [_event("page_view", path="/")] * 26)
        assert response.status_code == 422


@pytest.mark.integration
@pytest.mark.admin
class TestTrafficReport:
    @pytest.mark.asyncio
    async def test_requires_admin(self, async_client: AsyncClient):
        response = await async_client.get("/api/v1/admin/dashboard/analytics/traffic")
        assert response.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_report(self, async_client: AsyncClient, admin_headers, test_chair):
        await _post(async_client, [
            _event("page_view", path="/", referrer="https://bing.com/"),
            _event("page_view", path="/products"),
            _event("product_view", path="/products/x", product_id=test_chair.id),
            _event("download", product_id=test_chair.id, resource_type="cad",
                   resource_url="/uploads/chair.dwg", label="CAD File"),
            _event("search", path="/search", label="booth"),
        ])
        await _post(async_client, [
            {"type": "page_view", "visitor_id": "visitor-cccccccc", "session_id": "session-dddddddd", "path": "/"},
        ], ua=IPHONE_UA)

        response = await async_client.get(
            "/api/v1/admin/dashboard/analytics/traffic?days=7", headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()

        totals = data["totals"]
        assert totals["page_views"] == 3
        assert totals["product_views"] == 1
        assert totals["downloads"] == 1
        assert totals["searches"] == 1
        assert totals["visitors"] == 2
        assert totals["sessions"] == 2
        assert totals["bounce_rate"] == 50.0
        assert data["active_now"] == 2
        assert data["previous"]["page_views"] == 0

        assert len(data["timeseries"]) == 8
        assert data["timeseries"][-1]["page_views"] == 3

        assert data["top_pages"][0] == {"path": "/", "views": 2, "visitors": 2}
        assert data["top_products"][0]["product_id"] == test_chair.id
        assert data["top_products"][0]["name"] == test_chair.name
        assert data["top_products"][0]["views"] == 1
        assert data["top_products"][0]["downloads"] == 1
        assert data["top_downloads"][0]["label"] == "CAD File"
        assert data["downloads_by_type"] == [{"type": "cad", "downloads": 1}]
        assert {"source": "bing.com", "sessions": 1} in data["referrers"]
        assert {d["device"] for d in data["devices"]} == {"desktop", "mobile"}
        assert data["top_searches"] == [{"query": "booth", "searches": 1}]
