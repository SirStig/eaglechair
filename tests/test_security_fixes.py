"""
Security regression tests

Covers: profile mass assignment, guest quote attachment validation/storage,
AI calculator / webpage fetch hardening, and sandboxed email templates.
"""

import httpx
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.exceptions import ValidationError
from backend.models.company import CompanyStatus
from backend.models.quote import QuoteAttachment

PDF_BYTES = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"
PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


# ============================================================================
# #1 / #3 / #6 - /auth/me
# ============================================================================

@pytest.mark.integration
@pytest.mark.auth
class TestProfileSecurity:

    @pytest.mark.asyncio
    async def test_patch_me_ignores_privileged_fields(
        self, async_client: AsyncClient, test_company, company_token: str, db_session: AsyncSession
    ):
        original_status = test_company.status
        original_verified = test_company.is_verified
        original_credit = test_company.credit_limit
        original_tier = test_company.pricing_tier_id
        original_tax_id = test_company.tax_id

        response = await async_client.patch(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {company_token}"},
            json={
                "company_name": "Renamed Co",
                "is_verified": not original_verified,
                "status": "suspended" if original_status == CompanyStatus.ACTIVE else "active",
                "credit_limit": 999999999,
                "payment_terms": "Net 365",
                "pricing_tier_id": 12345,
                "admin_notes": "self-written note",
                "hashed_password": "x",
                "tax_id": "99-9999999",
            },
        )

        assert response.status_code == 200
        await db_session.refresh(test_company)
        assert test_company.company_name == "Renamed Co"
        assert test_company.status == original_status
        assert test_company.is_verified == original_verified
        assert test_company.credit_limit == original_credit
        assert test_company.pricing_tier_id == original_tier
        assert test_company.payment_terms != "Net 365"
        assert test_company.admin_notes != "self-written note"
        assert test_company.hashed_password != "x"
        assert test_company.tax_id == original_tax_id

    @pytest.mark.asyncio
    async def test_get_me_does_not_leak_secrets(
        self, async_client: AsyncClient, test_company, company_token: str
    ):
        response = await async_client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {company_token}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_company.id
        assert data["company_name"] == test_company.company_name
        assert data["rep_email"] == test_company.rep_email
        for secret in (
            "hashed_password", "refresh_token", "password_reset_token",
            "email_verification_token", "admin_notes", "pricing_tier_id",
        ):
            assert secret not in data

    @pytest.mark.asyncio
    async def test_refresh_token_cannot_authenticate(
        self, async_client: AsyncClient, test_company
    ):
        from backend.core.security import SecurityManager

        refresh = SecurityManager().create_refresh_token(
            data={"sub": str(test_company.id), "type": "company"}
        )
        response = await async_client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {refresh}"}
        )
        assert response.status_code == 401


# ============================================================================
# #2 - Guest quote attachments
# ============================================================================

