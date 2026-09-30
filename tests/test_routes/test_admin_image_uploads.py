"""
Admin image uploads produce responsive renditions

Every way an admin can add a site image must go through
media_service.store_image, so the frontend's .w{N}.webp / .full.webp URLs
exist from the moment the image is saved.
"""

import io

import pytest
from PIL import Image

from backend.models.company import AdminRole, AdminUser
from backend.services import media_service

UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) test", "X-Session-Token": "s", "X-Admin-Token": "a"}


def _png_bytes(size=(1800, 1200)):
    buf = io.BytesIO()
    Image.new("RGB", size, (20, 90, 160)).save(buf, format="PNG")
    return buf.getvalue()


def _assert_renditions_exist(master):
    assert master.is_file()
    missing = [p.name for p in media_service.variant_paths(master) if not p.is_file()]
    assert not missing, f"missing renditions: {missing}"


@pytest.fixture
def as_editor(async_client):
    from backend.api.dependencies import get_current_admin
    from tests.conftest import get_app

    app = get_app()
    admin = AdminUser(id=424243, username="upload-editor", email="upload@example.com",
                      role=AdminRole.EDITOR, is_active=True)
    app.dependency_overrides[get_current_admin] = lambda: admin
    yield
    app.dependency_overrides.pop(get_current_admin, None)


@pytest.mark.integration
@pytest.mark.admin
async def test_upload_route_writes_every_rendition(async_client, as_editor, tmp_path, monkeypatch):
    from backend.api.v1.routes.admin import upload

    monkeypatch.setattr(upload, "UPLOAD_BASE_DIR", tmp_path)

    response = await async_client.post(
        "/api/v1/admin/upload/image",
        files={"file": ("hero.png", _png_bytes(), "image/png")},
        data={"subfolder": "hero"},
        headers=UA,
    )

    assert response.status_code == 200, response.text
    url = response.json()["url"]
    assert url.startswith("/uploads/images/hero/")
    _assert_renditions_exist(tmp_path / url.removeprefix("/uploads/"))


@pytest.mark.integration
@pytest.mark.admin
async def test_pdf_import_promotion_writes_every_rendition(tmp_path, monkeypatch):
    from backend.api.v1.routes.admin import virtual_catalog

    tmp_images = tmp_path / "tmp_images"
    (tmp_images / "upload1").mkdir(parents=True)
    (tmp_images / "upload1" / "chair.png").write_bytes(_png_bytes())
    uploads = tmp_path / "uploads"
    monkeypatch.setattr(virtual_catalog, "TMP_IMAGES_DIR", tmp_images)
    monkeypatch.setattr(virtual_catalog, "get_upload_base_dir", lambda: uploads)

    created = []
    url = await virtual_catalog._promote_tmp_image("/tmp/images/upload1/chair.png", {}, created)

    assert url.startswith("/uploads/images/products/")
    _assert_renditions_exist(uploads / url.removeprefix("/uploads/"))
