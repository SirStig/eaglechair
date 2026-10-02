"""
SEO Prerender

Production serves the React app as one static index.html (Apache rewrite),
so link-preview bots (Facebook, LinkedIn, Slack, iMessage, X) and AI/search
crawlers that don't run JavaScript (GPTBot, ClaudeBot, PerplexityBot, Bing
on first pass) would see the same generic <head> and an empty page on every
URL. This job writes, next to the built frontend:

    _seo/<page path>/index.html   the built index.html with that page's
                                  <head> (title, description, canonical, Open
                                  Graph / Twitter tags, JSON-LD) and a
                                  <noscript> summary of the page content
    uploads/og/<kind>/<slug>-<hash>.jpg
                                  its 1200x630 share card (og_image_service)

Apache serves the shell when one exists for the request path (see the
"_seo" rule in frontend/public/.htaccess), FastAPI does the same in
serve_spa. The shell is the same app: tags carry data-rh="true", so
react-helmet-async takes them over on the client exactly like SSR output.

Pages: every active product, product family and category, plus the static
routes from frontend/src/config/seoConfig.js (the Vite build writes them to
seo-pages.json). The home page keeps the defaults in index.html itself.

Rebuilds run when the catalog, the deployed index.html, seo-pages.json or
the CMS export change (checked every SEO_PRERENDER_INTERVAL_SECONDS by a
background task; a file lock keeps it to one worker). A deploy wipes _seo/
(rsync --delete) and changes index.html, so the next check rebuilds it;
until then Apache falls back to the plain index.html. Share cards live under
uploads/, which deploys never touch, and are only rendered when their inputs
change.
"""

import asyncio
import html
import json
import logging
import os
import re
import shutil
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional
from xml.sax.saxutils import escape

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.core.config import settings
from backend.models.chair import (
    Category,
    Chair,
    ProductFamily,
    chair_categories,
    chair_secondary_families,
)
from backend.services import og_image_service as og

logger = logging.getLogger(__name__)

SHELL_DIR = "_seo"
PAGES_FILE = "seo-pages.json"
SIGNATURE_FILE = ".signature"
LOCK_FILE = ".seo-prerender.lock"
OG_SUBDIR = "og"
SEO_START = "<!--seo:start-->"
SEO_END = "<!--seo:end-->"

BRAND = "Eagle Chair"
DESCRIPTION_MAX = 158
TITLE_MAX = 65
# Members listed in a family/category <noscript> summary and ItemList
LIST_MAX = 120

_SAFE_SEGMENT = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._~-]*$")
_TAG_RE = re.compile(r"<[^>]+>")
_SPACE_RE = re.compile(r"\s+")


# ---------------------------------------------------------------------------
# Paths and URLs
# ---------------------------------------------------------------------------

def web_root() -> Path:
    """Directory holding the built frontend (index.html)."""
    if settings.FRONTEND_PATH and Path(settings.FRONTEND_PATH).is_absolute():
        return Path(settings.FRONTEND_PATH)
    return Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"


def upload_root() -> Path:
    from backend.api.v1.routes.admin.upload import UPLOAD_BASE_DIR

    return UPLOAD_BASE_DIR


def site_url(path: str = "/") -> str:
    return settings.SITE_URL.rstrip("/") + path


def media_url(url: Optional[str]) -> Optional[str]:
    """Public absolute URL of a stored image (or frontend file) path."""
    if not url or not isinstance(url, str):
        return None
    url = url.strip()
    if url.startswith(("http://", "https://")):
        return url
    if not url.startswith("/"):
        url = f"/uploads/{url}"
    return settings.MEDIA_BASE_URL.rstrip("/") + url


def product_path(product: dict) -> str:
    """Canonical product URL; mirrors buildProductUrl (frontend/src/utils/apiHelpers.js)."""
    slug = product["slug"] or str(product["id"])
    cat = product["category"]
    if cat and cat["parent_slug"]:
        return f"/products/{cat['parent_slug']}/{cat['slug']}/{slug}"
    if cat and cat["slug"]:
        return f"/products/{cat['slug']}/uncategorized/{slug}"
    return f"/products/{slug}"


def category_path(cat: dict) -> str:
    """Mirrors buildCatalogPath (frontend/src/utils/catalogUrl.js)."""
    if cat["parent_slug"]:
        return f"/products/category/{cat['parent_slug']}/{cat['slug']}"
    return f"/products/category/{cat['slug']}"


def family_path(family: dict) -> str:
    return f"/families/{family['slug']}"


def _is_safe_path(path: str) -> bool:
    segments = path.strip("/").split("/")
    return bool(segments) and all(_SAFE_SEGMENT.match(s) for s in segments)


# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------

def clean_text(value: Any) -> str:
    if not value or not isinstance(value, str):
        return ""
    return _SPACE_RE.sub(" ", html.unescape(_TAG_RE.sub(" ", value))).strip()


def truncate(text: str, limit: int = DESCRIPTION_MAX) -> str:
    """Cut at a word boundary, ending with an ellipsis."""
    if len(text) <= limit:
        return text
    cut = text[: limit - 1].rsplit(" ", 1)[0].rstrip(",;:-–— ")
    return cut + "…"


