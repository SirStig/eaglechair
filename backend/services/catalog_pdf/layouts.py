"""
Page layouts of the Eagle Chair catalog.

Each draw_* function paints one letter-size page in the style of the printed
catalog sheets (positions and type sizes measured from the 2024/2026 sheets):

- product: family title, product cut-outs each with a spec column and model
  label, the rounded Features / Materials / Standard / Options panel
- gallery: title + subtitle ("variations"), up to 8 captioned photos and the
  tagline banner
- photo: one full-bleed install photo
- cover: title, product photos with model labels, the eagle and two taglines
- toc: contents with page numbers (renderer decides how many pages it needs)

Photo boxes are recorded in ctx.slots so the editor can overlay them on the
preview and let admins drag / scale photos (stored as dx, dy, scale).
"""

import html
from dataclasses import dataclass, field
from typing import Optional

import fitz

from backend.services.catalog_pdf.assets import (
    BROWN,
    GREY,
    INK,
    LAYERS,
    LOGO_CLIP,
    PAGE_HEIGHT,
    PAGE_WIDTH,
    WHITE,
    fonts,
    SharedAssets,
)
from backend.services.catalog_pdf.images import ImageLoader, LoadedImage
from backend.services.catalog_pdf.specs import get_spec_items

PAGE_RECT = fitz.Rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT)

MAX_PRODUCT_ITEMS = 3
MAX_GALLERY_ITEMS = 8
MAX_COVER_ITEMS = 8
TOC_ROWS_PER_PAGE = 18  # rows of 30pt from y 160, clear of the banner at 727


@dataclass
class CatalogData:
    """Products and variations a document refers to, as plain dicts by id."""

    products: dict = field(default_factory=dict)
    variations: dict = field(default_factory=dict)


@dataclass
class Ctx:
    assets: SharedAssets
    images: ImageLoader
    data: CatalogData
    settings: dict
    preview: bool = False
    page_number: Optional[int] = None
    slots: list = field(default_factory=list)


# ---------------------------------------------------------------------------
# Items
# ---------------------------------------------------------------------------


def resolve_item(item: dict, data: CatalogData) -> tuple[Optional[dict], Optional[dict]]:
    """(product, variation) for a page item; either may be None."""
    variation = data.variations.get(item.get("variation_id"))
    product = data.products.get(item.get("product_id"))
    if product is None and variation is not None:
        product = data.products.get(variation["product_id"])
    return product, variation


def model_label(product: Optional[dict], variation: Optional[dict] = None) -> str:
    """The model number as printed under a product ("3506 CR", "3721.Cr.V")."""
    if variation and variation.get("sku"):
        return variation["sku"]
    if not product:
        return ""
    suffix = (product.get("model_suffix") or "").strip()
    return f"{product['model_number']} {suffix}".strip()


def item_image_url(item: dict, product: Optional[dict], variation: Optional[dict]) -> Optional[str]:
    if item.get("image_url"):
        return item["image_url"]
    if variation and variation.get("default_image"):
        return variation["default_image"]
    return product.get("default_image") if product else None


def _tweaks(item: dict) -> tuple[float, float, float]:
    """The editor's per-photo adjustments, clamped to sane ranges."""
    try:
        dx = max(-PAGE_WIDTH, min(PAGE_WIDTH, float(item.get("dx") or 0)))
        dy = max(-PAGE_HEIGHT, min(PAGE_HEIGHT, float(item.get("dy") or 0)))
        scale = max(0.2, min(4.0, float(item.get("scale") or 1)))
    except (TypeError, ValueError):
        return 0.0, 0.0, 1.0
    return dx, dy, scale


# ---------------------------------------------------------------------------
# Drawing primitives
# ---------------------------------------------------------------------------


def _layer(page: fitz.Page, ctx: Ctx, name: str, rect: fitz.Rect = PAGE_RECT, clip=None) -> None:
    page.show_pdf_page(rect, ctx.assets.template, LAYERS[name], clip=clip)


def _text(
    page: fitz.Page,
    x: float,
    y: float,
    text: str,
    role: str = "regular",
    size: float = 10,
    color=INK,
    align: str = "left",
    max_width: Optional[float] = None,
    opacity: float = 1.0,
) -> float:
    """Write one line with its baseline at y; returns the width used."""
    if not text:
        return 0.0
    font = fonts()[role]
    width = font.text_length(text, fontsize=size)
    if max_width and width > max_width:
        size *= max_width / width
        width = max_width
    if align == "right":
        x -= width
    elif align == "center":
        x -= width / 2
    writer = fitz.TextWriter(page.rect)
    writer.append((x, y), text, font=font, fontsize=size)
    writer.write_text(page, color=color, opacity=opacity)
    return width


