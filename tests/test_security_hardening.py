"""
Security hardening regression tests

Covers: admin write routes require EDITOR+ (VIEWER is read-only), legacy
/uploads/quotes/ is never served, ENVIRONMENT=production config checks, and
the legacy quote attachment migration script.
"""

import logging

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from backend.models.company import AdminRole, AdminUser

# Route-protection middleware only checks these are present; get_current_admin
# (which validates them) is overridden per test to pin the role.
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) test", "X-Session-Token": "s", "X-Admin-Token": "a"}


def assert_role_forbidden(response):
    assert response.status_code == 403, response.text
    assert response.json().get("error") == "INSUFFICIENT_PERMISSIONS", response.text


# ============================================================================
# Admin RBAC: VIEWER cannot write
# ============================================================================

@pytest.mark.integration
@pytest.mark.admin
class TestAdminWriteRoles:

    @pytest.fixture
    def as_role(self, async_client):
        from backend.api.dependencies import get_current_admin
        from tests.conftest import get_app

        app = get_app()

        def _set(role: AdminRole):
            admin = AdminUser(id=424242, username=f"rbac-{role.value}", email="rbac@example.com",
                              role=role, is_active=True)
            app.dependency_overrides[get_current_admin] = lambda: admin

        yield _set
        app.dependency_overrides.pop(get_current_admin, None)

    @pytest.fixture
    def stub_cms_write(self, monkeypatch):
        from backend.services.cms_admin_service import CMSAdminService

        calls = []

        async def _update_team_member(db, member_id, **updates):
            calls.append((member_id, updates))
            return None, True  # (member, exported)

        monkeypatch.setattr(CMSAdminService, "update_team_member", staticmethod(_update_team_member))
        return calls

    @pytest.mark.asyncio
    async def test_viewer_forbidden_editor_allowed_on_cms_write(self, async_client, as_role, stub_cms_write):
        url = "/api/v1/cms-admin/team-members/1"

        as_role(AdminRole.VIEWER)
        response = await async_client.patch(url, json={"name": "New Name"}, headers=UA)
        assert_role_forbidden(response)
        assert stub_cms_write == []

        as_role(AdminRole.EDITOR)
        response = await async_client.patch(url, json={"name": "New Name"}, headers=UA)
        assert response.status_code == 200, response.text
        assert stub_cms_write == [(1, {"name": "New Name"})]

    @pytest.mark.asyncio
    @pytest.mark.parametrize("method,url", [
        ("delete", "/api/v1/admin/upload/image?file_url=/uploads/images/x.png"),
        ("post", "/api/v1/admin/virtual-catalog/cleanup"),
        ("delete", "/api/v1/admin/ai/training/1"),
        ("put", "/api/v1/admin/upholsteries/1"),
        ("post", "/api/v1/cms-admin/export-all"),
    ])
    async def test_viewer_forbidden_on_write_routes(self, async_client, as_role, method, url):
        as_role(AdminRole.VIEWER)
        response = await getattr(async_client, method)(url, headers=UA)
        assert_role_forbidden(response)

    @pytest.mark.asyncio
    @pytest.mark.parametrize("method,url", [
        ("post", "/api/v1/admin/virtual-catalog/cleanup"),
        ("put", "/api/v1/admin/upholsteries/1"),
        ("delete", "/api/v1/admin/ai/training/1"),
    ])
    async def test_editor_forbidden_on_admin_level_routes(self, async_client, as_role, method, url):
        as_role(AdminRole.EDITOR)
        response = await getattr(async_client, method)(url, headers=UA)
        assert_role_forbidden(response)


# ============================================================================
# Legacy /uploads/quotes/ is never served
# ============================================================================

@pytest.mark.unit
class TestUploadsQuotesBlocked:

    @pytest.mark.asyncio
    async def test_quotes_subtree_is_404(self, tmp_path):
        from starlette.applications import Starlette

        from backend.main import _PublicUploads

        (tmp_path / "quotes" / "Q-1").mkdir(parents=True)
        (tmp_path / "quotes" / "Q-1" / "plan.pdf").write_bytes(b"%PDF-1.4 secret")
        (tmp_path / "images").mkdir()
        (tmp_path / "images" / "a.png").write_bytes(b"\x89PNG\r\n\x1a\npublic")

        app = Starlette()
        app.mount("/uploads", _PublicUploads(directory=str(tmp_path)), name="uploads")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
            assert (await c.get("/uploads/images/a.png")).status_code == 200
            for path in (
                "/uploads/quotes/Q-1/plan.pdf",
                "/uploads/quotes/",
                "/uploads/QUOTES/Q-1/plan.pdf",
                "/uploads//quotes/Q-1/plan.pdf",
                "/uploads/images/../quotes/Q-1/plan.pdf",
                "/uploads/images/..%2fquotes/Q-1/plan.pdf",
            ):
                response = await c.get(path)
                assert response.status_code == 404, path
                assert b"secret" not in response.content


