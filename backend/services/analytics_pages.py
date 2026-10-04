"""
Analytics page catalog

Which public paths count as real pages (everything else - scanner probes like
/wp-login.php or /.env, typos, dead links - is never recorded), and what each
recorded path is called in the admin reports. Keep PUBLIC_PAGES and
DYNAMIC_ROUTES in step with the public routes in frontend/src/App.jsx and the
copy in frontend/src/utils/analyticsRoutes.js.
"""

import re
from typing import Any, Dict, Iterable, Optional

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.chair import Category, Chair, ProductFamily, ProductSubcategory

PUBLIC_PAGES = {
    "/": "Home",
    "/products": "Product Catalog",
    "/search": "Search",
    "/gallery": "Gallery",
    "/about": "About",
    "/contact": "Contact",
    "/find-a-rep": "Find a Rep",
    "/virtual-catalogs": "Virtual Catalogs",
    "/resources/guides": "Guides",
    "/resources/spec-sheets": "Spec Sheets",
    "/resources/finishes": "Finishes",
    "/resources/woodfinishes": "Finishes",
    "/resources/hardware": "Hardware",
    "/resources/laminates": "Laminates",
    "/resources/upholstery": "Upholstery",
    "/resources/seat-back-terms": "Seat & Back Terms",
    "/general-information": "General Information",
    "/cart": "Quote Cart",
    "/quote-request": "Quote Request Form",
    "/terms": "Terms of Service",
    "/privacy": "Privacy Policy",
}

_SEG = r"[A-Za-z0-9][A-Za-z0-9_-]{0,199}"

# (kind, pattern) - more specific first
DYNAMIC_ROUTES = (
    ("subcategory", re.compile(rf"^/products/category/({_SEG})/({_SEG})$")),
    ("category", re.compile(rf"^/products/category/({_SEG})$")),
    ("related", re.compile(rf"^/products/({_SEG})/related$")),
    ("product", re.compile(rf"^/products/{_SEG}/{_SEG}/({_SEG})$")),
    ("product", re.compile(rf"^/products/({_SEG})$")),
    ("family", re.compile(rf"^/families/({_SEG})$")),
)


def match_route(path: Optional[str]):
    """(kind, groups) for a public page path, or None if it isn't one."""
    if not path:
        return None
    if path in PUBLIC_PAGES:
        return ("static", ())
    for kind, pattern in DYNAMIC_ROUTES:
        m = pattern.match(path)
        if m:
            return (kind, m.groups())
    return None


def is_public_page(path: Optional[str]) -> bool:
    return match_route(path) is not None


async def describe_pages(db: AsyncSession, paths: Iterable[str]) -> Dict[str, Dict[str, Any]]:
    """
    Name every path: {path: {"title", "kind", "exists"}}.

    `exists` is False when a product / family / category slug in the path no
    longer resolves (deleted product, mistyped link, someone guessing ids), so
    reports can leave those rows out.
    """
    matched = {p: match_route(p) for p in set(paths) if p}
    wanted: Dict[str, set] = {"product": set(), "family": set(), "category": set(), "subcategory": set()}
    for match in matched.values():
        if not match:
            continue
        kind, groups = match
        if kind in ("product", "related"):
            wanted["product"].add(groups[0])
        elif kind == "family":
            wanted["family"].add(groups[0])
        elif kind == "category":
            wanted["category"].add(groups[0])
        elif kind == "subcategory":
            wanted["category"].add(groups[0])
            wanted["subcategory"].add(groups[1])

    products: Dict[str, str] = {}
    if wanted["product"]:
        ids = [int(v) for v in wanted["product"] if v.isdigit()]
        slugs = [v for v in wanted["product"] if not v.isdigit()]
        conditions = []
        if ids:
            conditions.append(Chair.id.in_(ids))
        if slugs:
            conditions.append(Chair.slug.in_(slugs))
        for row in (await db.execute(select(Chair.id, Chair.slug, Chair.name).where(or_(*conditions)))).all():
            products[str(row.id)] = row.name
            products[row.slug] = row.name

    async def names(model, slugs):
        if not slugs:
            return {}
        rows = (await db.execute(select(model.slug, model.name).where(model.slug.in_(slugs)))).all()
        return {r.slug: r.name for r in rows}

    families = await names(ProductFamily, wanted["family"])
    categories = await names(Category, wanted["category"])
    subcategories = await names(ProductSubcategory, wanted["subcategory"])

    described = {}
    for path, match in matched.items():
        if not match:
            described[path] = {"title": path, "kind": "unknown", "exists": False}
            continue
        kind, groups = match
        title = None
        if kind == "static":
            title = PUBLIC_PAGES[path]
        elif kind == "product":
            title = products.get(groups[0])
        elif kind == "related":
            name = products.get(groups[0])
            title = f"Related to {name}" if name else None
        elif kind == "family":
            name = families.get(groups[0])
            title = f"{name} Family" if name else None
        elif kind == "category":
            title = categories.get(groups[0])
        elif kind == "subcategory":
            cat, sub = categories.get(groups[0]), subcategories.get(groups[1])
            title = f"{cat} › {sub}" if cat and sub else None
        described[path] = {"title": title or path, "kind": kind, "exists": title is not None}
    return described