def _sentence(text: str) -> str:
    text = text.strip()
    return text if not text or text[-1] in ".!?…" else text + "."


def inches(value: Optional[float]) -> Optional[str]:
    if value is None or value <= 0:
        return None
    return f'{value:g}"'


def compose_title(*parts: Optional[str], limit: int = TITLE_MAX) -> str:
    """'A | B | Eagle Chair', dropping trailing parts until it fits."""
    kept = [p for p in parts if p]
    while len(kept) > 1 and len(" | ".join([*kept, BRAND])) > limit:
        kept.pop()
    return " | ".join([*kept, BRAND])


def _e(value: Any) -> str:
    return html.escape(str(value), quote=True)


def _plural(n: int, word: str) -> str:
    return f"{n} {word}{'' if n == 1 else 's'}"


# ---------------------------------------------------------------------------
# Page model and HTML
# ---------------------------------------------------------------------------

@dataclass
class PageMeta:
    path: str
    title: str
    description: str
    image: Optional[str] = None
    image_alt: str = ""
    og_type: str = "website"
    noindex: bool = False
    json_ld: list[dict] = field(default_factory=list)
    body: str = ""  # crawlable HTML for the <noscript> block


def render_head(meta: PageMeta) -> str:
    """<head> tags for a page; data-rh lets react-helmet-async replace them."""
    canonical = site_url(meta.path)
    image = meta.image or media_url("/og-image.jpg")
    alt = meta.image_alt or meta.title
    robots = (
        "noindex, follow"
        if meta.noindex
        else "index, follow, max-image-preview:large, max-snippet:-1"
    )
    tags = [
        f'<title data-rh="true">{_e(meta.title)}</title>',
        f'<meta data-rh="true" name="description" content="{_e(meta.description)}"/>',
        f'<meta data-rh="true" name="robots" content="{robots}"/>',
        f'<link data-rh="true" rel="canonical" href="{_e(canonical)}"/>',
        f'<meta data-rh="true" property="og:site_name" content="{BRAND}"/>',
        '<meta data-rh="true" property="og:locale" content="en_US"/>',
        f'<meta data-rh="true" property="og:type" content="{_e(meta.og_type)}"/>',
        f'<meta data-rh="true" property="og:title" content="{_e(meta.title)}"/>',
        f'<meta data-rh="true" property="og:description" content="{_e(meta.description)}"/>',
        f'<meta data-rh="true" property="og:url" content="{_e(canonical)}"/>',
        f'<meta data-rh="true" property="og:image" content="{_e(image)}"/>',
        '<meta data-rh="true" property="og:image:type" content="image/jpeg"/>',
        f'<meta data-rh="true" property="og:image:width" content="{og.CARD_W}"/>',
        f'<meta data-rh="true" property="og:image:height" content="{og.CARD_H}"/>',
        f'<meta data-rh="true" property="og:image:alt" content="{_e(alt)}"/>',
        '<meta data-rh="true" name="twitter:card" content="summary_large_image"/>',
        f'<meta data-rh="true" name="twitter:title" content="{_e(meta.title)}"/>',
        f'<meta data-rh="true" name="twitter:description" content="{_e(meta.description)}"/>',
        f'<meta data-rh="true" name="twitter:image" content="{_e(image)}"/>',
        f'<meta data-rh="true" name="twitter:image:alt" content="{_e(alt)}"/>',
    ]
    for data in meta.json_ld:
        payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
        # "<" can't close the script element; U+2028/9 are escaped for old parsers
        payload = payload.replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
        tags.append(f'<script data-rh="true" type="application/ld+json">{payload}</script>')
    return "\n    ".join(tags)


def render_shell(template: str, meta: PageMeta) -> str:
    start = template.index(SEO_START) + len(SEO_START)
    end = template.index(SEO_END)
    out = template[:start] + "\n    " + render_head(meta) + "\n    " + template[end:]
    if meta.body:
        # Outside #root: the client only hydrates a root that has children
        noscript = f'<noscript><main class="seo-fallback">{meta.body}</main></noscript>'
        out = re.sub(r"(<body[^>]*>)", lambda m: m.group(1) + noscript, out, count=1)
    return out


def _breadcrumbs(items: list[tuple[str, str]]) -> dict:
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": i, "name": name, "item": site_url(path)}
            for i, (name, path) in enumerate(items, start=1)
        ],
    }


def _breadcrumb_html(items: list[tuple[str, str]]) -> str:
    links = " › ".join(f'<a href="{_e(path)}">{_e(name)}</a>' for name, path in items)
    return f'<nav aria-label="Breadcrumb">{links}</nav>'


# ---------------------------------------------------------------------------
# Catalog snapshot (plain dicts: rendering runs in a worker thread)
# ---------------------------------------------------------------------------

def image_urls(images: Any) -> list[str]:
    out = []
    for item in images or []:
        url = item.get("url") if isinstance(item, dict) else item
        if isinstance(url, str) and url.strip() and url.strip() not in out:
            out.append(url.strip())
    return out