# ============================================================================
# ENVIRONMENT=production config checks
# ============================================================================

@pytest.mark.unit
class TestProductionEnvironmentConfig:

    STRONG_KEY = "k" * 48

    @pytest.fixture
    def make_settings(self, monkeypatch):
        from backend.core.config import Settings

        def _make(**env):
            for key in ("ENVIRONMENT", "DEBUG", "SECRET_KEY", "ALLOWED_HOSTS", "CORS_ORIGINS", "TESTING"):
                monkeypatch.delenv(key, raising=False)
            for key, value in env.items():
                monkeypatch.setenv(key, value)
            return Settings()

        return _make

    def test_production_with_debug_still_requires_secret_key(self, make_settings):
        with pytest.raises(ValueError, match="SECRET_KEY"):
            make_settings(ENVIRONMENT="production", DEBUG="true")

    def test_production_with_debug_warns_on_short_secret_key(self, make_settings, caplog):
        # Short keys are flagged loudly but don't stop the site from starting
        with caplog.at_level(logging.CRITICAL, logger="backend.core.config"):
            make_settings(ENVIRONMENT="production", DEBUG="true", SECRET_KEY="short")
        assert "shorter than 32" in " ".join(r.getMessage() for r in caplog.records)

    def test_production_with_debug_disables_docs_and_warns(self, make_settings, caplog):
        with caplog.at_level(logging.CRITICAL, logger="backend.core.config"):
            s = make_settings(ENVIRONMENT="production", DEBUG="true", SECRET_KEY=self.STRONG_KEY)
        assert s.DEBUG is True
        assert s.docs_enabled is False
        messages = " ".join(r.getMessage() for r in caplog.records)
        assert "DEBUG=true" in messages
        assert "ALLOWED_HOSTS" in messages
        assert "localhost" in messages

    def test_production_with_explicit_hosts_does_not_warn(self, make_settings, caplog):
        with caplog.at_level(logging.CRITICAL, logger="backend.core.config"):
            make_settings(
                ENVIRONMENT="production", DEBUG="true", SECRET_KEY=self.STRONG_KEY,
                ALLOWED_HOSTS='["www.eaglechair.com"]', CORS_ORIGINS='["https://www.eaglechair.com"]',
            )
        assert not [r for r in caplog.records if "ALLOWED_HOSTS" in r.getMessage() or "CORS" in r.getMessage()]

    def test_development_debug_keeps_docs(self, make_settings):
        s = make_settings(DEBUG="true")
        assert s.docs_enabled is True


# ============================================================================
# Legacy quote attachment migration script
# ============================================================================

