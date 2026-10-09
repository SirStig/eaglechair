"""
Admin Media Library page (backend/api/v1/routes/admin/media.py)

Replace keeps the old file as a version and points every record at the new
one; versions can be restored; files can be taken off records or deleted;
free-text mentions are found and rewritten; the editor's background removal.
"""

import io

import pytest
from PIL import Image
from sqlalchemy import select

from tests.factories import create_chair

UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) test", "X-Session-Token": "s", "X-Admin-Token": "a"}
BASE = "/api/v1/admin/media"
OLD = "/uploads/images/products/bistro_1.png"


def _png_bytes(color=(20, 90, 160), size=(40, 30)):
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    return buf.getvalue()


def _write_png(path, **kw):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(_png_bytes(**kw))


def _as_role(role):
    from backend.api.dependencies import authenticate_admin
    from backend.models.company import AdminUser
    from tests.conftest import get_app

    app = get_app()
    admin = AdminUser(id=424245, username="media-mgr", email="mediamgr@example.com", role=role, is_active=True)
    app.dependency_overrides[authenticate_admin] = lambda: admin
    yield
    app.dependency_overrides.pop(authenticate_admin, None)


@pytest.fixture
def as_admin(async_client):
    from backend.models.company import AdminRole

    yield from _as_role(AdminRole.ADMIN)


@pytest.fixture
def as_viewer(async_client):
    from backend.models.company import AdminRole

    yield from _as_role(AdminRole.VIEWER)


@pytest.fixture
def exports(monkeypatch):
    """Record site-content exports instead of writing contentData.json."""
    from backend.utils import static_content_exporter

    calls = []

    async def fake_export(db):
        calls.append(True)
        return True

    monkeypatch.setattr(static_content_exporter, "export_all_content_types", fake_export)
    return calls


@pytest.fixture
def uploads(tmp_path, monkeypatch):
    from backend.api.v1.routes.admin import upload
    from backend.core.config import settings

    root = tmp_path / "uploads"
    monkeypatch.setattr(upload, "UPLOAD_BASE_DIR", root)
    monkeypatch.setattr(settings, "UPLOAD_TRASH_DIR", str(tmp_path / "trash"))
    _write_png(root / "images/products/bistro_1.png")
    _write_png(root / "images/finishes/walnut.png")
    return root


async def _chair(db_session):
    return await create_chair(
        db_session, name="Bistro Side Chair", model_number="6246",
        primary_image_url=OLD,
        images=[{"url": OLD, "type": "side"}, {"url": "/uploads/images/finishes/walnut.png", "type": "detail"}],
    )


async def _replace(async_client, url=OLD, color=(200, 30, 30), action="replaced"):
    return await async_client.post(
        f"{BASE}/replace", headers=UA,
        data={"kind": "image", "url": url, "action": action},
        files={"file": ("new.png", _png_bytes(color), "image/png")},
    )


@pytest.mark.integration
@pytest.mark.admin
async def test_replace_points_records_at_new_file_and_keeps_version(async_client, db_session, as_admin, uploads, exports):
    chair = await _chair(db_session)

    res = await _replace(async_client)
    assert res.status_code == 200, res.text
    new_url = res.json()["url"]
    assert new_url.startswith("/uploads/images/products/bistro_1_") and new_url != OLD
    assert (uploads / new_url.removeprefix("/uploads/")).is_file()
    assert (uploads / "images/products/bistro_1.png").is_file()  # old file stays as a version

    await db_session.refresh(chair)
    assert chair.primary_image_url == new_url
    assert chair.images[0] == {"url": new_url, "type": "side"}
    assert chair.images[1]["url"] == "/uploads/images/finishes/walnut.png"
    assert not exports  # products aren't site content

    listing = (await async_client.get(f"{BASE}/images", headers=UA)).json()
    urls = {i["url"]: i for i in listing["items"]}
    assert OLD not in urls  # earlier versions stay out of the grid
    assert urls[new_url]["versions"] == 1
    assert listing["summary"]["stored"] == 2

    details = (await async_client.get(f"{BASE}/details", params={"kind": "image", "url": new_url}, headers=UA)).json()
    assert [v["url"] for v in details["versions"]] == [OLD]
    assert details["versions"][0]["on_disk"] is True
    assert details["info"]["width"] == 40
    product = next(u for u in details["used_by"] if u["model"] == "Chair")
    assert set(product["fields"]) == {"primary_image_url", "images"}


@pytest.mark.integration
@pytest.mark.admin
async def test_version_chain_and_restore(async_client, db_session, as_admin, uploads, exports):
    chair = await _chair(db_session)
    second = (await _replace(async_client)).json()["url"]
    third = (await _replace(async_client, url=second, color=(0, 200, 0), action="edited")).json()["url"]

    details = (await async_client.get(f"{BASE}/details", params={"kind": "image", "url": third}, headers=UA)).json()
    assert [v["url"] for v in details["versions"]] == [second, OLD]
    assert details["versions"][0]["action"] == "edited"

    oldest = details["versions"][1]
    res = await async_client.post(f"{BASE}/versions/{oldest['id']}/restore", headers=UA)
    assert res.status_code == 200, res.text
    assert res.json()["url"] == OLD

    await db_session.refresh(chair)
    assert chair.primary_image_url == OLD
    details = (await async_client.get(f"{BASE}/details", params={"kind": "image", "url": OLD}, headers=UA)).json()
    assert {v["url"] for v in details["versions"]} == {second, third}
    assert details["versions"][0]["url"] == third and details["versions"][0]["action"] == "restored"