def _strings(values: Any) -> list[str]:
    return [clean_text(v) for v in (values or []) if isinstance(v, str) and clean_text(v)]


def _category_dict(cat: Optional[Category]) -> Optional[dict]:
    if cat is None:
        return None
    parent = cat.parent
    return {
        "id": cat.id,
        "name": cat.name,
        "slug": cat.slug,
        "parent_id": cat.parent_id,
        "parent_slug": parent.slug if parent is not None else None,
        "parent_name": parent.name if parent is not None else None,
        "description": cat.description,
        "meta_title": cat.meta_title,
        "meta_description": cat.meta_description,
        "banner_image_url": cat.banner_image_url,
        "updated_at": cat.updated_at,
    }


def _product_dict(c: Chair) -> dict:
    images = image_urls(c.images)
    return {
        "id": c.id,
        "slug": c.slug,
        "name": c.name,
        "model_number": c.model_number,
        "model_suffix": c.model_suffix,
        "short_description": c.short_description,
        "full_description": c.full_description,
        "meta_title": c.meta_title,
        "meta_description": c.meta_description,
        "category": _category_dict(c.category),
        "category_id": c.category_id,
        "family_id": c.family_id,
        "images": images,
        "primary_image": c.primary_image_url or (images[0] if images else None),
        "width": c.width,
        "depth": c.depth,
        "height": c.height,
        "seat_width": c.seat_width,
        "seat_depth": c.seat_depth,
        "seat_height": c.seat_height,
        "arm_height": c.arm_height,
        "back_height": c.back_height,
        "weight": c.weight,
        "frame_material": clean_text(c.frame_material),
        "upholstery_amount": c.upholstery_amount,
        "features": _strings(c.features),
        "stock_status": clean_text(c.stock_status),
        "lead_time_days": c.lead_time_days,
        "flame_certifications": _strings(c.flame_certifications),
        "green_certifications": _strings(c.green_certifications),
        "ada_compliant": bool(c.ada_compliant),
        "is_outdoor_suitable": bool(c.is_outdoor_suitable),
        "updated_at": c.updated_at,
    }


async def load_snapshot(db: AsyncSession) -> dict:
    categories = (
        await db.execute(
            select(Category)
            .options(selectinload(Category.parent))
            .where(Category.is_active == True)  # noqa: E712
        )
    ).scalars().all()
    families = (
        await db.execute(select(ProductFamily).where(ProductFamily.is_active == True))  # noqa: E712
    ).scalars().all()
    chairs = (
        await db.execute(
            select(Chair)
            .options(selectinload(Chair.category).selectinload(Category.parent))
            .where(Chair.is_active == True)  # noqa: E712
            .order_by(Chair.display_order, Chair.name)
        )
    ).scalars().all()
    secondary_families = (await db.execute(select(chair_secondary_families))).all()
    extra_categories = (await db.execute(select(chair_categories))).all()

    products = [_product_dict(c) for c in chairs]

    family_members: dict[int, set[int]] = {}
    category_members: dict[int, set[int]] = {}
    for p in products:
        if p["family_id"]:
            family_members.setdefault(p["family_id"], set()).add(p["id"])
        if p["category_id"]:
            category_members.setdefault(p["category_id"], set()).add(p["id"])
    for chair_id, family_id in secondary_families:
        family_members.setdefault(family_id, set()).add(chair_id)
    for chair_id, category_id in extra_categories:
        category_members.setdefault(category_id, set()).add(chair_id)

    return {
        "products": products,
        "families": [
            {
                "id": f.id,
                "slug": f.slug,
                "name": f.name,
                "description": f.description,
                "overview_text": getattr(f, "overview_text", None),
                "image": f.family_image or f.banner_image_url,
                "category_id": f.category_id,
                "members": family_members.get(f.id, set()),
            }
            for f in families
        ],
        "categories": [
            {**_category_dict(cat), "members": category_members.get(cat.id, set())}
            for cat in categories
        ],
    }


async def catalog_signature(db: AsyncSession) -> str:
    """Cheap fingerprint of everything the pages are built from."""
    parts = []
    for model in (Chair, ProductFamily, Category):
        count, latest = (
            await db.execute(select(func.count(), func.max(model.updated_at)).select_from(model))
        ).one()
        parts.append(f"{model.__tablename__}:{count}:{latest}")
    for table in (chair_secondary_families, chair_categories):
        count = (await db.execute(select(func.count()).select_from(table))).scalar()
        parts.append(f"{table.name}:{count}")
    root = web_root()
    for name in ("index.html", PAGES_FILE, "data/contentData.json"):
        try:
            parts.append(f"{name}:{(root / name).stat().st_mtime_ns}")
        except OSError:
            parts.append(f"{name}:-")
    parts.append(f"card:{og.TEMPLATE_VERSION}:{settings.SITE_URL}:{settings.MEDIA_BASE_URL}")
    return "|".join(parts)


# ---------------------------------------------------------------------------
# Share cards
# ---------------------------------------------------------------------------