@pytest.mark.unit
class TestGuestAttachmentValidation:

    def test_accepts_valid_pdf_and_png(self):
        from backend.services.quote_service import QuoteService

        result = QuoteService.validate_guest_attachments([
            ("plan.pdf", PDF_BYTES, "application/pdf"),
            ("photo.PNG", PNG_BYTES, "image/png"),
        ])
        assert [(r[2], r[3]) for r in result] == [("application/pdf", ".pdf"), ("image/png", ".png")]

    @pytest.mark.parametrize("name,content", [
        ("evil.html", b"<script>alert(1)</script>"),
        ("evil.svg", b"<svg onload=alert(1)>"),
        ("evil.pdf", b"<html><script>alert(1)</script></html>"),  # extension ok, magic bytes wrong
        ("script.php", PDF_BYTES),
        ("anim.gif", b"GIF89a" + b"\x00" * 16),
    ])
    def test_rejects_disallowed_files(self, name, content):
        from backend.services.quote_service import QuoteService

        with pytest.raises(ValidationError):
            QuoteService.validate_guest_attachments([(name, content, "application/pdf")])

    def test_stored_extension_comes_from_content(self):
        from backend.services.quote_service import QuoteService

        result = QuoteService.validate_guest_attachments([("scan.png", PDF_BYTES, "image/png")])
        assert result[0][2:] == ("application/pdf", ".pdf")

    def test_rejects_too_many_files(self):
        from backend.services.quote_service import GUEST_ATTACHMENT_MAX_FILES, QuoteService

        files = [(f"f{i}.pdf", PDF_BYTES, "application/pdf") for i in range(GUEST_ATTACHMENT_MAX_FILES + 1)]
        with pytest.raises(ValidationError):
            QuoteService.validate_guest_attachments(files)

    def test_rejects_oversized_file(self):
        from backend.services.quote_service import GUEST_ATTACHMENT_MAX_BYTES, QuoteService

        big = PDF_BYTES + b"0" * GUEST_ATTACHMENT_MAX_BYTES
        with pytest.raises(ValidationError):
            QuoteService.validate_guest_attachments([("big.pdf", big, "application/pdf")])


@pytest.mark.integration
class TestGuestQuoteAttachmentStorage:

    @staticmethod
    def _payload(product_id: int) -> dict:
        return {
            "contact_email": "guest@example.com",
            "contact_name": "Guest",
            "contact_phone": "5555555555",
            "shipping_destinations": [
                {"line1": "1 Main St", "city": "Town", "state": "TS", "zip": "12345", "country": "USA"}
            ],
            "items": [{"product_id": product_id, "quantity": 2}],
        }

    @staticmethod
    def _stub_emails(monkeypatch):
        from backend.services.email_service import EmailService

        async def _noop(*args, **kwargs):
            return True

        monkeypatch.setattr(EmailService, "send_quote_created_email", _noop)
        monkeypatch.setattr(EmailService, "send_admin_quote_notification", _noop)

    @pytest.mark.asyncio
    async def test_attachment_stored_privately(
        self, db_session: AsyncSession, test_chair, tmp_path, monkeypatch
    ):
        from backend.services import quote_service
        from backend.services.quote_service import QuoteService

        monkeypatch.setattr(quote_service, "QUOTE_ATTACHMENT_DIR", tmp_path)
        self._stub_emails(monkeypatch)

        quote = await QuoteService.create_guest_quote_request(
            db=db_session,
            payload=self._payload(test_chair.id),
            files=[("../../etc/plan.pdf", PDF_BYTES, "text/html")],
        )

        result = await db_session.execute(
            select(QuoteAttachment).where(QuoteAttachment.quote_id == quote.id)
        )
        attachment = result.scalar_one()
        assert attachment.file_url.startswith(
            f"{quote_service.QUOTE_ATTACHMENT_URL_PREFIX}/{quote.quote_number}/"
        )
        assert not attachment.file_url.startswith("/uploads/")
        assert attachment.file_type == "application/pdf"

        stored_name = attachment.file_url.rsplit("/", 1)[-1]
        assert len(stored_name) == 36 and stored_name.endswith(".pdf")
        stored = tmp_path / quote.quote_number / stored_name
        assert stored.read_bytes() == PDF_BYTES

    @pytest.mark.asyncio
    async def test_invalid_attachment_rejected_before_quote_created(
        self, async_client: AsyncClient, test_chair, tmp_path, monkeypatch
    ):
        import json

        from backend.services import quote_service

        monkeypatch.setattr(quote_service, "QUOTE_ATTACHMENT_DIR", tmp_path)
        self._stub_emails(monkeypatch)

        payload = self._payload(test_chair.id)
        payload["billing_address"] = {
            "line1": "1 Main St", "city": "Town", "state": "TS", "zip": "12345", "country": "USA"
        }
        response = await async_client.post(
            "/api/v1/quotes/request-guest",
            data={"quote_data": json.dumps(payload)},
            files={"files": ("x.html", b"<script>alert(1)</script>", "text/html")},
        )
        assert response.status_code == 422
        assert "PDF, PNG, JPG and WEBP" in response.text
        assert list(tmp_path.iterdir()) == []

    @pytest.mark.asyncio
    async def test_download_requires_admin(self, async_client: AsyncClient):
        response = await async_client.get(
            f"/api/v1/admin/quotes/attachments/Q-20260101-0001/{'a' * 32}.pdf"
        )
        assert response.status_code in (401, 403)


