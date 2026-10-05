"""
Admin Bulk Edit Routes

One endpoint applies the same change set to many rows of an admin list:
POST /admin/bulk/{resource} with {"ids": [...], "changes": {...}}.

Each resource whitelists the fields that may be bulk-edited; values are
checked against the column type (boolean, integer, string length, enum,
foreign key). Products go through AdminService.update_product so category
assignments and caches stay in sync, and also take list operations
(add/remove categories and available options).

There is no bulk delete: deactivating (is_active = false) is the
reversible bulk equivalent.
"""

import logging
from dataclasses import dataclass
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Boolean, Enum as SQLEnum, Float, Integer, String, delete, insert, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.api.dependencies import require_role
from backend.core.exceptions import ResourceNotFoundError, ValidationError
from backend.database.base import get_db
from backend.models.chair import (
    Category,
    Chair,
    Color,
    Finish,
    ProductFamily,
    ProductSubcategory,
    ProductVariation,
    Upholstery,
    variation_families,
)
from backend.models.company import AdminRole, AdminUser, CompanyPricing
from backend.models.content import Catalog, EmailTemplate, Feedback, Hardware, Laminate
from backend.models.legal import LegalDocument
from backend.services.admin_service import AdminService
from backend.utils.static_content_exporter import export_content_after_update

logger = logging.getLogger(__name__)

router = APIRouter()

MAX_IDS = 5000


@dataclass(frozen=True)
class BulkResource:
    model: Any
    fields: tuple[str, ...]
    # contentData.json section to re-export after a change, if any
    export_section: Optional[str] = None


RESOURCES: dict[str, BulkResource] = {
    "variations": BulkResource(
        ProductVariation,
        (
            "is_available", "stock_status", "lead_time_days", "finish_id",
            "upholstery_id", "color_id", "upholstery_enabled", "colors_enabled",
            "laminates_enabled",
        ),
    ),
    "categories": BulkResource(Category, ("is_active", "parent_id"), "categories"),
    "subcategories": BulkResource(ProductSubcategory, ("is_active", "category_id"), "categories"),
    "families": BulkResource(ProductFamily, ("is_active", "is_featured", "category_id")),
    "finishes": BulkResource(
        Finish,
        ("is_active", "is_custom", "is_to_match", "grade", "finish_type", "color_id"),
        "finishes",
    ),
    "colors": BulkResource(Color, ("is_active", "category")),
    "upholsteries": BulkResource(
        Upholstery,
        ("is_active", "is_com", "is_seat_option_only", "grade", "material_type", "color_id"),
        "upholsteries",
    ),
    "laminates": BulkResource(
        Laminate,
        (
            "is_active", "is_featured", "is_popular", "is_in_stock", "brand",
            "color_family", "finish_type", "grade", "lead_time_days",
        ),
        "laminates",
    ),
    "hardware": BulkResource(Hardware, ("is_active", "is_featured", "category"), "hardware"),
    "catalogs": BulkResource(
        Catalog,
        ("is_active", "is_featured", "catalog_type", "category_id", "year", "version"),
        "catalogs",
    ),
    "pricing-tiers": BulkResource(CompanyPricing, ("is_active",)),
    "inquiries": BulkResource(Feedback, ("is_read", "is_responded")),
    "email-templates": BulkResource(EmailTemplate, ("is_active",)),
    "legal-documents": BulkResource(LegalDocument, ("is_active",), "legalDocuments"),
}

PRODUCT_FIELDS = (
    "is_active", "is_featured", "is_new", "is_custom_only", "is_outdoor_suitable",
    "ada_compliant", "upholstery_enabled", "colors_enabled", "laminates_enabled",
    "stock_status", "lead_time_days", "minimum_order_quantity", "frame_material",
    "category_id", "subcategory_id", "family_id",
)

