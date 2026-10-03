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
    async def test_flags_admin_sessions_as_staff(self, async_client: AsyncClient, db_session: AsyncSession):
        async_client.cookies.set("session_token", "x")
        async_client.cookies.set("admin_token", "y")
        try:
            response = await _post(async_client, [_event("page_view", path="/")])
        finally:
            async_client.cookies.clear()
        assert response.status_code == 204
        row = (await db_session.execute(select(AnalyticsEvent))).scalar_one()
        assert row.is_staff is True

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
            _event("download", path="/products/x", product_id=test_chair.id, resource_type="cad",
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

        assert data["top_pages"][0]["path"] == "/"
        assert data["top_pages"][0]["title"] == "Home"
        assert data["top_pages"][0]["views"] == 2
        assert data["top_pages"][0]["visitors"] == 2
        # "/products/x" doesn't resolve to a real product, so it isn't listed
        assert "/products/x" not in [p["path"] for p in data["top_pages"]]
        assert data["top_products"][0]["product_id"] == test_chair.id
        assert data["top_products"][0]["name"] == test_chair.name
        assert data["top_products"][0]["views"] == 1
        assert data["top_products"][0]["downloads"] == 1
        assert data["top_downloads"][0]["label"] == "CAD File"
        assert data["downloads_by_type"] == [{"type": "cad", "downloads": 1}]
        # The bing session's later /products view has no referrer but must not
        # count as a second, "direct" session
        assert sorted(data["referrers"], key=lambda r: r["source"]) == [
            {"source": "Direct / none", "sessions": 1},
            {"source": "bing.com", "sessions": 1},
        ]
        assert {d["device"] for d in data["devices"]} == {"desktop", "mobile"}
        assert data["top_searches"] == [{"query": "booth", "searches": 1}]


class TestPageCatalog:
    def test_public_pages(self):
        from backend.services.analytics_pages import is_public_page

        for path in ("/", "/products", "/resources/woodfinishes", "/products/category/chairs",
                     "/products/category/chairs/side-chairs", "/products/chairs/side/alpha-chair",
                     "/products/123", "/products/alpha-chair/related", "/families/alpha"):
            assert is_public_page(path), path

    def test_scanner_probes_are_not_pages(self):
        from backend.services.analytics_pages import is_public_page

        for path in ("/wp-login.php", "/.env", "/.git/config", "/admin", "/wp-admin/setup-config.php",
                     "/phpmyadmin", "/products/../../etc/passwd", "/cgi-bin/luci", "/products/x.php",
                     "/api/v1/products", "/xmlrpc.php", "/a/b/c/d/e", None, ""):
            assert not is_public_page(path), path


@pytest.mark.integration
class TestExpandedIngest:
    @pytest.mark.asyncio
    async def test_scanner_paths_dropped(self, async_client: AsyncClient, db_session: AsyncSession):
        await _post(async_client, [
            _event("page_view", path="/wp-login.php"),
            _event("page_view", path="/.env"),
            _event("page_view", path="/some/unknown/route/here"),
            _event("page_view", path="/about"),
        ])
        rows = (await db_session.execute(select(AnalyticsEvent))).scalars().all()
        assert [r.path for r in rows] == ["/about"]

    @pytest.mark.asyncio
    async def test_scanner_user_agents_dropped(self, async_client: AsyncClient, db_session: AsyncSession):
        # (sqlmap and friends are already rejected by InputSanitizerMiddleware)
        for ua in ("Mozilla/5.0 zgrab/0.x", "Go-http-client/1.1", "Nuclei - Open-source project"):
            await _post(async_client, [_event("page_view", path="/")], ua=ua)
        assert await _count(db_session) == 0

    @pytest.mark.asyncio
    async def test_new_event_types(self, async_client: AsyncClient, db_session: AsyncSession, test_chair):
        await _post(async_client, [
            _event("page_view", path="/", utm_source="newsletter", utm_medium="email", utm_campaign="fall"),
            _event("cart_add", path="/products/x", product_id=test_chair.id, value=4),
            _event("cart_remove", path="/cart", product_id=test_chair.id),
            _event("quote_start", path="/quote-request"),
            _event("quote_submit", path="/quote-request", value=2),
            _event("contact_submit", path="/contact", label="General"),
            _event("rep_search", path="/find-a-rep", label="Texas"),
            _event("material_view", path="/resources/woodfinishes", resource_type="finish", label="Walnut"),
            _event("product_interaction", path="/products/x", product_id=test_chair.id,
                   resource_type="tab", label="Dimensions"),
            _event("catalog_read", path="/virtual-catalogs", label="2026 Catalog", value=95),
            _event("filter", path="/products", label="Category: Barstools"),
            _event("engagement", path="/", value=42.6, depth=80),
            _event("search", path="/search", label="booth", value=0),
        ])
        rows = {r.event_type: r for r in (await db_session.execute(select(AnalyticsEvent))).scalars().all()}
        assert len(rows) == 13
        assert rows["page_view"].utm_source == "newsletter"
        assert rows["page_view"].utm_campaign == "fall"
        assert rows["cart_add"].value == 4
        assert rows["engagement"].value == 42
        assert rows["engagement"].depth == 80
        assert rows["catalog_read"].value == 95
        assert rows["search"].value == 0
        assert rows["cart_add"].utm_source is None

    @pytest.mark.asyncio
    async def test_invalid_new_events_dropped(self, async_client: AsyncClient, db_session: AsyncSession):
        await _post(async_client, [
            _event("cart_add", path="/products/x"),  # no product
            _event("engagement", path="/", value=0),  # no time
            _event("engagement", path="/", value=999999),  # implausible
            _event("catalog_read", path="/virtual-catalogs", label="Catalog"),  # no time
            _event("material_view", path="/resources/woodfinishes"),  # no label
        ])
        assert await _count(db_session) == 0

    @pytest.mark.asyncio
    async def test_country_from_cdn_header(self, async_client: AsyncClient, db_session: AsyncSession):
        await async_client.post(
            "/api/v1/analytics/events",
            json={"events": [_event("page_view", path="/")]},
            headers={"User-Agent": BROWSER_UA, "CF-IPCountry": "us"},
        )
        row = (await db_session.execute(select(AnalyticsEvent))).scalar_one()
        assert row.country == "US"


@pytest.mark.integration
@pytest.mark.admin
class TestExpandedReport:
    @pytest.mark.asyncio
    async def test_report_sections(self, async_client: AsyncClient, admin_headers, test_chair):
        product_path = f"/products/{test_chair.slug}"
        await _post(async_client, [
            _event("page_view", path="/", utm_source="newsletter", utm_medium="email"),
            _event("engagement", path="/", value=20, depth=40),
            _event("engagement", path="/", value=10, depth=50),  # same visit, reported in two pieces
            _event("page_view", path=product_path),
            _event("product_view", path=product_path, product_id=test_chair.id),
            _event("cart_add", path=product_path, product_id=test_chair.id, value=1),
            _event("page_view", path="/quote-request"),
            _event("quote_start", path="/quote-request"),
            _event("quote_submit", path="/quote-request", value=1),
            _event("search", path="/search", label="booth", value=0),
            _event("material_view", path="/resources/woodfinishes", resource_type="finish", label="Walnut"),
            _event("catalog_read", path="/virtual-catalogs", label="2026 Catalog", value=60),
            _event("catalog_read", path="/virtual-catalogs", label="2026 Catalog", value=30),  # same read, resumed
            _event("page_view", path="/products/no-such-product"),
        ])
        # Staff traffic is stored but excluded by default
        async_client.cookies.set("session_token", "x")
        async_client.cookies.set("admin_token", "y")
        try:
            await _post(async_client, [
                {"type": "page_view", "visitor_id": "staff-vvvvvvvv", "session_id": "staff-ssssssss", "path": "/"},
            ])
        finally:
            async_client.cookies.clear()

        data = (await async_client.get(
            "/api/v1/admin/dashboard/analytics/traffic?days=7", headers=admin_headers
        )).json()

        assert data["staff_events_excluded"] == 1
        assert data["totals"]["visitors"] == 1
        assert data["totals"]["cart_adds"] == 1
        assert data["totals"]["zero_result_searches"] == 1
        assert data["totals"]["avg_engaged_seconds"] == 30

        funnel = {s["key"]: s["sessions"] for s in data["funnel"]}
        assert funnel == {
            "visited": 1, "viewed_product": 1, "added_to_quote": 1,
            "opened_form": 1, "started_form": 1, "submitted": 1,
        }

        titles = {p["path"]: p["title"] for p in data["top_pages"]}
        assert titles[product_path] == test_chair.name
        assert titles["/quote-request"] == "Quote Request Form"
        assert "/products/no-such-product" not in titles
        home = next(p for p in data["top_pages"] if p["path"] == "/")
        assert home["avg_seconds"] == 30 and home["avg_depth"] == 50

        assert data["entry_pages"][0]["path"] == "/"
        assert data["campaigns"][0]["source"] == "newsletter"
        assert data["zero_result_searches"] == [{"query": "booth", "searches": 1}]
        assert data["materials"][0]["label"] == "Walnut"
        assert data["catalogs"][0] == {"label": "2026 Catalog", "readers": 1, "avg_seconds": 90, "total_seconds": 90}

        top = data["top_products"][0]
        assert top["product_id"] == test_chair.id
        assert top["cart_adds"] == 1
        assert top["interest_score"] == 1 * 1 + 1 * 5

        with_staff = (await async_client.get(
            "/api/v1/admin/dashboard/analytics/traffic?days=7&include_staff=true", headers=admin_headers
        )).json()
        assert with_staff["totals"]["visitors"] == 2
        assert with_staff["staff_events_excluded"] == 0

    @pytest.mark.asyncio
    async def test_product_report(self, async_client: AsyncClient, admin_headers, test_chair):
        path = f"/products/{test_chair.slug}"
        await _post(async_client, [
            _event("product_view", path=path, product_id=test_chair.id),
            _event("product_interaction", path=path, product_id=test_chair.id, resource_type="tab", label="Dimensions"),
            _event("cart_add", path=path, product_id=test_chair.id),
            _event("cart_remove", path="/cart", product_id=test_chair.id),
        ])
        response = await async_client.get(
            f"/api/v1/admin/dashboard/analytics/products/{test_chair.id}?days=7", headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["product"]["id"] == test_chair.id
        assert data["totals"]["views"] == 1
        assert data["totals"]["cart_adds"] == 1
        assert data["totals"]["cart_removes"] == 1
        assert data["interactions"][0]["label"] == "Dimensions"
        assert data["timeseries"][-1]["views"] == 1

        missing = await async_client.get("/api/v1/admin/dashboard/analytics/products/999999", headers=admin_headers)
        assert missing.status_code == 404

    @pytest.mark.asyncio
    async def test_digest_preview_escapes_visitor_text(self, async_client: AsyncClient, admin_headers):
        await _post(async_client, [_event("search", path="/search", label="<script>x</script>", value=0)])
        response = await async_client.get("/api/v1/admin/dashboard/analytics/digest/preview", headers=admin_headers)
        assert response.status_code == 200
        body = response.json()["html"]
        assert "<script>" not in body
        assert "&lt;script&gt;" in body
