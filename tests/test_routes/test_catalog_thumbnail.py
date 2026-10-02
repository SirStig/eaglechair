"""
PDF thumbnail endpoint: documents live in several upload folders, not only documents/catalogs.
"""

import fitz
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.v1.routes import content as content_routes
from backend.models.content import CatalogType
from tests.factories import create_catalog


def _write_pdf(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    doc = fitz.open()
    doc.new_page(width=200, height=200)
    doc.save(str(path))
    doc.close()


@pytest.mark.integration
@pytest.mark.asyncio
class TestCatalogPdfThumbnail:
    async def test_renders_pdf_outside_catalogs_folder(
        self, async_client: AsyncClient, db_session: AsyncSession, tmp_path, monkeypatch
    ):
        monkeypatch.setattr(content_routes, "UPLOAD_BASE_DIR", tmp_path)
        _write_pdf(tmp_path / "documents" / "guides" / "booth-layout.pdf")
        guide = await create_catalog(
            db_session,
            catalog_type=CatalogType.INSTALLATION_GUIDE,
            file_type="PDF",
            file_url="/uploads/documents/guides/booth-layout.pdf",
        )

        response = await async_client.get(f"/api/v1/content/catalogs/{guide.id}/pdf-thumbnail")

        assert response.status_code == 200
        assert response.headers["content-type"] == "image/png"

    async def test_rejects_path_outside_uploads(
        self, async_client: AsyncClient, db_session: AsyncSession, tmp_path, monkeypatch
    ):
        uploads = tmp_path / "uploads"
        uploads.mkdir()
        monkeypatch.setattr(content_routes, "UPLOAD_BASE_DIR", uploads)
        _write_pdf(tmp_path / "secret.pdf")
        catalog = await create_catalog(
            db_session,
            catalog_type=CatalogType.OTHER,
            file_type="PDF",
            file_url="/uploads/../secret.pdf",
        )

        response = await async_client.get(f"/api/v1/content/catalogs/{catalog.id}/pdf-thumbnail")

        assert response.status_code == 404
