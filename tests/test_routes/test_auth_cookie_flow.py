"""
Cookie-based auth flow and token revocation (route level)
"""

import pytest
from httpx import AsyncClient

import backend.models  # noqa: F401 - register all tables before test_engine's create_all
from backend.core.security import SecurityManager
from backend.models.company import CompanyStatus
from tests.factories import create_admin, create_company

PASSWORD = "TestPassword123!"
# Headers a browser adds to fetch/XHR (scripts cannot set or remove them)
BROWSER = {"Sec-Fetch-Site": "same-site", "Sec-Fetch-Mode": "cors"}


def _set_cookie_headers(response) -> list[str]:
    return response.headers.get_list("set-cookie")


@pytest.mark.integration
@pytest.mark.auth
class TestCookieAuthFlow:
    @pytest.mark.asyncio
    async def test_browser_login_uses_httponly_cookies_only(self, async_client: AsyncClient, db_session):
        company = await create_company(db_session, status=CompanyStatus.ACTIVE)
        response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": company.rep_email, "password": PASSWORD},
            headers=BROWSER,
        )
        assert response.status_code == 200
        body = response.json()
        assert "access_token" not in body and "refresh_token" not in body
        assert body["user"]["id"] == company.id

        cookies = _set_cookie_headers(response)
        for name in ("access_token", "refresh_token"):
            header = next(c for c in cookies if c.startswith(f"{name}="))
            assert "HttpOnly" in header
            assert "samesite=lax" in header.lower()

        # Cookie alone authenticates
        me = await async_client.get("/api/v1/auth/me")
        assert me.status_code == 200

    @pytest.mark.asyncio
    async def test_api_client_login_still_gets_tokens(self, async_client: AsyncClient, db_session):
        company = await create_company(db_session, status=CompanyStatus.ACTIVE)
        response = await async_client.post(
            "/api/v1/auth/login", json={"email": company.rep_email, "password": PASSWORD}
        )
        assert response.status_code == 200
        assert "access_token" in response.json()

    @pytest.mark.asyncio
    async def test_refresh_via_cookie(self, async_client: AsyncClient, db_session):
        company = await create_company(db_session, status=CompanyStatus.ACTIVE)
        await async_client.post(
            "/api/v1/auth/login",
            json={"email": company.rep_email, "password": PASSWORD},
            headers=BROWSER,
        )
        async_client.cookies.delete("access_token")
        response = await async_client.post("/api/v1/auth/refresh", headers=BROWSER)
        assert response.status_code == 200
        assert "access_token" not in response.json()
        assert any(c.startswith("access_token=") for c in _set_cookie_headers(response))
        assert (await async_client.get("/api/v1/auth/me")).status_code == 200

    @pytest.mark.asyncio
    async def test_admin_login_sets_admin_cookies(self, async_client: AsyncClient, db_session):
        admin = await create_admin(db_session)
        response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": admin.email, "password": PASSWORD},
            headers=BROWSER,
        )
        assert response.status_code == 200
        body = response.json()
        assert "session_token" not in body and "admin_token" not in body
        names = {c.split("=", 1)[0] for c in _set_cookie_headers(response)}
        assert {"access_token", "refresh_token", "session_token", "admin_token"} <= names
        me = await async_client.get("/api/v1/auth/me")
        assert me.status_code == 200
        assert me.json()["type"] == "admin"


