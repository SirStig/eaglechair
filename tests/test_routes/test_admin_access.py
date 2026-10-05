"""
Admin permissions, audit trail, admin management and step-up confirmation
(backend/core/admin_permissions.py, backend/services/audit_service.py,
backend/services/admin_confirmation.py, routes/admin/admins.py,
routes/admin/audit_log.py)
"""

import pytest
from sqlalchemy import select

from backend.core.admin_permissions import (
    Permission,
    effective_permissions,
    missing_permissions,
    normalize_permissions,
    required_permissions,
)
from backend.core.ephemeral_store import ephemeral_store
from backend.models.company import AdminAuditLog, AdminRole, AdminUser
from backend.services.audit_service import describe_request
from tests.factories import create_admin, create_category, create_color

UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) test"}
ADMINS = "/api/v1/admin/admins"
PASSWORD = "TestPassword123!"


@pytest.fixture(autouse=True)
def _clear_confirmations():
    ephemeral_store.clear_memory()
    yield
    ephemeral_store.clear_memory()


def _admin(role, permissions=None):
    return AdminUser(id=1, username="x", role=role, permissions=permissions, is_active=True)


async def _headers(db_session, admin):
    """Full admin auth headers (JWT + per-login session tokens) for `admin`"""
    import secrets

    from backend.core.security import SecurityManager

    token = SecurityManager().create_access_token(
        data={"sub": str(admin.id), "type": "admin", "email": admin.email, "role": admin.role.value}
    )
    session_token, admin_token = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    admin.session_token = SecurityManager.hash_token(session_token)
    admin.admin_token = SecurityManager.hash_token(admin_token)
    await db_session.commit()
    return {
        **UA,
        "Authorization": f"Bearer {token}",
        "X-Session-Token": session_token,
        "X-Admin-Token": admin_token,
    }


async def _logs(db_session, **filters):
    query = select(AdminAuditLog).order_by(AdminAuditLog.id)
    for field, value in filters.items():
        query = query.where(getattr(AdminAuditLog, field) == value)
    return (await db_session.execute(query)).scalars().all()


# ============================================================================
# Policy
# ============================================================================

