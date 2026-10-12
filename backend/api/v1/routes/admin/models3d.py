"""
3D Model Routes - API v1

Admin storage for the 3D studio: configurable product models and the
materials they are shown in. No database tables while this is trialled.

Models: uploads/models3d/<stem>.glb, a <stem>.json sidecar (display name,
linked product, viewer settings, file summary) and an optional <stem>.png
thumbnail captured from the viewer.

A configurable model names its parts through glTF material extras:
ec_slot ("upholstery" | "frame" | "metal" | "top") and ec_kind (the material
its maps show). Settings can remap parts to slots for models without extras.

Materials: uploads/materials3d/<stem>.json, plus either <stem>.glb (a glTF
material, e.g. from Poly Haven) or a <stem>/ folder of texture maps (an
ambientCG / Poly Haven map download). uploads/materials3d/.library.json holds
the library config: the default material per material kind, and materials
assigned to specific catalog options ("finish:12", "laminate:3", ...).
"""

import json
import logging
import re
import shutil
import time
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from backend.api.dependencies import get_current_admin
from backend.api.v1.routes.admin.upload import UPLOAD_BASE_DIR, stored_base_name, unique_stem
from backend.services import glb_service
from backend.services.glb_service import GlbError

logger = logging.getLogger(__name__)

router = APIRouter(tags=["3D Models"])

MODELS_DIR = UPLOAD_BASE_DIR / "models3d"
MATERIALS_DIR = UPLOAD_BASE_DIR / "materials3d"
MAX_MODEL_SIZE = 100 * 1024 * 1024  # 100MB
MAX_THUMBNAIL_SIZE = 2 * 1024 * 1024
_STEM = re.compile(r"^[A-Za-z0-9_-]+$")
# Catalog option keys a material can be assigned to
_OPTION_KEY = re.compile(r"^(upholstery|finish|laminate):\d+$")

MATERIAL_KINDS = {
    "fabric", "vinyl", "leather", "wood", "paint", "laminate", "laminate_wood",
    "metal", "chrome", "brushed", "powder", "other",
}


class Model3DUpdate(BaseModel):
    """Editable model metadata"""
    name: str | None = Field(None, max_length=200)
    product_id: int | None = None
    # Viewer settings (grain per slot, part → slot overrides, ...), kept as given
    settings: dict | None = None


class Material3DUpdate(BaseModel):
    """Editable material metadata"""
    name: str | None = Field(None, max_length=200)
    kind: str | None = None
    # Tint the maps with the catalog option's colour (neutral maps) or show them as they are
    tint: bool | None = None
    # Look tweaks: scale, roughness, metalness, normal_scale, sheen, clearcoat, ...
    settings: dict | None = None


class LibraryConfig(BaseModel):
    """Default material per kind, and per catalog option overrides"""
    defaults: dict[str, str] = Field(default_factory=dict)
    assignments: dict[str, str] = Field(default_factory=dict)


def _read_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text()) if path.is_file() else {}
    except (OSError, ValueError):
        logger.warning(f"Unreadable 3D library file: {path}")
        return {}


def _write_json(path: Path, data: dict) -> None:
    tmp = path.with_name(f".{path.name}.tmp")
    tmp.write_text(json.dumps(data, indent=2))
    tmp.replace(path)


def _check_stem(stem: str) -> None:
    if not _STEM.match(stem):
        raise HTTPException(status_code=400, detail="Invalid id")


async def _read_upload(file: UploadFile, limit: int = MAX_MODEL_SIZE) -> bytes:
    content = await file.read()
    if len(content) > limit:
        raise HTTPException(status_code=400, detail=f"File too large. Maximum size: {limit // 1024 // 1024}MB")
    return content


