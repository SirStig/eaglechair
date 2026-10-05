"""
Admin device sessions (backend/services/admin_session_service.py): one row
per sign-in, listed under /auth/admin/sessions and signed out individually.
"""

import pytest
from sqlalchemy import select

from backend.models.company import AdminRole, AdminSession
from backend.services.admin_session_service import device_label
from tests.factories import create_admin

PASSWORD = "TestPassword123!"
CHROME_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36"
SAFARI_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
SESSIONS = "/api/v1/auth/admin/sessions"


async def _login(client, admin, user_agent=CHROME_MAC):
    """Sign in like a separate device; returns header-based auth for it"""
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": admin.email, "password": PASSWORD},
        headers={"User-Agent": user_agent},
    )
    assert response.status_code == 200, response.text
    client.cookies.clear()  # cookies would win over headers
    body = response.json()
    return {
        "User-Agent": user_agent,
        "Authorization": f"Bearer {body['access_token']}",
        "X-Session-Token": body["session_token"],
        "X-Admin-Token": body["admin_token"],
        "_refresh": body["refresh_token"],
    }


def _h(device):
    return {k: v for k, v in device.items() if not k.startswith("_")}


@pytest.mark.unit
def test_device_label():
    assert device_label(CHROME_MAC) == "Chrome on macOS"
    assert device_label(SAFARI_IPHONE) == "Safari on iPhone"
    assert device_label(None) is None