def _wrap(text: str, role: str, size: float, max_width: Optional[float]) -> list[str]:
    """Split text into lines on newlines, then word-wrap each to max_width."""
    font = fonts()[role]
    lines = []
    for raw in (text or "").splitlines():
        words, line = raw.split(), ""
        for word in words:
            candidate = f"{line} {word}".strip()
            if max_width and line and font.text_length(candidate, fontsize=size) > max_width:
                lines.append(line)
                line = word
            else:
                line = candidate
        lines.append(line)
    return lines


def _lines(page, x, y, text, size, leading=None, max_width=None, role="regular", **kwargs) -> float:
    """Write wrapped multi-line text; returns the y below it."""
    leading = leading or size * 1.15
    for line in _wrap(text, role, size, max_width):
        _text(page, x, y, line, role=role, size=size, max_width=max_width, **kwargs)
        y += leading
    return y


def _place_photo(
    page: fitz.Page,
    ctx: Ctx,
    img: Optional[LoadedImage],
    box: fitz.Rect,
    item: dict,
    index: int,
) -> fitz.Rect:
    """
    Fit a photo into box (bottom-centered, like a chair standing on the floor),
    apply the editor tweaks and record the slot. Returns the drawn rect.
    """
    dx, dy, scale = _tweaks(item)
    if img is None:
        rect = fitz.Rect(box)
        if ctx.preview:
            page.draw_rect(rect, color=GREY, width=0.8, dashes="[4] 0")
            _text(page, rect.x0 + rect.width / 2, rect.y0 + rect.height / 2, "No photo", size=11, color=GREY, align="center")
        ctx.slots.append({"item": index, "rect": list(rect), "box": list(box), "missing": True})
        return rect

    fit = min(box.width / img.width, box.height / img.height) * scale
    width, height = img.width * fit, img.height * fit
    cx = box.x0 + box.width / 2 + dx
    y1 = box.y1 + dy
    rect = fitz.Rect(cx - width / 2, y1 - height, cx + width / 2, y1)
    page.insert_image(rect, stream=img.data)
    ctx.slots.append({"item": index, "rect": list(rect), "box": list(box), "missing": False})
    return rect


def _chrome(page: fitz.Page, ctx: Ctx, background: str, logo: bool = True) -> None:
    """Background and the eagle logo."""
    _layer(page, ctx, background)
    if logo:
        _layer(page, ctx, "logo")


def _footer(page: fitz.Page, ctx: Ctx) -> None:
    """Copyright line (bottom right) and page number (bottom left), in white."""
    _text(page, 570, 785, ctx.settings.get("copyright") or "", size=7.7, color=WHITE, align="right", max_width=420)
    if ctx.settings.get("page_numbers", True) and ctx.page_number:
        _text(page, 36, 785, str(ctx.page_number), size=7.7, color=WHITE)


# Title baseline: the 66pt caps clear the logo (ends at y 39) by ~10pt
TITLE_BASELINE = 102


def _title(page: fitz.Page, title: str, subtitle: str = "", y: float = TITLE_BASELINE) -> None:
    """Family name in large white light oblique, optional smaller subtitle after it."""
    title = (title or "").strip()
    subtitle = (subtitle or "").strip()
    sub_width = fonts()["title"].text_length(subtitle, fontsize=30) + 14 if subtitle else 0
    width = _text(page, 18, y, title, role="title", size=66, color=WHITE, max_width=574 - sub_width)
    if subtitle:
        x = 18 + width + (14 if title else 0)
        _text(page, x, y, subtitle, role="title", size=30, color=WHITE, opacity=0.8, max_width=592 - x)


def _html_box(page: fitz.Page, rect: fitz.Rect, blocks: list[tuple[str, str]], size: float = 11) -> None:
    """Headed paragraphs (bold heading, body text) fitted into rect."""
    parts = []
    for heading, body in blocks:
        body = (body or "").strip()
        if not body:
            continue
        body_html = "<br>".join(html.escape(line) for line in body.splitlines())
        parts.append(f"<p><b>{html.escape(heading)}</b><br>{body_html}</p>")
    if not parts:
        return
    css = (
        f"* {{font-family: sans-serif; font-size: {size}px; line-height: 1.18; color: #221f1f;}}"
        "p {margin: 0 0 6px 0;}"
    )
    page.insert_htmlbox(rect, "".join(parts), css=css, scale_low=0.5)


