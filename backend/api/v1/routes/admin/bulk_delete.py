"""
Admin Permanent Delete Routes

POST /admin/bulk/{resource}/delete with {"ids": [...], "confirm": "DELETE"}
permanently removes rows that are already retired: deactivated / archived
(is_active = false), unavailable variations, read inquiries, inactive or
suspended companies, declined or expired quotes. Active rows are skipped, so
deleting always takes two deliberate steps. Super admin only.

Rows linked through ON DELETE CASCADE / SET NULL foreign keys are removed or
cleared with the item (done explicitly, so it works the same whatever the
database enforces). Throwaway customer state (carts, saved configurations) is
cleared too. Anything else that still points at a row - quote line items,
products in a category, child categories - blocks that row, which is skipped
with the reason. Rows are deleted in passes, so a parent selected together
with its children goes once the children are gone.
"""

import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Table, delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import require_role
from backend.database.base import Base, get_db
from backend.models.chair import (
    Category,
    Chair,
    Color,
    Finish,
    ProductFamily,
    ProductSubcategory,
    ProductVariation,
    Upholstery,
)
from backend.models.company import AdminRole, AdminUser, Company, CompanyPricing, CompanyStatus
from backend.models.content import Catalog, EmailTemplate, Feedback, Hardware, Laminate
from backend.models.legal import LegalDocument
from backend.models.quote import Quote, QuoteStatus
from backend.utils.static_content_exporter import export_content_after_update

logger = logging.getLogger(__name__)

router = APIRouter()

CONFIRM_WORD = "DELETE"
MAX_IDS = 2000


def _inactive(row) -> bool:
    return row.is_active is False


@dataclass(frozen=True)
class DeleteSpec:
    model: Any
    # Only rows passing this test may be deleted
    retired: Callable[[Any], bool] = _inactive
    retired_hint: str = "deactivate or archive it first"
    # Referencing tables removed along with the row although their foreign
    # key has no ON DELETE rule (throwaway state, or the row's own children)
    clear: tuple[str, ...] = ()
    # "table.column" references set to NULL instead of blocking the delete
    nullify: tuple[str, ...] = ()
    # contentData.json section to re-export afterwards
    export_section: Optional[str] = None
    name: Callable[[Any], str] = field(default=lambda row: getattr(row, "name", None) or f"#{row.id}")


SPECS: dict[str, DeleteSpec] = {
    "products": DeleteSpec(Chair, clear=("cart_items", "saved_configurations")),
    "variations": DeleteSpec(
        ProductVariation,
        retired=lambda v: v.is_available is False,
        retired_hint="mark it not available first",
        name=lambda v: v.sku,
    ),
    "categories": DeleteSpec(Category, nullify=("catalogs.category_id",), export_section="categories"),
    "subcategories": DeleteSpec(ProductSubcategory, export_section="categories"),
    "families": DeleteSpec(ProductFamily),
    "finishes": DeleteSpec(Finish, nullify=("cart_items.selected_finish_id",), export_section="finishes"),
    "colors": DeleteSpec(Color),
    "upholsteries": DeleteSpec(
        Upholstery, nullify=("cart_items.selected_upholstery_id",), export_section="upholsteries"
    ),
    "laminates": DeleteSpec(Laminate, export_section="laminates", name=lambda r: f"{r.brand} {r.pattern_name}"),
    "hardware": DeleteSpec(Hardware, export_section="hardware"),
    "catalogs": DeleteSpec(Catalog, export_section="catalogs", name=lambda r: r.title),
    "pricing-tiers": DeleteSpec(CompanyPricing, name=lambda r: r.pricing_tier_name),
    "inquiries": DeleteSpec(
        Feedback,
        retired=lambda r: r.is_read is True,
        retired_hint="open or mark it read first",
        name=lambda r: f"inquiry from {r.name}",
    ),
    "email-templates": DeleteSpec(EmailTemplate),
    "legal-documents": DeleteSpec(LegalDocument, export_section="legalDocuments", name=lambda r: r.title),
    "companies": DeleteSpec(
        Company,
        retired=lambda c: c.is_active is False or c.status in (CompanyStatus.INACTIVE, CompanyStatus.SUSPENDED),
        retired_hint="set it inactive or suspended first",
        clear=("carts", "saved_configurations"),
        name=lambda c: c.company_name,
    ),
    "quotes": DeleteSpec(
        Quote,
        retired=lambda q: q.status in (QuoteStatus.DECLINED, QuoteStatus.EXPIRED),
        retired_hint="decline or expire it first",
        clear=("quote_items", "quote_attachments", "quote_history"),
        name=lambda q: f"quote {q.quote_number}",
    ),
}

# How blockers are described to the admin
TABLE_NOUNS = {
    "quote_items": "quote line",
    "chairs": "product",
    "categories": "child category",
    "quotes": "quote",
}


class DeleteRequest(BaseModel):
    ids: list[int] = Field(..., min_length=1, max_length=MAX_IDS)
    confirm: str = Field(..., description=f'Must be "{CONFIRM_WORD}"')