def _footer_domain() -> str:
    host = settings.SITE_URL.split("://", 1)[-1].strip("/")
    return host[4:] if host.startswith("www.") else host


class _Cards:
    """
    Writes share cards to uploads/og/<kind>/<slug>.jpg. The name is stable so
    the client can point at it (shareImageUrl in frontend/src/config/site.js);
    shells add ?v=<content hash> so networks that cache per URL refetch a
    changed card. manifest.json maps each card to its hash.
    """

    def __init__(self):
        self.uploads = upload_root()
        self.manifest_path = self.uploads / OG_SUBDIR / "manifest.json"
        self.manifest: dict[str, str] = _read_json(self.manifest_path) or {}
        self.keep: dict[str, str] = {}
        self.rendered = 0
        self._images: dict[str, Any] = {}

    def _image(self, url: str):
        if url not in self._images:
            if len(self._images) > 32:
                self._images.clear()
            self._images[url] = og.load_source_image(url, self.uploads)
        return self._images[url]

    def card(
        self,
        kind: str,
        slug: str,
        layout: str,
        sources: list[str],
        eyebrow: str,
        title: str,
        details: list[str],
    ) -> Optional[str]:
        footer = _footer_domain()
        key = og.card_key(layout, {
            "images": sources, "eyebrow": eyebrow, "title": title,
            "details": details, "footer": footer,
        })
        name = f"{kind}/{slug}"
        target = self.uploads / OG_SUBDIR / kind / f"{slug}.jpg"
        if self.manifest.get(name) != key or not target.is_file():
            images = [img for img in (self._image(u) for u in sources if u) if img is not None]
            try:
                if layout == "photo":
                    data = og.render_photo_card(images[0] if images else None, eyebrow, title, details, footer)
                else:
                    data = og.render_product_card(images, eyebrow, title, details, footer)
            except Exception:
                logger.exception(f"Share card failed for {name}")
                return None
            target.parent.mkdir(parents=True, exist_ok=True)
            tmp = target.with_name(f".{target.name}.{uuid.uuid4().hex}.tmp")
            tmp.write_bytes(data)
            os.replace(tmp, target)
            self.rendered += 1
        self.keep[name] = key
        return media_url(f"/uploads/{OG_SUBDIR}/{kind}/{slug}.jpg?v={key}")

    def finish(self) -> None:
        """Save the manifest and delete cards no page uses anymore."""
        for name in set(self.manifest) - set(self.keep):
            (self.uploads / OG_SUBDIR / f"{name}.jpg").unlink(missing_ok=True)
        self.manifest_path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.manifest_path.with_name(f".manifest.{uuid.uuid4().hex}.tmp")
        tmp.write_text(json.dumps(self.keep, sort_keys=True), encoding="utf-8")
        os.replace(tmp, self.manifest_path)


# ---------------------------------------------------------------------------
# Page builders
# ---------------------------------------------------------------------------

def _model_label(p: dict) -> str:
    return f"{p['model_number'] or ''}{p['model_suffix'] or ''}".strip()


def _spec_rows(p: dict) -> list[tuple[str, str, Optional[float], Optional[str]]]:
    """(label, display text, numeric value, UN/CEFACT unit code) per known spec."""
    rows = []
    for key, label in (
        ("width", "Width"), ("depth", "Depth"), ("height", "Height"),
        ("seat_height", "Seat height"), ("seat_width", "Seat width"), ("seat_depth", "Seat depth"),
        ("arm_height", "Arm height"), ("back_height", "Back height"),
    ):
        if inches(p[key]):
            rows.append((label, inches(p[key]), p[key], "INH"))
    if p["weight"]:
        rows.append(("Weight", f"{p['weight']:g} lb", p["weight"], "LBR"))
    if p["upholstery_amount"]:
        rows.append(("COM yardage", f"{p['upholstery_amount']:g} yd", p["upholstery_amount"], "YRD"))
    if p["frame_material"]:
        rows.append(("Frame", p["frame_material"], None, None))
    if p["features"]:
        rows.append(("Features", ", ".join(p["features"]), None, None))
    if p["flame_certifications"]:
        rows.append(("Flammability", ", ".join(p["flame_certifications"]), None, None))
    if p["green_certifications"]:
        rows.append(("Certifications", ", ".join(p["green_certifications"]), None, None))
    if p["ada_compliant"]:
        rows.append(("ADA compliant", "Yes", None, None))
    if p["is_outdoor_suitable"]:
        rows.append(("Outdoor use", "Yes", None, None))
    if p["stock_status"]:
        rows.append(("Availability", p["stock_status"], None, None))
    if p["lead_time_days"]:
        rows.append(("Lead time", f"{p['lead_time_days']} days", p["lead_time_days"], "DAY"))
    return rows


