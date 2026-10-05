"""
Admin Supplier Link Routes (/admin/material-sources)

Outside supplier catalogs we order from on request ("any Wilsonart HPL
pattern") instead of keeping our own swatch list. Products opt in through
Chair.material_sources; the active links are also exported to
contentData.json (materialSources) for the materials resource pages.

Deleting deactivates; permanent deletes go through /admin/bulk/material-sources/delete.
"""

import logging
from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import get_current_admin
from backend.database.base import get_db
from backend.models.company import AdminUser
from backend.models.content import MATERIAL_SOURCE_TYPES, MaterialSource
from backend.utils.static_content_exporter import export_content_after_update

logger = logging.getLogger(__name__)

router = APIRouter()

EXPORT_SECTION = "materialSources"


def _check_url(value: Optional[str]) -> Optional[str]:
    """Normalise a supplier link; bare domains get https://"""
    if value is None:
        return None
    value = value.strip()
    if not value:
        raise ValueError("A link is required")
    if "://" not in value:
        value = f"https://{value}"
    parsed = urlparse(value)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("Enter a full web address, e.g. https://www.wilsonart.com/laminate")
    return value


def _check_type(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip().lower()
    if value not in MATERIAL_SOURCE_TYPES:
        raise ValueError(f"material_type must be one of: {', '.join(MATERIAL_SOURCE_TYPES)}")
    return value


class SourceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    material_type: str
    url: str = Field(..., max_length=500)
    description: Optional[str] = None
    logo_url: Optional[str] = Field(None, max_length=500)
    display_order: int = 0
    is_active: bool = True

    @field_validator("material_type")
    @classmethod
    def _type(cls, v):
        return _check_type(v)

    @field_validator("url")
    @classmethod
    def _url(cls, v):
        return _check_url(v)


class SourceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    material_type: Optional[str] = None
    url: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = None
    logo_url: Optional[str] = Field(None, max_length=500)
    display_order: Optional[int] = None
    is_active: Optional[bool] = None

    @field_validator("material_type")
    @classmethod
    def _type(cls, v):
        return _check_type(v)

    @field_validator("url")
    @classmethod
    def _url(cls, v):
        return _check_url(v)


class ReorderItem(BaseModel):
    id: int
    display_order: int


class ReorderBody(BaseModel):
    order: list[ReorderItem]


def _to_dict(source: MaterialSource) -> dict:
    return {
        "id": source.id,
        "name": source.name,
        "material_type": source.material_type,
        "url": source.url,
        "description": source.description,
        "logo_url": source.logo_url,
        "display_order": source.display_order,
        "is_active": source.is_active,
    }


@router.get("", summary="List supplier links")
async def list_sources(
    material_type: Optional[str] = None,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(MaterialSource).order_by(MaterialSource.display_order, MaterialSource.name)
    if material_type:
        query = query.where(MaterialSource.material_type == material_type)
    return [_to_dict(s) for s in (await db.execute(query)).scalars().all()]


@router.get("/types", summary="Supplier link material types")
async def list_types(admin: AdminUser = Depends(get_current_admin)):
    return list(MATERIAL_SOURCE_TYPES)


@router.post("", summary="Create supplier link")
async def create_source(
    body: SourceCreate,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    source = MaterialSource(**body.model_dump())
    db.add(source)
    await db.commit()
    await db.refresh(source)
    await export_content_after_update(EXPORT_SECTION, db)
    logger.info("Admin %s created supplier link %s (%s)", admin.username, source.name, source.url)
    return _to_dict(source)


@router.post("/reorder", summary="Reorder supplier links")
async def reorder_sources(
    body: ReorderBody,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    for item in body.order:
        source = await db.get(MaterialSource, item.id)
        if source:
            source.display_order = item.display_order
    await db.commit()
    await export_content_after_update(EXPORT_SECTION, db)
    return {"message": "Order updated", "count": len(body.order)}


@router.put("/{source_id}", summary="Update supplier link")
async def update_source(
    source_id: int,
    body: SourceUpdate,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    source = await db.get(MaterialSource, source_id)
    if source is None:
        raise HTTPException(status_code=404, detail="Supplier link not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        if key in ("name", "material_type", "url") and value is None:
            continue  # required fields can't be cleared
        setattr(source, key, value)
    await db.commit()
    await db.refresh(source)
    await export_content_after_update(EXPORT_SECTION, db)
    return _to_dict(source)


@router.delete("/{source_id}", summary="Deactivate supplier link")
async def deactivate_source(
    source_id: int,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    source = await db.get(MaterialSource, source_id)
    if source is None:
        raise HTTPException(status_code=404, detail="Supplier link not found")
    source.is_active = False
    await db.commit()
    await export_content_after_update(EXPORT_SECTION, db)
    return {"message": f"{source.name} deactivated"}
