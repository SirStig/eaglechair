"""
AI catalog tools - full read access and approval-gated writes for the admin AI.

The AI can see every catalog entity (active or not), audit data quality, and
propose batches of creates / updates / deletes. Proposals are stored in
``ai_proposed_edits`` and only touch catalog data once an admin approves them.

Editable fields are derived from the SQLAlchemy columns of each model, so new
columns become visible and editable without changes here. Values are coerced
to the column type and foreign keys are checked when a change is proposed and
again when it is applied.
"""

import enum
import logging
import re
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Callable, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    Enum,
    Float,
    Integer,
    Numeric,
    String,
    Text,
    and_,
    func,
    or_,
    select,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.base import Base
from backend.models.ai_chat import AIProposedEdit, ProposalStatus
from backend.models.catalog_project import CatalogProject
from backend.models.chair import (
    Category,
    Chair,
    Color,
    CustomOption,
    Finish,
    ProductFamily,
    ProductSubcategory,
    ProductTag,
    ProductVariation,
    Upholstery,
    chair_categories,
    chair_secondary_families,
    chair_subcategories,
)
from backend.models.content import Catalog, Hardware, Laminate

logger = logging.getLogger(__name__)

MAX_LIST_LIMIT = 500
MAX_GET_IDS = 100
MAX_PROPOSALS_PER_CALL = 200

# Never editable, on any entity
_SYSTEM_FIELDS = {"id", "created_at", "updated_at", "view_count", "quote_count", "download_count"}
_CENTS_FIELDS = {"base_price", "msrp", "price_adjustment", "additional_cost", "list_price", "price_per_sheet"}


# ─────────────────────────────────────────────────────────────────────────────
# Entity registry
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class EntitySpec:
    key: str
    model: type
    label: str
    display: Callable[[Any], str]
    search_fields: tuple[str, ...]
    summary_fields: tuple[str, ...]
    admin_path: str
    active_field: Optional[str] = "is_active"
    readonly_fields: set[str] = field(default_factory=set)
    slug_source: Optional[str] = None  # create: auto-generate `slug` from this field
    cms_section: Optional[str] = None  # contentData.json section to re-export after writes
    virtual_fields: dict[str, str] = field(default_factory=dict)  # name -> description

    @property
    def table(self):
        return self.model.__table__


def _join(*parts) -> str:
    return " ".join(str(p).strip() for p in parts if p not in (None, "")).strip()


ENTITIES: dict[str, EntitySpec] = {
    spec.key: spec
    for spec in [
        EntitySpec(
            key="product",
            model=Chair,
            label="Product",
            display=lambda o: _join(f"{o.model_number or ''}{o.model_suffix or ''}", o.name),
            search_fields=("model_number", "model_suffix", "name", "slug", "short_description"),
            summary_fields=(
                "model_number", "model_suffix", "name", "family_id", "category_id", "subcategory_id",
                "base_price", "stock_status", "is_active", "is_featured", "is_new", "primary_image_url",
            ),
            admin_path="/admin/catalog?edit={id}",
            virtual_fields={
                "category_ids": "list of ALL category ids the product is listed under (primary must be included)",
                "subcategory_ids": "list of ALL subcategory ids",
                "secondary_family_ids": "list of additional family ids the product also appears in",
            },
            slug_source="name",
        ),
        EntitySpec(
            key="variation",
            model=ProductVariation,
            label="Variation",
            display=lambda o: _join(o.sku, f"— {o.name}" if o.name else None),
            search_fields=("sku", "name"),
            summary_fields=(
                "product_id", "sku", "name", "finish_id", "upholstery_id", "color_id",
                "price_adjustment", "stock_status", "is_available", "display_order",
            ),
            admin_path="/admin/catalog?edit={product_id}",
            active_field="is_available",
        ),
        EntitySpec(
            key="family",
            model=ProductFamily,
            label="Family",
            display=lambda o: o.name,
            search_fields=("name", "slug", "description", "overview_text"),
            summary_fields=("name", "slug", "category_id", "subcategory_id", "is_active", "is_featured", "family_image", "display_order"),
            admin_path="/admin/families",
            slug_source="name",
        ),
        EntitySpec(
            key="category",
            model=Category,
            label="Category",
            display=lambda o: o.name,
            search_fields=("name", "slug", "description"),
            summary_fields=("name", "slug", "parent_id", "is_active", "display_order", "spec_profile"),
            admin_path="/admin/categories",
            slug_source="name",
            cms_section="categories",
        ),
        EntitySpec(
            key="subcategory",
            model=ProductSubcategory,
            label="Subcategory",
            display=lambda o: o.name,
            search_fields=("name", "slug", "description"),
            summary_fields=("name", "slug", "category_id", "is_active", "display_order"),
            admin_path="/admin/categories",
            slug_source="name",
        ),
        EntitySpec(
            key="finish",
            model=Finish,
            label="Finish",
            display=lambda o: _join(o.name, f"({o.finish_code})" if o.finish_code else None),
            search_fields=("name", "finish_code", "finish_type", "description"),
            summary_fields=("name", "finish_code", "finish_type", "grade", "additional_cost", "color_id", "image_url", "is_active", "display_order"),
            admin_path="/admin/finishes",
            cms_section="finishes",
        ),
        EntitySpec(
            key="upholstery",
            model=Upholstery,
            label="Upholstery",
            display=lambda o: _join(o.name, f"({o.material_code})" if o.material_code else None),
            search_fields=("name", "material_code", "material_type", "manufacturer", "color", "pattern"),
            summary_fields=("name", "material_code", "material_type", "manufacturer", "grade", "additional_cost", "color_id", "swatch_image_url", "is_active", "display_order"),
            admin_path="/admin/upholstery",
            cms_section="upholsteries",
        ),
        EntitySpec(
            key="color",
            model=Color,
            label="Color",
            display=lambda o: _join(o.name, f"({o.color_code})" if o.color_code else None),
            search_fields=("name", "color_code", "category", "hex_value"),
            summary_fields=("name", "color_code", "hex_value", "category", "is_active", "display_order"),
            admin_path="/admin/colors",
        ),
        EntitySpec(
            key="laminate",
            model=Laminate,
            label="Laminate",
            display=lambda o: _join(o.brand, o.pattern_name, f"({o.pattern_code})" if o.pattern_code else None),
            search_fields=("brand", "pattern_name", "pattern_code", "color_family", "description"),
            summary_fields=("brand", "pattern_name", "pattern_code", "color_family", "grade", "is_in_stock", "is_active", "display_order"),
            admin_path="/admin/laminates",
            cms_section="laminates",
        ),
        EntitySpec(
            key="hardware",
            model=Hardware,
            label="Hardware",
            display=lambda o: _join(o.name, f"({o.model_number})" if o.model_number else None),
            search_fields=("name", "category", "model_number", "sku", "material", "description"),
            summary_fields=("name", "category", "model_number", "sku", "material", "finish", "list_price", "is_active", "display_order"),
            admin_path="/admin/hardware",
            cms_section="hardware",
        ),
        EntitySpec(
            key="custom_option",
            model=CustomOption,
            label="Custom option",
            display=lambda o: _join(o.name, f"({o.option_code})" if o.option_code else None),
            search_fields=("name", "option_code", "option_type", "description"),
            summary_fields=("name", "option_code", "option_type", "price_adjustment", "requires_quote", "is_active", "display_order"),
            admin_path="/admin/catalog",
        ),
        EntitySpec(
            key="catalog",
            model=Catalog,
            label="Catalog / download",
            display=lambda o: _join(o.title, f"({o.year})" if o.year else None),
            search_fields=("title", "description", "version", "year"),
            summary_fields=("title", "catalog_type", "file_url", "thumbnail_url", "version", "year", "category_id", "is_active", "is_featured", "display_order"),
            admin_path="/admin/downloads",
            readonly_fields={"file_type", "file_size"},
            cms_section="catalogs",
        ),
        EntitySpec(
            key="catalog_project",
            model=CatalogProject,
            label="Catalog Builder project",
            display=lambda o: o.name,
            search_fields=("name", "description"),
            summary_fields=("name", "description", "last_exported_at", "updated_at"),
            admin_path="/admin/catalog-builder",
            active_field=None,
            # The page layout document is edited in the Catalog Builder, never by the AI
            readonly_fields={"document", "created_by_id", "updated_by_id", "last_exported_at"},
        ),
        EntitySpec(
            key="tag",
            model=ProductTag,
            label="Product tag",
            display=lambda o: o.tag_name,
            search_fields=("tag_name", "tag_type", "slug"),
            summary_fields=("tag_name", "tag_type", "slug", "is_active"),
            admin_path="/admin/catalog",
            slug_source="tag_name",
        ),
    ]
}

