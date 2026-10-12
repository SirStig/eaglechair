"""
Admin 3D library (backend/api/v1/routes/admin/models3d.py)

Models: only real binary glTF files are accepted; metadata lives in a JSON
sidecar that can be edited; delete removes the model's files.

Materials: a .glb, loose texture maps or a .zip of maps; maps are classified
by filename; the library config only accepts known kinds / option keys and
existing materials; an assigned material cannot be deleted.
"""

import io
import json
import struct
import zipfile

import pytest
from PIL import Image

from backend.services import glb_service

BASE = "/api/v1/admin/models3d"
MATS = f"{BASE}/materials"


def _glb_bytes(gltf=None, binary=b""):
    return glb_service.write_glb(gltf or {"asset": {"version": "2.0"}}, binary)


def _png(size=(8, 8), color=(200, 100, 50)):
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, "PNG")
    return buf.getvalue()


def _textured_glb(image: bytes):
    """One material whose base colour texture is `image`, plus a 12-byte position view."""
    positions = struct.pack("<9f", 0, 0, 0, 1, 0, 0, 0, 1, 0)
    pad = b"\0" * (-len(positions) % 4)
    binary = positions + pad + image
    gltf = {
        "asset": {"version": "2.0"},
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": len(positions)},
            {"buffer": 0, "byteOffset": len(positions) + len(pad), "byteLength": len(image)},
        ],
        "accessors": [{"bufferView": 0, "componentType": 5126, "count": 3, "type": "VEC3"}],
        "images": [{"bufferView": 1, "mimeType": "image/png"}],
        "textures": [{"source": 0}],
        "materials": [{"name": "Seat", "extras": {"ec_slot": "upholstery"},
                       "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}}}],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0}, "material": 0}]}],
    }
    return _glb_bytes(gltf, binary)


@pytest.fixture
def store(tmp_path, monkeypatch):
    from backend.api.v1.routes.admin import models3d

    monkeypatch.setattr(models3d, "MODELS_DIR", tmp_path / "models3d")
    monkeypatch.setattr(models3d, "MATERIALS_DIR", tmp_path / "materials3d")
    return tmp_path


@pytest.mark.admin
async def test_upload_list_update_delete(async_client, admin_headers, store):
    r = await async_client.post(
        BASE, headers=admin_headers,
        files={"file": ("Empire State.glb", _glb_bytes(), "model/gltf-binary")},
        data={"name": "Empire State 6430"},
    )
    assert r.status_code == 200, r.text
    model = r.json()
    assert model["name"] == "Empire State 6430"
    assert model["url"].startswith("/uploads/models3d/Empire")
    assert model["thumbnail_url"] is None
    assert (store / "models3d" / f"{model['id']}.glb").is_file()

    r = await async_client.patch(f"{BASE}/{model['id']}", headers=admin_headers,
                                 json={"product_id": 18, "settings": {"swatch_scale": 0.2}})
    assert r.status_code == 200
    assert r.json()["product_id"] == 18 and r.json()["name"] == "Empire State 6430"

    r = await async_client.put(f"{BASE}/{model['id']}/thumbnail", headers=admin_headers,
                               files={"file": ("thumb.png", _png(), "image/png")})
    assert r.status_code == 200
    assert "/models3d/" in r.json()["thumbnail_url"]

    r = await async_client.get(BASE, headers=admin_headers)
    assert [m["id"] for m in r.json()["models"]] == [model["id"]]
    assert r.json()["models"][0]["settings"] == {"swatch_scale": 0.2}

    r = await async_client.delete(f"{BASE}/{model['id']}", headers=admin_headers)
    assert r.status_code == 200
    assert list((store / "models3d").iterdir()) == []


@pytest.mark.admin
async def test_upload_summarizes_and_shrinks_textures(async_client, admin_headers, store):
    big = _png((3000, 1500))
    r = await async_client.post(BASE, headers=admin_headers,
                                files={"file": ("seat.glb", _textured_glb(big), "model/gltf-binary")})
    assert r.status_code == 200, r.text
    model = r.json()
    assert model["summary"]["slots"] == ["upholstery"]
    assert model["summary"]["vertices"] == 3 and model["summary"]["triangles"] == 1
    assert model["optimized"]["images_changed"] == 1

    gltf, binary = glb_service.read_glb((store / "models3d" / f"{model['id']}.glb").read_bytes())
    view = gltf["bufferViews"][1]
    image = Image.open(io.BytesIO(binary[view["byteOffset"]: view["byteOffset"] + view["byteLength"]]))
    assert max(image.size) == glb_service.MAX_TEXTURE_SIZE and gltf["images"][0]["mimeType"] == "image/jpeg"
    # The vertex data is untouched
    assert struct.unpack_from("<3f", binary, gltf["bufferViews"][0]["byteOffset"] + 12) == (1.0, 0.0, 0.0)


@pytest.mark.admin
@pytest.mark.parametrize("name,content", [
    ("chair.obj", b"v 0 0 0"),
    ("chair.glb", b"not a gltf file at all"),
])
async def test_rejects_non_glb(async_client, admin_headers, store, name, content):
    r = await async_client.post(BASE, headers=admin_headers, files={"file": (name, content, "application/octet-stream")})
    assert r.status_code == 400


@pytest.mark.admin
async def test_bad_ids(async_client, admin_headers, store):
    assert (await async_client.delete(f"{BASE}/bad.id", headers=admin_headers)).status_code == 400
    assert (await async_client.patch(f"{BASE}/missing", headers=admin_headers, json={})).status_code == 404
    assert (await async_client.patch(f"{MATS}/missing", headers=admin_headers, json={})).status_code == 404


async def test_requires_admin(async_client, store):
    assert (await async_client.get(BASE)).status_code in (401, 403)
    assert (await async_client.get(MATS)).status_code in (401, 403)


@pytest.mark.parametrize("filename,kind", [
    ("Wood049_2K-JPG_Color.jpg", "color"),
    ("Wood049_2K-JPG_NormalGL.jpg", "normal_gl"),
    ("Wood049_2K-JPG_NormalDX.jpg", "normal_dx"),
    ("Wood049_2K-JPG_Roughness.jpg", "roughness"),
    ("Wood049_2K-JPG_Displacement.jpg", None),
    ("brushed_metal_diff_2k.jpg", "color"),
    ("brushed_metal_nor_gl_2k.png", "normal_gl"),
    ("brushed_metal_metal_2k.jpg", "metalness"),
    ("brushed_metal_rough_4k.exr", "roughness"),
    ("brushed_metal_arm_2k.jpg", "arm"),
    ("fabric_ao.png", "ao"),
    ("Wood049.png", None),
])
def test_classify_map(filename, kind):
    assert glb_service.classify_map(filename) == kind


@pytest.mark.admin
async def test_material_map_zip_config_and_delete(async_client, admin_headers, store):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("Wood049_2K-JPG_Color.jpg", _png((64, 64)))
        z.writestr("Wood049_2K-JPG_NormalDX.png", _png((64, 64), (128, 100, 255)))
        z.writestr("Wood049_2K-JPG_Roughness.jpg", _png((64, 64), (90, 90, 90)))
        z.writestr("Wood049.png", _png())
    r = await async_client.post(MATS, headers=admin_headers,
                                files=[("files", ("Wood049_2K-JPG.zip", buf.getvalue(), "application/zip"))])
    assert r.status_code == 200, r.text
    mat = r.json()
    assert mat["name"] == "Wood049" and mat["kind"] == "wood" and mat["source"] == "maps"
    assert set(mat["maps"]) == {"map", "normalMap", "roughnessMap"}
    # Real colour maps are shown as they are, not tinted
    assert mat["tint"] is False
    normal = Image.open(store / "materials3d" / mat["id"] / "normalMap.jpg")
    assert abs(normal.getpixel((0, 0))[1] - (255 - 100)) <= 3  # DX green flipped to GL

    r = await async_client.patch(f"{MATS}/{mat['id']}", headers=admin_headers,
                                 json={"kind": "laminate_wood", "settings": {"scale": 2}})
    assert r.status_code == 200 and r.json()["kind"] == "laminate_wood"
    assert (await async_client.patch(f"{MATS}/{mat['id']}", headers=admin_headers, json={"kind": "lava"})).status_code == 400

    r = await async_client.put(f"{MATS}/config", headers=admin_headers,
                               json={"defaults": {"laminate_wood": mat["id"], "fabric": "builtin:fabric"},
                                     "assignments": {"laminate:4": mat["id"]}})
    assert r.status_code == 200, r.text
    r = await async_client.get(MATS, headers=admin_headers)
    assert r.json()["config"]["assignments"] == {"laminate:4": mat["id"]}

    for bad in ({"defaults": {"lava": "builtin:fabric"}}, {"assignments": {"chair:1": mat["id"]}},
                {"assignments": {"finish:1": "missing_1"}}):
        assert (await async_client.put(f"{MATS}/config", headers=admin_headers, json=bad)).status_code in (400, 404)

    assert (await async_client.delete(f"{MATS}/{mat['id']}", headers=admin_headers)).status_code == 409
    await async_client.put(f"{MATS}/config", headers=admin_headers, json={})
    assert (await async_client.delete(f"{MATS}/{mat['id']}", headers=admin_headers)).status_code == 200
    assert not (store / "materials3d" / mat["id"]).exists()


@pytest.mark.admin
async def test_material_glb_and_bad_uploads(async_client, admin_headers, store):
    r = await async_client.post(MATS, headers=admin_headers, data={"name": "Brushed steel"},
                                files=[("files", ("steel.glb", _textured_glb(_png()), "model/gltf-binary"))])
    assert r.status_code == 200, r.text
    assert r.json()["source"] == "glb" and r.json()["kind"] == "brushed" and r.json()["url"].endswith(".glb")
    meta = json.loads((store / "materials3d" / f"{r.json()['id']}.json").read_text())
    assert meta["source"] == "glb"

    r = await async_client.post(MATS, headers=admin_headers,
                                files=[("files", ("notes.txt", b"hello", "text/plain"))])
    assert r.status_code == 400
    r = await async_client.post(MATS, headers=admin_headers,
                                files=[("files", ("empty.glb", _glb_bytes(), "model/gltf-binary"))])
    assert r.status_code == 400
