"""
Admin Product Register Routes

The master list of every product and variation (active or not) with data
quality flags, bulk status / family changes and quick variation edits.
Single-product edits go through PATCH /admin/products/{id}.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import get_current_admin
from backend.core.exceptions import ResourceNotFoundError
from backend.database.base import get_db
from backend.models.chair import (
    ProductFamily,
    ProductVariation,
    chair_categories,
    chair_secondary_families,
    chair_subcategories,
)
from backend.models.company import AdminUser
from backend.services.admin_service import AdminService
from backend.services.catalog_pdf.data import load_products

logger = logging.getLogger(__name__)

router = APIRouter()

_DIMENSION_KEYS = ("height", "width", "depth", "seat_height")

ISSUE_LABELS = {
    "no_photo": "No photo",
    "no_family": "No family",
    "no_category": "No category",
    "no_dimensions": "No dimensions",
    "no_description": "No description",
}


def _issues(product: dict) -> list[str]:
    issues = []
    if not product["default_image"]:
        issues.append("no_photo")
    if not product["family_id"]:
        issues.append("no_family")
    if not product["category_id"]:
        issues.append("no_category")
    if all(product.get(k) is None for k in _DIMENSION_KEYS):
        issues.append("no_dimensions")
    if not (product.get("short_description") or product.get("full_description")):
        issues.append("no_description")
    return issues


@router.get("", summary="Product register")
async def get_register(
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    products = await load_products(db, include_inactive=True)
    # Every category / subcategory / family a product is listed under, for the filters
    links = {}
    for table, column, key in (
        (chair_categories, "category_id", "category_ids"),
        (chair_subcategories, "subcategory_id", "subcategory_ids"),
        (chair_secondary_families, "family_id", "family_ids"),
    ):
        for chair_id, linked_id in (await db.execute(select(table.c.chair_id, table.c[column]))).all():
            links.setdefault((chair_id, key), set()).add(linked_id)

    def linked(p, key, primary):
        ids = links.get((p["id"], key), set()) | ({primary} if primary else set())
        return sorted(ids)

    rows = []
    for p in products:
        rows.append({
            "id": p["id"],
            "model_number": p["model_number"],
            "model_suffix": p["model_suffix"],
            "name": p["name"],
            "slug": p["slug"],
            "is_active": p["is_active"],
            "stock_status": p["stock_status"],
            "family_id": p["family_id"],
            "family_name": p["family_name"],
            "category_id": p["category_id"],
            "category_name": p["category_name"],
            "parent_category_name": p["parent_category_name"],
            "subcategory_name": p["subcategory_name"],
            "category_ids": linked(p, "category_ids", p["category_id"]),
            "subcategory_ids": linked(p, "subcategory_ids", p["subcategory_id"]),
            "family_ids": linked(p, "family_ids", p["family_id"]),
            "default_image": p["default_image"],
            "updated_at": p["updated_at"],
            "issues": _issues(p),
            "variations": [
                {k: v[k] for k in ("id", "sku", "name", "default_image", "is_available", "stock_status", "finish", "upholstery", "color")}
                for v in p["variations"]
            ],
        })
    families = (await db.execute(select(ProductFamily).order_by(ProductFamily.name))).scalars().all()
    return {
        "products": rows,
        "families": [{"id": f.id, "name": f.name} for f in families],
        "issue_labels": ISSUE_LABELS,
    }


class BulkUpdate(BaseModel):
    product_ids: list[int] = Field(..., min_length=1, max_length=2000)
    is_active: Optional[bool] = None
    family_id: Optional[int] = Field(None, description="0 clears the family")
    stock_status: Optional[str] = Field(None, max_length=50)


@router.post("/bulk", summary="Bulk update products")
async def bulk_update(
    body: BulkUpdate,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    changes = {}
    if body.is_active is not None:
        changes["is_active"] = body.is_active
    if body.family_id is not None:
        if body.family_id and await db.get(ProductFamily, body.family_id) is None:
            raise HTTPException(status_code=400, detail="Family not found")
        changes["family_id"] = body.family_id or None
    if body.stock_status:
        changes["stock_status"] = body.stock_status.strip()
    if not changes:
        raise HTTPException(status_code=400, detail="Nothing to change")

    from backend.services.cache_service import cache_service

    updated = 0
    for product_id in dict.fromkeys(body.product_ids):
        try:
            await AdminService.update_product(db=db, product_id=product_id, update_data=dict(changes))
        except ResourceNotFoundError:
            continue
        await cache_service.invalidate_product(product_id)
        updated += 1
    logger.info("Admin %s bulk-updated %d products: %s", admin.username, updated, changes)
    return {"updated": updated}


class VariationPatch(BaseModel):
    sku: Optional[str] = Field(None, min_length=1, max_length=100)
    name: Optional[str] = Field(None, max_length=255)
    is_available: Optional[bool] = None
    stock_status: Optional[str] = Field(None, max_length=50)


@router.patch("/variations/{variation_id}", summary="Quick-edit a variation")
async def patch_variation(
    variation_id: int,
    body: VariationPatch,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    variation = await db.get(ProductVariation, variation_id)
    if variation is None:
        raise HTTPException(status_code=404, detail="Variation not found")
    changes = body.model_dump(exclude_unset=True)
    if "sku" in changes:
        changes["sku"] = changes["sku"].strip()
        clash = await db.execute(
            select(ProductVariation.id).where(ProductVariation.sku == changes["sku"], ProductVariation.id != variation_id)
        )
        if clash.first():
            raise HTTPException(status_code=409, detail=f"SKU {changes['sku']} is already used")
    for key, value in changes.items():
        setattr(variation, key, value)
    await db.commit()

    from backend.services.cache_service import cache_service

    await cache_service.invalidate_product(variation.product_id)
    return {k: getattr(variation, k) for k in ("id", "product_id", "sku", "name", "is_available", "stock_status")}
