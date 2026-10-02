"""
Contact form submissions and admin legal-document writes
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.content import Feedback
from backend.models.legal import LegalDocument, LegalDocumentType

LEGAL_URL = "/api/v1/cms-admin/legal-documents"


@pytest.mark.integration
@pytest.mark.asyncio
class TestContactFormSubmission:
    async def test_submit_stores_all_fields(self, async_client: AsyncClient, db_session: AsyncSession):
        response = await async_client.post(
            "/api/v1/content/feedback",
            json={
                "name": "Jane Buyer",
                "email": "jane@example.com",
                "phone": "555-0100",
                "company_name": "Acme Hospitality",
                "subject": "quote",
                "message": "We need 200 chairs for a new restaurant.",
                "feedback_type": "quote",
            },
        )
        assert response.status_code == 201, response.text

        feedback = (await db_session.execute(
            select(Feedback).where(Feedback.email == "jane@example.com")
        )).scalar_one()
        assert feedback.phone == "555-0100"
        assert feedback.company_name == "Acme Hospitality"
        assert feedback.feedback_type == "quote"
        assert feedback.message.startswith("We need 200 chairs")

    async def test_submit_minimal_fields(self, async_client: AsyncClient):
        response = await async_client.post(
            "/api/v1/content/feedback",
            json={"name": "A", "email": "a@example.com", "message": "Hello"},
        )
        assert response.status_code == 201, response.text


@pytest.mark.integration
@pytest.mark.admin
@pytest.mark.asyncio
class TestAdminLegalDocuments:
    async def _create(self, db_session: AsyncSession, doc_type: LegalDocumentType, slug: str) -> LegalDocument:
        doc = LegalDocument(
            document_type=doc_type, title=slug.title(), content="Body", slug=slug,
            meta_title="Meta T", meta_description="Meta D",
        )
        db_session.add(doc)
        await db_session.commit()
        await db_session.refresh(doc)
        return doc

    async def test_list_includes_seo_fields(self, async_client: AsyncClient, db_session: AsyncSession, admin_headers):
        await self._create(db_session, LegalDocumentType.WARRANTY, "warranty")
        response = await async_client.get(LEGAL_URL, headers=admin_headers)
        assert response.status_code == 200, response.text
        doc = next(d for d in response.json() if d["slug"] == "warranty")
        assert doc["metaTitle"] == "Meta T"
        assert doc["metaDescription"] == "Meta D"
        assert doc["updatedAt"]

    async def test_create_duplicate_type_is_conflict(self, async_client: AsyncClient, db_session: AsyncSession, admin_headers):
        await self._create(db_session, LegalDocumentType.RETURNS, "returns")
        response = await async_client.post(
            LEGAL_URL,
            headers=admin_headers,
            json={"document_type": "returns", "title": "Returns 2", "content": "x", "slug": "returns-2"},
        )
        assert response.status_code == 409, response.text

    async def test_update_can_change_type(self, async_client: AsyncClient, db_session: AsyncSession, admin_headers):
        doc = await self._create(db_session, LegalDocumentType.STORAGE, "storage")
        response = await async_client.put(
            f"{LEGAL_URL}/{doc.id}", headers=admin_headers, json={"document_type": "maintenance"}
        )
        assert response.status_code == 200, response.text
        assert response.json()["documentType"] == "maintenance"

    async def test_update_to_taken_type_is_conflict(self, async_client: AsyncClient, db_session: AsyncSession, admin_headers):
        await self._create(db_session, LegalDocumentType.TAXES, "taxes")
        doc = await self._create(db_session, LegalDocumentType.PAYMENTS, "payments")
        response = await async_client.put(
            f"{LEGAL_URL}/{doc.id}", headers=admin_headers, json={"document_type": "taxes"}
        )
        assert response.status_code == 409, response.text


@pytest.mark.integration
@pytest.mark.admin
@pytest.mark.asyncio
class TestAdminInquiries:
    async def _seed(self, db_session: AsyncSession, **kw) -> Feedback:
        item = Feedback(name=kw.get("name", "Lead"), email=kw.get("email", "lead@example.com"),
                        message=kw.get("message", "Hi"), is_read=kw.get("is_read", False))
        db_session.add(item)
        await db_session.commit()
        await db_session.refresh(item)
        return item

    async def test_requires_admin(self, async_client: AsyncClient):
        response = await async_client.get("/api/v1/admin/inquiries")
        assert response.status_code in (401, 403)

    async def test_list_filter_and_unread_count(self, async_client: AsyncClient, db_session: AsyncSession, admin_headers):
        await self._seed(db_session, email="new@example.com")
        await self._seed(db_session, email="old@example.com", is_read=True)

        response = await async_client.get("/api/v1/admin/inquiries", headers=admin_headers)
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["total"] == 2
        assert body["unread"] == 1

        unread = (await async_client.get(
            "/api/v1/admin/inquiries", params={"status": "unread"}, headers=admin_headers
        )).json()
        assert [i["email"] for i in unread["items"]] == ["new@example.com"]

        found = (await async_client.get(
            "/api/v1/admin/inquiries", params={"search": "old@"}, headers=admin_headers
        )).json()
        assert found["total"] == 1

    async def test_mark_responded_also_marks_read(self, async_client: AsyncClient, db_session: AsyncSession, admin_headers):
        item = await self._seed(db_session)
        response = await async_client.patch(
            f"/api/v1/admin/inquiries/{item.id}", headers=admin_headers,
            json={"is_responded": True, "admin_notes": "Called back"},
        )
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["is_responded"] is True
        assert data["is_read"] is True
        assert data["admin_notes"] == "Called back"

    async def test_delete(self, async_client: AsyncClient, db_session: AsyncSession, admin_headers):
        item = await self._seed(db_session)
        response = await async_client.delete(f"/api/v1/admin/inquiries/{item.id}", headers=admin_headers)
        assert response.status_code == 200, response.text
        missing = await async_client.patch(
            f"/api/v1/admin/inquiries/{item.id}", headers=admin_headers, json={"is_read": True}
        )
        assert missing.status_code == 404
