"""
Tests for the in-process product search index, catalog response caching
headers, rate limiter / DDoS state pruning and background email sending.
"""

import asyncio
import logging

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.services import product_search_index
from backend.services.product_service import ProductService
from tests.factories import create_category, create_chair


async def _seating_category(db_session):
    # Category name deliberately avoids "chair" so it doesn't match queries
    return await create_category(db_session, name="Seating", slug="seating-test")


@pytest.mark.unit
@pytest.mark.products
class TestProductSearchIndex:
    @pytest.mark.asyncio
    async def test_exact_model_number_ranks_first(self, db_session: AsyncSession):
        category = await _seating_category(db_session)
        await create_chair(
            db_session, category_id=category.id, name="Lounge 6010 Chair",
            model_number="7777", short_description="Inspired by the 6010",
        )
        await create_chair(
            db_session, category_id=category.id, name="Prefix Chair",
            model_number="60105",
        )
        exact = await create_chair(
            db_session, category_id=category.id, name="Zeta Side Chair",
            model_number="6010",
        )

        results = await ProductService.search_products_fuzzy(
            db_session, "6010", limit=10, threshold=75
        )

        assert results, "expected matches"
        assert results[0].id == exact.id
        assert [p.model_number for p in results[:2]] == ["6010", "60105"]

    @pytest.mark.asyncio
    async def test_model_number_ignores_punctuation_and_case(self, db_session: AsyncSession):
        category = await _seating_category(db_session)
        target = await create_chair(
            db_session, category_id=category.id, name="Hyphen Model",
            model_number="EC-6246",
        )
        results = await ProductService.search_products_fuzzy(db_session, "ec6246")
        assert results and results[0].id == target.id

    @pytest.mark.asyncio
    async def test_generic_word_does_not_match_everything(self, db_session: AsyncSession):
        category = await _seating_category(db_session)
        chair = await create_chair(
            db_session, category_id=category.id, name="Classic Side Chair",
            short_description="Wood frame", model_number="A100",
        )
        await create_chair(
            db_session, category_id=category.id, name="Bar Stool",
            short_description="Counter height", model_number="B200",
        )
        await create_chair(
            db_session, category_id=category.id, name="Dining Table",
            short_description="Solid top", model_number="C300",
        )

        results = await ProductService.search_products_fuzzy(
            db_session, "chair", limit=50, threshold=60
        )

        assert [p.id for p in results] == [chair.id]

    @pytest.mark.asyncio
    async def test_numeric_query_does_not_match_product_ids(self, db_session: AsyncSession):
        category = await _seating_category(db_session)
        product = await create_chair(
            db_session, category_id=category.id, name="Plain Stool",
            short_description="Simple", model_number="ZZZ",
        )
        results = await ProductService.search_products_fuzzy(
            db_session, str(product.id), limit=50, threshold=75
        )
        assert product.id not in [p.id for p in results]

    @pytest.mark.asyncio
    async def test_typo_tolerance(self, db_session: AsyncSession):
        category = await _seating_category(db_session)
        target = await create_chair(
            db_session, category_id=category.id, name="Executive Armchair",
            short_description="Leather", model_number="X1",
        )
        await create_chair(
            db_session, category_id=category.id, name="Dining Table",
            short_description="Solid top", model_number="C300",
        )

        results = await ProductService.search_products_fuzzy(
            db_session, "executve", limit=10, threshold=75
        )

        assert [p.id for p in results] == [target.id]

    @pytest.mark.asyncio
    async def test_prefix_typeahead_and_inactive_excluded(self, db_session: AsyncSession):
        category = await _seating_category(db_session)
        active = await create_chair(
            db_session, category_id=category.id, name="Alpine Barstool",
            model_number="AL1",
        )
        await create_chair(
            db_session, category_id=category.id, name="Alpine Retired",
            model_number="AL2", is_active=False,
        )
        results = await ProductService.search_products_fuzzy(db_session, "alp")
        assert [p.id for p in results] == [active.id]

    def test_search_ranking_tiers_unit(self):
        index = product_search_index._Index()
        for pid, name, model in [
            (1, "Oak Chair", "100"),
            (2, "Chair 100 Deluxe", "250"),
            (3, "Wide Bench", "1005"),
        ]:
            tokens = frozenset(product_search_index.tokenize(name)) | {model}
            index.entries[pid] = product_search_index._Entry(
                id=pid,
                name=name.lower(),
                models=(model,),
                name_tokens=frozenset(product_search_index.tokenize(name)),
                text_tokens=tokens,
            )
        index.vocabulary = frozenset(
            t for e in index.entries.values() for t in e.text_tokens
        )
        assert product_search_index.search(index, "100", 10, 75)[:2] == [1, 3]