_TABLE_TO_ENTITY = {spec.table.name: key for key, spec in ENTITIES.items()}

_ALIASES = {
    "products": "product", "chair": "product", "chairs": "product",
    "variations": "variation", "product_variation": "variation", "product_variations": "variation",
    "families": "family", "product_family": "family", "product_families": "family",
    "categories": "category", "subcategories": "subcategory", "product_subcategory": "subcategory",
    "finishes": "finish", "upholsteries": "upholstery", "fabric": "upholstery", "fabrics": "upholstery",
    "colors": "color", "laminates": "laminate", "custom_options": "custom_option",
    "catalogs": "catalog", "download": "catalog", "downloads": "catalog",
    "catalog_projects": "catalog_project", "catalog_builder": "catalog_project",
    "tags": "tag", "product_tag": "tag", "product_tags": "tag",
}


def get_spec(entity_type: str) -> EntitySpec:
    key = str(entity_type or "").strip().lower().replace(" ", "_").replace("-", "_")
    key = _ALIASES.get(key, key)
    if key not in ENTITIES:
        raise ValueError(f"Unknown entity_type '{entity_type}'. Valid: {', '.join(ENTITIES)}")
    return ENTITIES[key]


def _editable_columns(spec: EntitySpec) -> dict:
    return {
        c.name: c
        for c in spec.table.columns
        if c.name not in _SYSTEM_FIELDS and c.name not in spec.readonly_fields
        and not c.name.endswith("_at")
    }


def _fk_target(column) -> Optional[str]:
    for fk in column.foreign_keys:
        return fk.column.table.name
    return None


def _type_name(column) -> str:
    t = column.type
    if isinstance(t, Enum):
        return "enum(" + "|".join(str(v) for v in t.enums) + ")"
    if isinstance(t, Boolean):
        return "boolean"
    if isinstance(t, Integer):
        name = column.name
        if name in _CENTS_FIELDS or name.endswith("_cost") or name.endswith("_price"):
            return "integer (cents)"
        return "integer"
    if isinstance(t, (Float, Numeric)):
        return "number"
    if isinstance(t, JSON):
        return "json"
    if isinstance(t, Text):
        return "text"
    if isinstance(t, String):
        return f"string(max {t.length})" if t.length else "string"
    return type(t).__name__.lower()


def _is_required(column) -> bool:
    return not column.nullable and column.default is None and column.server_default is None