def _spec_column(page: fitz.Page, ctx: Ctx, product: dict, variation: Optional[dict], x: float, y: float, compact: bool) -> None:
    """Icon + value rows and the model label; x is the icon column's left edge."""
    rows = get_spec_items(product, variation, product.get("spec_profile"))
    pitch = 17.5 if compact or len(rows) > 9 else 21.7
    for row in rows:
        drawn = bool(row["icon"]) and ctx.assets.draw_icon(page, row["icon"], fitz.Rect(x, y, x + 18, y + 18))
        if not drawn:
            _text(page, x + 9, y + 12, row["badge"], role="bold", size=7, align="center")
        _text(page, x + 24, y + 12, row["value"], size=9)
        y += pitch
    _text(page, x + 3, y + 12, model_label(product, variation), size=12.6, max_width=120)


# ---------------------------------------------------------------------------
# Page types
# ---------------------------------------------------------------------------

# Photo box and spec column (icon x, top y) per product count
# Everything below the title starts at y >= 122.
PRODUCT_LAYOUTS = {
    1: [(fitz.Rect(80, 124, 560, 600), (18, 160))],
    2: [
        (fitz.Rect(64, 124, 330, 384), (18, 132)),
        (fitz.Rect(300, 336, 525, 590), (531, 346)),
    ],
    3: [
        (fitz.Rect(62, 124, 290, 345), (18, 128)),
        (fitz.Rect(330, 124, 525, 345), (531, 128)),
        (fitz.Rect(150, 362, 520, 590), (531, 366)),
    ],
}

# Emblem choice -> (template layer, rect on product pages)
EMBLEMS = {
    "flag": ("flag_emblem", fitz.Rect(26, 540, 90, 607)),
    "made_in_usa": ("made_in_usa", fitz.Rect(26, 536, 90, 607)),
}


def draw_product(page: fitz.Page, ctx: Ctx, spec: dict) -> None:
    _chrome(page, ctx, "bg_spec")
    _title(page, spec.get("title"), spec.get("subtitle"))

    items = (spec.get("items") or [])[:MAX_PRODUCT_ITEMS]
    layout = PRODUCT_LAYOUTS.get(len(items), [])
    compact = len(items) >= 3
    for index, (item, (box, (sx, sy))) in enumerate(zip(items, layout)):
        product, variation = resolve_item(item, ctx.data)
        img = ctx.images.load(item_image_url(item, product, variation))
        _place_photo(page, ctx, img, box, item, index)
        if product and item.get("show_specs", True):
            _spec_column(page, ctx, product, variation, sx, sy, compact)

    emblem = EMBLEMS.get(spec.get("emblem"))
    if emblem:
        _layer(page, ctx, *emblem)
    ip_text = (spec.get("ip_text") or "").strip()
    if ip_text:
        x = 100 if emblem else 36
        width = _text(page, x, 600, "IP:", role="bold", size=14)
        _text(page, x + width + 3, 600, ip_text, size=10)

    _layer(page, ctx, "spec_panel")
    environmental = (spec.get("environmental") or "").strip()
    bottom = 742 if environmental else 772
    _html_box(page, fitz.Rect(34, 628, 400, bottom), [("Features", spec.get("features")), ("Materials", spec.get("materials"))])
    _html_box(page, fitz.Rect(423, 628, 572, 772), [("Standard", spec.get("standard")), ("Options", spec.get("options"))], size=10)
    if environmental:
        _html_box(page, fitz.Rect(34, 744, 575, 776), [("Environmental consideration", environmental)], size=10)
    _footer(page, ctx)


