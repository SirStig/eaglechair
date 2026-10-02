"""
Loads products for the catalog tools (Catalog Builder, product exports,
product register) as plain dicts, so rendering can run off the event loop
without touching the ORM.
"""

import uuid
from collections import OrderedDict
from datetime import date
from typing import Iterable, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.models.chair import Category, Chair, ProductFamily, ProductVariation
from backend.services.catalog_pdf.layouts import MAX_GALLERY_ITEMS, CatalogData
from backend.services.catalog_pdf.specs import SPEC_FIELDS


def _image_urls(images, primary: Optional[str] = None) -> list[str]:
    """Image URLs from a JSON images column (strings or {"url": ...}), primary first."""
    urls = []
    for entry in images or []:
        url = entry.get("url") if isinstance(entry, dict) else entry
        if isinstance(url, str) and url and url not in urls:
            urls.append(url)
    if primary:
        if primary in urls:
            urls.remove(primary)
        urls.insert(0, primary)
    return urls


def spec_profile(chair: Chair) -> Optional[str]:
    """The product's spec profile: subcategory's, else category's, else its parent's."""
    if chair.subcategory is not None and chair.subcategory.spec_profile:
        return chair.subcategory.spec_profile
    category = chair.category
    if category is None:
        return None
    if category.spec_profile:
        return category.spec_profile
    return category.parent.spec_profile if category.parent is not None else None


def product_query(include_inactive: bool = True):
    query = select(Chair).options(
        selectinload(Chair.category).selectinload(Category.parent),
        selectinload(Chair.subcategory),
        selectinload(Chair.family),
        selectinload(Chair.variations).selectinload(ProductVariation.finish),
        selectinload(Chair.variations).selectinload(ProductVariation.upholstery),
        selectinload(Chair.variations).selectinload(ProductVariation.color),
    )
    if not include_inactive:
        query = query.where(Chair.is_active.is_(True))
    return query.order_by(Chair.model_number, Chair.model_suffix, Chair.id)


def variation_dict(variation: ProductVariation) -> dict:
    images = _image_urls(variation.images, variation.primary_image_url)
    data = {
        "id": variation.id,
        "product_id": variation.product_id,
        "sku": variation.sku,
        "name": variation.name,
        "images": images,
        "default_image": images[0] if images else None,
        "is_available": variation.is_available,
        "stock_status": variation.stock_status,
        "display_order": variation.display_order,
        "finish": variation.finish.name if variation.finish else None,
        "upholstery": variation.upholstery.name if variation.upholstery else None,
        "color": variation.color.name if variation.color else None,
    }
    for key in SPEC_FIELDS:
        data[key] = getattr(variation, key, None)
    return data


def product_dict(chair: Chair) -> dict:
    images = _image_urls(chair.images, chair.primary_image_url)
    category = chair.category
    data = {
        "id": chair.id,
        "model_number": chair.model_number,
        "model_suffix": chair.model_suffix,
        "name": chair.name,
        "slug": chair.slug,
        "is_active": chair.is_active,
        "stock_status": chair.stock_status,
        "family_id": chair.family_id,
        "family_name": chair.family.name if chair.family else None,
        "category_id": chair.category_id,
        "category_name": category.name if category else None,
        "parent_category_name": category.parent.name if category and category.parent else None,
        "subcategory_name": chair.subcategory.name if chair.subcategory else None,
        "spec_profile": spec_profile(chair),
        "images": images,
        "default_image": images[0] if images else None,
        "short_description": chair.short_description,
        "full_description": chair.full_description,
        "frame_material": chair.frame_material,
        "construction_details": chair.construction_details,
        "features": chair.features if isinstance(chair.features, list) else [],
        "green_certifications": chair.green_certifications if isinstance(chair.green_certifications, list) else [],
        "display_order": chair.display_order,
        "updated_at": chair.updated_at.isoformat() if chair.updated_at else None,
        "variations": [
            variation_dict(v) for v in sorted(chair.variations, key=lambda v: (v.display_order, v.sku or ""))
        ],
    }
    for key in SPEC_FIELDS:
        data[key] = getattr(chair, key, None)
    return data


async def load_products(
    db: AsyncSession, ids: Optional[Iterable[int]] = None, include_inactive: bool = True
) -> list[dict]:
    query = product_query(include_inactive)
    if ids is not None:
        ids = list({int(i) for i in ids})
        if not ids:
            return []
        query = query.where(Chair.id.in_(ids))
    result = await db.execute(query)
    return [product_dict(chair) for chair in result.scalars().unique().all()]


def _referenced_ids(document: dict) -> tuple[set[int], set[int]]:
    product_ids, variation_ids = set(), set()
    for page in document.get("pages") or []:
        for item in page.get("items") or []:
            if item.get("product_id"):
                product_ids.add(int(item["product_id"]))
            if item.get("variation_id"):
                variation_ids.add(int(item["variation_id"]))
    return product_ids, variation_ids


