"""
3D Model Routes - API v1

Admin storage for configurable 3D product models (binary glTF, .glb).
Files live in uploads/models3d/<stem>.glb, each with a <stem>.json sidecar
holding its display name, linked product and viewer settings, so the
library needs no database table while it is being trialled.

A configurable model names its parts through glTF material extras:
ec_slot ("upholstery" | "frame") and ec_ref_lum (see the 3D viewer).
"""

import json
import logging
import re
import time
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from backend.api.dependencies import get_current_admin
from backend.api.v1.routes.admin.upload import UPLOAD_BASE_DIR, stored_base_name, unique_stem

logger = logging.getLogger(__name__)

router = APIRouter(tags=["3D Models"])

MODELS_DIR = UPLOAD_BASE_DIR / "models3d"
MAX_MODEL_SIZE = 100 * 1024 * 1024  # 100MB
_STEM = re.compile(r"^[A-Za-z0-9_-]+$")


class Model3DUpdate(BaseModel):
    """Editable model metadata"""
    name: str | None = Field(None, max_length=200)
    product_id: int | None = None
    # Viewer settings (swatch scale per slot, etc.), kept as given
    settings: dict | None = None


def _model_path(stem: str) -> Path:
    if not _STEM.match(stem):
        raise HTTPException(status_code=400, detail="Invalid model id")
    path = MODELS_DIR / f"{stem}.glb"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Model not found")
    return path


def _read_meta(path: Path) -> dict:
    sidecar = path.with_suffix(".json")
    try:
        return json.loads(sidecar.read_text()) if sidecar.is_file() else {}
    except (OSError, ValueError):
        logger.warning(f"Unreadable 3D model sidecar: {sidecar}")
        return {}


def _describe(path: Path) -> dict:
    meta = _read_meta(path)
    stat = path.stat()
    return {
        "id": path.stem,
        "name": meta.get("name") or path.stem,
        "product_id": meta.get("product_id"),
        "settings": meta.get("settings") or {},
        "url": f"/uploads/models3d/{path.name}",
        "size": stat.st_size,
        "uploaded_at": meta.get("uploaded_at") or int(stat.st_mtime),
    }


def _write_meta(path: Path, meta: dict) -> None:
    path.with_suffix(".json").write_text(json.dumps(meta, indent=2))


@router.get("", summary="List 3D models")
async def list_models(current_admin=Depends(get_current_admin)):
    if not MODELS_DIR.is_dir():
        return {"models": []}
    paths = sorted(MODELS_DIR.glob("*.glb"), key=lambda p: p.stat().st_mtime, reverse=True)
    return {"models": [_describe(p) for p in paths]}


@router.post("", summary="Upload a 3D model (.glb)")
async def upload_model(
    file: UploadFile = File(...),
    name: str = Form(""),
    product_id: int | None = Form(None),
    current_admin=Depends(get_current_admin),
):
    filename = file.filename or "model.glb"
    if Path(filename).suffix.lower() != ".glb":
        raise HTTPException(status_code=400, detail="Only binary glTF (.glb) models are supported")
    content = await file.read()
    if len(content) > MAX_MODEL_SIZE:
        raise HTTPException(status_code=400, detail=f"File too large. Maximum size: {MAX_MODEL_SIZE // 1024 // 1024}MB")
    # Binary glTF header: magic "glTF", version 2
    if len(content) < 12 or content[:4] != b"glTF" or int.from_bytes(content[4:8], "little") != 2:
        raise HTTPException(status_code=400, detail="File is not a valid glTF 2.0 binary (.glb)")

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    path = MODELS_DIR / f"{unique_stem(stored_base_name(filename))}.glb"
    await run_in_threadpool(path.write_bytes, content)
    meta = {"name": name.strip() or Path(filename).stem, "product_id": product_id,
            "settings": {}, "uploaded_at": int(time.time())}
    await run_in_threadpool(_write_meta, path, meta)
    logger.info(f"3D model uploaded: {path.name} by admin {current_admin.id}")
    return _describe(path)


@router.patch("/{model_id}", summary="Update 3D model details")
async def update_model(model_id: str, data: Model3DUpdate, current_admin=Depends(get_current_admin)):
    path = _model_path(model_id)
    meta = _read_meta(path)
    meta.update(data.model_dump(exclude_unset=True))
    await run_in_threadpool(_write_meta, path, meta)
    return _describe(path)


@router.delete("/{model_id}", summary="Delete a 3D model")
async def delete_model(model_id: str, current_admin=Depends(get_current_admin)):
    path = _model_path(model_id)
    path.unlink()
    path.with_suffix(".json").unlink(missing_ok=True)
    logger.info(f"3D model deleted: {path.name} by admin {current_admin.id}")
    return {"success": True}