# ============================================================================
# #4 - AI tools
# ============================================================================

@pytest.mark.unit
class TestAICalculator:

    @pytest.mark.parametrize("expression,expected", [
        ("250 * 1.15", 287.5),
        ("(500 - 350) / 500 * 100", 30.0),
        ("sqrt(144)", 12.0),
        ("2^10", 1024.0),
        ("-7 % 3", 2.0),
        ("max(1, 5, 3)", 5.0),
    ])
    def test_valid_expressions(self, expression, expected):
        from backend.services.ai_service import calculate

        result = calculate(expression)
        assert "error" not in result
        assert result["numeric"] == pytest.approx(expected)

    @pytest.mark.parametrize("expression", [
        "__import__('os').system('id')",
        "().__class__.__bases__[0].__subclasses__()",
        "open('/etc/passwd').read()",
        "exec('1')",
        "lambda: 1",
        "x + 1",
        "9**9**9**9",
        "10**100000",
        "1" * 500,
    ])
    def test_rejects_unsafe_or_expensive_expressions(self, expression):
        from backend.services.ai_service import calculate

        result = calculate(expression)
        assert "error" in result
        assert "result" not in result


@pytest.mark.unit
class TestAIFetchWebpage:

    @pytest.mark.parametrize("url", [
        "file:///etc/passwd",
        "ftp://example.com/",
        "http://127.0.0.1/",
        "http://localhost/",
        "http://169.254.169.254/latest/meta-data/",
        "http://10.0.0.5/",
        "http://192.168.1.1/",
        "http://[::1]/",
        "http://0.0.0.0/",
    ])
    def test_rejects_non_public_urls(self, url):
        from backend.services.ai_service import fetch_webpage

        result = fetch_webpage(url)
        assert result.get("error")
        assert result["content"] == ""

    def test_redirect_to_private_address_is_blocked(self, monkeypatch):
        from backend.services import ai_service

        def fake_getaddrinfo(host, port, *args, **kwargs):
            ip = "93.184.216.34" if host == "public.example" else "127.0.0.1"
            return [(2, 1, 6, "", (ip, port))]

        requested = []

        def handler(request: httpx.Request) -> httpx.Response:
            requested.append(f"http://{request.headers['host']}{request.url.raw_path.decode()}")
            if request.headers["host"] == "public.example":
                return httpx.Response(302, headers={"location": "http://internal.example/secret"})
            return httpx.Response(200, text="secret", headers={"content-type": "text/plain"})

        real_client = httpx.Client
        monkeypatch.setattr(ai_service.socket, "getaddrinfo", fake_getaddrinfo)
        monkeypatch.setattr(
            ai_service.httpx, "Client",
            lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs),
        )

        result = ai_service.fetch_webpage("http://public.example/")
        assert result.get("error")
        assert result["content"] == ""
        assert requested == ["http://public.example/"]

    def test_response_size_is_capped(self, monkeypatch):
        from backend.services import ai_service

        monkeypatch.setattr(
            ai_service.socket, "getaddrinfo",
            lambda host, port, *a, **k: [(2, 1, 6, "", ("93.184.216.34", port))],
        )
        body = b"a" * (ai_service.FETCH_MAX_BYTES * 2)
        real_client = httpx.Client
        monkeypatch.setattr(
            ai_service.httpx, "Client",
            lambda **kwargs: real_client(
                transport=httpx.MockTransport(
                    lambda request: httpx.Response(200, content=body, headers={"content-type": "text/plain"})
                ),
                **kwargs,
            ),
        )

        result = ai_service.fetch_webpage("http://public.example/", max_chars=10 ** 9)
        assert "error" not in result
        assert len(result["content"]) <= ai_service.FETCH_MAX_BYTES

    def test_dns_rebinding_is_blocked(self, monkeypatch):
        """The connection goes to the IP that was validated, not a re-resolved one."""
        from backend.services import ai_service

        answers = iter(["93.184.216.34", "127.0.0.1", "127.0.0.1"])
        lookups = []

        def rebinding_getaddrinfo(host, port, *args, **kwargs):
            ip = next(answers)  # public first, then rebinds to loopback
            lookups.append((host, ip))
            return [(2, 1, 6, "", (ip, port))]

        requests = []

        def handler(request: httpx.Request) -> httpx.Response:
            requests.append(request)
            return httpx.Response(200, text="public page", headers={"content-type": "text/plain"})

        real_client = httpx.Client
        monkeypatch.setattr(ai_service.socket, "getaddrinfo", rebinding_getaddrinfo)
        monkeypatch.setattr(
            ai_service.httpx, "Client",
            lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs),
        )

        result = ai_service.fetch_webpage("https://rebind.example:8443/page?q=1")

        assert result["content"] == "public page"
        assert lookups == [("rebind.example", "93.184.216.34")]
        (request,) = requests
        assert request.url.host == "93.184.216.34"
        assert request.url.port == 8443
        assert request.url.raw_path == b"/page?q=1"
        assert request.headers["host"] == "rebind.example:8443"
        assert request.extensions["sni_hostname"] == "rebind.example"