@pytest.mark.unit
class TestPermissionPolicy:
    def test_role_defaults(self):
        assert effective_permissions(_admin(AdminRole.VIEWER)) == frozenset()
        editor = effective_permissions(_admin(AdminRole.EDITOR))
        assert Permission.EDIT_CATALOG in editor and Permission.DELETE not in editor
        admin = effective_permissions(_admin(AdminRole.ADMIN))
        assert {Permission.DELETE, Permission.VIEW_AUDIT} <= admin
        assert Permission.MANAGE_ADMINS not in admin
        assert effective_permissions(_admin(AdminRole.SUPER_ADMIN)) == frozenset(Permission)

    def test_override_replaces_defaults_but_never_grants_super_admin_powers(self):
        custom = _admin(AdminRole.EDITOR, ["edit_catalog", "delete", "manage_admins", "bogus"])
        assert effective_permissions(custom) == {Permission.EDIT_CATALOG, Permission.DELETE}
        # Super admins always hold everything, whatever is stored
        assert effective_permissions(_admin(AdminRole.SUPER_ADMIN, [])) == frozenset(Permission)

    def test_normalize(self):
        assert normalize_permissions(AdminRole.EDITOR, ["edit_catalog", "edit_sales", "edit_content"]) is None
        assert normalize_permissions(AdminRole.EDITOR, ["delete", "edit_catalog"]) == ["delete", "edit_catalog"]
        with pytest.raises(ValueError):
            normalize_permissions(AdminRole.ADMIN, ["manage_admins"])

    @pytest.mark.parametrize("method,path,needed", [
        ("GET", "/api/v1/admin/products", set()),
        ("PATCH", "/api/v1/admin/products/1", {Permission.EDIT_CATALOG}),
        ("DELETE", "/api/v1/admin/products/1", {Permission.EDIT_CATALOG, Permission.DELETE}),
        ("PATCH", "/api/v1/admin/quotes/3/status", {Permission.EDIT_SALES}),
        ("POST", "/api/v1/admin/bulk/companies", {Permission.EDIT_SALES}),
        ("POST", "/api/v1/admin/bulk/legal-documents", {Permission.EDIT_CONTENT}),
        ("POST", "/api/v1/admin/bulk/finishes/delete",
         {Permission.EDIT_CATALOG, Permission.DELETE, Permission.PERMANENT_DELETE}),
        ("PATCH", "/api/v1/cms-admin/team-members/1", {Permission.EDIT_CONTENT}),
        ("DELETE", "/api/v1/cms-admin/team-members/1", {Permission.EDIT_CONTENT, Permission.DELETE}),
        ("POST", "/api/v1/admin/catalog-builder/preview", set()),
        ("DELETE", "/api/v1/admin/ai/chats/abc", set()),
        ("POST", "/api/v1/admin/ai/edits/apply", {Permission.EDIT_CATALOG}),
        ("GET", "/api/v1/admin/admins", {Permission.MANAGE_ADMINS}),
        ("GET", "/api/v1/admin/audit-log", {Permission.VIEW_AUDIT}),
        ("POST", "/api/v1/auth/password/change", set()),
    ])
    def test_required_permissions(self, method, path, needed):
        assert required_permissions(method, path) == needed

    def test_hard_delete_needs_permanent_delete(self):
        admin = _admin(AdminRole.ADMIN)
        assert not missing_permissions(admin, "DELETE", "/api/v1/admin/catalog/colors/1")
        assert missing_permissions(
            admin, "DELETE", "/api/v1/admin/catalog/colors/1", {"hard_delete": "true"}
        ) == {Permission.PERMANENT_DELETE}
        assert missing_permissions(admin, "DELETE", "/api/v1/admin/products/1", {"hard": "1"})
        assert not missing_permissions(
            _admin(AdminRole.SUPER_ADMIN), "DELETE", "/api/v1/admin/products/1", {"hard": "true"}
        )

    def test_missing_permissions(self):
        sales_only = _admin(AdminRole.EDITOR, ["edit_sales"])
        assert missing_permissions(sales_only, "PATCH", "/api/v1/admin/products/1") == {Permission.EDIT_CATALOG}
        assert not missing_permissions(sales_only, "PATCH", "/api/v1/admin/companies/1")


@pytest.mark.unit
class TestDescribeRequest:
    @pytest.mark.parametrize("method,path,action,resource_type,resource_id,target", [
        ("DELETE", "/api/v1/admin/products/12/variations/5", "delete", "products", 12, "variations/5"),
        ("PATCH", "/api/v1/admin/catalog/colors/3", "update", "colors", 3, None),
        ("POST", "/api/v1/admin/categories", "create", "categories", None, None),
        ("POST", "/api/v1/admin/categories/reorder", "reorder", "categories", None, None),
        ("PATCH", "/api/v1/admin/quotes/7/status", "update_status", "quotes", 7, None),
        ("POST", "/api/v1/admin/quotes/7/items", "create", "quotes", 7, "items"),
        ("POST", "/api/v1/admin/bulk/finishes", "bulk_edit", "finishes", None, None),
        ("POST", "/api/v1/admin/bulk/finishes/delete", "permanent_delete", "finishes", None, None),
        ("POST", "/api/v1/admin/admins/4/reset-password", "reset_password", "admins", 4, None),
        ("POST", "/api/v1/cms-admin/hero-slides", "create", "hero-slides", None, None),
    ])
    def test_describe(self, method, path, action, resource_type, resource_id, target):
        assert describe_request(method, path) == {
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "target": target,
        }


# ============================================================================
# Enforcement + audit trail (real admin auth, no dependency overrides)
# ============================================================================

