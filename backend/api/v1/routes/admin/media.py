"""
Media Library Routes - API v1

Admin Media Library page: browse every uploaded image and document, see
where each is used, take files off records, replace them (keeping the old
file as a version), restore or delete versions, delete files, and the image
editor's server-side helpers. See backend/services/media_manager_service.py.
"""

import logging
from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from backend.api.dependencies import get_current_admin
from backend.api.v1.routes.admin import upload
from backend.database.base import get_db
from backend.services import document_library_service, media_library_service, media_manager_service, media_service
from backend.services.media_manager_service import MediaError

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Media Library"])

Kind = Literal["image", "document"]
SORT_PATTERN = "^(newest|oldest|name|size|usage)$"
MAX_EDITOR_UPLOAD = 60 * 1024 * 1024


def _base():
    # Read at call time so tests can point uploads at a temp folder
    return upload.UPLOAD_BASE_DIR


def _http(err: MediaError) -> HTTPException:
    return HTTPException(status_code=err.status, detail=err.message)


async def _export_site_content(db: AsyncSession, touched: list[dict]) -> None:
    """Changed CMS rows reach the public site through contentData.json."""
    if media_manager_service.touches_site_content(touched):
        from backend.utils.static_content_exporter import export_all_content_types

        await export_all_content_types(db)