def _card_details(p: dict) -> list[str]:
    bits = []
    if inches(p["seat_height"]):
        bits.append(f"Seat height {inches(p['seat_height'])}")
    elif inches(p["width"]) and inches(p["depth"]) and inches(p["height"]):
        bits.append(f"{inches(p['width'])} W × {inches(p['depth'])} D × {inches(p['height'])} H")
    elif p["frame_material"] and len(p["frame_material"]) <= 40:
        bits.append(p["frame_material"])
    if p["stock_status"]:
        bits.append(p["stock_status"][0].upper() + p["stock_status"][1:].lower())
    return [" · ".join(bits)] if bits else []


def build_product_page(p: dict, families_by_id: dict, cards: _Cards) -> PageMeta:
    path = product_path(p)
    name = clean_text(p["name"]) or f"Model {p['model_number']}"
    model = _model_label(p)
    cat = p["category"]
    cat_name = clean_text(cat["name"]) if cat else None
    family = families_by_id.get(p["family_id"])

    name_has_model = not model or model.lower() in name.lower()
    headline = name if name_has_model else f"{name}, Model {model}"
    title = clean_text(p["meta_title"]) or compose_title(headline, cat_name)

    summary = clean_text(p["short_description"]) or clean_text(p["full_description"])
    if clean_text(p["meta_description"]):
        description = truncate(clean_text(p["meta_description"]))
    else:
        lead = _sentence(summary) if summary else f"{name} by {BRAND}."
        kind = cat_name.lower() if cat_name else "seating"
        context = f"Model {model} commercial {kind}, made to order. Request a quote." if model else "Made to order. Request a quote."
        description = truncate(f"{lead} {context}" if len(lead) < 100 else lead)

    images = p["images"] or ([p["primary_image"]] if p["primary_image"] else [])
    primary = p["primary_image"] or (images[0] if images else None)
    eyebrow = " · ".join(x for x in (cat_name, f"Model {model}" if model else None) if x)
    image = cards.card("product", p["slug"] or str(p["id"]), "product",
                       [primary] if primary else [], eyebrow, name, _card_details(p))

    crumbs = [("Home", "/"), ("Products", "/products")]
    if cat:
        if cat["parent_slug"]:
            crumbs.append((cat["parent_name"], f"/products/category/{cat['parent_slug']}"))
        crumbs.append((cat["name"], category_path(cat)))
    crumbs.append((name, path))

    specs = _spec_rows(p)
    full = clean_text(p["full_description"]) or summary
    product_ld: dict[str, Any] = {
        "@context": "https://schema.org",
        "@type": "Product",
        "@id": site_url(path) + "#product",
        "name": name,
        "url": site_url(path),
        "description": truncate(full or description, 4900),
        "image": [u for u in (media_url(x) for x in images[:6]) if u],
        "sku": model or str(p["id"]),
        "mpn": model or None,
        "model": model or None,
        "brand": {"@type": "Brand", "name": BRAND},
        "manufacturer": {"@id": site_url("/#organization")},
        "category": cat_name,
        "material": p["frame_material"] or None,
    }
    for key in ("width", "depth", "height"):
        if inches(p[key]):
            product_ld[key] = {"@type": "QuantitativeValue", "value": p[key], "unitCode": "INH"}
    if p["weight"]:
        product_ld["weight"] = {"@type": "QuantitativeValue", "value": p["weight"], "unitCode": "LBR"}
    additional = [
        {"@type": "PropertyValue", "name": label,
         **({"value": value, "unitCode": unit} if unit else {"value": display})}
        for label, display, value, unit in specs
        if label not in ("Width", "Depth", "Height", "Weight", "Frame")
    ]
    if additional:
        product_ld["additionalProperty"] = additional
    if family:
        product_ld["isRelatedTo"] = {
            "@type": "ProductGroup", "name": clean_text(family["name"]), "url": site_url(family_path(family)),
        }
    product_ld = {k: v for k, v in product_ld.items() if v not in (None, [], "")}

    body = [
        _breadcrumb_html(crumbs[:-1]),
        f"<h1>{_e(name)}</h1>",
        f"<p>{_e(' · '.join(x for x in (f'Model {model}' if model else None, cat_name) if x))}</p>",
    ]
    if primary and media_url(primary):
        body.append(f'<img src="{_e(media_url(primary))}" alt="{_e(name)}" width="600"/>')
    if full:
        body.append(f"<p>{_e(full)}</p>")
    if specs:
        rows = "".join(f"<dt>{_e(label)}</dt><dd>{_e(display)}</dd>" for label, display, _, _ in specs)
        body.append(f"<h2>Specifications</h2><dl>{rows}</dl>")
    if family:
        body.append(f'<p>Part of the <a href="{_e(family_path(family))}">{_e(clean_text(family["name"]))}</a> collection.</p>')
    body.append('<p><a href="/quote-request">Request a quote</a> or <a href="/find-a-rep">find a sales representative</a>.</p>')

    return PageMeta(
        path=path, title=title, description=description, image=image,
        image_alt=f"{name}{'' if name_has_model else f' (Model {model})'} by {BRAND}",
        og_type="product", json_ld=[product_ld, _breadcrumbs(crumbs)], body="".join(body),
    )