def describe_schema(entity_type: Optional[str] = None) -> dict:
    """Editable fields for one or all entity types (fed to the AI via get_data_schema)."""
    specs = [get_spec(entity_type)] if entity_type else list(ENTITIES.values())
    out = {}
    for spec in specs:
        fields = {}
        for name, col in _editable_columns(spec).items():
            info = _type_name(col)
            target = _fk_target(col)
            if target:
                info += f" -> {_TABLE_TO_ENTITY.get(target, target)} id"
            if _is_required(col):
                info += ", required on create"
            fields[name] = info
        for name, desc in spec.virtual_fields.items():
            fields[name] = f"virtual: {desc}"
        out[spec.key] = {
            "label": spec.label,
            "fields": fields,
            "active_flag": spec.active_field,
            "slug_auto_generated_on_create": bool(spec.slug_source),
        }
    return {"entities": out, "notes": [
        "Prices/costs are integers in cents (25000 = $250.00).",
        "Prefer deactivating (is_active=false, or is_available=false for variations) over deleting "
        "records that quotes, carts or other records may reference.",
    ]}


# ─────────────────────────────────────────────────────────────────────────────
# Serialization
# ─────────────────────────────────────────────────────────────────────────────

def _jsonable(value):
    if isinstance(value, enum.Enum):
        return value.value
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}
    return value


def _row_dict(spec: EntitySpec, obj, fields=None) -> dict:
    names = fields or [c.name for c in spec.table.columns]
    out = {"id": obj.id, "_name": spec.display(obj)}
    for name in names:
        if name == "id":
            continue
        if spec.key == "catalog_project" and name == "document":
            out["document_summary"] = summarize_catalog_document(obj.document)
            continue
        out[name] = _jsonable(getattr(obj, name, None))
    return out


def summarize_catalog_document(document) -> dict:
    doc = document if isinstance(document, dict) else {}
    pages = doc.get("pages") or []
    page_types: dict[str, int] = {}
    product_ids: set = set()
    for page in pages:
        if not isinstance(page, dict):
            continue
        kind = str(page.get("type", "page"))
        page_types[kind] = page_types.get(kind, 0) + 1
        _collect_ids(page, product_ids)
    return {"page_count": len(pages), "page_types": page_types, "referenced_product_ids": sorted(product_ids)[:200]}


def _collect_ids(node, acc: set):
    if isinstance(node, dict):
        for k, v in node.items():
            if k in ("product_id", "productId") and isinstance(v, int):
                acc.add(v)
            elif k in ("product_ids", "productIds") and isinstance(v, list):
                acc.update(x for x in v if isinstance(x, int))
            else:
                _collect_ids(v, acc)
    elif isinstance(node, list):
        for v in node:
            _collect_ids(v, acc)


def admin_url_for(entity_type: str, entity_id: Optional[int], data: Optional[dict] = None) -> Optional[str]:
    try:
        spec = get_spec(entity_type)
    except ValueError:
        return None
    if "{product_id}" in spec.admin_path:
        pid = (data or {}).get("product_id")
        return spec.admin_path.format(product_id=pid) if pid else "/admin/catalog"
    if "{id}" in spec.admin_path:
        return spec.admin_path.format(id=entity_id) if entity_id else spec.admin_path.split("?")[0]
    return spec.admin_path


# ─────────────────────────────────────────────────────────────────────────────
# Read tools
# ─────────────────────────────────────────────────────────────────────────────

def _search_clause(spec: EntitySpec, search: str):
    term = f"%{search.strip().lower()}%"
    cols = [getattr(spec.model, f) for f in spec.search_fields if hasattr(spec.model, f)]
    clauses = [func.lower(func.coalesce(c, "")).like(term) for c in cols]
    if spec.key == "product":
        # "5242P" style full model numbers
        clauses.append(
            func.lower(func.coalesce(Chair.model_number, "") + func.coalesce(Chair.model_suffix, "")).like(term)
        )
    if search.strip().isdigit():
        clauses.append(spec.model.id == int(search.strip()))
    return or_(*clauses)


def _filter_clauses(spec: EntitySpec, filters: Optional[dict]) -> list:
    if filters is not None and not isinstance(filters, dict):
        raise ValueError("filters must be an object of field: value")
    clauses = []
    for name, value in (filters or {}).items():
        col = spec.table.columns.get(name)
        if col is None:
            raise ValueError(f"Unknown filter field '{name}' for {spec.key}")
        attr = getattr(spec.model, name)
        if value is None or (isinstance(value, str) and value.lower() == "null"):
            clauses.append(attr.is_(None))
        elif isinstance(value, str) and value.lower() == "not_null":
            clauses.append(attr.is_not(None))
        elif isinstance(value, list):
            clauses.append(attr.in_([_coerce(col, v) for v in value]))
        else:
            clauses.append(attr == _coerce(col, value))
    return clauses


async def list_records(
    db: AsyncSession,
    entity_type: str,
    search: Optional[str] = None,
    filters: Optional[dict] = None,
    include_inactive: bool = True,
    fields: Optional[list] = None,
    limit: int = 100,
    offset: int = 0,
) -> dict:
    """Page through any entity, with optional text search and exact-match filters."""
    spec = get_spec(entity_type)
    limit = max(1, min(int(limit or 100), MAX_LIST_LIMIT))
    offset = max(0, int(offset or 0))
    where = _filter_clauses(spec, filters)
    if search and str(search).strip():
        where.append(_search_clause(spec, str(search)))
    if not include_inactive and spec.active_field:
        where.append(getattr(spec.model, spec.active_field).is_(True))

    count_q = select(func.count()).select_from(spec.model)
    q = select(spec.model)
    if where:
        count_q = count_q.where(and_(*where))
        q = q.where(and_(*where))
    order = []
    if spec.key == "variation":
        order.append(ProductVariation.product_id)
    if hasattr(spec.model, "display_order"):
        order.append(spec.model.display_order)
    order.append(spec.model.id)
    q = q.order_by(*order).offset(offset).limit(limit)

    total = (await db.execute(count_q)).scalar() or 0
    rows = (await db.execute(q)).scalars().all()

    wanted = None
    if fields:
        valid = {c.name for c in spec.table.columns}
        wanted = [f for f in fields if f in valid]
    records = [_row_dict(spec, r, wanted or list(spec.summary_fields)) for r in rows]
    await _attach_reference_names(db, spec, records)
    return {
        "entity_type": spec.key,
        "total": total,
        "offset": offset,
        "returned": len(records),
        "has_more": offset + len(records) < total,
        "records": records,
    }