@pytest.mark.integration
@pytest.mark.products
class TestCatalogRoutesCaching:
    @pytest.mark.asyncio
    async def test_search_route_shape(self, async_client: AsyncClient, db_session: AsyncSession):
        category = await _seating_category(db_session)
        await create_chair(
            db_session, category_id=category.id, name="Executive Chair",
            model_number="EX-1",
        )
        response = await async_client.get(
            "/api/v1/products/search", params={"q": "exec", "limit": 5, "threshold": 60}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list) and data[0]["name"] == "Executive Chair"

    @pytest.mark.asyncio
    async def test_public_cache_control_headers(self, async_client: AsyncClient, db_session: AsyncSession):
        await _seating_category(db_session)

        anon = await async_client.get("/api/v1/categories")
        assert anon.status_code == 200
        assert anon.headers["cache-control"] == "public, max-age=60, stale-while-revalidate=300"
        assert "Authorization" in anon.headers.get("vary", "")
        assert any(c["name"] == "Seating" for c in anon.json())

        authed = await async_client.get(
            "/api/v1/categories", headers={"Authorization": "Bearer not-a-real-token"}
        )
        assert authed.status_code == 200
        assert authed.headers["cache-control"] == "private, no-store"

    @pytest.mark.asyncio
    async def test_products_list_and_detail_shape(self, async_client: AsyncClient, db_session: AsyncSession):
        category = await _seating_category(db_session)
        product = await create_chair(
            db_session, category_id=category.id, name="Shape Chair", model_number="S1",
        )
        listing = await async_client.get("/api/v1/products")
        assert listing.status_code == 200
        body = listing.json()
        assert {"items", "total", "page", "per_page", "total_pages"} <= set(body)
        assert listing.headers["cache-control"].startswith("public")

        detail = await async_client.get(f"/api/v1/products/{product.id}")
        assert detail.status_code == 200
        assert detail.json()["id"] == product.id

        missing = await async_client.get("/api/v1/products/999999")
        assert missing.status_code == 404


@pytest.mark.unit
class TestTrackingStatePruning:
    def test_rate_limiter_prunes_idle_identifiers(self):
        from backend.core.middleware.rate_limiter import AdvancedRateLimiter

        limiter = AdvancedRateLimiter(app=None, max_tracked_identifiers=5)
        now = 10_000.0
        for i in range(20):
            limiter.request_history[f"ip:{i}"].append(now - 5000)  # long idle
            limiter.burst_tracker[f"ip:{i}"].append(now - 5000)
        limiter.request_history["ip:active"].append(now)
        limiter.burst_tracker["ip:active"].append(now)

        limiter._maybe_cleanup(now)

        assert list(limiter.request_history) == ["ip:active"]
        assert list(limiter.burst_tracker) == ["ip:active"]

    def test_rate_limiter_hard_cap(self):
        from backend.core.middleware.rate_limiter import AdvancedRateLimiter

        limiter = AdvancedRateLimiter(app=None, max_tracked_identifiers=3)
        now = 10_000.0
        for i in range(10):
            limiter.request_history[f"ip:{i}"].append(now - 10 + i)
        limiter.cleanup_old_data(now)
        assert sorted(limiter.request_history) == ["ip:7", "ip:8", "ip:9"]

    def test_ddos_cleanup_runs_periodically(self):
        import time

        from backend.core.middleware.ddos_protection import DDoSProtectionMiddleware

        ddos = DDoSProtectionMiddleware(app=None, max_tracked_ips=2)
        now = time.time()
        for i in range(5):
            ddos.request_counts[f"10.0.0.{i}"].append(now - 1000)
        ddos.banned_ips["10.0.0.9"] = now - 1
        ddos.suspicious_ips.update({"10.0.0.1", "10.0.0.9"})

        ddos._maybe_cleanup(now)  # over the cap -> prunes immediately

        assert not ddos.request_counts
        assert not ddos.banned_ips
        assert not ddos.suspicious_ips

    @pytest.mark.asyncio
    async def test_ddos_attack_pattern_blocks_request_without_banning_ip(self):
        from starlette.requests import Request
        from starlette.responses import Response

        from backend.core.exceptions import SuspiciousActivityError
        from backend.core.middleware.ddos_protection import DDoSProtectionMiddleware

        async def ok(request):
            return Response("ok")

        ddos = DDoSProtectionMiddleware(app=None)

        def req(path, ua):
            return Request({
                "type": "http", "method": "GET", "path": path, "query_string": b"",
                "headers": [(b"user-agent", ua.encode())], "client": ("10.0.0.5", 1234),
            })

        with pytest.raises(SuspiciousActivityError):
            await ddos.dispatch(req("/../etc/passwd", "Mozilla/5.0 probe"), ok)
        assert not ddos.banned_ips

        # The same IP (e.g. a shared proxy) keeps working for normal requests
        response = await ddos.dispatch(req("/api/v1/admin/ai/ws-ticket", "Mozilla/5.0 Safari"), ok)
        assert response.status_code == 200