# List operations on products: op -> (Chair attribute, add?)
PRODUCT_LIST_OPS = {
    f"{verb}_{group}": (f"available_{group}", verb == "add")
    for verb in ("add", "remove")
    for group in ("finishes", "upholsteries", "colors", "laminates")
}
PRODUCT_CATEGORY_OPS = ("add_category_id", "remove_category_id")
# Family membership: on products, add sets the main family when there is none
# and a secondary family otherwise; remove takes it off either way.
FAMILY_OPS = ("add_family_id", "remove_family_id")


class BulkEditRequest(BaseModel):
    ids: list[int] = Field(..., min_length=1, max_length=MAX_IDS)
    changes: dict[str, Any] = Field(..., min_length=1)


class BulkEditResponse(BaseModel):
    updated: int
    missing: list[int] = []


def _coerce(model, field: str, value: Any) -> Any:
    """Check `value` against the column type of model.field; raise 400 if invalid"""
    column = model.__table__.columns[field]
    if value is None:
        if not column.nullable:
            raise HTTPException(status_code=400, detail=f"{field} cannot be empty")
        return None

    col_type = column.type
    if isinstance(col_type, Boolean):
        if not isinstance(value, bool):
            raise HTTPException(status_code=400, detail=f"{field} must be true or false")
        return value
    if isinstance(col_type, SQLEnum):
        enum_class = col_type.enum_class
        if enum_class is not None:
            try:
                return enum_class(value)
            except ValueError:
                allowed = ", ".join(m.value for m in enum_class)
                raise HTTPException(status_code=400, detail=f"{field} must be one of: {allowed}")
        if value not in col_type.enums:
            raise HTTPException(status_code=400, detail=f"{field} must be one of: {', '.join(col_type.enums)}")
        return value
    if isinstance(col_type, Integer):
        if isinstance(value, bool) or not isinstance(value, int):
            raise HTTPException(status_code=400, detail=f"{field} must be a whole number")
        return value
    if isinstance(col_type, Float):
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise HTTPException(status_code=400, detail=f"{field} must be a number")
        return float(value)
    if isinstance(col_type, String):
        if not isinstance(value, str):
            raise HTTPException(status_code=400, detail=f"{field} must be text")
        value = value.strip()
        if col_type.length and len(value) > col_type.length:
            raise HTTPException(status_code=400, detail=f"{field} is longer than {col_type.length} characters")
        if not value and not column.nullable:
            raise HTTPException(status_code=400, detail=f"{field} cannot be empty")
        return value or None
    raise HTTPException(status_code=400, detail=f"{field} can't be bulk edited")


async def _check_foreign_key(db: AsyncSession, model, field: str, value: Any) -> None:
    """400 if `value` doesn't reference an existing row of the column's FK target"""
    if value is None:
        return
    column = model.__table__.columns[field]
    for fk in column.foreign_keys:
        target = fk.column
        found = await db.execute(select(target).where(target == value))
        if found.first() is None:
            raise HTTPException(status_code=400, detail=f"{field} {value} not found")


def _validated_changes(model, allowed: tuple[str, ...], changes: dict[str, Any]) -> dict[str, Any]:
    unknown = sorted(set(changes) - set(allowed))
    if unknown:
        raise HTTPException(status_code=400, detail=f"Can't bulk edit: {', '.join(unknown)}")
    return {field: _coerce(model, field, value) for field, value in changes.items()}


def _id_list(op: str, value: Any) -> list[int]:
    if not isinstance(value, list) or not all(isinstance(v, int) and not isinstance(v, bool) for v in value):
        raise HTTPException(status_code=400, detail=f"{op} must be a list of IDs")
    return list(dict.fromkeys(value))