class SkippedRow(BaseModel):
    id: int
    name: str
    reason: str


class DeleteResponse(BaseModel):
    deleted: int
    skipped: list[SkippedRow] = []


def _references(table: Table):
    """(referencing table, fk column, ondelete) for every FK pointing at table"""
    for other in Base.metadata.tables.values():
        for fk in other.foreign_keys:
            if fk.column.table is table:
                yield other, fk.parent, (fk.ondelete or "").upper()


async def _purge(db: AsyncSession, table: Table, ids: list, nullify: tuple[str, ...] = ()) -> None:
    """
    Delete rows of `table` by id along with everything that references them:
    SET NULL (and `nullify`) references are cleared, all others removed,
    recursively. Only called once a row has passed the blocker check.
    """
    if not ids:
        return
    for other, column, ondelete in _references(table):
        if other is table:
            continue  # self-references (parent_id) are blockers, checked earlier
        if (ondelete == "SET NULL" or f"{other.name}.{column.name}" in nullify) and column.nullable:
            await db.execute(update(other).where(column.in_(ids)).values({column.name: None}))
        elif "id" in other.c and other.c.id.primary_key:
            child_ids = (await db.execute(select(other.c.id).where(column.in_(ids)))).scalars().all()
            await _purge(db, other, list(child_ids))
        else:
            await db.execute(delete(other).where(column.in_(ids)))
    await db.execute(delete(table).where(table.c.id.in_(ids)))


async def _blockers(db: AsyncSession, spec: DeleteSpec, row_id: int) -> list[str]:
    """What still uses this row and has no ON DELETE rule, e.g. "2 quote lines" """
    table = spec.model.__table__
    found = []
    for other, column, ondelete in _references(table):
        if ondelete in ("CASCADE", "SET NULL") and other is not table:
            continue
        if other.name in spec.clear or f"{other.name}.{column.name}" in spec.nullify:
            continue
        count = (await db.execute(select(func.count()).select_from(other).where(column == row_id))).scalar_one()
        if count:
            noun = TABLE_NOUNS.get(other.name, other.name.replace("_", " ").rstrip("s"))
            found.append(f"{count} {noun}{'' if count == 1 else 's'}")
    return found


@router.post("/{resource}/delete", response_model=DeleteResponse, summary="Permanently delete retired rows")
async def permanent_delete(
    resource: str,
    body: DeleteRequest,
    admin: AdminUser = Depends(require_role(AdminRole.SUPER_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    spec = SPECS.get(resource)
    if spec is None:
        raise HTTPException(status_code=404, detail=f"Unknown resource: {resource}")
    if body.confirm.strip().upper() != CONFIRM_WORD:
        raise HTTPException(status_code=400, detail=f'Type "{CONFIRM_WORD}" to confirm a permanent delete')

    ids = list(dict.fromkeys(body.ids))
    rows = {r.id: r for r in (await db.execute(select(spec.model).where(spec.model.id.in_(ids)))).scalars().all()}
    names = {row_id: spec.name(row) for row_id, row in rows.items()}
    product_ids = {r.product_id for r in rows.values()} if resource == "variations" else set()

    skipped: dict[int, str] = {}
    pending = []
    for row_id in ids:
        row = rows.get(row_id)
        if row is None:
            skipped[row_id] = "not found"
        elif not spec.retired(row):
            skipped[row_id] = f"still active: {spec.retired_hint}"
        else:
            pending.append(row_id)

    # Drop the ORM objects so bulk statements don't fight the identity map
    db.expunge_all()

    table = spec.model.__table__
    deleted = []
    blocked: dict[int, list[str]] = {}
    progress = True
    while pending and progress:
        progress = False
        for row_id in list(pending):
            reasons = await _blockers(db, spec, row_id)
            if reasons:
                blocked[row_id] = reasons
                continue
            try:
                async with db.begin_nested():
                    await _purge(db, table, [row_id], spec.nullify)
            except IntegrityError:
                blocked[row_id] = ["still referenced elsewhere"]
                continue
            pending.remove(row_id)
            blocked.pop(row_id, None)
            deleted.append(row_id)
            progress = True
    for row_id in pending:
        skipped[row_id] = "in use: " + ", ".join(blocked.get(row_id, ["still referenced"]))

    await db.commit()

    if deleted:
        if spec.export_section:
            await export_content_after_update(spec.export_section, db)
        if resource in ("products", "variations"):
            from backend.services.cache_service import cache_service

            for product_id in (deleted if resource == "products" else product_ids):
                await cache_service.invalidate_product(product_id)

    logger.warning(
        "Admin %s permanently deleted %d %s: %s (skipped %d)",
        admin.username, len(deleted), resource, deleted, len(skipped),
    )
    return DeleteResponse(
        deleted=len(deleted),
        skipped=[SkippedRow(id=i, name=names.get(i, f"#{i}"), reason=r) for i, r in skipped.items()],
    )