@pytest.mark.unit
class TestMigrateQuoteAttachments:

    def test_moves_valid_quarantines_invalid_and_is_idempotent(self, tmp_path, monkeypatch):
        from backend.database.base import Base
        from backend.models.quote import QuoteAttachment
        from backend.scripts import migrate_quote_attachments as mig

        engine = create_engine(f"sqlite:///{tmp_path / 'm.db'}")
        Base.metadata.create_all(engine, tables=[QuoteAttachment.__table__])
        monkeypatch.setattr(mig, "create_engine", lambda *a, **k: engine)
        monkeypatch.setattr(mig, "QUOTE_ATTACHMENT_DIR", tmp_path / "private" / "quotes")
        monkeypatch.setattr(mig, "REJECTED_DIR", tmp_path / "private" / "rejected" / "quotes")

        uploads = tmp_path / "uploads"
        (uploads / "quotes" / "Q-1").mkdir(parents=True)
        (uploads / "quotes" / "Q-1" / "1700_plan.pdf").write_bytes(b"%PDF-1.4 plan")
        (uploads / "quotes" / "Q-1" / "1701_x.html").write_bytes(b"<script>x</script>")

        def att(url, ftype):
            return QuoteAttachment(quote_id=1, file_name="f", file_url=url, file_type=ftype,
                                   file_size_bytes=1, attachment_type="general", uploaded_at="x")

        with Session(engine) as db:
            db.add_all([att("/uploads/quotes/Q-1/1700_plan.pdf", "text/plain"),
                        att("/uploads/quotes/Q-1/1701_x.html", "text/html")])
            db.commit()

        dry = mig.run(uploads, dry_run=True)
        assert (dry["moved"], dry["quarantined"]) == (1, 1)
        assert (uploads / "quotes" / "Q-1" / "1700_plan.pdf").exists()

        stats = mig.run(uploads, dry_run=False)
        assert (stats["moved"], stats["quarantined"], stats["rows_updated"]) == (1, 1, 2)
        assert not (uploads / "quotes").exists() or not any((uploads / "quotes").rglob("*.*"))

        with Session(engine) as db:
            rows = {r.file_name + str(r.id): r for r in db.execute(select(QuoteAttachment)).scalars()}
            urls = sorted(r.file_url for r in rows.values())
        pdf_url = next(u for u in urls if u.startswith("/api/v1/admin/quotes/attachments/Q-1/"))
        name = pdf_url.rsplit("/", 1)[1]
        from backend.api.v1.routes.admin.quotes import _ATTACHMENT_NAME_RE
        assert _ATTACHMENT_NAME_RE.match(name)
        assert (tmp_path / "private" / "quotes" / "Q-1" / name).read_bytes() == b"%PDF-1.4 plan"
        assert any(u.startswith("quarantined:") for u in urls)
        assert (tmp_path / "private" / "rejected" / "quotes" / "Q-1" / "1701_x.html").exists()

        again = mig.run(uploads, dry_run=False)
        assert (again["moved"], again["quarantined"], again["rows_updated"]) == (0, 0, 0)


# ============================================================================
# Quote tax report / 10% auto-tax cleanup script
# ============================================================================

@pytest.mark.unit
class TestReportQuoteTax:

    def test_report_and_zero_only_ten_percent_quotes(self, tmp_path, monkeypatch, capsys):
        from backend.database.base import Base
        from backend.models.quote import Quote, QuoteStatus
        from backend.scripts import report_quote_tax as rpt

        engine = create_engine(f"sqlite:///{tmp_path / 't.db'}")
        Base.metadata.create_all(engine)
        monkeypatch.setattr(rpt, "create_engine", lambda *a, **k: engine)

        def quote(number, subtotal, tax, shipping=0, discount=0):
            return Quote(
                quote_number=number, contact_name="C", contact_email="c@example.com", contact_phone="1",
                shipping_address_line1="1 St", shipping_city="X", shipping_state="CA", shipping_zip="1",
                status=QuoteStatus.SUBMITTED, subtotal=subtotal, tax_amount=tax, shipping_cost=shipping,
                discount_amount=discount, total_amount=subtotal + tax + shipping - discount,
            )

        with Session(engine) as db:
            db.add_all([
                quote("Q-TEN", 12345, 1235, shipping=500, discount=100),   # round(1234.5) = 1234 -> within 1 cent
                quote("Q-MANUAL", 10000, 725),                              # hand-entered 7.25%
                quote("Q-ZERO", 10000, 0),
            ])
            db.commit()

        assert rpt.run(zero_ten_percent=False) == 0
        out = capsys.readouterr().out
        assert "Q-TEN" in out and "Q-MANUAL" in out and "Q-ZERO" not in out
        assert "2 quote(s) with tax > 0; 1 match 10%" in out

        monkeypatch.setattr("builtins.input", lambda prompt="": "no")
        assert rpt.run(zero_ten_percent=True) == 0

        monkeypatch.setattr("builtins.input", lambda prompt="": "yes")
        assert rpt.run(zero_ten_percent=True) == 1

        with Session(engine) as db:
            rows = {q.quote_number: q for q in db.execute(select(Quote)).scalars()}
        assert (rows["Q-TEN"].tax_amount, rows["Q-TEN"].total_amount) == (0, 12345 + 500 - 100)
        assert (rows["Q-MANUAL"].tax_amount, rows["Q-MANUAL"].total_amount) == (725, 10725)