async def _optimized_glb(content: bytes, optimize: bool) -> tuple[bytes, dict, dict]:
    """(glb, summary, optimize report); 400 for files that are not usable glTF."""
    try:
        gltf, _ = glb_service.read_glb(content)
        report = {"before": len(content), "after": len(content), "images_changed": 0}
        if optimize:
            content, report = await run_in_threadpool(glb_service.optimize_textures, content)
            gltf, _ = glb_service.read_glb(content)
    except GlbError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    if gltf.get("buffers") and any("uri" in b for b in gltf["buffers"]):
        raise HTTPException(status_code=400, detail="The model references external files. Export it as a single .glb.")
    return content, glb_service.summarize(gltf), report


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

def _model_path(stem: str) -> Path:
    _check_stem(stem)
    path = MODELS_DIR / f"{stem}.glb"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Model not found")
    return path


def _describe_model(path: Path) -> dict:
    meta = _read_json(path.with_suffix(".json"))
    stat = path.stat()
    thumb = path.with_suffix(".png")
    return {
        "id": path.stem,
        "name": meta.get("name") or path.stem,
        "product_id": meta.get("product_id"),
        "settings": meta.get("settings") or {},
        "summary": meta.get("summary"),
        "optimized": meta.get("optimized"),
        "url": f"/uploads/models3d/{path.name}",
        # Thumbnails are replaced in place, so the URL carries their version
        "thumbnail_url": f"/uploads/models3d/{thumb.name}?v={int(thumb.stat().st_mtime)}" if thumb.is_file() else None,
        "size": stat.st_size,
        "uploaded_at": meta.get("uploaded_at") or int(stat.st_mtime),
    }


@router.get("", summary="List 3D models")
async def list_models(current_admin=Depends(get_current_admin)):
    if not MODELS_DIR.is_dir():
        return {"models": []}
    paths = sorted(MODELS_DIR.glob("*.glb"), key=lambda p: p.stat().st_mtime, reverse=True)
    return {"models": [_describe_model(p) for p in paths]}


@router.post("", summary="Upload a 3D model (.glb)")
async def upload_model(
    file: UploadFile = File(...),
    name: str = Form(""),
    product_id: int | None = Form(None),
    optimize: bool = Form(True),
    current_admin=Depends(get_current_admin),
):
    filename = file.filename or "model.glb"
    if Path(filename).suffix.lower() != ".glb":
        raise HTTPException(status_code=400, detail="Only binary glTF (.glb) models are supported")
    content, summary, report = await _optimized_glb(await _read_upload(file), optimize)

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    path = MODELS_DIR / f"{unique_stem(stored_base_name(filename))}.glb"
    await run_in_threadpool(path.write_bytes, content)
    meta = {"name": name.strip() or Path(filename).stem, "product_id": product_id, "settings": {},
            "summary": summary, "optimized": report, "uploaded_at": int(time.time())}
    await run_in_threadpool(_write_json, path.with_suffix(".json"), meta)
    logger.info(f"3D model uploaded: {path.name} ({report['before']} -> {report['after']} bytes) by admin {current_admin.id}")
    return _describe_model(path)


@router.patch("/{model_id}", summary="Update 3D model details")
async def update_model(model_id: str, data: Model3DUpdate, current_admin=Depends(get_current_admin)):
    path = _model_path(model_id)
    meta = _read_json(path.with_suffix(".json"))
    meta.update(data.model_dump(exclude_unset=True))
    await run_in_threadpool(_write_json, path.with_suffix(".json"), meta)
    return _describe_model(path)


@router.put("/{model_id}/thumbnail", summary="Set a 3D model's thumbnail (PNG from the viewer)")
async def set_model_thumbnail(model_id: str, file: UploadFile = File(...), current_admin=Depends(get_current_admin)):
    path = _model_path(model_id)
    content = await _read_upload(file, MAX_THUMBNAIL_SIZE)
    if content[:8] != b"\x89PNG\r\n\x1a\n":
        raise HTTPException(status_code=400, detail="Thumbnail must be a PNG")
    await run_in_threadpool(path.with_suffix(".png").write_bytes, content)
    return _describe_model(path)