async def _attach_reference_names(db: AsyncSession, spec: EntitySpec, records: list[dict]):
    """Add `<fk>_name` next to foreign key ids so the AI doesn't need extra lookups."""
    for name, col in _editable_columns(spec).items():
        target_key = _TABLE_TO_ENTITY.get(_fk_target(col) or "")
        if not target_key:
            continue
        ids = {r[name] for r in records if r.get(name)}
        if not ids:
            continue
        tspec = ENTITIES[target_key]
        objs = (await db.execute(select(tspec.model).where(tspec.model.id.in_(ids)))).scalars().all()
        names = {o.id: tspec.display(o) for o in objs}
        label = f"{name.removesuffix('_id')}_name"
        for r in records:
            if r.get(name):
                r[label] = names.get(r[name], "<missing record>")


async def get_records(db: AsyncSession, entity_type: str, ids: list) -> dict:
    """Every column of the given records, plus related ids (variations, M2M links, products)."""
    spec = get_spec(entity_type)
    clean_ids = []
    for i in (ids or [])[:MAX_GET_IDS]:
        try:
            clean_ids.append(int(i))
        except (TypeError, ValueError):
            continue
    if not clean_ids:
        return {"error": "ids is required", "records": []}
    objs = (await db.execute(select(spec.model).where(spec.model.id.in_(clean_ids)))).scalars().all()
    records = [_row_dict(spec, o) for o in objs]
    await _attach_reference_names(db, spec, records)
    by_id = {r["id"]: r for r in records}

    if spec.key == "product" and by_id:
        pids = list(by_id)
        for table, col, key in (
            (chair_categories, "category_id", "category_ids"),
            (chair_subcategories, "subcategory_id", "subcategory_ids"),
            (chair_secondary_families, "family_id", "secondary_family_ids"),
        ):
            for r in by_id.values():
                r[key] = []
            rows = await db.execute(select(table.c.chair_id, table.c[col]).where(table.c.chair_id.in_(pids)))
            for chair_id, other in rows.all():
                by_id[chair_id][key].append(other)
        vspec = ENTITIES["variation"]
        vfields = list(vspec.summary_fields) + ["width", "depth", "height", "seat_height", "weight", "upholstery_amount", "primary_image_url"]
        vrows = (await db.execute(
            select(ProductVariation).where(ProductVariation.product_id.in_(pids))
            .order_by(ProductVariation.display_order, ProductVariation.id)
        )).scalars().all()
        for r in by_id.values():
            r["variations"] = []
        for v in vrows:
            by_id[v.product_id]["variations"].append(_row_dict(vspec, v, vfields))
        for r in by_id.values():
            await _attach_reference_names(db, vspec, r["variations"])

    if spec.key == "family" and by_id:
        for r in by_id.values():
            r["products"] = []
        prows = await db.execute(
            select(Chair.id, Chair.family_id, Chair.model_number, Chair.model_suffix, Chair.name, Chair.is_active)
            .where(Chair.family_id.in_(list(by_id)))
        )
        for p in prows.all():
            by_id[p.family_id]["products"].append({
                "id": p.id, "model": f"{p.model_number}{p.model_suffix or ''}", "name": p.name, "is_active": p.is_active,
            })

    missing = [i for i in clean_ids if i not in by_id]
    return {"entity_type": spec.key, "records": records, "not_found": missing}


async def catalog_overview(db: AsyncSession) -> dict:
    """Row counts (total and active) for every entity type."""
    out = {}
    for key, spec in ENTITIES.items():
        entry = {"total": (await db.execute(select(func.count()).select_from(spec.model))).scalar() or 0}
        if spec.active_field:
            entry[spec.active_field.removeprefix("is_")] = (await db.execute(
                select(func.count()).select_from(spec.model).where(getattr(spec.model, spec.active_field).is_(True))
            )).scalar() or 0
        out[key] = entry
    return {"counts": out}


# ─────────────────────────────────────────────────────────────────────────────
# Data quality audit
# ─────────────────────────────────────────────────────────────────────────────

def _messy(s: Optional[str]) -> bool:
    return bool(s) and (s != s.strip() or "  " in s)


def _norm_code(s: Optional[str]) -> str:
    return re.sub(r"[\s\-]", "", s or "").upper()