@pytest.mark.integration
@pytest.mark.admin
class TestAuditTrail:
    async def test_write_is_recorded_with_redacted_body(self, async_client, db_session):
        editor = await create_admin(db_session, role=AdminRole.EDITOR)
        headers = await _headers(db_session, editor)
        category = await create_category(db_session)

        response = await async_client.put(
            f"/api/v1/admin/categories/{category.id}",
            json={"name": "Renamed", "password": "hunter2"},
            headers=headers,
        )
        assert response.status_code == 200, response.text

        [entry] = await _logs(db_session, admin_id=editor.id)
        assert (entry.action, entry.resource_type, entry.resource_id) == ("update", "categories", category.id)
        assert entry.details["outcome"] == "success"
        assert entry.details["label"] == "Renamed"
        assert entry.details["body"]["password"] == "[redacted]"
        assert entry.ip_address

    async def test_reads_are_not_recorded(self, async_client, db_session):
        viewer = await create_admin(db_session, role=AdminRole.VIEWER)
        headers = await _headers(db_session, viewer)
        assert (await async_client.get("/api/v1/admin/categories", headers=headers)).status_code == 200
        assert await _logs(db_session, admin_id=viewer.id) == []

    async def test_denied_write_is_blocked_and_recorded(self, async_client, db_session):
        editor = await create_admin(db_session, role=AdminRole.EDITOR)
        headers = await _headers(db_session, editor)
        category = await create_category(db_session)

        response = await async_client.delete(f"/api/v1/admin/categories/{category.id}", headers=headers)
        assert response.status_code == 403
        assert "Delete" in response.json()["message"]

        [entry] = await _logs(db_session, admin_id=editor.id)
        assert entry.action == "denied"
        assert entry.details["attempted"] == "delete"
        assert entry.resource_id == category.id

    async def test_granted_permission_beats_role(self, async_client, db_session):
        color = await create_color(db_session)
        plain = await create_admin(db_session, role=AdminRole.EDITOR)
        denied = await async_client.delete(
            f"/api/v1/admin/catalog/colors/{color.id}", headers=await _headers(db_session, plain)
        )
        assert denied.status_code == 403

        granted = await create_admin(db_session, role=AdminRole.EDITOR, permissions=["edit_catalog", "delete"])
        response = await async_client.delete(
            f"/api/v1/admin/catalog/colors/{color.id}", headers=await _headers(db_session, granted)
        )
        assert response.status_code == 200, response.text

    async def test_login_and_failed_login_are_recorded(self, async_client, db_session):
        admin = await create_admin(db_session)
        bad = await async_client.post(
            "/api/v1/auth/login", json={"email": admin.email, "password": "WrongPassword1"}, headers=UA
        )
        assert bad.status_code == 401
        good = await async_client.post(
            "/api/v1/auth/login", json={"email": admin.email, "password": PASSWORD}, headers=UA
        )
        assert good.status_code == 200, good.text
        assert "permissions" in good.json()["user"]
        assert [e.action for e in await _logs(db_session, admin_id=admin.id)] == ["login_failed", "login"]

    async def test_activity_log_listing_and_access(self, async_client, db_session):
        admin = await create_admin(db_session, role=AdminRole.ADMIN)
        editor = await create_admin(db_session, role=AdminRole.EDITOR)
        category = await create_category(db_session, name="Stools")
        editor_headers = await _headers(db_session, editor)
        await async_client.put(
            f"/api/v1/admin/categories/{category.id}", json={"name": "Bar Stools"}, headers=editor_headers
        )

        # Editors can't see the log by default (the refused attempt is itself logged)
        assert (await async_client.get("/api/v1/admin/audit-log", headers=editor_headers)).status_code == 403

        headers = await _headers(db_session, admin)
        response = await async_client.get(
            "/api/v1/admin/audit-log", params={"admin_id": editor.id, "action": "update"}, headers=headers
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["total"] == 1
        item = body["items"][0]
        assert item["admin"]["id"] == editor.id
        assert item["resource_name"] == "Bar Stools"
        assert item["created_at"].endswith("+00:00")

        by_record = await async_client.get(
            "/api/v1/admin/audit-log",
            params={"resource_type": "categories", "resource_id": category.id},
            headers=headers,
        )
        assert by_record.json()["total"] == 1

        filters = await async_client.get("/api/v1/admin/audit-log/filters", headers=headers)
        assert "categories" in filters.json()["resource_types"]

    async def test_ai_edit_entries_join_record_history(self, async_client, db_session):
        from tests.factories import create_admin_audit_log

        admin = await create_admin(db_session, role=AdminRole.ADMIN)
        category = await create_category(db_session, name="Booths")
        await create_admin_audit_log(
            db_session, admin.id, action="AI_UPDATE_CATEGORY", resource_type="category", resource_id=category.id
        )
        headers = await _headers(db_session, admin)
        response = await async_client.get(
            "/api/v1/admin/audit-log",
            params={"resource_type": "categories", "resource_id": category.id},
            headers=headers,
        )
        [item] = response.json()["items"]
        assert item["resource_type"] == "categories"
        assert item["resource_name"] == "Booths"


# ============================================================================
# Admin management + step-up confirmation
# ============================================================================

@pytest.mark.integration
@pytest.mark.admin
class TestAdminManagement:
    async def _super(self, db_session):
        admin = await create_admin(db_session, role=AdminRole.SUPER_ADMIN)
        return admin, await _headers(db_session, admin)

    async def _confirm(self, client, headers):
        response = await client.post("/api/v1/auth/admin/confirm", json={"password": PASSWORD}, headers=headers)
        assert response.status_code == 200, response.text
        return response

    async def test_only_super_admins(self, async_client, db_session):
        admin = await create_admin(db_session, role=AdminRole.ADMIN)
        headers = await _headers(db_session, admin)
        assert (await async_client.get(ADMINS, headers=headers)).status_code == 403

    async def test_list_includes_catalogue(self, async_client, db_session):
        _, headers = await self._super(db_session)
        body = (await async_client.get(ADMINS, headers=headers)).json()
        assert [r["value"] for r in body["roles"]] == ["viewer", "editor", "admin", "super_admin"]
        assert any(p["value"] == "delete" and p["grantable"] for p in body["permissions"])

    async def test_writes_need_recent_confirmation(self, async_client, db_session):
        admin, headers = await self._super(db_session)
        new = {
            "username": "kat", "email": "kat@example.com", "first_name": "Katarina",
            "last_name": "Kac-Statton", "role": "editor", "password": "Sup3rSecretPass",
        }
        blocked = await async_client.post(ADMINS, json=new, headers=headers)
        assert blocked.status_code == 403
        assert blocked.json()["error"] == "REAUTH_REQUIRED"

        wrong = await async_client.post("/api/v1/auth/admin/confirm", json={"password": "nope"}, headers=headers)
        assert wrong.status_code == 401

        await self._confirm(async_client, headers)
        created = await async_client.post(ADMINS, json=new, headers=headers)
        assert created.status_code == 201, created.text
        assert created.json()["permissions"] == ["edit_catalog", "edit_content", "edit_sales"]

        actions = [e.action for e in await _logs(db_session, admin_id=admin.id)]
        assert actions[-3:] == ["confirm_failed", "confirm_identity", "create"]
        create_entry = (await _logs(db_session, admin_id=admin.id, action="create"))[0]
        assert create_entry.details["body"]["password"] == "[redacted]"

    async def test_confirmation_status(self, async_client, db_session):
        _, headers = await self._super(db_session)
        status = (await async_client.get("/api/v1/auth/admin/confirm", headers=headers)).json()
        assert status["confirmedUntil"] is None and status["hasPasskey"] is False
        await self._confirm(async_client, headers)
        status = (await async_client.get("/api/v1/auth/admin/confirm", headers=headers)).json()
        assert status["confirmedUntil"]

    async def test_edit_role_and_custom_permissions(self, async_client, db_session):
        _, headers = await self._super(db_session)
        target = await create_admin(db_session, role=AdminRole.EDITOR)
        await self._confirm(async_client, headers)

        response = await async_client.patch(
            f"{ADMINS}/{target.id}", json={"role": "admin", "last_name": "Kac-Statton"}, headers=headers
        )
        assert response.status_code == 200, response.text
        assert response.json()["role"] == "admin"
        assert response.json()["custom_permissions"] is False
        assert response.json()["last_name"] == "Kac-Statton"

        response = await async_client.patch(
            f"{ADMINS}/{target.id}", json={"permissions": ["edit_catalog", "view_audit"]}, headers=headers
        )
        assert response.json()["permissions"] == ["edit_catalog", "view_audit"]
        assert response.json()["custom_permissions"] is True

        bad = await async_client.patch(
            f"{ADMINS}/{target.id}", json={"permissions": ["manage_admins"]}, headers=headers
        )
        assert bad.status_code == 400

    async def test_cannot_demote_or_deactivate_self(self, async_client, db_session):
        me, headers = await self._super(db_session)
        await self._confirm(async_client, headers)
        own = await async_client.patch(f"{ADMINS}/{me.id}", json={"role": "admin"}, headers=headers)
        assert own.status_code == 400
        own = await async_client.patch(f"{ADMINS}/{me.id}", json={"is_active": False}, headers=headers)
        assert own.status_code == 400
        # Editing your own name is fine
        ok = await async_client.patch(f"{ADMINS}/{me.id}", json={"first_name": "Josh"}, headers=headers)
        assert ok.status_code == 200

        other = await create_admin(db_session, role=AdminRole.SUPER_ADMIN)
        demoted = await async_client.patch(f"{ADMINS}/{other.id}", json={"role": "admin"}, headers=headers)
        assert demoted.status_code == 200  # two super admins existed

    async def test_deactivate_signs_out_and_blocks(self, async_client, db_session):
        _, headers = await self._super(db_session)
        target = await create_admin(db_session, role=AdminRole.EDITOR)
        target_headers = await _headers(db_session, target)
        version = target.token_version or 0
        await self._confirm(async_client, headers)

        response = await async_client.patch(f"{ADMINS}/{target.id}", json={"is_active": False}, headers=headers)
        assert response.status_code == 200
        await db_session.refresh(target)
        assert target.token_version == version + 1
        assert (await async_client.get("/api/v1/admin/categories", headers=target_headers)).status_code == 401

    async def test_reset_password_and_unlock(self, async_client, db_session):
        _, headers = await self._super(db_session)
        target = await create_admin(db_session, failed_login_attempts=5, locked_until="2999-01-01T00:00:00")
        await self._confirm(async_client, headers)

        weak = await async_client.post(
            f"{ADMINS}/{target.id}/reset-password", json={"new_password": "short"}, headers=headers
        )
        assert weak.status_code == 400
        ok = await async_client.post(
            f"{ADMINS}/{target.id}/reset-password", json={"new_password": "BrandNewPass9"}, headers=headers
        )
        assert ok.status_code == 200, ok.text
        await db_session.refresh(target)
        assert target.locked_until is None and target.failed_login_attempts == 0

        login = await async_client.post(
            "/api/v1/auth/login", json={"email": target.email, "password": "BrandNewPass9"}, headers=UA
        )
        assert login.status_code == 200

    async def test_duplicate_email_rejected(self, async_client, db_session):
        _, headers = await self._super(db_session)
        existing = await create_admin(db_session)
        await self._confirm(async_client, headers)
        response = await async_client.post(ADMINS, json={
            "username": "newperson", "email": existing.email.upper(), "first_name": "A",
            "last_name": "B", "password": "Sup3rSecretPass",
        }, headers=headers)
        assert response.status_code == 409