@router.delete("/{model_id}", summary="Delete a 3D model")
async def delete_model(model_id: str, current_admin=Depends(get_current_admin)):
    path = _model_path(model_id)
    path.unlink()
    path.with_suffix(".json").unlink(missing_ok=True)
    path.with_suffix(".png").unlink(missing_ok=True)
    logger.info(f"3D model deleted: {path.name} by admin {current_admin.id}")
    return {"success": True}


# ---------------------------------------------------------------------------
# Materials
# ---------------------------------------------------------------------------

LIBRARY_FILE = ".library.json"


def _material_meta_path(stem: str) -> Path:
    _check_stem(stem)
    path = MATERIALS_DIR / f"{stem}.json"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Material not found")
    return path


def _describe_material(meta_path: Path) -> dict:
    meta = _read_json(meta_path)
    stem = meta_path.stem
    base = "/uploads/materials3d"
    out = {
        "id": stem,
        "name": meta.get("name") or stem,
        "kind": meta.get("kind") or "other",
        "tint": bool(meta.get("tint")),
        "source": meta.get("source"),
        "settings": meta.get("settings") or {},
        "size": meta.get("size"),
        "uploaded_at": meta.get("uploaded_at"),
        "url": None,
        "maps": {},
    }
    if meta.get("source") == "glb":
        out["url"] = f"{base}/{stem}.glb"
    else:
        out["maps"] = {slot: f"{base}/{stem}/{name}" for slot, name in (meta.get("maps") or {}).items()}
    return out


def _guess_kind(name: str) -> str:
    n = name.lower()
    for kind, pattern in (
        ("chrome", r"chrome|mirror|polished"), ("brushed", r"brushed|stainless|satin[_ -]?(nickel|steel)"),
        ("powder", r"powder"), ("metal", r"metal|steel|alumin|iron|brass|bronze|copper"),
        ("laminate_wood", r"laminate.*wood|wood.*laminate"), ("laminate", r"laminate|formica|wilsonart|pionite"),
        ("leather", r"leather"), ("vinyl", r"vinyl|naugahyde|faux"), ("fabric", r"fabric|cloth|weave|textile|wool|linen|velvet"),
        ("paint", r"paint|lacquer"), ("wood", r"wood|oak|walnut|maple|cherry|beech|ash|veneer|plank"),
    ):
        if re.search(pattern, n):
            return kind
    return "other"


@router.get("/materials", summary="List 3D materials and the library config")
async def list_materials(current_admin=Depends(get_current_admin)):
    materials = []
    if MATERIALS_DIR.is_dir():
        paths = [p for p in MATERIALS_DIR.glob("*.json") if not p.name.startswith(".")]
        paths.sort(key=lambda p: p.stat().st_mtime, reverse=True)
        materials = [_describe_material(p) for p in paths]
    config = _read_json(MATERIALS_DIR / LIBRARY_FILE)
    return {
        "materials": materials,
        "config": {"defaults": config.get("defaults") or {}, "assignments": config.get("assignments") or {}},
    }