def _grid(count: int, cols: int, top: float, bottom: float, left=24, right=588, gap=18, caption=34) -> list[fitz.Rect]:
    rows = -(-count // cols)
    cell_w = (right - left - gap * (cols - 1)) / cols
    cell_h = (bottom - top - gap * (rows - 1)) / rows
    boxes = []
    for i in range(count):
        r, c = divmod(i, cols)
        x0 = left + c * (cell_w + gap)
        y0 = top + r * (cell_h + gap)
        boxes.append(fitz.Rect(x0, y0, x0 + cell_w, y0 + cell_h - caption))
    return boxes


# Staggered photo boxes like the printed "variations" sheets, all below the
# title row and leaving ~34pt under each box for its caption
GALLERY_LAYOUTS = {
    1: [fitz.Rect(110, 128, 500, 680)],
    2: [fitz.Rect(30, 128, 300, 500), fitz.Rect(312, 300, 582, 680)],
    3: [fitz.Rect(24, 128, 260, 380), fitz.Rect(352, 160, 584, 420), fitz.Rect(170, 440, 420, 684)],
    4: [fitz.Rect(24, 128, 260, 370), fitz.Rect(352, 160, 584, 400), fitz.Rect(60, 440, 286, 684), fitz.Rect(352, 448, 584, 684)],
    5: [
        fitz.Rect(20, 128, 200, 300),
        fitz.Rect(400, 128, 580, 290),
        fitz.Rect(214, 316, 398, 480),
        fitz.Rect(30, 508, 210, 684),
        fitz.Rect(400, 500, 580, 684),
    ],
}


def gallery_boxes(count: int) -> list[fitz.Rect]:
    if count in GALLERY_LAYOUTS:
        return GALLERY_LAYOUTS[count]
    return _grid(count, 3 if count <= 6 else 4, top=128, bottom=716)


def default_caption(product: Optional[dict], variation: Optional[dict]) -> str:
    """Like the printed captions: "3506.Bl Lobo" over the variation's description."""
    product = product or {}
    first = f"{model_label(product, variation)} {product.get('family_name') or ''}".strip()
    second = (variation or {}).get("name") or ("" if product.get("family_name") else product.get("name")) or ""
    return f"{first}\n{second}".strip()


def draw_gallery(page: fitz.Page, ctx: Ctx, spec: dict) -> None:
    _chrome(page, ctx, "bg_gallery")
    _title(page, spec.get("title"), spec.get("subtitle"))

    emblem = EMBLEMS.get(spec.get("emblem"))
    emblem_rect = fitz.Rect(13, 623, 77, 694)
    items = (spec.get("items") or [])[:MAX_GALLERY_ITEMS]
    size = 12 if len(items) <= 5 else 10
    for index, (item, box) in enumerate(zip(items, gallery_boxes(len(items)))):
        box = fitz.Rect(box)
        if emblem and box.intersects(emblem_rect + (0, 0, 0, 30)):
            box.x0 = emblem_rect.x1 + 8  # keep the emblem clear
        product, variation = resolve_item(item, ctx.data)
        img = ctx.images.load(item_image_url(item, product, variation))
        rect = _place_photo(page, ctx, img, box, item, index)
        caption = item.get("caption")
        if caption is None:
            caption = default_caption(product, variation)
        x = max(rect.x0, box.x0, 18)
        _lines(page, x, min(rect.y1, box.y1 + 30) + size + 4, caption, size, max_width=min(box.width + 30, 594 - x))

    if emblem:
        _layer(page, ctx, emblem[0], emblem_rect)

    _layer(page, ctx, "banner_panel")
    tagline = (spec.get("tagline") or "").strip()
    if tagline:
        page.insert_htmlbox(
            fitz.Rect(30, 738, 550, 768),
            html.escape(tagline),
            css="* {font-family: sans-serif; font-size: 13px; color: #221f1f; text-align: center;}",
            scale_low=0.6,
        )
    _footer(page, ctx)


def draw_photo(page: fitz.Page, ctx: Ctx, spec: dict) -> None:
    """Full-bleed install photo (cover-fit), optional caption."""
    img = ctx.images.load(spec.get("image_url"))
    if img is None:
        _chrome(page, ctx, "bg_gallery", logo=False)
        if ctx.preview:
            _text(page, PAGE_WIDTH / 2, PAGE_HEIGHT / 2, "Choose a photo", size=16, color=GREY, align="center")
        ctx.slots.append({"item": 0, "rect": list(PAGE_RECT), "box": list(PAGE_RECT), "missing": True})
    else:
        dx, dy, scale = _tweaks(spec)
        fit = max(PAGE_WIDTH / img.width, PAGE_HEIGHT / img.height) * scale
        width, height = img.width * fit, img.height * fit
        cx, cy = PAGE_WIDTH / 2 + dx, PAGE_HEIGHT / 2 + dy
        rect = fitz.Rect(cx - width / 2, cy - height / 2, cx + width / 2, cy + height / 2)
        page.insert_image(rect, stream=img.data)
        ctx.slots.append({"item": 0, "rect": list(rect), "box": list(PAGE_RECT), "missing": False})
    caption = (spec.get("caption") or "").strip()
    if caption:
        _lines(page, 24, 756, caption, 12, color=WHITE)
    if spec.get("show_footer"):
        _footer(page, ctx)


def draw_cover(page: fitz.Page, ctx: Ctx, spec: dict) -> None:
    """
    Cover in the style of the 2025 outdoor catalog: serif brown headline,
    product photos labelled "<model> <name>", the eagle between two taglines.
    """
    _chrome(page, ctx, "bg_spec", logo=False)

    company = (spec.get("subtitle") or "Eagle Chair Inc.").strip()
    _text(page, PAGE_WIDTH / 2, 46, company, role="serif_bold", size=20, color=BROWN, align="center", max_width=560)
    _text(page, PAGE_WIDTH / 2, 92, (spec.get("title") or "").strip(), role="serif_bold", size=40, color=BROWN, align="center", max_width=570)
    year = str(spec.get("year") or "").strip()
    if year:
        _text(page, PAGE_WIDTH / 2, 122, year, role="serif_bold", size=24, color=BROWN, align="center")

    items = (spec.get("items") or [])[:MAX_COVER_ITEMS]
    top = items[: (len(items) + 1) // 2]
    rows = ((top, 140, 330), (items[len(top):], 470, 690))
    index = 0
    for row_items, y0, y1 in rows:
        if not row_items:
            continue
        width = 564 / len(row_items)
        for col, item in enumerate(row_items):
            box = fitz.Rect(24 + col * width + 6, y0, 24 + (col + 1) * width - 6, y1 - 30)
            product, variation = resolve_item(item, ctx.data)
            img = ctx.images.load(item_image_url(item, product, variation))
            _place_photo(page, ctx, img, box, item, index)
            caption = item.get("caption")
            label = model_label(product, variation) if caption is None else caption
            used = _text(page, box.x0, y1 - 8, label, role="bold_oblique", size=17, max_width=box.width * 0.7)
            name = (product or {}).get("family_name") or (product or {}).get("name") or ""
            if name and caption is None:
                _text(page, box.x0 + used + 3, y1 - 8, name, role="oblique", size=9, max_width=box.width - used - 3)
            index += 1

    # Eagle and taglines across the middle
    _layer(page, ctx, "logo", fitz.Rect(PAGE_WIDTH / 2 - 55, 335, PAGE_WIDTH / 2 + 55, 438), clip=LOGO_CLIP)
    _text(page, PAGE_WIDTH / 2, 452, "Eagle Chair", role="serif_bold", size=12, align="center")
    _text(page, 150, 395, (spec.get("tagline") or "").strip(), role="serif_bold", size=20, align="center", max_width=230)
    _text(page, 462, 395, (spec.get("tagline_right") or "").strip(), role="serif_bold", size=20, align="center", max_width=230)

    _text(page, 24, 785, (spec.get("website") or "www.eaglechair.com").strip(), size=7.7, color=WHITE)
    _text(page, 588, 785, ctx.settings.get("copyright") or "", size=7.7, color=WHITE, align="right", max_width=380)


def draw_toc(page: fitz.Page, ctx: Ctx, spec: dict, entries: list[dict], first: bool) -> None:
    """One page of contents: title, then rows of "name ..... page" with model numbers."""
    _chrome(page, ctx, "bg_gallery")
    _title(page, spec.get("title") or "Contents", "" if first else "continued")
    y = 160
    for entry in entries:
        number = str(entry["page"])
        name_width = _text(page, 40, y, entry["title"], role="bold", size=13, max_width=400)
        num_width = fonts()["regular"].text_length(number, fontsize=13)
        _text(page, 572, y, number, size=13, align="right")
        # Dotted leader between name and page number
        x0, x1 = 40 + name_width + 6, 572 - num_width - 6
        if x1 > x0:
            page.draw_line((x0, y - 1), (x1, y - 1), color=GREY, width=0.7, dashes="[1 3] 0")
        models = entry.get("models") or []
        if models:
            _text(page, 40, y + 13, ", ".join(models), size=8.5, color=GREY, max_width=530)
        y += 30
    _layer(page, ctx, "banner_panel")
    tagline = (spec.get("tagline") or "").strip()
    if tagline:
        _text(page, 290, 757, tagline, size=13, align="center", max_width=500)
    _footer(page, ctx)