def _member_list(members: list[dict]) -> tuple[dict, str]:
    """ItemList JSON-LD + <ul> of member products."""
    shown = members[:LIST_MAX]
    item_list = {
        "@type": "ItemList",
        "numberOfItems": len(members),
        "itemListElement": [
            {"@type": "ListItem", "position": i, "url": site_url(product_path(p)), "name": clean_text(p["name"])}
            for i, p in enumerate(shown, start=1)
        ],
    }
    items = "".join(
        f'<li><a href="{_e(product_path(p))}">{_e(clean_text(p["name"]))}</a>'
        f'{f" (Model {_e(_model_label(p))})" if _model_label(p) else ""}</li>'
        for p in shown
    )
    return item_list, f"<ul>{items}</ul>" if items else ""


def _member_images(members: list[dict], count: int = 3) -> list[str]:
    urls = []
    for p in members:
        url = p["primary_image"] or (p["images"][0] if p["images"] else None)
        if url and url not in urls:
            urls.append(url)
        if len(urls) == count:
            break
    return urls


def _member_kinds(members: list[dict]) -> list[str]:
    kinds = []
    for p in members:
        kind = clean_text(p["category"]["name"]) if p["category"] else ""
        if kind and kind not in kinds:
            kinds.append(kind)
    return kinds


def _collection_ld(path: str, name: str, description: str, image: Optional[str], item_list: dict) -> dict:
    data = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "@id": site_url(path),
        "name": name,
        "url": site_url(path),
        "description": description,
        "isPartOf": {"@id": site_url("/#website")},
        "mainEntity": item_list,
    }
    if image:
        data["primaryImageOfPage"] = {"@type": "ImageObject", "url": image}
    return data


def build_family_page(f: dict, members: list[dict], categories_by_id: dict, cards: _Cards) -> PageMeta:
    path = family_path(f)
    name = clean_text(f["name"])
    heading = name if re.search(r"\b(collection|series|family)\b", name, re.I) else f"{name} Collection"
    category = categories_by_id.get(f["category_id"])
    kinds = _member_kinds(members)
    title = compose_title(heading, clean_text(category["name"]) if category else None)
    summary = clean_text(f["description"]) or clean_text(f["overview_text"])
    if summary:
        description = truncate(summary)
    else:
        kinds_text = ", ".join(k.lower() for k in kinds) if kinds else "commercial seating"
        description = truncate(
            f"The {name} from {BRAND}: {_plural(len(members), 'model')} of {kinds_text} for restaurants, "
            f"bars and hospitality. Made to order in Houston, TX. Request a quote."
            if members else
            f"The {name} from {BRAND}. Commercial seating made to order in Houston, TX. Request a quote."
        )

    # A family photo when one is uploaded, else its products side by side
    if f["image"]:
        layout, sources = "photo", [f["image"]]
    else:
        layout, sources = "product", _member_images(members)
    eyebrow = " · ".join(x for x in ("Collection", _plural(len(members), "model") if members else None) if x)
    image = cards.card("family", f["slug"], layout, sources, eyebrow, heading,
                       [", ".join(kinds[:3])] if kinds else [])

    crumbs = [("Home", "/"), ("Products", "/products"), (heading, path)]
    item_list, list_html = _member_list(members)
    body = [_breadcrumb_html(crumbs[:-1]), f"<h1>{_e(heading)}</h1>"]
    if summary:
        body.append(f"<p>{_e(summary)}</p>")
    body.append(list_html)
    return PageMeta(
        path=path, title=title, description=description, image=image,
        image_alt=f"{heading} by {BRAND}",
        json_ld=[_collection_ld(path, heading, description, image, item_list), _breadcrumbs(crumbs)],
        body="".join(body),
    )


def build_category_page(cat: dict, members: list[dict], cards: _Cards) -> PageMeta:
    path = category_path(cat)
    name = clean_text(cat["name"])
    title = clean_text(cat["meta_title"]) or compose_title(f"Commercial {name}")
    summary = clean_text(cat["description"])
    if clean_text(cat["meta_description"]):
        description = truncate(clean_text(cat["meta_description"]))
    else:
        description = truncate(
            (_sentence(summary) + " " if summary else "")
            + f"Browse commercial {name.lower()} from {BRAND}, "
            f"made to order in Houston, TX since 1984. Request a quote."
        )

    if cat["banner_image_url"]:
        layout, sources = "photo", [cat["banner_image_url"]]
    else:
        layout, sources = "product", _member_images(members)
    eyebrow = " · ".join(x for x in (cat["parent_name"] or "Products", _plural(len(members), "model") if members else None) if x)
    image = cards.card("category", cat["slug"], layout, sources, eyebrow, name,
                       ["Made to order for restaurants & hospitality"])

    crumbs = [("Home", "/"), ("Products", "/products")]
    if cat["parent_slug"]:
        crumbs.append((cat["parent_name"], f"/products/category/{cat['parent_slug']}"))
    crumbs.append((name, path))
    item_list, list_html = _member_list(members)
    body = [_breadcrumb_html(crumbs[:-1]), f"<h1>{_e(name)}</h1>"]
    if summary:
        body.append(f"<p>{_e(summary)}</p>")
    body.append(list_html)
    return PageMeta(
        path=path, title=title, description=description, image=image,
        image_alt=f"{name} by {BRAND}",
        json_ld=[_collection_ld(path, name, description, image, item_list), _breadcrumbs(crumbs)],
        body="".join(body),
    )


