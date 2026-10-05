"""
Admin media library (image picker overlay)

Lists uploaded originals (renditions hidden) with the records using them,
searchable by filename or by the product that uses the image, and refuses
to delete an image a record still references.
"""

import io

import pytest
from PIL import Image

from tests.factories import create_chair

UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) test", "X-Session-Token": "s", "X-Admin-Token": "a"}


def _write_png(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    buf = io.BytesIO()
    Image.new("RGB", (40, 30), (20, 90, 160)).save(buf, format="PNG")
    path.write_bytes(buf.getvalue())


def _as_role(role):
    from backend.api.dependencies import authenticate_admin
    from backend.models.company import AdminUser
    from tests.conftest import get_app

    app = get_app()
    admin = AdminUser(id=424244, username="media-admin", email="media@example.com",
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
    _write_png(tmp_path / "images/products/bistro_1.png")
    _write_png(tmp_path / "images/products/bistro_1.w320.webp")  # rendition: hidden
    _write_png(tmp_path / "images/finishes/walnut.png")
    return tmp_path


@pytest.mark.integration
@pytest.mark.admin
async def test_lists_originals_with_usage_and_searches_by_product(async_client, db_session, as_editor, uploads):
    await create_chair(db_session, name="Bistro Side Chair", model_number="6246",
                       primary_image_url="/uploads/images/products/bistro_1.png")

    res = await async_client.get("/api/v1/admin/upload/images", headers=UA)
    assert res.status_code == 200, res.text
    body = res.json()
    urls = {i["url"] for i in body["items"]}
    assert urls == {"/uploads/images/products/bistro_1.png", "/uploads/images/finishes/walnut.png"}
    assert {f["name"] for f in body["folders"]} == {"products", "finishes"}

    bistro = next(i for i in body["items"] if i["folder"] == "products")
    assert bistro["thumbnail_url"] == "/uploads/images/products/bistro_1.w320.webp"
    assert any(u["type"] == "Product" and "6246" in u["label"] for u in bistro["used_by"])

    # Search matches the product using the image, not just the filename
    res = await async_client.get("/api/v1/admin/upload/images", params={"q": "side chair"}, headers=UA)
    assert [i["url"] for i in res.json()["items"]] == ["/uploads/images/products/bistro_1.png"]

    res = await async_client.get("/api/v1/admin/upload/images", params={"usage": "unused"}, headers=UA)
    assert [i["url"] for i in res.json()["items"]] == ["/uploads/images/finishes/walnut.png"]

    res = await async_client.get("/api/v1/admin/upload/images", params={"folder": "finishes"}, headers=UA)
    assert res.json()["total"] == 1


@pytest.mark.integration
@pytest.mark.admin
async def test_includes_images_records_use_from_anywhere(async_client, db_session, as_editor, uploads):
    from tests.factories import create_product_family, create_product_variation

    chair = await create_chair(db_session, name="Avignon", model_number="5576",
                               primary_image_url="https://www.eaglechair.com/uploads/images/products/bistro_1.png")
    await create_product_family(db_session, name="Yuglich", family_image="/images/families/yuglich.jpg")
    await create_product_variation(db_session, product_id=chair.id,
                                   primary_image_url="https://cdn.example.com/photos/5576P.webp")

    res = await async_client.get("/api/v1/admin/upload/images", headers=UA)
    assert res.status_code == 200, res.text
    items = {i["url"]: i for i in res.json()["items"]}

    # Absolute URL to an uploaded file merges with the file on disk
    assert items["/uploads/images/products/bistro_1.png"]["on_disk"] is True
    assert any("5576" in u["label"] for u in items["/uploads/images/products/bistro_1.png"]["used_by"])
    # Images stored outside the uploads folder are still in the library
    assert items["/images/families/yuglich.jpg"]["on_disk"] is False
    assert items["/images/families/yuglich.jpg"]["used_by"][0]["type"] == "Family"
    assert items["https://cdn.example.com/photos/5576P.webp"]["used_by"][0]["type"] == "Variation"
    assert {"Product", "Family", "Variation"} <= {t["name"] for t in res.json()["types"]}

    res = await async_client.get("/api/v1/admin/upload/images", params={"used_by_type": "Family"}, headers=UA)
    assert [i["url"] for i in res.json()["items"]] == ["/images/families/yuglich.jpg"]


@pytest.mark.integration
@pytest.mark.admin
async def test_delete_refuses_image_in_use(async_client, db_session, as_admin, uploads):
    await create_chair(db_session, primary_image_url="/uploads/images/products/bistro_1.png")

    res = await async_client.request("DELETE", "/api/v1/admin/upload/image",
                                     json={"url": "/uploads/images/products/bistro_1.png"}, headers=UA)
    assert res.status_code == 409
    assert (uploads / "images/products/bistro_1.png").is_file()

    res = await async_client.request("DELETE", "/api/v1/admin/upload/image",
                                     json={"url": "/uploads/images/finishes/walnut.png"}, headers=UA)
    assert res.status_code == 200
    assert not (uploads / "images/finishes/walnut.png").is_file()
