"""
Admin document library (document picker overlay)

Lists uploaded documents with the catalog/content records using them,
searchable by filename or by the product/family/catalog that uses them,
never offers customer quote files, and refuses to delete a document a record
still references.
"""

import pytest

from tests.factories import create_chair, create_product_family

UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) test", "X-Session-Token": "s", "X-Admin-Token": "a"}

PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"


def _write(path, content=PDF):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


def _as_role(role):
    from backend.api.dependencies import authenticate_admin
    from backend.models.company import AdminUser
    from tests.conftest import get_app

    app = get_app()
    admin = AdminUser(id=424245, username="docs-admin", email="docs@example.com",
                      role=role, is_active=True)
    app.dependency_overrides[authenticate_admin] = lambda: admin
    yield
    app.dependency_overrides.pop(authenticate_admin, None)


@pytest.fixture
def as_editor(async_client):
    from backend.models.company import AdminRole

    yield from _as_role(AdminRole.EDITOR)


@pytest.fixture
def as_admin(async_client):
    from backend.models.company import AdminRole

    yield from _as_role(AdminRole.ADMIN)


@pytest.fixture
def uploads(tmp_path, monkeypatch):
    from backend.api.v1.routes.admin import upload

    monkeypatch.setattr(upload, "UPLOAD_BASE_DIR", tmp_path)
    _write(tmp_path / "documents/product-families/bistro_catalog.pdf")
    _write(tmp_path / "documents/catalogs/price_list_2026.pdf")
    _write(tmp_path / "documents/catalogs/finish_samples.zip", b"PK\x03\x04rest")
    return tmp_path


@pytest.mark.integration
@pytest.mark.admin
async def test_lists_documents_with_usage_and_searches_by_record(async_client, db_session, as_editor, uploads):
    await create_product_family(db_session, name="Bistro Series",
                                catalog_pdf_url="/uploads/documents/product-families/bistro_catalog.pdf")
    await create_chair(db_session, name="Avignon", model_number="5576",
                       spec_sheet_url="https://www.eaglechair.com/uploads/documents/catalogs/price_list_2026.pdf",
                       dimensional_drawing_url="/catalogs/drawings/5576.pdf")

    res = await async_client.get("/api/v1/admin/upload/documents", headers=UA)
    assert res.status_code == 200, res.text
    body = res.json()
    items = {i["url"]: i for i in body["items"]}
    assert set(items) == {
        "/uploads/documents/product-families/bistro_catalog.pdf",
        "/uploads/documents/catalogs/price_list_2026.pdf",
        "/uploads/documents/catalogs/finish_samples.zip",
        "/catalogs/drawings/5576.pdf",
    }
    assert items["/uploads/documents/product-families/bistro_catalog.pdf"]["used_by"][0]["type"] == "Family"
    # Absolute URL to an uploaded file merges with the file on disk
    assert any("5576" in u["label"] for u in items["/uploads/documents/catalogs/price_list_2026.pdf"]["used_by"])
    # Documents stored outside the uploads folder are still listed
    assert items["/catalogs/drawings/5576.pdf"]["on_disk"] is False
    assert items["/uploads/documents/catalogs/finish_samples.zip"]["kind"] == "zip"
    assert {k["name"] for k in body["kinds"]} == {"pdf", "zip"}

    res = await async_client.get("/api/v1/admin/upload/documents", params={"q": "bistro series"}, headers=UA)
    assert [i["url"] for i in res.json()["items"]] == ["/uploads/documents/product-families/bistro_catalog.pdf"]

    res = await async_client.get("/api/v1/admin/upload/documents", params={"kind": "zip"}, headers=UA)
    assert [i["url"] for i in res.json()["items"]] == ["/uploads/documents/catalogs/finish_samples.zip"]

    res = await async_client.get("/api/v1/admin/upload/documents", params={"usage": "unused"}, headers=UA)
    assert [i["url"] for i in res.json()["items"]] == ["/uploads/documents/catalogs/finish_samples.zip"]

    res = await async_client.get("/api/v1/admin/upload/documents", params={"folder": "product-families"}, headers=UA)
    assert res.json()["total"] == 1


@pytest.mark.integration
@pytest.mark.admin
async def test_catalog_cover_is_used_as_document_preview(async_client, db_session, as_editor, uploads):
    from backend.models.content import Catalog, CatalogType

    db_session.add(Catalog(title="2026 Price List", catalog_type=CatalogType.PRICE_LIST, file_type="PDF",
                           file_url="/uploads/documents/catalogs/price_list_2026.pdf",
                           thumbnail_url="/uploads/images/catalogs/price_cover.png"))
    await db_session.flush()

    res = await async_client.get("/api/v1/admin/upload/documents", params={"used_by_type": "Catalog"}, headers=UA)
    assert res.status_code == 200, res.text
    [item] = res.json()["items"]
    assert item["cover_url"] == "/uploads/images/catalogs/price_cover.png"
    assert item["used_by"][0]["label"] == "2026 Price List"


@pytest.mark.integration
@pytest.mark.admin
async def test_quote_files_are_never_listed(async_client, db_session, as_editor, uploads):
    from backend.services.document_library_service import _scan_targets

    assert not any(cls.__module__ == "backend.models.quote" for cls, *_ in _scan_targets())


@pytest.mark.integration
@pytest.mark.admin
async def test_delete_refuses_document_in_use(async_client, db_session, as_admin, uploads):
    await create_product_family(db_session, catalog_pdf_url="/uploads/documents/product-families/bistro_catalog.pdf")

    res = await async_client.request("DELETE", "/api/v1/admin/upload/document",
                                     json={"url": "/uploads/documents/product-families/bistro_catalog.pdf"}, headers=UA)
    assert res.status_code == 409
    assert (uploads / "documents/product-families/bistro_catalog.pdf").is_file()

    res = await async_client.request("DELETE", "/api/v1/admin/upload/document",
                                     json={"url": "/uploads/documents/catalogs/finish_samples.zip"}, headers=UA)
    assert res.status_code == 200
    assert not (uploads / "documents/catalogs/finish_samples.zip").is_file()

    # Paths outside the documents folder are refused
    res = await async_client.request("DELETE", "/api/v1/admin/upload/document",
                                     json={"url": "/uploads/documents/../images/x.png"}, headers=UA)
    assert res.status_code == 400


@pytest.mark.integration
@pytest.mark.admin
async def test_catalog_picked_from_library_records_size_and_type(async_client, db_session, as_admin, uploads):
    from backend.models.content import Catalog, CatalogType

    catalog = Catalog(title="Old", catalog_type=CatalogType.FULL_CATALOG, file_type="PDF",
                      file_url="/uploads/documents/catalogs/old.pdf")
    db_session.add(catalog)
    await db_session.flush()

    res = await async_client.put(f"/api/v1/admin/catalog/catalogs/{catalog.id}", headers=UA,
                                 data={"file_url": "/uploads/documents/catalogs/finish_samples.zip"})
    assert res.status_code == 200, res.text
    await db_session.refresh(catalog)
    assert catalog.file_url == "/uploads/documents/catalogs/finish_samples.zip"
    assert catalog.file_type == "ZIP"
    assert catalog.file_size == len(b"PK\x03\x04rest")
