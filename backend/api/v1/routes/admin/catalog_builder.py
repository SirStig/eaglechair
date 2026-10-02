"""
Admin Catalog Builder Routes

Saved catalog projects, page previews (PNG) and PDF export in the Eagle Chair
catalog design, plus the product / family pickers the editor uses.
Rendering runs in a worker thread (MuPDF is CPU-bound and not async).
"""

import base64
import logging
import re
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from backend.api.dependencies import get_current_admin, require_role
from backend.api.v1.routes.admin.upload import get_upload_base_dir
from backend.api.v1.schemas.catalog_builder import (
    CatalogDocument,
    CatalogProjectCreate,
    CatalogProjectUpdate,
    ExportRequest,
    PreviewRequest,
    SuggestPagesRequest,
)
from backend.database.base import get_db
from backend.models.catalog_project import CatalogProject
from backend.models.chair import Chair, ProductFamily
from backend.models.company import AdminRole, AdminUser
from backend.models.content import Installation
from backend.services.catalog_pdf.data import load_catalog_data, load_products, sample_document, suggest_pages
from backend.services.catalog_pdf.images import EXPORT_MAX_PX, PREVIEW_MAX_PX, ImageLoader
from backend.services.catalog_pdf.renderer import render_pdf, render_preview

logger = logging.getLogger(__name__)

router = APIRouter()


def _project_summary(project: CatalogProject) -> dict:
    pages = (project.document or {}).get("pages") or []
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "page_count": len(pages),
        "created_at": project.created_at.isoformat() if project.created_at else None,
        "updated_at": project.updated_at.isoformat() if project.updated_at else None,
        "last_exported_at": project.last_exported_at.isoformat() if project.last_exported_at else None,
    }


def _project_detail(project: CatalogProject) -> dict:
    document = CatalogDocument.model_validate(project.document or {}).model_dump()
    return {**_project_summary(project), "document": document}


async def _get_project(db: AsyncSession, project_id: int) -> CatalogProject:
    project = await db.get(CatalogProject, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Catalog project not found")
    return project


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------


@router.get("/projects", summary="List catalog projects")
async def list_projects(
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CatalogProject).order_by(CatalogProject.updated_at.desc()))
    return [_project_summary(p) for p in result.scalars().all()]