async def _bulk_update_products(db: AsyncSession, ids: list[int], changes: dict[str, Any]) -> BulkEditResponse:
    list_ops = {op: _id_list(op, changes.pop(op)) for op in list(changes) if op in PRODUCT_LIST_OPS}
    category_ops = {op: changes.pop(op) for op in list(changes) if op in PRODUCT_CATEGORY_OPS}
    family_changes = {op: changes.pop(op) for op in list(changes) if op in FAMILY_OPS}
    fields = _validated_changes(Chair, PRODUCT_FIELDS, changes)
    if "category_id" in fields and fields["category_id"] is None:
        raise HTTPException(status_code=400, detail="category_id cannot be empty")
    for field in ("category_id", "subcategory_id", "family_id"):
        if field in fields:
            await _check_foreign_key(db, Chair, field, fields[field])
    for op, value in category_ops.items():
        if isinstance(value, bool) or not isinstance(value, int):
            raise HTTPException(status_code=400, detail=f"{op} must be a category ID")
        await _check_foreign_key(db, Chair, "category_id", value)
    family_ops = await _family_ops(db, family_changes)
    if "family_id" in fields and family_ops:
        raise HTTPException(status_code=400, detail="Set family_id or add/remove a family, not both")
    if not (fields or list_ops or category_ops or family_ops):
        raise HTTPException(status_code=400, detail="Nothing to change")

    from backend.services.cache_service import cache_service

    result = await db.execute(
        select(Chair)
        .where(Chair.id.in_(ids))
        .options(
            selectinload(Chair.categories),
            selectinload(Chair.subcategories),
            selectinload(Chair.secondary_families),
        )
    )
    products = {p.id: p for p in result.scalars().all()}

    subcategory_parent = {}
    if "category_id" in fields or "remove_category_id" in category_ops:
        rows = await db.execute(select(ProductSubcategory.id, ProductSubcategory.category_id))
        subcategory_parent = dict(rows.all())

    updated = 0
    for product_id in ids:
        product = products.get(product_id)
        if product is None:
            continue
        update = dict(fields)

        category_ids = [c.id for c in product.categories] or ([product.category_id] if product.category_id else [])
        subcategory_ids = [s.id for s in product.subcategories] or (
            [product.subcategory_id] if product.subcategory_id else []
        )
        categories_changed = False
        if "category_id" in fields:
            # Move: the new category becomes primary and replaces the old primary
            new_primary = fields["category_id"]
            category_ids = [new_primary] + [c for c in category_ids if c not in (new_primary, product.category_id)]
            categories_changed = True
        add_id = category_ops.get("add_category_id")
        if add_id is not None and add_id not in category_ids:
            category_ids.append(add_id)
            categories_changed = True
        remove_id = category_ops.get("remove_category_id")
        if remove_id is not None and remove_id in category_ids and len(category_ids) > 1:
            category_ids.remove(remove_id)
            categories_changed = True
        if categories_changed:
            update["category_ids"] = category_ids
            if "category_id" not in update and product.category_id not in category_ids:
                update["category_id"] = category_ids[0]
            if "subcategory_id" not in fields and subcategory_parent:
                # Drop subcategories that no longer sit under one of the product's categories
                kept = [s for s in subcategory_ids if subcategory_parent.get(s) in category_ids]
                if kept != subcategory_ids:
                    update["subcategory_ids"] = kept
                    if product.subcategory_id not in kept:
                        update["subcategory_id"] = kept[0] if kept else None
        if "subcategory_id" in fields:
            new_sub = fields["subcategory_id"]
            update["subcategory_ids"] = (
                [new_sub] + [s for s in subcategory_ids if s not in (new_sub, product.subcategory_id)]
                if new_sub
                else []
            )

        if family_ops:
            primary = product.family_id
            secondary = [f.id for f in product.secondary_families]
            add_id = family_ops.get("add_family_id")
            if add_id is not None and add_id != primary and add_id not in secondary:
                if primary is None:
                    primary = add_id
                else:
                    secondary.append(add_id)
            remove_id = family_ops.get("remove_family_id")
            if remove_id is not None:
                secondary = [f for f in secondary if f != remove_id]
                if primary == remove_id:
                    # Promote the first secondary family so the product keeps a main one
                    primary = secondary.pop(0) if secondary else None
            if primary != product.family_id:
                update["family_id"] = primary
            if secondary != [f.id for f in product.secondary_families]:
                update["secondary_family_ids"] = secondary

        for op, option_ids in list_ops.items():
            attr, add = PRODUCT_LIST_OPS[op]
            current = list(update.get(attr, getattr(product, attr) or []))
            if add:
                current += [i for i in option_ids if i not in current]
            else:
                current = [i for i in current if i not in option_ids]
            update[attr] = current

        try:
            await AdminService.update_product(db=db, product_id=product_id, update_data=update)
        except ResourceNotFoundError:
            continue
        except ValidationError as e:
            raise HTTPException(status_code=400, detail=str(e))
        await cache_service.invalidate_product(product_id)
        updated += 1

    return BulkEditResponse(updated=updated, missing=[i for i in ids if i not in products])


