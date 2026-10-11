"""
Admin 3D model library (backend/api/v1/routes/admin/models3d.py)

Only real binary glTF files are accepted; metadata lives in a JSON sidecar
that can be edited; delete removes both files.
"""

import struct

import pytest

BASE = "/api/v1/admin/models3d"


def _glb_bytes():
    body = b'{"asset":{"version":"2.0"}}  '
    chunk = struct.pack("<II", len(body), 0x4E4F534A) + body
    return b"glTF" + struct.pack("<II", 2, 12 + len(chunk)) + chunk


@pytest.fixture
def models_dir(tmp_path, monkeypatch):
    from backend.api.v1.routes.admin import models3d

    monkeypatch.setattr(models3d, "MODELS_DIR", tmp_path / "models3d")
    return tmp_path / "models3d"


@pytest.mark.admin
async def test_upload_list_update_delete(async_client, admin_headers, models_dir):
    r = await async_client.post(
        BASE, headers=admin_headers,
        files={"file": ("Empire State.glb", _glb_bytes(), "model/gltf-binary")},
        data={"name": "Empire State 6430"},
    )
    assert r.status_code == 200, r.text
    model = r.json()
    assert model["name"] == "Empire State 6430"
    assert model["url"].startswith("/uploads/models3d/Empire")
    assert (models_dir / f"{model['id']}.glb").is_file()

    r = await async_client.patch(f"{BASE}/{model['id']}", headers=admin_headers,
                                 json={"product_id": 18, "settings": {"swatch_scale": 0.2}})
    assert r.status_code == 200
    assert r.json()["product_id"] == 18 and r.json()["name"] == "Empire State 6430"

    r = await async_client.get(BASE, headers=admin_headers)
    assert [m["id"] for m in r.json()["models"]] == [model["id"]]
    assert r.json()["models"][0]["settings"] == {"swatch_scale": 0.2}

    r = await async_client.delete(f"{BASE}/{model['id']}", headers=admin_headers)
    assert r.status_code == 200
    assert list(models_dir.iterdir()) == []


@pytest.mark.admin
@pytest.mark.parametrize("name,content", [
    ("chair.obj", b"v 0 0 0"),
    ("chair.glb", b"not a gltf file at all"),
])
async def test_rejects_non_glb(async_client, admin_headers, models_dir, name, content):
    r = await async_client.post(BASE, headers=admin_headers, files={"file": (name, content, "application/octet-stream")})
    assert r.status_code == 400


@pytest.mark.admin
async def test_bad_ids(async_client, admin_headers, models_dir):
    assert (await async_client.delete(f"{BASE}/bad.id", headers=admin_headers)).status_code == 400
    assert (await async_client.patch(f"{BASE}/missing", headers=admin_headers, json={})).status_code == 404


async def test_requires_admin(async_client, models_dir):
    assert (await async_client.get(BASE)).status_code in (401, 403)