@router.post("/materials", summary="Upload a 3D material (.glb, texture maps or a .zip of maps)")
async def upload_material(
    files: list[UploadFile] = File(...),
    name: str = Form(""),
    kind: str = Form(""),
    current_admin=Depends(get_current_admin),
):
    raw = []
    total = 0
    for f in files:
        data = await f.read()
        total += len(data)
        if total > MAX_MODEL_SIZE:
            raise HTTPException(status_code=400, detail=f"Upload too large. Maximum size: {MAX_MODEL_SIZE // 1024 // 1024}MB")
        raw.append((f.filename or "file", data))
    first_name = raw[0][0] if raw else "material"
    try:
        glb, images = glb_service.unpack_upload(raw)
    except GlbError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    if not glb and not images:
        raise HTTPException(status_code=400, detail="Upload a .glb, texture images, or a .zip of texture maps")

    display = name.strip() or re.sub(r"[_-](\d+K|JPG|PNG)\b.*$", "", Path(first_name).stem, flags=re.I) or "Material"
    kind = kind if kind in MATERIAL_KINDS else _guess_kind(f"{display} {first_name}")
    MATERIALS_DIR.mkdir(parents=True, exist_ok=True)
    stem = unique_stem(stored_base_name(display))
    meta = {"name": display, "kind": kind, "settings": {}, "uploaded_at": int(time.time())}

    if glb:
        content, summary, _ = await _optimized_glb(glb, True)
        if not summary["materials"]:
            raise HTTPException(status_code=400, detail="The .glb has no materials")
        await run_in_threadpool((MATERIALS_DIR / f"{stem}.glb").write_bytes, content)
        # A glTF material carries its own colours
        meta.update(source="glb", tint=False, size=len(content))
    else:
        try:
            maps = await run_in_threadpool(glb_service.read_map_set, images)
        except GlbError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        folder = MATERIALS_DIR / stem
        folder.mkdir()
        names, written = {}, {}
        for slot, data in maps.items():
            # A packed ARM map fills three slots from one file
            if data not in written:
                written[data] = f"{slot}.jpg"
                await run_in_threadpool((folder / written[data]).write_bytes, data)
            names[slot] = written[data]
        # Maps without a colour map are a surface texture for catalog colours
        meta.update(source="maps", maps=names, tint="map" not in maps, size=sum(len(d) for d in written))

    await run_in_threadpool(_write_json, MATERIALS_DIR / f"{stem}.json", meta)
    logger.info(f"3D material uploaded: {stem} ({meta['source']}) by admin {current_admin.id}")
    return _describe_material(MATERIALS_DIR / f"{stem}.json")


@router.put("/materials/config", summary="Save material defaults and catalog assignments")
async def save_library_config(data: LibraryConfig, current_admin=Depends(get_current_admin)):
    for kind, material_id in data.defaults.items():
        if kind not in MATERIAL_KINDS:
            raise HTTPException(status_code=400, detail=f"Unknown material kind: {kind}")
        if not material_id.startswith("builtin:"):
            _material_meta_path(material_id)
    for key, material_id in data.assignments.items():
        if not _OPTION_KEY.match(key):
            raise HTTPException(status_code=400, detail=f"Invalid catalog option: {key}")
        if not material_id.startswith("builtin:"):
            _material_meta_path(material_id)
    MATERIALS_DIR.mkdir(parents=True, exist_ok=True)
    config = data.model_dump()
    await run_in_threadpool(_write_json, MATERIALS_DIR / LIBRARY_FILE, config)
    return config


@router.patch("/materials/{material_id}", summary="Update a 3D material")
async def update_material(material_id: str, data: Material3DUpdate, current_admin=Depends(get_current_admin)):
    path = _material_meta_path(material_id)
    changes = data.model_dump(exclude_unset=True)
    if "kind" in changes and changes["kind"] not in MATERIAL_KINDS:
        raise HTTPException(status_code=400, detail="Unknown material kind")
    meta = _read_json(path)
    meta.update(changes)
    await run_in_threadpool(_write_json, path, meta)
    return _describe_material(path)


@router.delete("/materials/{material_id}", summary="Delete a 3D material")
async def delete_material(material_id: str, current_admin=Depends(get_current_admin)):
    path = _material_meta_path(material_id)
    config_path = MATERIALS_DIR / LIBRARY_FILE
    config = _read_json(config_path)
    used = [k for k, v in {**(config.get("defaults") or {}), **(config.get("assignments") or {})}.items() if v == material_id]
    if used:
        raise HTTPException(status_code=409, detail=f"Material is in use ({', '.join(used[:5])}). Unassign it first.")
    (MATERIALS_DIR / f"{material_id}.glb").unlink(missing_ok=True)
    folder = MATERIALS_DIR / material_id
    if folder.is_dir():
        await run_in_threadpool(shutil.rmtree, folder)
    path.unlink()
    logger.info(f"3D material deleted: {material_id} by admin {current_admin.id}")
    return {"success": True}
