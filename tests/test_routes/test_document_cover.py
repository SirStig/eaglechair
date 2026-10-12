"""
PDF covers (first page rendered as WebP)

Any uploaded PDF gets a cover on first request, cached by path + mtime;
missing, non-PDF, unreadable and out-of-folder files 404 so the UI falls back
to its file icon; the document library offers the cover as preview_url.
"""

import fitz
import pytest

from backend.services import pdf_cover_service


def _pdf_bytes(text="Cover page"):
    doc = fitz.open()
    page = doc.new_page(width=612, height=792)
    page.insert_text((72, 72), text)
    data = doc.tobytes()
    doc.close()
    return data


def _write(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


@pytest.fixture
def uploads(tmp_path, monkeypatch):
    from backend.api.v1.routes import content
    from backend.api.v1.routes.admin import upload

    monkeypatch.setattr(upload, "UPLOAD_BASE_DIR", tmp_path)
    monkeypatch.setattr(content, "UPLOAD_BASE_DIR", tmp_path)
    _write(tmp_path / "documents/spec-sheets/6430 spec.pdf", _pdf_bytes())
    _write(tmp_path / "documents/catalogs/broken.pdf", b"%PDF-1.4 not really a pdf")
    _write(tmp_path / "documents/catalogs/samples.zip", b"PK\x03\x04rest")
    _write(tmp_path / "quotes/private.pdf", _pdf_bytes("secret"))
    return tmp_path


def test_cover_url_only_for_uploaded_pdfs():
    assert pdf_cover_service.cover_url("/uploads/documents/guides/a b.pdf", 1700000000.5) == (
        "/api/v1/content/document-cover?url=/uploads/documents/guides/a%20b.pdf&v=1700000000"
    )
    # Absolute URLs on any host collapse to the uploads path
    assert pdf_cover_service.cover_url("https://example.com/uploads/documents/x.pdf").endswith("url=/uploads/documents/x.pdf")
    assert pdf_cover_service.cover_url("/uploads/documents/x.zip") is None
    assert pdf_cover_service.cover_url("https://other.example.com/files/x.pdf") is None
    assert pdf_cover_service.cover_url(None) is None


def test_renders_and_caches(uploads):
    first = pdf_cover_service.get_cover("/uploads/documents/spec-sheets/6430 spec.pdf", uploads)
    assert first is not None and first.suffix == ".webp" and first.stat().st_size > 0
    assert first.is_relative_to(uploads / ".cache" / "pdf-covers")
    mtime = first.stat().st_mtime_ns
    again = pdf_cover_service.get_cover("/uploads/documents/spec-sheets/6430 spec.pdf", uploads)
    assert again == first and again.stat().st_mtime_ns == mtime


def test_unrenderable_pdf_is_remembered(uploads, monkeypatch):
    assert pdf_cover_service.get_cover("/uploads/documents/catalogs/broken.pdf", uploads) is None
    assert list((uploads / ".cache" / "pdf-covers").rglob("*.failed"))

    def boom(*_):
        raise AssertionError("should not re-render a known failure")

    monkeypatch.setattr(pdf_cover_service, "_render", boom)
    assert pdf_cover_service.get_cover("/uploads/documents/catalogs/broken.pdf", uploads) is None


@pytest.mark.asyncio
async def test_endpoint_serves_webp(async_client, uploads):
    url = pdf_cover_service.cover_url("/uploads/documents/spec-sheets/6430 spec.pdf", 123)
    res = await async_client.get(url)
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/webp"
    assert "immutable" in res.headers["cache-control"]
    res = await async_client.get(url, headers={"If-None-Match": res.headers["etag"]})
    assert res.status_code == 304


@pytest.mark.asyncio
@pytest.mark.parametrize("url", [
    "/uploads/documents/catalogs/broken.pdf",
    "/uploads/documents/catalogs/samples.zip",
    "/uploads/documents/catalogs/missing.pdf",
    "/uploads/documents/../quotes/private.pdf",
    "/uploads/quotes/private.pdf",
])
async def test_endpoint_404s_so_ui_falls_back(async_client, uploads, url):
    res = await async_client.get("/api/v1/content/document-cover", params={"url": url})
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_library_lists_preview_url(uploads, db_session):
    from backend.services import document_library_service

    result = await document_library_service.list_documents(db_session, uploads)
    by_name = {i["filename"]: i for i in result["items"]}
    assert by_name["6430 spec.pdf"]["preview_url"].startswith("/api/v1/content/document-cover?url=")
    assert by_name["samples.zip"]["preview_url"] is None
    # The cover cache folder is hidden from the library
    assert all(".cache" not in i["url"] for i in result["items"])