@pytest.mark.integration
@pytest.mark.admin
class TestAdminSessions:
    async def test_each_login_is_a_session_and_both_stay_signed_in(self, async_client, db_session):
        admin = await create_admin(db_session)
        laptop = await _login(async_client, admin)
        phone = await _login(async_client, admin, SAFARI_IPHONE)

        # Signing in on the phone no longer signs the laptop out
        assert (await async_client.get("/api/v1/admin/categories", headers=_h(laptop))).status_code == 200
        assert (await async_client.get("/api/v1/admin/categories", headers=_h(phone))).status_code == 200

        rows = (await db_session.execute(select(AdminSession).where(AdminSession.admin_id == admin.id))).scalars().all()
        assert len(rows) == 2

        listed = await async_client.get(SESSIONS, headers=_h(laptop))
        assert listed.status_code == 200, listed.text
        items = listed.json()["items"]
        assert {i["device"] for i in items} == {"Chrome on macOS", "Safari on iPhone"}
        current = [i for i in items if i["current"]]
        assert len(current) == 1 and current[0]["device"] == "Chrome on macOS"
        assert all(i["active"] and i["login_method"] == "password" for i in items)

    async def test_revoking_a_session_signs_that_device_out(self, async_client, db_session):
        admin = await create_admin(db_session)
        laptop = await _login(async_client, admin)
        phone = await _login(async_client, admin, SAFARI_IPHONE)
        items = (await async_client.get(SESSIONS, headers=_h(laptop))).json()["items"]
        phone_id = next(i["id"] for i in items if i["device"] == "Safari on iPhone")

        response = await async_client.delete(f"{SESSIONS}/{phone_id}", headers=_h(laptop))
        assert response.status_code == 200, response.text
        assert response.json()["current"] is False

        assert (await async_client.get("/api/v1/admin/categories", headers=_h(phone))).status_code == 401
        assert (await async_client.get("/api/v1/admin/categories", headers=_h(laptop))).status_code == 200

        # Its refresh token is dead too
        refreshed = await async_client.post(
            "/api/v1/auth/refresh",
            headers={"User-Agent": SAFARI_IPHONE, "Authorization": f"Bearer {phone['_refresh']}"},
        )
        assert refreshed.status_code == 401, refreshed.text
        assert "signed out" in refreshed.json()["message"]

    async def test_cannot_revoke_someone_elses_session(self, async_client, db_session):
        mine = await create_admin(db_session)
        other = await create_admin(db_session)
        me = await _login(async_client, mine)
        await _login(async_client, other)
        other_session = (
            await db_session.execute(select(AdminSession).where(AdminSession.admin_id == other.id))
        ).scalars().first()
        response = await async_client.delete(f"{SESSIONS}/{other_session.id}", headers=_h(me))
        assert response.status_code == 404

    async def test_revoke_others_keeps_current(self, async_client, db_session):
        admin = await create_admin(db_session)
        a = await _login(async_client, admin)
        b = await _login(async_client, admin, SAFARI_IPHONE)
        c = await _login(async_client, admin)

        response = await async_client.post(f"{SESSIONS}/revoke-others", headers=_h(c))
        assert response.status_code == 200, response.text
        assert response.json()["count"] == 2
        for device in (a, b):
            assert (await async_client.get("/api/v1/admin/categories", headers=_h(device))).status_code == 401
        assert (await async_client.get("/api/v1/admin/categories", headers=_h(c))).status_code == 200

    async def test_refresh_keeps_session(self, async_client, db_session):
        admin = await create_admin(db_session)
        device = await _login(async_client, admin)
        refreshed = await async_client.post(
            "/api/v1/auth/refresh",
            headers={"User-Agent": CHROME_MAC, "Authorization": f"Bearer {device['_refresh']}"},
        )
        assert refreshed.status_code == 200, refreshed.text
        async_client.cookies.clear()
        device["Authorization"] = f"Bearer {refreshed.json()['access_token']}"
        listed = await async_client.get(SESSIONS, headers=_h(device))
        assert listed.status_code == 200
        assert len(listed.json()["items"]) == 1 and listed.json()["items"][0]["current"]

    async def test_logout_ends_only_this_device(self, async_client, db_session):
        admin = await create_admin(db_session)
        laptop = await _login(async_client, admin)
        phone = await _login(async_client, admin, SAFARI_IPHONE)
        out = await async_client.post("/api/v1/auth/logout", headers=_h(phone))
        assert out.status_code == 200
        async_client.cookies.clear()
        assert (await async_client.get("/api/v1/admin/categories", headers=_h(phone))).status_code == 401
        assert (await async_client.get("/api/v1/admin/categories", headers=_h(laptop))).status_code == 200

    async def test_password_change_signs_out_other_devices(self, async_client, db_session):
        admin = await create_admin(db_session)
        laptop = await _login(async_client, admin)
        phone = await _login(async_client, admin, SAFARI_IPHONE)
        changed = await async_client.post(
            "/api/v1/auth/password/change",
            json={"current_password": PASSWORD, "new_password": "BrandNewPass9"},
            headers=_h(laptop),
        )
        assert changed.status_code == 200, changed.text
        async_client.cookies.clear()
        assert (await async_client.get("/api/v1/admin/categories", headers=_h(phone))).status_code == 401
        rows = (await db_session.execute(
            select(AdminSession).where(AdminSession.admin_id == admin.id, AdminSession.revoked_at.is_(None))
        )).scalars().all()
        assert len(rows) == 1  # the fresh session for the laptop

    async def test_tokens_without_sid_still_work(self, async_client, db_session, admin_headers):
        """Tokens issued before device sessions existed (conftest admin_headers has no sid)"""
        response = await async_client.get("/api/v1/admin/categories", headers=admin_headers)
        assert response.status_code == 200
        listed = await async_client.get(SESSIONS, headers=admin_headers)
        assert listed.status_code == 200
        assert listed.json()["current_session_id"] is None

    async def test_super_admin_sees_other_admins_sessions(self, async_client, db_session):
        boss = await create_admin(db_session, role=AdminRole.SUPER_ADMIN)
        staff = await create_admin(db_session)
        await _login(async_client, staff, SAFARI_IPHONE)
        boss_device = await _login(async_client, boss)
        response = await async_client.get(f"/api/v1/admin/admins/{staff.id}/sessions", headers=_h(boss_device))
        assert response.status_code == 200, response.text
        assert [i["device"] for i in response.json()["items"]] == ["Safari on iPhone"]

        staff_device = await _login(async_client, staff)
        forbidden = await async_client.get(f"/api/v1/admin/admins/{boss.id}/sessions", headers=_h(staff_device))
        assert forbidden.status_code == 403
