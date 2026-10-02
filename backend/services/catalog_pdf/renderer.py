"""
Turns a catalog document (settings + list of pages, as saved by the Catalog
Builder) into a PDF, or one page of it into a PNG preview.

Page numbers: every page is one physical page except "toc", which takes as
many pages as its entries need. Contents entries are the titled product /
gallery / photo pages; consecutive entries with the same title (a family that
spans several sheets) collapse into one.

MuPDF is not thread-safe, so renders are serialized with a lock (callers run
them in a worker thread).
"""

import html
import io
import math
import threading
from dataclasses import dataclass
from datetime import date
from typing import Optional

import fitz

from backend.services.catalog_pdf.assets import PAGE_HEIGHT, PAGE_WIDTH, open_template
from backend.services.catalog_pdf.images import ImageLoader
from backend.services.catalog_pdf.layouts import (
    PAGE_RECT,
    TOC_ROWS_PER_PAGE,
    CatalogData,
    Ctx,
    _chrome,
    _footer,
    _title,
    draw_cover,
    draw_gallery,
    draw_photo,
    draw_product,
    draw_toc,
    model_label,
    resolve_item,
)

PAGE_TYPES = ("cover", "toc", "product", "gallery", "photo")
DEFAULT_COPYRIGHT = "All Rights Reserved © Copyright Eagle Chair Inc. 1984 - {year}"

_render_lock = threading.Lock()

_DRAW = {
    "cover": draw_cover,
    "product": draw_product,
    "gallery": draw_gallery,
    "photo": draw_photo,
}


def resolve_settings(settings: Optional[dict]) -> dict:
    """Document settings with defaults; {year} in the copyright becomes this year."""
    merged = {"copyright": DEFAULT_COPYRIGHT, "page_numbers": True}
    merged.update({k: v for k, v in (settings or {}).items() if v is not None})
    merged["copyright"] = str(merged["copyright"]).replace("{year}", str(date.today().year))
    return merged


@dataclass
class PagePlan:
    index: int  # position in document["pages"]
    first: int  # first physical page number (1-based)
    count: int  # physical pages it occupies


def _entry_title(page: dict) -> str:
    return ((page.get("toc_label") or page.get("title")) or "").strip()


def _toc_candidates(pages: list[dict], data: CatalogData) -> list[dict]:
    """Contents entries without page numbers: [{"title", "models", "index"}]."""
    entries: list[dict] = []
    for index, page in enumerate(pages):
        if page.get("type") not in ("product", "gallery", "photo") or page.get("include_in_toc") is False:
            continue
        title = _entry_title(page)
        if not title:
            continue
        models = []
        if page.get("type") == "product":
            for item in page.get("items") or []:
                label = model_label(*resolve_item(item, data))
                if label:
                    models.append(label)
        if entries and entries[-1]["title"] == title:
            entries[-1]["models"].extend(m for m in models if m not in entries[-1]["models"])
        else:
            entries.append({"title": title, "models": models, "index": index})
    return entries


def plan_document(document: dict, data: CatalogData) -> tuple[list[PagePlan], list[dict]]:
    """Physical page plan and numbered contents entries."""
    pages = document.get("pages") or []
    candidates = _toc_candidates(pages, data)
    toc_pages = max(1, math.ceil(len(candidates) / TOC_ROWS_PER_PAGE))

    plans, number = [], 1
    for index, page in enumerate(pages):
        count = toc_pages if page.get("type") == "toc" else 1
        plans.append(PagePlan(index, number, count))
        number += count

    first_by_index = {p.index: p.first for p in plans}
    entries = [
        {"title": c["title"], "models": c["models"], "page": first_by_index[c["index"]]}
        for c in candidates
    ]
    return plans, entries


def _draw(out: fitz.Document, ctx: Ctx, page_spec: dict, plan: PagePlan, entries: list[dict], only_first: bool = False) -> list[list]:
    """Draw one document page (several physical pages for toc); returns slots per physical page."""
    kind = page_spec.get("type")
    slots = []
    count = 1 if only_first else plan.count
    for offset in range(count):
        page = out.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
        ctx.page_number = plan.first + offset
        ctx.slots = []
        if kind == "toc":
            chunk = entries[offset * TOC_ROWS_PER_PAGE:(offset + 1) * TOC_ROWS_PER_PAGE]
            draw_toc(page, ctx, page_spec, chunk, first=offset == 0)
        elif kind in _DRAW:
            _DRAW[kind](page, ctx, page_spec)
        slots.append(ctx.slots)
    return slots