@pytest.mark.integration
@pytest.mark.admin
async def test_detach_from_one_record(async_client, db_session, as_admin, uploads, exports):
    chair = await _chair(db_session)
    other = await create_chair(db_session, name="Other", primary_image_url=OLD, images=[])

    res = await async_client.post(f"{BASE}/detach", headers=UA, json={
        "kind": "image", "url": OLD, "targets": [{"model": "Chair", "id": chair.id}],
    })
    assert res.status_code == 200, res.text

    await db_session.refresh(chair)
    await db_session.refresh(other)
    assert chair.primary_image_url is None
    assert [i["url"] for i in chair.images] == ["/uploads/images/finishes/walnut.png"]
    assert other.primary_image_url == OLD


@pytest.mark.integration
@pytest.mark.admin
async def test_delete_refuses_in_use_unless_detaching(async_client, db_session, as_admin, uploads, exports):
    chair = await _chair(db_session)
    second = (await _replace(async_client)).json()["url"]

    res = await async_client.request("DELETE", f"{BASE}/files", headers=UA, json={"kind": "image", "urls": [second]})
    assert res.status_code == 200
    assert res.json()["deleted"] == [] and "Bistro" in res.json()["failed"][0]["detail"]

    res = await async_client.request(
        "DELETE", f"{BASE}/files", headers=UA, json={"kind": "image", "urls": [second], "detach": True}
    )
    assert res.json()["deleted"] == [second], res.text
    assert not (uploads / second.removeprefix("/uploads/")).exists()
    assert not (uploads / "images/products/bistro_1.png").exists()  # its version went too

    await db_session.refresh(chair)
    assert chair.primary_image_url is None
    from backend.models.media import MediaVersion

    assert (await db_session.execute(select(MediaVersion))).scalars().all() == []


@pytest.mark.integration
@pytest.mark.admin
async def test_free_text_mentions_found_and_rewritten(async_client, db_session, as_admin, uploads, exports):
    from backend.models.content import PageContent

    page = PageContent(page_slug="about", section_key="story", content=f'<p>Hi</p><img src="{OLD}">')
    db_session.add(page)
    await db_session.commit()

    details = (await async_client.get(f"{BASE}/details", params={"kind": "image", "url": OLD}, headers=UA)).json()
    assert [m["model"] for m in details["mentions"]] == ["PageContent"]

    res = await async_client.request("DELETE", f"{BASE}/files", headers=UA, json={"kind": "image", "urls": [OLD], "detach": True})
    assert res.json()["deleted"] == [] and "text" in res.json()["failed"][0]["detail"]

    new_url = (await _replace(async_client)).json()["url"]
    await db_session.refresh(page)
    assert new_url in page.content and OLD not in page.content
    assert exports  # site content changed: contentData.json re-exported


@pytest.mark.integration
@pytest.mark.admin
async def test_replace_document(async_client, db_session, as_admin, uploads, exports):
    from backend.models.chair import ProductFamily

    (uploads / "documents/catalogs").mkdir(parents=True)
    (uploads / "documents/catalogs/spring_2024.pdf").write_bytes(b"%PDF-1.4 old")
    family = ProductFamily(name="Spring", slug="spring", catalog_pdf_url="/uploads/documents/catalogs/spring_2024.pdf")
    db_session.add(family)
    await db_session.commit()

    res = await async_client.post(
        f"{BASE}/replace", headers=UA,
        data={"kind": "document", "url": "/uploads/documents/catalogs/spring_2024.pdf"},
        files={"file": ("whatever.pdf", b"%PDF-1.4 new", "application/pdf")},
    )
    assert res.status_code == 200, res.text
    new_url = res.json()["url"]
    assert new_url.startswith("/uploads/documents/catalogs/spring_2024_") and new_url.endswith(".pdf")
    await db_session.refresh(family)
    assert family.catalog_pdf_url == new_url

    listing = (await async_client.get(f"{BASE}/documents", headers=UA)).json()
    assert [i["url"] for i in listing["items"]] == [new_url]


@pytest.mark.integration
@pytest.mark.admin
async def test_remove_white_background(async_client, as_admin, uploads):
    img = Image.new("RGB", (120, 90), (255, 255, 255))
    img.paste((40, 40, 40), (40, 30, 80, 60))
    buf = io.BytesIO()
    img.save(buf, format="PNG")

    res = await async_client.post(
        f"{BASE}/remove-background", headers=UA, data={"method": "white"},
        files={"file": ("a.png", buf.getvalue(), "image/png")},
    )
    assert res.status_code == 200, res.text
    out = Image.open(io.BytesIO(res.content))
    assert out.mode == "RGBA"
    assert out.getpixel((2, 2))[3] == 0
    assert out.getpixel((60, 45))[3] == 255

    res = await async_client.post(
        f"{BASE}/remove-background", headers=UA, data={"method": "white"},
        files={"file": ("b.png", _png_bytes((10, 10, 10)), "image/png")},
    )
    assert res.status_code == 422


@pytest.mark.integration
@pytest.mark.admin
async def test_viewer_can_browse_but_not_change(async_client, db_session, as_viewer, uploads):
    assert (await async_client.get(f"{BASE}/images", headers=UA)).status_code == 200
    assert (await _replace(async_client)).status_code == 403
    res = await async_client.request("DELETE", f"{BASE}/files", headers=UA, json={"kind": "image", "urls": [OLD]})
    assert res.status_code == 403