async def load_catalog_data(db: AsyncSession, document: dict) -> CatalogData:
    """Every product / variation a catalog document refers to."""
    product_ids, variation_ids = _referenced_ids(document)
    if variation_ids:
        rows = await db.execute(
            select(ProductVariation.product_id).where(ProductVariation.id.in_(variation_ids))
        )
        product_ids.update(rows.scalars().all())
    data = CatalogData()
    for product in await load_products(db, product_ids):
        data.products[product["id"]] = product
        for variation in product["variations"]:
            data.variations[variation["id"]] = variation
    return data


# ---------------------------------------------------------------------------
# Page suggestions ("add family" in the Catalog Builder)
# ---------------------------------------------------------------------------


def new_page_id() -> str:
    return uuid.uuid4().hex[:12]


def _join(*parts: Optional[str]) -> str:
    return "\n".join(p.strip() for p in parts if p and p.strip())


def suggest_pages(products: list[dict], families: dict[int, ProductFamily], include_gallery: bool = True) -> list[dict]:
    """
    Starter pages for products, grouped by family: spec sheets with two
    products each (pre-filled with the product text) and a variations gallery
    when there are at least three photographed variations.
    """
    groups: "OrderedDict[str, list[dict]]" = OrderedDict()
    for product in products:
        groups.setdefault(product.get("family_name") or product["name"], []).append(product)

    pages = []
    for title, members in groups.items():
        family = families.get(members[0].get("family_id"))
        overview = family.overview_text if family is not None else None
        for start in range(0, len(members), 2):
            chunk = members[start:start + 2]
            lead = chunk[0]
            pages.append({
                "id": new_page_id(),
                "type": "product",
                "title": title,
                "subtitle": "",
                "items": [{"product_id": p["id"]} for p in chunk],
                "features": overview or lead.get("full_description") or lead.get("short_description") or "",
                "materials": _join(lead.get("frame_material"), lead.get("construction_details")),
                "environmental": ", ".join(lead.get("green_certifications") or []),
                "standard": "",
                "options": "",
                "ip_text": "",
                "emblem": "none",
            })
        if include_gallery:
            photographed = [v for p in members for v in p["variations"] if v.get("default_image")]
            if len(photographed) >= 3:
                # Items carry the product id too, so editors can show them without a lookup
                pages.append({
                    "id": new_page_id(),
                    "type": "gallery",
                    "title": title,
                    "subtitle": "variations",
                    "items": [
                        {"product_id": v["product_id"], "variation_id": v["id"]}
                        for v in photographed[:MAX_GALLERY_ITEMS]
                    ],
                    "tagline": "Your imagination is the only limitation on what we can build for you.",
                    "emblem": "none",
                })
    return pages


# ---------------------------------------------------------------------------
# Sample catalog (a ready-made template built from live data)
# ---------------------------------------------------------------------------

SAMPLE_FAMILY_COUNT = 6


def sample_document(products: list[dict], families: dict[int, ProductFamily], install_photos: list[str]) -> dict:
    """
    A complete starter catalog: cover, contents, then the best-photographed
    families (active products only), with an install photo after the first.
    """
    photographed = [p for p in products if p["is_active"] and p.get("default_image") and p.get("family_id")]
    by_family: "OrderedDict[int, list[dict]]" = OrderedDict()
    for product in photographed:
        by_family.setdefault(product["family_id"], []).append(product)
    ranked = sorted(by_family.items(), key=lambda kv: (-len(kv[1]), kv[1][0]["family_name"] or ""))
    chosen = ranked[:SAMPLE_FAMILY_COUNT]

    # Cover: one product per family first, then fill up to 8
    cover_items, seen = [], set()
    for _, members in chosen:
        cover_items.append({"product_id": members[0]["id"]})
        seen.add(members[0]["id"])
    for _, members in chosen:
        for p in members[1:]:
            if len(cover_items) >= 8:
                break
            if p["id"] not in seen:
                cover_items.append({"product_id": p["id"]})
                seen.add(p["id"])

    year = str(date.today().year)
    pages = [
        {
            "id": new_page_id(), "type": "cover", "title": "New Traditions", "subtitle": "Eagle Chair Inc.",
            "year": year, "items": cover_items[:8], "tagline": "Built to last",
            "tagline_right": "Designed to impress", "website": "www.eaglechair.com",
        },
        {"id": new_page_id(), "type": "toc", "title": "Contents", "tagline": "Diverse concepts, unvarying quality"},
    ]
    for index, (_, members) in enumerate(chosen):
        pages.extend(suggest_pages(members, families, include_gallery=True))
        if index == 0 and install_photos:
            pages.append({
                "id": new_page_id(), "type": "photo", "image_url": install_photos[0],
                "include_in_toc": False, "title": "",
            })
    return {"settings": {"title": f"Eagle Chair Catalog {year}"}, "pages": pages}