def render_pdf(document: dict, data: CatalogData, images: ImageLoader) -> bytes:
    """The whole catalog as PDF bytes."""
    with _render_lock:
        settings = resolve_settings(document.get("settings"))
        plans, entries = plan_document(document, data)
        pages = document.get("pages") or []
        out = fitz.open()
        with open_template() as template:
            ctx = Ctx(template=template, images=images, data=data, settings=settings)
            for plan in plans:
                _draw(out, ctx, pages[plan.index], plan, entries)
        out.set_metadata({
            "title": (settings.get("title") or "Eagle Chair Catalog"),
            "author": "Eagle Chair Inc.",
            "creator": "Eagle Chair Catalog Builder",
        })
        out.subset_fonts()
        return out.tobytes(garbage=3, deflate=True)


@dataclass
class Preview:
    png: bytes
    slots: list
    page_number: int
    physical_pages: int
    total_pages: int


def render_preview(document: dict, data: CatalogData, images: ImageLoader, index: int, dpi: int = 110) -> Preview:
    """PNG of one document page (the first sheet of a multi-page contents)."""
    with _render_lock:
        settings = resolve_settings(document.get("settings"))
        plans, entries = plan_document(document, data)
        pages = document.get("pages") or []
        if not 0 <= index < len(pages):
            raise IndexError("page index out of range")
        plan = plans[index]
        out = fitz.open()
        with open_template() as template:
            ctx = Ctx(template=template, images=images, data=data, settings=settings, preview=True)
            slots = _draw(out, ctx, pages[index], plan, entries, only_first=True)
        png = out[0].get_pixmap(dpi=dpi).tobytes("png")
        total = plans[-1].first + plans[-1].count - 1 if plans else 0
        return Preview(png=png, slots=slots[0], page_number=plan.first, physical_pages=plan.count, total_pages=total)


# ---------------------------------------------------------------------------
# Product index (admin export): every product grouped by category and family
# ---------------------------------------------------------------------------

_INDEX_CSS = """
* {font-family: sans-serif; color: #221f1f;}
h1 {font-size: 15px; font-weight: bold; color: #43a19a; margin: 10px 0 4px 0;}
h2 {font-size: 11.5px; font-weight: bold; margin: 7px 0 2px 0;}
p {font-size: 9.5px; margin: 0 0 3px 8px; line-height: 1.2;}
.v {font-size: 8px; color: #606066;}
.off {color: #a03030; font-size: 8px;}
"""

_INDEX_COLUMNS = (fitz.Rect(36, 118, 300, 720), fitz.Rect(318, 118, 576, 720))


def _index_html(groups: list[dict]) -> str:
    out = []
    for category in groups:
        out.append(f"<h1>{html.escape(category['name'])}</h1>")
        for family in category["families"]:
            out.append(f"<h2>{html.escape(family['name'])}</h2>")
            for product in family["products"]:
                line = f"<b>{html.escape(product['model'])}</b> {html.escape(product['name'])}"
                if not product.get("is_active", True):
                    line += ' <span class="off">(inactive)</span>'
                if product.get("variations"):
                    line += f'<br><span class="v">{html.escape(", ".join(product["variations"]))}</span>'
                out.append(f"<p>{line}</p>")
    return "".join(out)


def render_product_index(groups: list[dict], title: str = "Product Index", subtitle: str = "") -> bytes:
    """
    Contents-style PDF of the product list in the catalog design.

    groups: [{"name": category, "families": [{"name", "products": [{"model",
    "name", "variations": [sku, ...], "is_active"}]}]}]
    """
    with _render_lock:
        story = fitz.Story(_index_html(groups) or "<p>No products.</p>", user_css=_INDEX_CSS)
        buffer = io.BytesIO()
        writer = fitz.DocumentWriter(buffer)
        more = True
        while more:
            device = writer.begin_page(PAGE_RECT)
            for column in _INDEX_COLUMNS:
                more, _ = story.place(column)
                story.draw(device)
                if not more:
                    break
            writer.end_page()
        writer.close()

        settings = resolve_settings(None)
        content = fitz.open("pdf", buffer.getvalue())
        out = fitz.open()
        with open_template() as template:
            ctx = Ctx(template=template, images=None, data=CatalogData(), settings=settings)
            for i in range(len(content)):
                page = out.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
                _chrome(page, ctx, "bg_gallery")
                _title(page, title, subtitle if i == 0 else "continued")
                page.show_pdf_page(page.rect, content, i)
                ctx.page_number = i + 1
                _footer(page, ctx)
        out.set_metadata({"title": title, "author": "Eagle Chair Inc."})
        out.subset_fonts()
        return out.tobytes(garbage=3, deflate=True)