@router.post("/projects", status_code=201, summary="Create a catalog project")
async def create_project(
    body: CatalogProjectCreate,
    admin: AdminUser = Depends(require_role(AdminRole.EDITOR)),
    db: AsyncSession = Depends(get_db),
):
    document = body.document or CatalogDocument()
    project = CatalogProject(
        name=body.name.strip(),
        description=body.description,
        document=document.model_dump(),
        created_by_id=admin.id,
        updated_by_id=admin.id,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    logger.info("Admin %s created catalog project %s", admin.username, project.id)
    return _project_detail(project)


@router.post("/projects/sample", status_code=201, summary="Create a sample catalog from live data")
async def create_sample_project(
    admin: AdminUser = Depends(require_role(AdminRole.EDITOR)),
    db: AsyncSession = Depends(get_db),
):
    """
    A ready-made catalog to show or start from: cover, contents and the
    best-photographed families with their variations, plus an install photo.
    """
    products = await load_products(db, include_inactive=False)
    family_ids = {p["family_id"] for p in products if p["family_id"]}
    families = {}
    if family_ids:
        rows = await db.execute(select(ProductFamily).where(ProductFamily.id.in_(family_ids)))
        families = {f.id: f for f in rows.scalars().all()}
    installs = await db.execute(
        select(Installation).where(Installation.is_active.is_(True)).order_by(Installation.display_order)
    )
    photos = []
    for inst in installs.scalars().all():
        for entry in [inst.primary_image, *(inst.images or [])]:
            url = entry.get("url") if isinstance(entry, dict) else entry
            if isinstance(url, str) and url.startswith("/uploads/images/"):
                photos.append(url)
    document = CatalogDocument.model_validate(sample_document(products, families, photos))
    project = CatalogProject(
        name="Sample Catalog",
        description="Built automatically from live products, families and install photos.",
        document=document.model_dump(),
        created_by_id=admin.id,
        updated_by_id=admin.id,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    logger.info("Admin %s created a sample catalog (%d pages)", admin.username, len(document.pages))
    return _project_detail(project)


@router.get("/projects/{project_id}", summary="Get a catalog project")
async def get_project(
    project_id: int,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return _project_detail(await _get_project(db, project_id))


@router.put("/projects/{project_id}", summary="Save a catalog project")
async def update_project(
    project_id: int,
    body: CatalogProjectUpdate,
    admin: AdminUser = Depends(require_role(AdminRole.EDITOR)),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_project(db, project_id)
    if body.name is not None:
        project.name = body.name.strip()
    if body.description is not None:
        project.description = body.description
    if body.document is not None:
        project.document = body.document.model_dump()
    project.updated_by_id = admin.id
    await db.commit()
    await db.refresh(project)
    return _project_detail(project)


@router.post("/projects/{project_id}/duplicate", status_code=201, summary="Duplicate a catalog project")
async def duplicate_project(
    project_id: int,
    admin: AdminUser = Depends(require_role(AdminRole.EDITOR)),
    db: AsyncSession = Depends(get_db),
):
    source = await _get_project(db, project_id)
    copy = CatalogProject(
        name=f"{source.name} (copy)"[:255],
        description=source.description,
        document=source.document,
        created_by_id=admin.id,
        updated_by_id=admin.id,
    )
    db.add(copy)
    await db.commit()
    await db.refresh(copy)
    return _project_detail(copy)


@router.delete("/projects/{project_id}", summary="Delete a catalog project")
async def delete_project(
    project_id: int,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_project(db, project_id)
    await db.delete(project)
    await db.commit()
    logger.info("Admin %s deleted catalog project %s", admin.username, project_id)
    return {"message": "Catalog project deleted"}


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------


@router.post("/preview", summary="Render one page as PNG")
async def preview_page(
    body: PreviewRequest,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Renders page ``page_index`` of an (unsaved) document. Returns a JPEG as a
    data URL plus the photo slots (PDF points, 612 x 792 page) for the editor's
    drag handles.
    """
    document = body.document.model_dump()
    if body.page_index >= len(document["pages"]):
        raise HTTPException(status_code=400, detail="page_index is out of range")
    data = await load_catalog_data(db, document)
    images = ImageLoader(get_upload_base_dir(), PREVIEW_MAX_PX)
    preview = await run_in_threadpool(render_preview, document, data, images, body.page_index, body.dpi)
    return {
        "image": "data:image/jpeg;base64," + base64.b64encode(preview.image).decode("ascii"),
        "slots": preview.slots,
        "page_number": preview.page_number,
        "physical_pages": preview.physical_pages,
        "total_pages": preview.total_pages,
        "page_size": [612, 792],
    }


def _safe_filename(name: Optional[str]) -> str:
    stem = re.sub(r"[^A-Za-z0-9 ._-]+", "", (name or "").strip()).strip(" .") or "Eagle Chair Catalog"
    return f"{stem[:100]}.pdf"


@router.post("/export", summary="Export a catalog as PDF")
async def export_catalog(
    body: ExportRequest,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    document = body.document.model_dump()
    if not document["pages"]:
        raise HTTPException(status_code=400, detail="The catalog has no pages")
    data = await load_catalog_data(db, document)
    images = ImageLoader(get_upload_base_dir(), EXPORT_MAX_PX)
    pdf = await run_in_threadpool(render_pdf, document, data, images)

    if body.project_id is not None:
        project = await db.get(CatalogProject, body.project_id)
        if project is not None:
            project.last_exported_at = datetime.utcnow()
            await db.commit()

    logger.info("Admin %s exported a catalog (%d pages)", admin.username, len(document["pages"]))
    filename = _safe_filename(body.filename or document["settings"].get("title"))
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"', "Cache-Control": "no-store"},
    )


# ---------------------------------------------------------------------------
# Pickers
# ---------------------------------------------------------------------------


@router.post("/suggest-pages", summary="Starter pages for families / products")
async def suggest(
    body: SuggestPagesRequest,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    ids = set(body.product_ids)
    if body.family_ids:
        # Whole families: only the products that are live on the site
        rows = await db.execute(
            select(Chair.id).where(Chair.family_id.in_(body.family_ids), Chair.is_active.is_(True))
        )
        ids.update(rows.scalars().all())
    products = await load_products(db, ids)
    # Requested family order first, then family name and model number
    family_rank = {fid: i for i, fid in enumerate(body.family_ids)}
    products.sort(key=lambda p: (family_rank.get(p["family_id"], len(family_rank)), p["family_name"] or "", p["model_number"]))
    family_ids = {p["family_id"] for p in products if p["family_id"]}
    families = {}
    if family_ids:
        rows = await db.execute(select(ProductFamily).where(ProductFamily.id.in_(family_ids)))
        families = {f.id: f for f in rows.scalars().all()}
    return {"pages": suggest_pages(products, families, body.include_gallery)}


@router.get("/products", summary="Products for the catalog editor")
async def picker_products(
    search: Optional[str] = Query(None, max_length=100),
    family_id: Optional[int] = None,
    ids: Optional[str] = Query(None, description="Comma-separated product ids", max_length=4000),
    include_inactive: bool = True,
    limit: int = Query(60, ge=1, le=500),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Products with their variations and photos (searchable by model number or name)."""
    query = select(Chair.id)
    if not include_inactive:
        query = query.where(Chair.is_active.is_(True))
    if family_id is not None:
        query = query.where(Chair.family_id == family_id)
    if ids:
        wanted = [int(x) for x in ids.split(",") if x.strip().isdigit()]
        query = query.where(Chair.id.in_(wanted))
    if search:
        term = f"%{search.strip()}%"
        query = query.where(or_(Chair.model_number.ilike(term), Chair.name.ilike(term)))
    rows = await db.execute(query.order_by(Chair.model_number).limit(limit))
    products = await load_products(db, rows.scalars().all())
    keep = ("id", "model_number", "model_suffix", "name", "family_id", "family_name", "category_name",
            "is_active", "images", "default_image", "spec_profile")
    return [
        {
            **{k: p[k] for k in keep},
            "variations": [
                {k: v[k] for k in ("id", "sku", "name", "images", "default_image")} for v in p["variations"]
            ],
        }
        for p in products
    ]


@router.get("/families", summary="Families for the catalog editor")
async def picker_families(
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    counts = (
        select(Chair.family_id, func.count(Chair.id).label("n"))
        .where(Chair.family_id.is_not(None))
        .group_by(Chair.family_id)
        .subquery()
    )
    rows = await db.execute(
        select(ProductFamily, counts.c.n)
        .join(counts, counts.c.family_id == ProductFamily.id)
        .order_by(ProductFamily.name)
    )
    return [
        {"id": f.id, "name": f.name, "is_active": f.is_active, "image": f.family_image, "product_count": n}
        for f, n in rows.all()
    ]