@pytest.mark.integration
@pytest.mark.auth
class TestTokenRevocation:
    @pytest.mark.asyncio
    async def test_logout_revokes_access_and_refresh_tokens(self, async_client: AsyncClient, db_session):
        company = await create_company(db_session, status=CompanyStatus.ACTIVE)
        login = await async_client.post(
            "/api/v1/auth/login", json={"email": company.rep_email, "password": PASSWORD}
        )
        tokens = login.json()
        async_client.cookies.clear()
        auth = {"Authorization": f"Bearer {tokens['access_token']}"}

        assert (await async_client.get("/api/v1/auth/me", headers=auth)).status_code == 200
        assert (await async_client.post("/api/v1/auth/logout", headers=auth)).status_code == 200

        assert (await async_client.get("/api/v1/auth/me", headers=auth)).status_code == 401
        refresh = await async_client.post(
            "/api/v1/auth/refresh", headers={"Authorization": f"Bearer {tokens['refresh_token']}"}
        )
        assert refresh.status_code == 401

    @pytest.mark.asyncio
    async def test_logout_clears_cookies(self, async_client: AsyncClient, db_session):
        company = await create_company(db_session, status=CompanyStatus.ACTIVE)
        await async_client.post(
            "/api/v1/auth/login",
            json={"email": company.rep_email, "password": PASSWORD},
            headers=BROWSER,
        )
        response = await async_client.post("/api/v1/auth/logout", headers=BROWSER)
        assert response.status_code == 200
        cleared = {c.split("=", 1)[0] for c in _set_cookie_headers(response) if "Max-Age=0" in c}
        assert {"access_token", "refresh_token", "session_token", "admin_token"} <= cleared
        assert (await async_client.get("/api/v1/auth/me")).status_code == 401

    @pytest.mark.asyncio
    async def test_admin_logout_revokes_tokens(self, async_client: AsyncClient, db_session):
        admin = await create_admin(db_session)
        login = await async_client.post(
            "/api/v1/auth/login", json={"email": admin.email, "password": PASSWORD}
        )
        tokens = login.json()
        async_client.cookies.clear()
        headers = {
            "Authorization": f"Bearer {tokens['access_token']}",
            "X-Session-Token": tokens["session_token"],
            "X-Admin-Token": tokens["admin_token"],
        }
        assert (await async_client.get("/api/v1/auth/me", headers=headers)).status_code == 200
        assert (await async_client.post("/api/v1/auth/logout", headers=headers)).status_code == 200
        assert (await async_client.get("/api/v1/auth/me", headers=headers)).status_code == 401

    @pytest.mark.asyncio
    async def test_password_change_revokes_other_sessions(self, async_client: AsyncClient, db_session):
        company = await create_company(db_session, status=CompanyStatus.ACTIVE)
        other_session = (
            await async_client.post(
                "/api/v1/auth/login", json={"email": company.rep_email, "password": PASSWORD}
            )
        ).json()["access_token"]

        await async_client.post(
            "/api/v1/auth/login",
            json={"email": company.rep_email, "password": PASSWORD},
            headers=BROWSER,
        )
        response = await async_client.post(
            "/api/v1/auth/password/change",
            json={"current_password": PASSWORD, "new_password": "NewPassword123!"},
            headers=BROWSER,
        )
        assert response.status_code == 200

        # This browser session got fresh cookies and stays signed in
        assert (await async_client.get("/api/v1/auth/me")).status_code == 200
        # The other session is revoked
        async_client.cookies.clear()
        me = await async_client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {other_session}"}
        )
        assert me.status_code == 401

    @pytest.mark.asyncio
    async def test_token_without_tv_claim_still_valid(self, async_client: AsyncClient, company_token):
        # Tokens issued before the deploy have no `tv` claim -> treated as 0
        assert "tv" not in SecurityManager.decode_token(company_token)
        me = await async_client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {company_token}"}
        )
        assert me.status_code == 200

    @pytest.mark.asyncio
    async def test_refresh_token_cannot_be_used_as_access_token(self, async_client: AsyncClient, db_session):
        company = await create_company(db_session, status=CompanyStatus.ACTIVE)
        tokens = (
            await async_client.post(
                "/api/v1/auth/login", json={"email": company.rep_email, "password": PASSWORD}
            )
        ).json()
        async_client.cookies.clear()
        me = await async_client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {tokens['refresh_token']}"}
        )
        assert me.status_code == 401