def build_static_page(page: dict, hero_image: Optional[str], cards: _Cards) -> Optional[PageMeta]:
    """Routes from seoConfig.js (about, contact, product knowledge pages ...)."""
    path = page.get("url")
    title = clean_text(page.get("title"))
    if not path or path == "/" or not title:
        return None
    description = truncate(clean_text(page.get("description")))
    noindex = bool(page.get("noindex"))
    heading = re.sub(r"\s*[|–-]\s*Eagle Chair\s*$", "", title).strip() or title
    image = None
    if not noindex:
        slug = path.strip("/").replace("/", "-")
        image = cards.card("page", slug, "photo", [hero_image] if hero_image else [], BRAND, heading, [])
    return PageMeta(
        path=path, title=title, description=description, image=image,
        image_alt=heading, noindex=noindex,
        body=f"<h1>{_e(heading)}</h1><p>{_e(description)}</p>",
    )


# ---------------------------------------------------------------------------
# Sitemap
# ---------------------------------------------------------------------------

# Used when the build's seo-pages.json is unavailable.
# Keep in sync with frontend/src/config/seoConfig.js
FALLBACK_PAGES = (
    "/products",
    "/about",
    "/gallery",
    "/find-a-rep",
    "/contact",
    "/virtual-catalogs",
    "/resources/spec-sheets",
    "/resources/guides",
    "/resources/woodfinishes",
    "/resources/upholstery",
    "/resources/laminates",
    "/resources/hardware",
    "/resources/seat-back-terms",
)


def _static_pages() -> list[str]:
    """Indexable static routes from frontend/src/config/seoConfig.js (via the build)."""
    try:
        data = json.loads((web_root() / PAGES_FILE).read_text(encoding="utf-8"))
        paths = [
            p["url"] for p in data.get("pages", [])
            if p.get("url") not in (None, "/", "/search") and not p.get("noindex")
        ]
        if paths:
            return paths
    except (OSError, ValueError, KeyError, TypeError, AttributeError):
        pass
    return list(FALLBACK_PAGES)


def _date(value) -> str | None:
    return value.strftime("%Y-%m-%d") if value else None


def _sitemap_url(path: str, lastmod: str | None = None, images: list[tuple[str, str]] = ()) -> str:
    parts = [f"<url><loc>{escape(site_url(path))}</loc>"]
    if lastmod:
        parts.append(f"<lastmod>{lastmod}</lastmod>")
    for loc, title in images:
        parts.append(
            f"<image:image><image:loc>{escape(loc)}</image:loc>"
            f"<image:title>{escape(title)}</image:title></image:image>"
        )
    parts.append("</url>")
    return "".join(parts)


def render_sitemap(snapshot: dict) -> str:
    """Sitemap of the home page, static pages, categories, families and products."""
    products = snapshot["products"]
    by_id = {p["id"]: p for p in products}
    latest = max((p["updated_at"] for p in products if p["updated_at"]), default=None)

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
        'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
        _sitemap_url("/", _date(latest)),
    ]
    lines += [_sitemap_url(path) for path in _static_pages()]

    for cat in snapshot["categories"]:
        if cat["slug"] and (not cat["parent_id"] or cat["parent_slug"]):
            lines.append(_sitemap_url(category_path(cat), _date(cat["updated_at"])))

    for family in snapshot["families"]:
        members = [by_id[i] for i in family["members"] if i in by_id]
        if family["slug"] and members:
            newest = max((p["updated_at"] for p in members if p["updated_at"]), default=None)
            lines.append(_sitemap_url(family_path(family), _date(newest)))

    for p in products:
        name = clean_text(p["name"])
        images = [(media_url(u), name) for u in p["images"][:5] if media_url(u)]
        if not images and media_url(p["primary_image"]):
            images = [(media_url(p["primary_image"]), name)]
        lines.append(_sitemap_url(product_path(p), _date(p["updated_at"]), images))

    lines.append("</urlset>")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

def _read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _hero_image(root: Path) -> Optional[str]:
    content = _read_json(root / "data" / "contentData.json") or {}
    for slide in content.get("heroSlides") or []:
        url = slide.get("image") or slide.get("background_image_url") or slide.get("backgroundImageUrl")
        if url and "wp-content" not in url:
            return url
    return None


