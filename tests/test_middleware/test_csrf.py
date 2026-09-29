"""
Tests for the CSRF Origin/Referer verification middleware
"""

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

import backend.models  # noqa: F401 - register all tables before test_engine's create_all
from backend.core.config import settings
from backend.core.middleware.csrf import normalize_origin
from backend.database.base import get_db
from tests.conftest import get_app

LOGOUT = "/api/v1/auth/logout"
AUTH_COOKIE = {"Cookie": "access_token=not-a-real-token"}


@pytest_asyncio.fixture
async def raw_client(db_session):
    """Client that sends no Origin header by default (unlike async_client)"""
    app = get_app()
    app.dependency_overrides[get_db] = lambda: db_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.mark.unit
@pytest.mark.auth
class TestNormalizeOrigin:
    def test_normalizes_scheme_host_and_default_port(self):
        assert normalize_origin("HTTPS://Joshua.EagleChair.com:443") == "https://joshua.eaglechair.com"
        assert normalize_origin("http://localhost:5173/some/path?x=1") == "http://localhost:5173"

    def test_rejects_opaque_and_malformed(self):
        assert normalize_origin(None) is None
        assert normalize_origin("null") is None
        assert normalize_origin("javascript:alert(1)") is None
        assert normalize_origin("not a url") is None


@pytest.mark.integration
@pytest.mark.auth
class TestCSRFMiddleware:
    @pytest.mark.asyncio
    async def test_cookie_request_from_untrusted_origin_rejected(self, raw_client):
        response = await raw_client.post(
            LOGOUT, headers={**AUTH_COOKIE, "Origin": "https://evil.example.com"}
        )
        assert response.status_code == 403
        assert response.json()["error"] == "CSRF_VALIDATION_FAILED"

    @pytest.mark.asyncio
    async def test_cookie_request_without_origin_or_referer_rejected(self, raw_client):
        response = await raw_client.post(LOGOUT, headers=AUTH_COOKIE)
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_cookie_request_with_untrusted_referer_rejected(self, raw_client):
        response = await raw_client.post(
            LOGOUT, headers={**AUTH_COOKIE, "Referer": "https://evil.example.com/page"}
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_null_origin_rejected_even_with_trusted_referer(self, raw_client):
        trusted = settings.CORS_ORIGINS[0]
        response = await raw_client.post(
            LOGOUT, headers={**AUTH_COOKIE, "Origin": "null", "Referer": f"{trusted}/x"}
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_cookie_request_from_cors_origin_allowed(self, raw_client):
        response = await raw_client.post(
            LOGOUT, headers={**AUTH_COOKIE, "Origin": settings.CORS_ORIGINS[0]}
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_cookie_request_from_own_host_allowed(self, raw_client):
        response = await raw_client.post(LOGOUT, headers={**AUTH_COOKIE, "Origin": "http://test"})
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_trusted_referer_used_when_origin_absent(self, raw_client):
        trusted = settings.CORS_ORIGINS[0]
        response = await raw_client.post(
            LOGOUT, headers={**AUTH_COOKIE, "Referer": f"{trusted}/admin/dashboard"}
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_admin_cookies_also_trigger_check(self, raw_client):
        response = await raw_client.put(
            "/api/v1/admin/products/1",
            headers={"Cookie": "session_token=a; admin_token=b", "Origin": "https://evil.example.com"},
            json={},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_header_only_auth_without_origin_passes(self, raw_client, company_token):
        # Non-browser client: Authorization header, no cookies, no Origin
        response = await raw_client.post(
            LOGOUT, headers={"Authorization": f"Bearer {company_token}"}
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_login_without_cookie_not_blocked(self, raw_client):
        response = await raw_client.post(
            "/api/v1/auth/login",
            json={"email": "nobody@example.com", "password": "WrongPassword1"},
            headers={"Origin": "https://evil.example.com"},
        )
        # Rejected by credentials, not by CSRF
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_safe_methods_not_checked(self, raw_client):
        response = await raw_client.get(
            "/api/v1/health", headers={**AUTH_COOKIE, "Origin": "https://evil.example.com"}
        )
        assert response.status_code != 403