# ============================================================================
# #7 - Email templates
# ============================================================================

@pytest.mark.unit
class TestEmailTemplateSandbox:

    def test_variables_are_escaped_and_helpers_escape_args(self):
        from backend.services.email_service import EmailService

        template = EmailService._create_template_with_helpers(
            "<p>Hi {{ company_name }}</p>{{ button(url, text) }}{{ code(value) }}{{ image(img, alt) }}"
        )
        html = template.render(
            company_name="<script>x</script>",
            url='https://example.com/?a="><script>',
            text="<b>Go</b>",
            value="<i>123</i>",
            img="https://example.com/i.png",
            alt='"><script>',
        )

        assert "<script>" not in html
        assert "&lt;script&gt;x&lt;/script&gt;" in html
        # Helper markup itself is preserved (not double-escaped)
        assert '<div class="button-container"><a href="https://example.com/?a=&#34;&gt;&lt;script&gt;"' in html
        assert "&lt;b&gt;Go&lt;/b&gt;" in html
        assert "&lt;i&gt;123&lt;/i&gt;" in html
        assert '<img src="https://example.com/i.png" alt="&#34;&gt;&lt;script&gt;"' in html

    def test_template_cannot_escape_sandbox(self):
        from jinja2.exceptions import SecurityError

        from backend.services.email_service import EmailService

        template = EmailService._create_template_with_helpers(
            "{{ ''.__class__.__mro__[1].__subclasses__() }}"
        )
        with pytest.raises(SecurityError):
            template.render()

    def test_default_templates_still_render(self):
        from backend.services.email_service import EmailService

        for template_type, template in EmailService.DEFAULT_TEMPLATES.items():
            body = EmailService._create_template_with_helpers(template["body"]).render(
                company_name="Acme & Co", quote_number="Q-1", reset_link="https://x/r?t=1",
                verification_url="https://x/v", login_url="https://x/l", item_count=1,
                body="<p>Custom</p>", subject="S", status="quoted", total_amount=100,
                items=[], contact_email="a@b.c", registration_url="https://x/reg",
            )
            assert isinstance(body, str) and body