def build_pages(snapshot: dict, root: Path, cards: _Cards) -> list[PageMeta]:
    products = snapshot["products"]
    by_id = {p["id"]: p for p in products}
    families_by_id = {f["id"]: f for f in snapshot["families"]}
    categories_by_id = {c["id"]: c for c in snapshot["categories"]}

    # A parent category lists its subcategories' products too
    children: dict[int, list[int]] = {}
    for c in snapshot["categories"]:
        if c["parent_id"]:
            children.setdefault(c["parent_id"], []).append(c["id"])

    def category_member_ids(cat_id: int, seen: frozenset = frozenset()) -> set[int]:
        ids = set(categories_by_id[cat_id]["members"])
        for child in children.get(cat_id, []):
            if child not in seen and child in categories_by_id:
                ids |= category_member_ids(child, seen | {cat_id})
        return ids

    def ordered(ids: set[int]) -> list[dict]:
        return [p for p in products if p["id"] in ids]

    pages = [build_product_page(p, families_by_id, cards) for p in products]
    for f in snapshot["families"]:
        if f["slug"]:
            pages.append(build_family_page(f, ordered(f["members"] & by_id.keys()), categories_by_id, cards))
    for c in snapshot["categories"]:
        # Skip children of inactive parents: they have no reachable URL
        if c["slug"] and (not c["parent_id"] or c["parent_slug"]):
            pages.append(build_category_page(c, ordered(category_member_ids(c["id"]) & by_id.keys()), cards))
    hero = _hero_image(root)
    for page in (_read_json(root / PAGES_FILE) or {}).get("pages", []):
        meta = build_static_page(page, hero, cards)
        if meta:
            pages.append(meta)
    return pages


def build_all(snapshot: dict) -> dict:
    """Render every shell into a fresh _seo/ and swap it in. Blocking (run in a thread)."""
    started = time.monotonic()
    root = web_root()
    template = (root / "index.html").read_text(encoding="utf-8")
    if SEO_START not in template or SEO_END not in template:
        logger.warning("SEO prerender skipped: index.html has no <!--seo:start--> block (rebuild the frontend)")
        return {"pages": 0}

    cards = _Cards()
    pages = build_pages(snapshot, root, cards)

    staging = root / f"{SHELL_DIR}.new-{uuid.uuid4().hex[:8]}"
    written = 0
    seen = set()
    for meta in pages:
        if meta.path in seen or not _is_safe_path(meta.path):
            continue
        seen.add(meta.path)
        target = staging / meta.path.strip("/") / "index.html"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(render_shell(template, meta), encoding="utf-8")
        written += 1

    live = root / SHELL_DIR
    old = root / f"{SHELL_DIR}.old-{uuid.uuid4().hex[:8]}"
    if live.exists():
        os.replace(live, old)
    os.replace(staging, live)
    shutil.rmtree(old, ignore_errors=True)
    cards.finish()

    # Static copy on the site's own host for robots.txt (the API serves the same XML)
    sitemap_tmp = root / f".sitemap.xml.{uuid.uuid4().hex}.tmp"
    sitemap_tmp.write_text(render_sitemap(snapshot), encoding="utf-8")
    os.replace(sitemap_tmp, root / "sitemap.xml")

    stats = {
        "pages": written,
        "cards_rendered": cards.rendered,
        "seconds": round(time.monotonic() - started, 1),
    }
    logger.info(f"SEO prerender: {stats}")
    return stats


async def run_once(force: bool = False) -> Optional[dict]:
    """Rebuild when inputs changed since the last build. Returns stats, or None if skipped."""
    from backend.database.base import AsyncSessionLocal

    root = web_root()
    if not (root / "index.html").is_file():
        return None
    signature_path = root / SHELL_DIR / SIGNATURE_FILE
    async with AsyncSessionLocal() as db:
        signature = await catalog_signature(db)
        try:
            if not force and signature_path.read_text(encoding="utf-8") == signature:
                return None
        except OSError:
            pass
        snapshot = await load_snapshot(db)

    stats = await asyncio.to_thread(build_all, snapshot)
    if stats.get("pages"):
        signature_path.write_text(signature, encoding="utf-8")
    return stats


class _FileLock:
    """Non-blocking exclusive lock shared by the Gunicorn workers on this host."""

    def __init__(self, path: Path):
        self.path = path
        self.handle = None

    def acquire(self) -> bool:
        try:
            import fcntl
        except ImportError:  # Windows dev machines run a single process
            return True
        self.handle = open(self.path, "a")
        try:
            fcntl.flock(self.handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return True
        except OSError:
            self.handle.close()
            self.handle = None
            return False

    def release(self) -> None:
        if self.handle is not None:
            import fcntl

            fcntl.flock(self.handle, fcntl.LOCK_UN)
            self.handle.close()
            self.handle = None


async def prerender_loop() -> None:
    """Background task: rebuild shells whenever their inputs change."""
    interval = max(15, settings.SEO_PRERENDER_INTERVAL_SECONDS)
    await asyncio.sleep(5)
    while True:
        try:
            root = web_root()
            if root.is_dir():
                lock = _FileLock(root / LOCK_FILE)
                if lock.acquire():
                    try:
                        await run_once()
                    finally:
                        lock.release()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("SEO prerender failed")
        await asyncio.sleep(interval)


if __name__ == "__main__":
    # python -m backend.services.seo_prerender [--force]
    import sys

    logging.basicConfig(level=logging.INFO)
    print(asyncio.run(run_once(force="--force" in sys.argv)))