async def _family_ops(db: AsyncSession, changes: dict[str, Any]) -> dict[str, int]:
    """Validate add_family_id / remove_family_id values"""
    ops = {}
    for op in FAMILY_OPS:
        if op not in changes:
            continue
        value = changes[op]
        if isinstance(value, bool) or not isinstance(value, int):
            raise HTTPException(status_code=400, detail=f"{op} must be a family ID")
        if await db.get(ProductFamily, value) is None:
            raise HTTPException(status_code=400, detail=f"Family {value} not found")
        ops[op] = value
    return ops


async def _apply_variation_family_ops(db: AsyncSession, variation_ids: list[int], ops: dict[str, int]) -> None:
    if "remove_family_id" in ops:
        await db.execute(
            delete(variation_families).where(
                variation_families.c.variation_id.in_(variation_ids),
                variation_families.c.family_id == ops["remove_family_id"],
            )
        )
    if "add_family_id" in ops:
        family_id = ops["add_family_id"]
        existing = await db.execute(
            select(variation_families.c.variation_id).where(
                variation_families.c.variation_id.in_(variation_ids),
                variation_families.c.family_id == family_id,
            )
        )
        have = set(existing.scalars().all())
        rows = [{"variation_id": v, "family_id": family_id} for v in variation_ids if v not in have]
        if rows:
            await db.execute(insert(variation_families), rows)


@router.post("/{resource}", response_model=BulkEditResponse, summary="Bulk edit admin rows")
async def bulk_edit(
    resource: str,
    body: BulkEditRequest,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    ids = list(dict.fromkeys(body.ids))
    changes = dict(body.changes)

    if resource == "products":
        response = await _bulk_update_products(db, ids, changes)
        logger.info("Admin %s bulk-edited %d products: %s", admin.username, response.updated, body.changes)
        return response

    spec = RESOURCES.get(resource)
    if spec is None:
        raise HTTPException(status_code=404, detail=f"Unknown resource: {resource}")

    family_ops = {}
    if resource == "variations":
        family_ops = await _family_ops(db, {op: changes.pop(op) for op in list(changes) if op in FAMILY_OPS})
    if not changes and not family_ops:
        raise HTTPException(status_code=400, detail="Nothing to change")
    fields = _validated_changes(spec.model, spec.fields, changes)
    for field, value in fields.items():
        await _check_foreign_key(db, spec.model, field, value)
    if resource == "categories" and fields.get("parent_id") in ids:
        raise HTTPException(status_code=400, detail="A category can't be its own parent")

    result = await db.execute(select(spec.model).where(spec.model.id.in_(ids)))
    rows = result.scalars().all()
    for row in rows:
        for field, value in fields.items():
            setattr(row, field, value)
    if family_ops and rows:
        await _apply_variation_family_ops(db, [row.id for row in rows], family_ops)
    await db.commit()

    if spec.export_section and rows:
        await export_content_after_update(spec.export_section, db)
    if resource == "variations":
        from backend.services.cache_service import cache_service

        for product_id in {row.product_id for row in rows}:
            await cache_service.invalidate_product(product_id)

    found = {row.id for row in rows}
    logger.info("Admin %s bulk-edited %d %s: %s", admin.username, len(rows), resource, body.changes)
    return BulkEditResponse(updated=len(rows), missing=[i for i in ids if i not in found])