@pytest.mark.unit
class TestBackgroundEmail:
    @pytest.mark.asyncio
    async def test_send_in_background_logs_failures(self, monkeypatch, caplog):
        import backend.database.base as db_base
        from backend.services import email_service
        from backend.services.email_service import EmailService

        class _DummySession:
            async def __aenter__(self):
                return object()

            async def __aexit__(self, *exc):
                return False

        monkeypatch.setattr(email_service.settings, "TESTING", False)
        monkeypatch.setattr(db_base, "AsyncSessionLocal", lambda: _DummySession())

        async def failing_send(db, to_email):
            raise RuntimeError("smtp down")

        with caplog.at_level(logging.ERROR, logger="backend.services.email_service"):
            task = EmailService.send_in_background(failing_send, to_email="a@b.c")
            assert task is not None
            await asyncio.wait_for(task, timeout=5)

        assert "failing_send to a@b.c failed" in caplog.text

    @pytest.mark.asyncio
    async def test_smtp_send_runs_off_event_loop(self, monkeypatch):
        import threading

        from email.mime.multipart import MIMEMultipart

        from backend.services.email_service import EmailService

        loop_thread = threading.get_ident()
        seen = {}

        class _FakeServer:
            def send_message(self, msg):
                seen["thread"] = threading.get_ident()

            def quit(self):
                seen["quit"] = True

        monkeypatch.setattr(EmailService, "_get_smtp_connection", staticmethod(lambda: _FakeServer()))
        await asyncio.to_thread(EmailService._send_message_blocking, MIMEMultipart())

        assert seen["quit"] is True
        assert seen["thread"] != loop_thread


class _FakeRedis:
    def __init__(self):
        self.store = {}

    async def get(self, key):
        return self.store.get(key)

    async def set(self, key, value, ex=None):
        self.store[key] = value if isinstance(value, bytes) else str(value).encode()

    async def incr(self, key):
        value = int(self.store.get(key, b"0")) + 1
        self.store[key] = str(value).encode()
        return value


@pytest.mark.integration
@pytest.mark.products
class TestPublicResponseCache:
    @pytest.mark.asyncio
    async def test_cache_hit_and_version_bump(
        self, async_client: AsyncClient, db_session: AsyncSession, monkeypatch
    ):
        from backend.services import catalog_cache

        fake = _FakeRedis()
        monkeypatch.setattr(catalog_cache, "_redis_enabled", lambda: True)
        monkeypatch.setattr(catalog_cache, "_get_client", lambda: fake)

        await create_category(db_session, name="First", slug="first-cat")

        miss = await async_client.get("/api/v1/categories?include_nested=false&ref=home")
        assert miss.status_code == 200 and "x-cache" not in miss.headers

        await create_category(db_session, name="Second", slug="second-cat")

        # Same parameters in a different order hit the same entry
        hit = await async_client.get("/api/v1/categories?ref=home&include_nested=false")
        assert hit.headers.get("x-cache") == "HIT"
        assert hit.json() == miss.json()

        await catalog_cache.bump_catalog_version()
        fresh = await async_client.get("/api/v1/categories?include_nested=false")
        assert "x-cache" not in fresh.headers
        assert {c["name"] for c in fresh.json()} >= {"First", "Second"}