async def audit_data_quality(
    db: AsyncSession,
    entity_type: str,
    filters: Optional[dict] = None,
    max_issues: int = 300,
) -> dict:
    """
    Find cleanup candidates: duplicates, messy whitespace, missing names/images,
    broken references, SKUs that don't match their product, unused options, etc.
    Issues with an obvious fix carry `suggested_changes` ready for propose_changes.
    """
    spec = get_spec(entity_type)
    q = select(spec.model)
    where = _filter_clauses(spec, filters)
    if where:
        q = q.where(and_(*where))
    objs = (await db.execute(q.order_by(spec.model.id))).scalars().all()
    issues: list[dict] = []

    def add(obj, issue, detail=None, fix=None):
        entry = {"id": obj.id, "name": spec.display(obj), "issue": issue}
        if detail:
            entry["detail"] = detail
        if fix:
            entry["suggested_changes"] = fix
        issues.append(entry)

    # Generic checks: whitespace in text columns, duplicate display names
    string_cols = [c.name for c in spec.table.columns if isinstance(c.type, String) and not c.name.endswith("_url")]
    name_groups: dict[str, list] = {}
    for o in objs:
        for name in string_cols:
            val = getattr(o, name, None)
            if isinstance(val, str) and _messy(val):
                add(o, "messy_whitespace", f"{name}={val!r}", {name: re.sub(r"\s+", " ", val).strip()})
        name_groups.setdefault(spec.display(o).strip().lower(), []).append(o)
    if spec.key != "variation":
        for name, group in name_groups.items():
            if name and len(group) > 1:
                for o in group:
                    add(o, "duplicate_name", f"same name as ids {[g.id for g in group if g.id != o.id]}")

    if spec.key == "variation":
        product_ids = {o.product_id for o in objs}
        products = {}
        if product_ids:
            products = {p.id: p for p in (await db.execute(select(Chair).where(Chair.id.in_(product_ids)))).scalars().all()}
        sku_groups: dict[str, list] = {}
        combo_groups: dict[tuple, list] = {}
        for o in objs:
            p = products.get(o.product_id)
            norm = _norm_code(o.sku)
            sku_groups.setdefault(norm, []).append(o)
            combo_groups.setdefault((o.product_id, o.finish_id, o.upholstery_id, o.color_id), []).append(o)
            if p is None:
                add(o, "orphan_variation", f"product {o.product_id} does not exist")
                continue
            if o.sku and o.sku.strip() != o.sku.strip().upper():
                add(o, "sku_not_uppercase", o.sku, {"sku": o.sku.strip().upper()})
            if p.model_number and norm and not norm.startswith(_norm_code(p.model_number)):
                add(o, "sku_does_not_match_product_model", f"sku {o.sku} vs product {p.model_number}{p.model_suffix or ''}")
            if not (o.name or "").strip():
                add(o, "missing_name")
            if o.is_available and not p.is_active:
                add(o, "available_on_inactive_product", f"product {p.model_number} is inactive", {"is_available": False})
            if not any((o.finish_id, o.upholstery_id, o.color_id)):
                add(o, "no_finish_upholstery_or_color")
            same_dims = [
                d for d in ("width", "depth", "height", "seat_height", "weight")
                if getattr(o, d) is not None and getattr(o, d) == getattr(p, d)
            ]
            if same_dims:
                add(o, "redundant_dimensions", f"{', '.join(same_dims)} equal the product's (inherited anyway)", {d: None for d in same_dims})
        for norm, group in sku_groups.items():
            if norm and len(group) > 1:
                for o in group:
                    add(o, "duplicate_sku", f"normalized SKU {norm} shared with ids {[g.id for g in group if g.id != o.id]}")
        for combo, group in combo_groups.items():
            if len(group) > 1 and any(combo[1:]):
                for o in group[1:]:
                    add(o, "duplicate_option_combination", f"same product/finish/upholstery/color as id {group[0].id}")

    elif spec.key == "product":
        variation_counts = dict((await db.execute(
            select(ProductVariation.product_id, func.count()).group_by(ProductVariation.product_id)
        )).all())
        model_groups: dict[str, list] = {}
        for o in objs:
            model_groups.setdefault(_norm_code(f"{o.model_number}{o.model_suffix or ''}"), []).append(o)
            if not o.primary_image_url and not o.images:
                add(o, "missing_image")
            if not (o.short_description or "").strip():
                add(o, "missing_short_description")
            if not o.base_price:
                add(o, "zero_base_price")
            if not o.family_id:
                add(o, "no_family")
            if not any((o.width, o.depth, o.height)):
                add(o, "missing_dimensions")
            if o.is_active and not variation_counts.get(o.id):
                add(o, "no_variations")
        for model, group in model_groups.items():
            if len(group) > 1:
                for o in group:
                    add(o, "duplicate_model_number", f"{model} shared with ids {[g.id for g in group if g.id != o.id]}")

    elif spec.key == "family":
        counts = dict((await db.execute(
            select(Chair.family_id, func.count()).where(Chair.is_active.is_(True)).group_by(Chair.family_id)
        )).all())
        for o in objs:
            if o.is_active and not counts.get(o.id):
                add(o, "family_without_active_products", None, {"is_active": False})
            if not o.family_image:
                add(o, "missing_family_image")
            if not (o.overview_text or o.description):
                add(o, "missing_overview")

    elif spec.key in ("finish", "upholstery", "color"):
        col = {
            "finish": ProductVariation.finish_id,
            "upholstery": ProductVariation.upholstery_id,
            "color": ProductVariation.color_id,
        }[spec.key]
        used = dict((await db.execute(select(col, func.count()).where(col.is_not(None)).group_by(col))).all())
        for o in objs:
            if not used.get(o.id):
                add(o, "not_used_by_any_variation")
            if not (getattr(o, "image_url", None) or getattr(o, "swatch_image_url", None) or getattr(o, "hex_value", None)):
                add(o, "missing_image_or_swatch")

    by_issue: dict[str, int] = {}
    for i in issues:
        by_issue[i["issue"]] = by_issue.get(i["issue"], 0) + 1
    max_issues = max(1, min(int(max_issues or 300), 1000))
    return {
        "entity_type": spec.key,
        "records_checked": len(objs),
        "issue_counts": by_issue,
        "issues": issues[:max_issues],
        "truncated": len(issues) > max_issues,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Validation
# ─────────────────────────────────────────────────────────────────────────────

class ChangeError(ValueError):
    """A proposed change is invalid; the message is shown to the AI so it can fix it."""


_TRUE = {"true", "1", "yes", "y", "on"}
_FALSE = {"false", "0", "no", "n", "off"}


def _coerce(column, value):
    """Convert an AI-supplied value to the column's Python type, or raise ChangeError."""
    if value is None:
        if not column.nullable:
            raise ChangeError(f"{column.name} cannot be null")
        return None
    t = column.type
    try:
        if isinstance(t, Boolean):
            if isinstance(value, bool):
                return value
            s = str(value).strip().lower()
            if s in _TRUE:
                return True
            if s in _FALSE:
                return False
            raise ValueError
        if isinstance(t, Enum):
            allowed = list(t.enums)
            s = value.value if isinstance(value, enum.Enum) else str(value)
            for a in allowed:
                if s.lower() == a.lower():
                    return a
            raise ChangeError(f"{column.name} must be one of {allowed}")
        if isinstance(t, Integer):
            if isinstance(value, bool):
                raise ValueError
            number = float(value) if isinstance(value, str) else value
            if isinstance(number, float) and not number.is_integer():
                raise ChangeError(f"{column.name} must be a whole number (prices are in cents)")
            return int(number)
        if isinstance(t, (Float, Numeric)):
            if isinstance(value, bool):
                raise ValueError
            return float(value)
        if isinstance(t, JSON):
            if isinstance(value, (list, dict)):
                return value
            raise ChangeError(f"{column.name} must be a JSON list or object")
        if isinstance(t, (String, Text)):
            s = value if isinstance(value, str) else str(value)
            length = getattr(t, "length", None)
            if length and len(s) > length:
                raise ChangeError(f"{column.name} is longer than {length} characters")
            return s
    except ChangeError:
        raise
    except (TypeError, ValueError):
        raise ChangeError(f"{column.name}: {value!r} is not a valid {_type_name(column)}")
    return value


def _as_python(column, stored):
    """Turn a JSON-stored proposal value back into what the ORM column expects."""
    if stored is not None and isinstance(column.type, Enum) and column.type.enum_class:
        for member in column.type.enum_class:
            if stored in (member.value, member.name):
                return member
    return stored


async def _check_fk(db: AsyncSession, column, value):
    target = _fk_target(column)
    if value is None or not target:
        return
    table = Base.metadata.tables.get(target)
    if table is None:
        return
    if not (await db.execute(select(table.c.id).where(table.c.id == value))).first():
        raise ChangeError(f"{column.name}={value}: no {_TABLE_TO_ENTITY.get(target, target)} with that id")


async def _check_unique(db: AsyncSession, spec: EntitySpec, column, value, entity_id):
    if value is None or not column.unique:
        return
    q = select(spec.model.id).where(getattr(spec.model, column.name) == value)
    if entity_id:
        q = q.where(spec.model.id != entity_id)
    if (await db.execute(q)).first():
        raise ChangeError(f"{column.name} '{value}' is already used by another {spec.label.lower()}")


async def _check_id_list(db: AsyncSession, model, ids, label) -> list[int]:
    if not isinstance(ids, list):
        raise ChangeError(f"{label} must be a list of ids")
    clean = []
    for i in ids:
        try:
            clean.append(int(i))
        except (TypeError, ValueError):
            raise ChangeError(f"{label}: {i!r} is not an id")
    if clean:
        found = set((await db.execute(select(model.id).where(model.id.in_(clean)))).scalars().all())
        missing = [i for i in clean if i not in found]
        if missing:
            raise ChangeError(f"{label}: ids {missing} do not exist")
    return clean


_VIRTUAL_MODELS = {"category_ids": Category, "subcategory_ids": ProductSubcategory, "secondary_family_ids": ProductFamily}
_VIRTUAL_TABLES = {
    "category_ids": (chair_categories, "category_id"),
    "subcategory_ids": (chair_subcategories, "subcategory_id"),
    "secondary_family_ids": (chair_secondary_families, "family_id"),
}


async def _normalize_fields(db: AsyncSession, spec: EntitySpec, data: dict, entity_id: Optional[int]) -> dict:
    if not isinstance(data, dict) or not data:
        raise ChangeError("changes must be a non-empty object of field: value")
    cols = _editable_columns(spec)
    out = {}
    for name, value in data.items():
        if name in spec.virtual_fields:
            out[name] = await _check_id_list(db, _VIRTUAL_MODELS[name], value, name)
            continue
        col = cols.get(name)
        if col is None:
            if name in spec.table.columns:
                raise ChangeError(f"{name} is read-only")
            raise ChangeError(f"{spec.key} has no field '{name}'")
        if isinstance(value, str) and name in ("sku", "slug", "model_number", "model_suffix"):
            value = value.strip()
        coerced = _coerce(col, value)
        await _check_fk(db, col, coerced)
        await _check_unique(db, spec, col, coerced, entity_id)
        out[name] = coerced
    return out


async def _current_values(db: AsyncSession, spec: EntitySpec, obj, names) -> dict:
    out = {}
    for name in names:
        if name in spec.virtual_fields:
            table, col = _VIRTUAL_TABLES[name]
            rows = await db.execute(select(table.c[col]).where(table.c.chair_id == obj.id))
            out[name] = sorted(rows.scalars().all())
        else:
            out[name] = _jsonable(getattr(obj, name, None))
    return out


def _same(a, b) -> bool:
    if isinstance(a, list) and isinstance(b, list) and all(isinstance(x, int) for x in a + b):
        return sorted(a) == sorted(b)
    numeric = (int, float)
    if isinstance(a, numeric) and isinstance(b, numeric) and not isinstance(a, bool) and not isinstance(b, bool):
        return float(a) == float(b)
    return a == b


async def _reference_impact(db: AsyncSession, spec: EntitySpec, entity_id: int) -> dict:
    """Count rows in other tables that point at this record (shown before a delete)."""
    impact = {}
    for table in Base.metadata.tables.values():
        if table.name == "ai_proposed_edits":
            continue
        for col in table.columns:
            if any(fk.column.table.name == spec.table.name for fk in col.foreign_keys):
                n = (await db.execute(select(func.count()).select_from(table).where(col == entity_id))).scalar() or 0
                if n:
                    impact[f"{table.name}.{col.name}"] = n
    return impact


async def validate_change(db: AsyncSession, op: dict) -> dict:
    """
    Validate and normalize one proposed change.

    Returns {action, entity_type, entity_id, entity_name, changes, before, reason}
    or raises ChangeError with a message the AI can act on.
    """
    if not isinstance(op, dict):
        raise ChangeError("each change must be an object")
    action = str(op.get("action") or "update").strip().lower()
    if action not in ("update", "create", "delete"):
        raise ChangeError("action must be update, create or delete")
    try:
        spec = get_spec(op.get("entity_type"))
    except ValueError as e:
        raise ChangeError(str(e))
    changes = op.get("changes") or op.get("data") or {}
    reason = str(op.get("reason") or "")[:2000]

    if action == "create":
        data = await _normalize_fields(db, spec, changes, None)
        if spec.slug_source and not data.get("slug"):
            source = data.get(spec.slug_source) or ""
            if spec.key == "product":
                source = f"{data.get('model_number', '')}-{source}"
            data["slug"] = await _unique_slug(db, spec, source)
        missing = [c.name for c in _editable_columns(spec).values() if _is_required(c) and c.name not in data]
        if missing:
            raise ChangeError(f"creating a {spec.key} requires: {', '.join(missing)}")
        name = op.get("entity_name") or _display_from_data(spec, data)
        return {
            "action": "create", "entity_type": spec.key, "entity_id": None,
            "entity_name": str(name)[:255], "changes": _jsonable(data), "before": None, "reason": reason,
        }

    try:
        entity_id = int(op.get("entity_id"))
    except (TypeError, ValueError):
        raise ChangeError(f"entity_id is required for {action}")
    obj = await db.get(spec.model, entity_id)
    if obj is None:
        raise ChangeError(f"no {spec.key} with id {entity_id}")
    name = spec.display(obj)

    if action == "delete":
        before = _row_dict(spec, obj, list(spec.summary_fields))
        before.pop("_name", None)
        before.pop("id", None)
        impact = await _reference_impact(db, spec, entity_id)
        if impact:
            before["_referenced_by"] = impact
        return {
            "action": "delete", "entity_type": spec.key, "entity_id": entity_id,
            "entity_name": name[:255], "changes": {}, "before": before, "reason": reason,
        }

    data = await _normalize_fields(db, spec, changes, entity_id)
    current = await _current_values(db, spec, obj, list(data))
    data = {k: v for k, v in data.items() if not _same(_jsonable(v), current.get(k))}
    if not data:
        raise ChangeError(f"{spec.key} {entity_id}: every proposed value already matches the current data")
    before = {k: current[k] for k in data}
    if spec.key == "variation":
        # Context only (not diffed): lets the UI link to the parent product
        before["_product_id"] = obj.product_id
    return {
        "action": "update", "entity_type": spec.key, "entity_id": entity_id,
        "entity_name": name[:255], "changes": _jsonable(data), "before": before, "reason": reason,
    }


def _display_from_data(spec: EntitySpec, data: dict) -> str:
    class _Obj:
        def __getattr__(self, item):
            return data.get(item)
    try:
        return spec.display(_Obj()) or f"New {spec.label.lower()}"
    except Exception:
        return f"New {spec.label.lower()}"


def _slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
    return s[:200] or "item"


async def _unique_slug(db: AsyncSession, spec: EntitySpec, source: str) -> str:
    base = _slugify(source)
    slug, n = base, 2
    while (await db.execute(select(spec.model.id).where(spec.model.slug == slug))).first():
        slug = f"{base}-{n}"
        n += 1
    return slug


# ─────────────────────────────────────────────────────────────────────────────
# Proposals
# ─────────────────────────────────────────────────────────────────────────────

def serialize_proposal(p: AIProposedEdit) -> dict:
    url_data = {**(p.before or {}), **(p.changes or {})}
    url_data.setdefault("product_id", url_data.get("_product_id"))
    return {
        "id": p.id,
        "batch_id": p.batch_id,
        "action": p.action,
        "entity_type": p.entity_type,
        "entity_id": p.entity_id,
        "entity_name": p.entity_name,
        "changes": p.changes or {},
        "before": p.before,
        "reason": p.reason,
        "status": p.status,
        "error": p.error,
        "admin_url": admin_url_for(p.entity_type, p.entity_id, url_data),
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "resolved_at": p.resolved_at.isoformat() if p.resolved_at else None,
    }


async def create_proposals(
    db: AsyncSession,
    *,
    session_id: str,
    message_id: Optional[str],
    admin_user_id: Optional[int],
    title: Optional[str],
    changes: list,
) -> dict:
    """Validate each change, store the valid ones as one pending batch, report the rest."""
    if not isinstance(changes, list) or not changes:
        return {"error": "changes must be a non-empty list", "accepted": 0, "rejected": [], "edits": []}
    if len(changes) > MAX_PROPOSALS_PER_CALL:
        return {
            "error": f"at most {MAX_PROPOSALS_PER_CALL} changes per call; split into several batches",
            "accepted": 0, "rejected": [], "edits": [],
        }

    title = (title or "Proposed changes").strip()[:255]
    batch_id = str(uuid.uuid4())
    rows: list[AIProposedEdit] = []
    rejected = []
    seen = set()
    for idx, op in enumerate(changes):
        op_info = op if isinstance(op, dict) else {}
        try:
            norm = await validate_change(db, op)
        except ChangeError as e:
            rejected.append({"index": idx, "entity_type": op_info.get("entity_type"),
                             "entity_id": op_info.get("entity_id"), "error": str(e)})
            continue
        if norm["action"] != "create":
            key = (norm["entity_type"], norm["entity_id"])
            if key in seen:
                rejected.append({"index": idx, "entity_type": norm["entity_type"], "entity_id": norm["entity_id"],
                                 "error": "more than one change for the same record in this batch; merge them into one"})
                continue
            seen.add(key)
        rows.append(AIProposedEdit(
            id=str(uuid.uuid4()),
            session_id=session_id,
            message_id=message_id,
            batch_id=batch_id,
            batch_title=title,
            admin_user_id=admin_user_id,
            position=len(rows),
            status=ProposalStatus.PENDING.value,
            **norm,
        ))
    for r in rows:
        db.add(r)
    await db.commit()
    return {
        "batch_id": batch_id if rows else None,
        "title": title,
        "accepted": len(rows),
        "rejected": rejected,
        "edits": [serialize_proposal(r) for r in rows],
    }


async def _after_write(spec: EntitySpec, db: AsyncSession, entity_id: Optional[int], product_ids: set):
    """Cache invalidation and static content re-export, matching the admin routes."""
    try:
        from backend.services.cache_service import cache_service

        if spec.key in ("product", "variation"):
            for pid in product_ids:
                await cache_service.invalidate_product(pid)
        elif spec.key == "family" and entity_id:
            await cache_service.invalidate_family(entity_id)
        elif spec.key == "category" and entity_id:
            await cache_service.invalidate_category(entity_id)
        elif spec.key in ("finish", "upholstery", "color", "subcategory", "tag"):
            await cache_service.invalidate_all_products()
    except Exception as e:  # the write already committed; cache is best effort
        logger.warning(f"AI edit cache invalidation failed for {spec.key} {entity_id}: {e}")
    if spec.cms_section:
        try:
            from backend.utils.static_content_exporter import export_content_after_update

            await export_content_after_update(spec.cms_section, db)
        except Exception as e:
            logger.warning(f"AI edit CMS export failed for {spec.cms_section}: {e}")


async def apply_proposal(db: AsyncSession, p: AIProposedEdit, *, force: bool = False) -> dict:
    """
    Apply one pending proposal. Returns {status, error, conflict, entity_id}.

    Updates are refused (conflict=True, status stays pending) when a changed
    field no longer holds the value it had when the AI proposed the edit,
    unless force is set.
    """
    from backend.core.exceptions import ResourceNotFoundError, ValidationError
    from backend.services.admin_service import AdminService

    spec = get_spec(p.entity_type)
    cols = spec.table.columns
    data = {k: (_as_python(cols[k], v) if k in cols else v) for k, v in (p.changes or {}).items()}
    entity_id = p.entity_id
    product_ids: set = set()
    try:
        if p.action == "update":
            obj = await db.get(spec.model, entity_id)
            if obj is None:
                return {"status": "failed", "error": f"{spec.key} {entity_id} no longer exists", "conflict": False}
            if not force and p.before:
                current = await _current_values(db, spec, obj, [k for k in p.before if k in p.changes])
                drift = [k for k, v in current.items() if not _same(v, p.before.get(k))]
                if drift:
                    return {
                        "status": "pending", "conflict": True,
                        "error": f"Changed since it was proposed: {', '.join(drift)}. Apply again to overwrite.",
                        "current": current,
                    }
            # Re-check references: something may have been deleted since the proposal
            await _normalize_fields(db, spec, p.changes or {}, entity_id)
            if spec.key == "variation":
                product_ids.update({obj.product_id, data.get("product_id")} - {None})
            if spec.key == "product":
                await AdminService.update_product(db=db, product_id=entity_id, update_data=dict(data))
                product_ids.add(entity_id)
            else:
                for k, v in data.items():
                    setattr(obj, k, v)
                await db.commit()
        elif p.action == "create":
            check = {k: v for k, v in (p.changes or {}).items() if k != "slug"}
            await _normalize_fields(db, spec, check, None)
            if data.get("slug") and spec.slug_source:
                if (await db.execute(select(spec.model.id).where(spec.model.slug == data["slug"]))).first():
                    data["slug"] = await _unique_slug(db, spec, data["slug"])
            if spec.key == "product":
                obj = await AdminService.create_product(db=db, product_data=dict(data))
            else:
                obj = spec.model(**data)
                db.add(obj)
                await db.commit()
                await db.refresh(obj)
            entity_id = obj.id
            product_ids.add(obj.id if spec.key == "product" else getattr(obj, "product_id", None))
        elif p.action == "delete":
            obj = await db.get(spec.model, entity_id)
            if obj is None:
                return {"status": "applied", "error": None, "conflict": False, "entity_id": entity_id}
            product_ids.add(entity_id if spec.key == "product" else getattr(obj, "product_id", None))
            if spec.key == "product":
                await AdminService.delete_product(db=db, product_id=entity_id, hard_delete=True)
            else:
                await db.delete(obj)
                await db.commit()
        else:
            return {"status": "failed", "error": f"unknown action {p.action}", "conflict": False}
    except (ChangeError, ResourceNotFoundError, ValidationError) as e:
        await db.rollback()
        return {"status": "failed", "error": str(e), "conflict": False}
    except IntegrityError as e:
        await db.rollback()
        logger.info(f"AI proposal {p.id} integrity error: {getattr(e, 'orig', e)}")
        msg = "The database rejected the change (a reference or unique constraint failed)"
        if p.action == "delete":
            msg = "Cannot delete: other records still reference it. Deactivate it instead."
        return {"status": "failed", "error": msg, "conflict": False}

    product_ids.discard(None)
    await _after_write(spec, db, entity_id, product_ids)
    return {"status": "applied", "error": None, "conflict": False, "entity_id": entity_id}