@router.get("/images", summary="Media library: images")
async def list_images(
    q: str = Query("", max_length=200),
    folder: str = Query("", max_length=100),
    usage: str = Query("all", pattern="^(all|used|unused)$"),
    used_by_type: str = Query("", max_length=100),
    sort: str = Query("newest", pattern=SORT_PATTERN),
    page: int = Query(1, ge=1),
    page_size: int = Query(60, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_admin=Depends(get_current_admin),
):
    versions, hidden = await media_manager_service.version_index(db, "image")
    return await media_library_service.list_images(
        db, _base(), q=q, folder=upload.sanitize_subfolder(folder) if folder else "",
        usage=usage, used_by_type=used_by_type, page=page, page_size=page_size,
        sort=sort, versions=versions, hidden=hidden,
    )


@router.get("/documents", summary="Media library: documents")
async def list_documents(
    q: str = Query("", max_length=200),
    folder: str = Query("", max_length=100),
    kind: str = Query("", pattern="^(|pdf|word|zip|cad|spreadsheet|other)$"),
    usage: str = Query("all", pattern="^(all|used|unused)$"),
    used_by_type: str = Query("", max_length=100),
    sort: str = Query("newest", pattern=SORT_PATTERN),
    page: int = Query(1, ge=1),
    page_size: int = Query(60, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_admin=Depends(get_current_admin),
):
    versions, hidden = await media_manager_service.version_index(db, "document")
    return await document_library_service.list_documents(
        db, _base(), q=q, folder=upload.sanitize_subfolder(folder) if folder else "",
        kind=kind, usage=usage, used_by_type=used_by_type, page=page, page_size=page_size,
        sort=sort, versions=versions, hidden=hidden,
    )


@router.get("/details", summary="Where a file is used, its versions and facts")
async def file_details(
    kind: Kind = Query(...),
    url: str = Query(..., max_length=1000),
    db: AsyncSession = Depends(get_db),
    current_admin=Depends(get_current_admin),
):
    try:
        return await media_manager_service.details(db, kind, url, _base())
    except MediaError as e:
        raise _http(e)


@router.get("/raw", summary="Image bytes for the editor")
async def raw_image(url: str = Query(..., max_length=1000), current_admin=Depends(get_current_admin)):
    """Same-origin copy of an uploaded image, so the editor canvas can read its pixels."""
    path = media_manager_service.resolve_path("image", url, _base())
    if path is None or not path.is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(path, headers={"Cache-Control": "no-store"})


@router.get("/capabilities", summary="Optional editor features this server supports")
async def capabilities(current_admin=Depends(get_current_admin)):
    return {"ai_background_removal": media_manager_service.ai_background_available()}


@router.post("/replace", summary="Replace a file, keeping the old one as a version")
async def replace_file(
    file: UploadFile = File(...),
    kind: Kind = Form(...),
    url: str = Form(..., max_length=1000),
    action: Literal["replaced", "edited"] = Form("replaced"),
    note: Optional[str] = Form(None, max_length=255),
    db: AsyncSession = Depends(get_db),
    current_admin=Depends(get_current_admin),
):
    """
    Stores the upload as a new file next to the current one (same folder and
    base name), points every record at it and keeps the current file as an
    earlier version. Used for both "Upload replacement" and the image editor.
    """
    old_key = media_manager_service.library_key(kind, url)
    if not old_key:
        raise HTTPException(status_code=400, detail="Not a media URL")
    content = await file.read()
    folder = media_manager_service.folder_of(kind, old_key) or "general"
    base_name = old_key.rsplit("/", 1)[-1]
    if kind == "image":
        new_url, _ = await upload.store_uploaded_image(content, file.filename or base_name, file.content_type, folder, base_name)
    else:
        # Keep the new file's extension (a .docx may replace a .pdf)
        new_url = await upload.store_uploaded_document(content, file.filename or base_name, folder, base_name)
    try:
        touched = await media_manager_service.replace(
            db, kind, old_key, new_url, action=action, note=note, admin_id=current_admin.id
        )
        await db.commit()
    except MediaError as e:
        await db.rollback()
        # Nothing points at the new file: don't leave it behind
        new_path = media_manager_service.resolve_path(kind, new_url, _base())
        if new_path is not None:
            await run_in_threadpool(media_service.delete_image_files, new_path)
        raise _http(e)
    await _export_site_content(db, touched)
    logger.info(f"Media {action}: {old_key} -> {new_url} ({len(touched)} records) by admin {current_admin.id}")
    return {"url": new_url, "previous_url": old_key, "updated": touched}


class Target(BaseModel):
    model: str = Field(..., max_length=100)
    id: int


class DetachRequest(BaseModel):
    kind: Kind
    url: str = Field(..., max_length=1000)
    # None: every record using the file
    targets: Optional[list[Target]] = Field(None, max_length=500)


@router.post("/detach", summary="Take a file off records that use it")
async def detach(body: DetachRequest, db: AsyncSession = Depends(get_db), current_admin=Depends(get_current_admin)):
    only = None if body.targets is None else {(t.model, t.id) for t in body.targets}
    try:
        touched = await media_manager_service.rewrite_references(db, body.kind, body.url, remove=True, only=only)
        await db.commit()
    except MediaError as e:
        await db.rollback()
        raise _http(e)
    await _export_site_content(db, touched)
    return {"updated": touched}


@router.post("/versions/{version_id}/restore", summary="Make an earlier version current again")
async def restore_version(version_id: int, db: AsyncSession = Depends(get_db), current_admin=Depends(get_current_admin)):
    try:
        url, touched = await media_manager_service.restore_version(db, version_id, _base(), current_admin.id)
        await db.commit()
    except MediaError as e:
        await db.rollback()
        raise _http(e)
    await _export_site_content(db, touched)
    return {"url": url, "updated": touched}


@router.delete("/versions/{version_id}", summary="Delete an earlier version")
async def delete_version(version_id: int, db: AsyncSession = Depends(get_db), current_admin=Depends(get_current_admin)):
    try:
        url = await media_manager_service.delete_version(db, version_id, _base())
        await db.commit()
    except MediaError as e:
        await db.rollback()
        raise _http(e)
    logger.info(f"Media version deleted: {url} by admin {current_admin.id}")
    return {"success": True}


class DeleteFilesRequest(BaseModel):
    kind: Kind
    urls: list[str] = Field(..., min_length=1, max_length=200)
    # Take the files off the records using them first (otherwise in-use files are refused)
    detach: bool = False


@router.delete("/files", summary="Delete files and their versions")
async def delete_files(body: DeleteFilesRequest, db: AsyncSession = Depends(get_db), current_admin=Depends(get_current_admin)):
    """Each file is its own transaction: one refusal doesn't undo the rest."""
    deleted, failed, touched = [], [], []
    for url in dict.fromkeys(body.urls):
        try:
            result = await media_manager_service.delete_file(db, body.kind, url, _base(), detach=body.detach)
            await db.commit()
        except MediaError as e:
            await db.rollback()
            failed.append({"url": url, "detail": e.message})
            continue
        deleted.append(result["url"])
        touched += result["detached"]
    await _export_site_content(db, touched)
    if deleted:
        logger.info(f"Media deleted ({body.kind}): {', '.join(deleted)} by admin {current_admin.id}")
    return {"deleted": deleted, "failed": failed, "updated": touched}


@router.post("/remove-background", summary="Cut an image out of its background")
async def remove_background(
    file: UploadFile = File(...),
    method: Literal["white", "ai"] = Form("white"),
    current_admin=Depends(get_current_admin),
):
    content = await file.read()
    if not content or len(content) > MAX_EDITOR_UPLOAD:
        raise HTTPException(status_code=400, detail="Image is empty or too large")
    try:
        png = await run_in_threadpool(media_manager_service.remove_background, content, method)
    except MediaError as e:
        raise _http(e)
    except Exception as e:
        logger.exception("Background removal failed")
        raise HTTPException(status_code=500, detail=f"Background removal failed: {e.__class__.__name__}")
    return Response(content=png, media_type="image/png", headers={"Cache-Control": "no-store"})
