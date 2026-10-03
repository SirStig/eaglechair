"""
Page layouts of the Eagle Chair catalog.

Each draw_* function paints one letter-size page in the style of the printed
catalog sheets (positions and type sizes measured from the 2024/2026 sheets):

- product: family title, up to 5 product cut-outs each with a spec column
  beside it, the rounded Features / Materials / (Sizes) / Standard / Options
  panel (short, or the taller one when the text needs it)
- gallery: title + subtitle ("variations"), up to 8 captioned photos and the
  tagline banner
- photo: one full-bleed install photo, portrait or landscape
- seats: seat / upholstery options, close-ups in ovals with code + description
- bases: table bases with small captions and a sizes / weights table
- chart: a ruled table such as the table top / base compatibility chart
- cover: title, product photos with model labels, the eagle and two taglines
- toc: contents with page numbers (renderer decides how many pages it needs)

Photo boxes are recorded in ctx.slots so the editor can overlay them on the
preview and let admins drag / scale photos (stored as dx, dy, scale).
"""

import html
import io
from dataclasses import dataclass, field
from typing import Optional

import fitz
from PIL import Image, ImageDraw

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
        dx = max(-PAGE_HEIGHT, min(PAGE_HEIGHT, float(item.get("dx") or 0)))
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
    width, height = page.rect.width, page.rect.height
    _text(page, width - 42, height - 7, ctx.settings.get("copyright") or "", size=7.7, color=WHITE, align="right", max_width=420)
    if ctx.settings.get("page_numbers", True) and ctx.page_number:
        _text(page, 36, height - 7, str(ctx.page_number), size=7.7, color=WHITE)


# Title baseline: the 66pt caps clear the logo (ends at y 39) by ~10pt
TITLE_BASELINE = 102
SUBTITLE_SIZE = 24


def _title(page: fitz.Page, title: str, subtitle: str = "", y: float = TITLE_BASELINE) -> float:
    """
    Family name in large white light oblique, optional smaller subtitle after
    it, or on a second line when both don't fit at full size (as on the
    printed "St.Louis table bases / optional heights" sheets). Returns the
    baseline of the last line.
    """
    title = (title or "").strip()
    subtitle = (subtitle or "").strip()
    font = fonts()["title"]
    sub_width = font.text_length(subtitle, fontsize=SUBTITLE_SIZE) + 14 if subtitle else 0
    if title and subtitle and font.text_length(title, fontsize=66) + sub_width > 574:
        _text(page, 18, y, title, role="title", size=66, color=WHITE, max_width=574)
        _text(page, 110, y + 26, subtitle, role="title", size=SUBTITLE_SIZE + 6, color=WHITE, opacity=0.85, max_width=480)
        return y + 26
    width = _text(page, 18, y, title, role="title", size=66, color=WHITE, max_width=574 - sub_width)
    if subtitle:
        x = 18 + width + (14 if title else 0)
        _text(page, x, y, subtitle, role="title", size=SUBTITLE_SIZE, color=WHITE, opacity=0.85, max_width=592 - x)
    return y


_PANEL_CSS = (
    "* {{font-family: sans-serif; font-size: {size}px; line-height: 1.18; color: #221f1f;}}"
    "p {{margin: 0 0 7px 0;}} b {{font-size: {head}px;}}"
)


def _panel_html(blocks: list[tuple[str, str]]) -> str:
    parts = []
    for heading, body in blocks:
        body = (body or "").strip()
        if not body:
            continue
        body_html = "<br>".join(html.escape(line) for line in body.splitlines())
        head_html = f"<b>{html.escape(heading)}</b><br>" if heading else ""
        parts.append(f"<p>{head_html}{body_html}</p>")
    return "".join(parts)


def _html_box(page: fitz.Page, rect: fitz.Rect, blocks: list[tuple[str, str]], size: float = 10, scale_low: float = 0.5) -> bool:
    """
    Headed paragraphs (bold heading, body text) fitted into rect. Returns
    whether they fit at full size. With scale_low=1 nothing is drawn when
    they do not fit (used to test-fit on a scratch page).
    """
    content = _panel_html(blocks)
    if not content:
        return True
    css = _PANEL_CSS.format(size=size, head=size + 1)
    spare, scale = page.insert_htmlbox(rect, content, css=css, scale_low=scale_low)
    return spare >= 0 and scale >= 1


def _fits(rect: fitz.Rect, blocks: list[tuple[str, str]], size: float = 10) -> bool:
    scratch = fitz.open()
    page = scratch.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
    return _html_box(page, rect, blocks, size=size, scale_low=1)


def _spec_rows(product: dict, variation: Optional[dict]) -> list[dict]:
    return get_spec_items(product, variation, product.get("spec_profile"))


SPEC_COLUMN_WIDTH = 58  # icon (18) + gap + a value like 44.5"
SPEC_GAP = 6


def _spec_column(page: fitz.Page, ctx: Ctx, rows: list[dict], label: str, x: float, y: float, pitch: float) -> None:
    """Icon + value rows, a short rule, then the model label; x is the icon column's left edge."""
    for row in rows:
        drawn = bool(row["icon"]) and ctx.assets.draw_icon(page, row["icon"], fitz.Rect(x, y, x + 18, y + 18))
        if not drawn:
            _text(page, x + 9, y + 12, row["badge"], role="bold", size=7, align="center")
        _text(page, x + 23, y + 12, row["value"], size=9)
        y += pitch
    page.draw_line((x, y + 1.5), (x + 44, y + 1.5), color=GREY, width=0.4)
    _text(page, x + 1, y + 13, label, size=11.3, max_width=118)


def _place_spec_column(rect: fitz.Rect, side: str, rows: int, pitch: float, bottom: float) -> tuple[float, float]:
    """
    (x, top y) of a spec column next to a drawn photo, as on the printed
    sheets: beside the photo, its model label level with the photo's foot.
    """
    height = rows * pitch + 16
    low, high = 14.0, PAGE_WIDTH - 14 - SPEC_COLUMN_WIDTH
    left, right = rect.x0 - SPEC_COLUMN_WIDTH - SPEC_GAP, rect.x1 + SPEC_GAP
    # Use the other side when the page edge would push the column onto the photo
    if side == "left" and left < low and right <= high:
        side = "right"
    elif side == "right" and right > high and left >= low:
        side = "left"
    x = max(low, min(high, left if side == "left" else right))
    y = rect.y1 - 6 - height
    y = max(CONTENT_TOP, min(bottom - height, y))
    return x, y


# ---------------------------------------------------------------------------
# Page types
# ---------------------------------------------------------------------------

# Everything below the title starts at y >= CONTENT_TOP
CONTENT_TOP = 122.0
CONTENT_LEFT, CONTENT_RIGHT = 14.0, 598.0

# Product sheet photo boxes as fractions of the content area (x0, y0, x1, y1)
# and the side of the photo its spec column goes on, per product count.
# Modelled on the printed sheets: Abruzzo (3), Nazare (4), Alpine (5).
PRODUCT_LAYOUTS = {
    1: [((0.22, 0.0, 0.9, 1.0), "left")],
    2: [((0.12, 0.0, 0.5, 0.74), "left"), ((0.64, 0.26, 0.98, 1.0), "left")],
    3: [((0.12, 0.0, 0.5, 0.76), "left"), ((0.76, 0.0, 0.92, 0.38), "right"), ((0.66, 0.42, 0.95, 1.0), "left")],
    4: [
        ((0.11, 0.0, 0.42, 0.6), "left"),
        ((0.8, 0.0, 0.98, 0.32), "left"),
        ((0.72, 0.36, 0.98, 0.96), "left"),
        ((0.3, 0.62, 0.5, 1.0), "right"),
    ],
    5: [
        ((0.11, 0.0, 0.33, 0.44), "left"),
        ((0.72, 0.0, 0.98, 0.44), "left"),
        ((0.46, 0.2, 0.64, 0.6), "left"),
        ((0.1, 0.56, 0.36, 1.0), "right"),
        ((0.7, 0.52, 0.98, 1.0), "left"),
    ],
}
MAX_PRODUCT_ITEMS = max(PRODUCT_LAYOUTS)

# Spec row pitch by product count: the printed sheets use ~22pt, tighter when crowded
SPEC_PITCH = {1: 21.7, 2: 21.7, 3: 20.0, 4: 19.0, 5: 17.5}

# The white text panel: short (Lobo) or tall (most sheets); text area of each
PANELS = {
    "short": ("spec_panel", 628.0, 772.0),
    "tall": ("spec_panel_tall", 610.0, 768.0),
}

# Emblem choice -> (template layer, rect on product pages)
EMBLEMS = {
    "flag": ("flag_emblem", fitz.Rect(26, 540, 90, 607)),
    "made_in_usa": ("made_in_usa", fitz.Rect(26, 536, 90, 607)),
}


def _area_box(fractions: tuple, bottom: float) -> fitz.Rect:
    fx0, fy0, fx1, fy1 = fractions
    width, height = CONTENT_RIGHT - CONTENT_LEFT, bottom - CONTENT_TOP
    return fitz.Rect(
        CONTENT_LEFT + fx0 * width, CONTENT_TOP + fy0 * height, CONTENT_LEFT + fx1 * width, CONTENT_TOP + fy1 * height
    )


def _panel_columns(spec: dict, top: float, bottom: float) -> list[tuple[fitz.Rect, list, float]]:
    """(rect, blocks, size) per panel column: Features & co. | sizes | Standard / Options."""
    sizes = (spec.get("sizes") or "").strip()
    left_x1 = 330 if sizes else 385
    columns = [
        (
            fitz.Rect(34, top, left_x1, bottom),
            [("Features", spec.get("features")), ("Materials", spec.get("materials")),
             ("Environmental consideration", spec.get("environmental"))],
            10,
        ),
    ]
    if sizes:
        columns.append((fitz.Rect(338, top, 404, bottom), [((spec.get("sizes_label") or "Standard Sizes").strip(), sizes)], 10))
    columns.append(
        (fitz.Rect(412 if sizes else 398, top, 574, bottom), [("Standard", spec.get("standard")), ("Options", spec.get("options"))], 10)
    )
    return columns


def choose_panel(spec: dict) -> str:
    """The short panel when the text fits it at full size, else the tall one."""
    _, top, bottom = PANELS["short"]
    if all(_fits(rect, blocks, size) for rect, blocks, size in _panel_columns(spec, top, bottom)):
        return "short"
    return "tall"


def draw_product(page: fitz.Page, ctx: Ctx, spec: dict) -> None:
    _chrome(page, ctx, "bg_spec")
    _title(page, spec.get("title"), spec.get("subtitle"))

    panel = choose_panel(spec)
    layer, text_top, text_bottom = PANELS[panel]
    panel_top = 597.0 if panel == "tall" else 623.0
    emblem = EMBLEMS.get(spec.get("emblem"))
    ip_text = (spec.get("ip_text") or "").strip()
    # Photos stand on a line above the panel (and above the emblem / IP line)
    bottom = panel_top - (30 if (emblem or ip_text) else 8)

    items = (spec.get("items") or [])[:MAX_PRODUCT_ITEMS]
    pitch = SPEC_PITCH.get(len(items), 17.5)
    for index, (item, (fractions, side)) in enumerate(zip(items, PRODUCT_LAYOUTS.get(len(items), []))):
        product, variation = resolve_item(item, ctx.data)
        img = ctx.images.load(item_image_url(item, product, variation))
        rect = _place_photo(page, ctx, img, _area_box(fractions, bottom), item, index)
        if product and item.get("show_specs", True):
            rows = _spec_rows(product, variation)
            x, y = _place_spec_column(rect, side, len(rows), pitch, bottom)
            _spec_column(page, ctx, rows, model_label(product, variation), x, y, pitch)

    if emblem:
        _layer(page, ctx, emblem[0], emblem[1] + (0, panel_top - 623, 0, panel_top - 623))
    if ip_text:
        x = 100 if emblem else 36
        width = _text(page, x, panel_top - 14, "IP:", role="bold", size=14)
        _text(page, x + width + 3, panel_top - 14, ip_text, size=10)

    _layer(page, ctx, layer)
    for rect, blocks, size in _panel_columns(spec, text_top, text_bottom):
        _html_box(page, rect, blocks, size=size)
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


def _caption(page: fitz.Page, x: float, top: float, text: str, size: float, max_width: Optional[float] = None) -> float:
    """A caption under a photo: a short grey rule, then the lines. Returns the y below it."""
    if not (text or "").strip():
        return top
    page.draw_line((x, top), (x + 40, top), color=GREY, width=0.4)
    return _lines(page, x, top + size + 2, text, size, max_width=max_width)


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
    size = 11.3 if len(items) <= 5 else 10
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
        _caption(page, x, min(rect.y1, box.y1 + 30) + 4, caption, size, max_width=min(box.width + 30, 594 - x))

    if emblem:
        _layer(page, ctx, emblem[0], emblem_rect)

    _banner(page, ctx, spec.get("tagline"))
    _footer(page, ctx)


def page_size(spec: dict) -> tuple[float, float]:
    """(width, height) of a page: photo pages can be landscape, like the printed install shots."""
    if spec.get("type") == "photo" and spec.get("orientation") == "landscape":
        return PAGE_HEIGHT, PAGE_WIDTH
    return PAGE_WIDTH, PAGE_HEIGHT


def draw_photo(page: fitz.Page, ctx: Ctx, spec: dict) -> None:
    """Full-bleed install photo (cover-fit), optional caption; portrait or landscape."""
    full = fitz.Rect(page.rect)
    img = ctx.images.load(spec.get("image_url"), cutout=False)  # keep the photo as shot
    if img is None:
        page.draw_rect(full, color=None, fill=(0.82, 0.82, 0.83))
        if ctx.preview:
            _text(page, full.width / 2, full.height / 2, "Choose a photo", size=16, color=GREY, align="center")
        ctx.slots.append({"item": 0, "rect": list(full), "box": list(full), "missing": True})
    else:
        dx, dy, scale = _tweaks(spec)
        fit = max(full.width / img.width, full.height / img.height) * scale
        width, height = img.width * fit, img.height * fit
        cx, cy = full.width / 2 + dx, full.height / 2 + dy
        rect = fitz.Rect(cx - width / 2, cy - height / 2, cx + width / 2, cy + height / 2)
        page.insert_image(rect, stream=img.data)
        ctx.slots.append({"item": 0, "rect": list(rect), "box": list(full), "missing": False})
    caption = (spec.get("caption") or "").strip()
    if caption:
        _lines(page, 24, full.height - 36, caption, 12, color=WHITE)
    if spec.get("show_footer"):
        _footer(page, ctx)


def _banner(page: fitz.Page, ctx: Ctx, tagline: str) -> None:
    """The rounded tagline banner at the foot of gallery-style pages."""
    _layer(page, ctx, "banner_panel")
    tagline = (tagline or "").strip()
    if tagline:
        page.insert_htmlbox(
            fitz.Rect(30, 736, 560, 770),
            "<br>".join(html.escape(line) for line in tagline.splitlines()),
            css="* {font-family: sans-serif; font-size: 13px; line-height: 1.15; color: #221f1f; text-align: center;}",
            scale_low=0.6,
        )


# ---------------------------------------------------------------------------
# Seat / upholstery options: seat close-ups in ovals with a code + description
# ---------------------------------------------------------------------------

MAX_SEAT_ITEMS = 10
SEAT_TAGLINE = (
    "Eagle Chair provides one of the widest selections of upholstered seat types on all of our chairs.\n"
    "And even those can be further customized by several factors."
)


def seat_caption(product: Optional[dict], variation: Optional[dict]) -> str:
    """"P - Padded seat": the variation's code and name."""
    label = model_label(product, variation)
    name = (variation or {}).get("name") or ""
    return f"{label} - {name}" if label and name else label or name


def seat_boxes(count: int, top: float = CONTENT_TOP + 8) -> list[tuple[fitz.Rect, str]]:
    """(oval rect, caption side) per seat: one column of up to 5, else two columns."""
    bottom = 716.0
    if count <= 5:
        row = (bottom - top) / max(count, 1)
        height = min(row - 18, 124)
        width = height * 2.1
        return [
            (fitz.Rect(64, top + i * row + (row - height) / 2, 64 + width, top + i * row + (row + height) / 2), "right")
            for i in range(count)
        ]
    rows = -(-count // 2)
    row = (bottom - top) / rows
    height = min(row - 64, 104)  # room for a three-line caption under each oval
    width = height * 2.1
    boxes = []
    for i in range(count):
        col, r = divmod(i, rows)
        x0 = 40 + col * 300
        y0 = top + r * row + 4
        boxes.append((fitz.Rect(x0, y0, x0 + width, y0 + height), "below"))
    return boxes


# How far down a product cut-out its seat usually is, by spec profile
SEAT_LEVEL = {"barstool": 0.4, "bench": 0.45, "booth": 0.6}


def _place_in_oval(
    page: fitz.Page, ctx: Ctx, img: Optional[LoadedImage], box: fitz.Rect, item: dict, index: int, level: float = 0.52
) -> None:
    """
    The photo inside an oval frame, zoomed onto the seat: by default the
    photo is a bit wider than the oval with the seat (level of the way down
    the photo) at the oval's centre. dx/dy/scale move and zoom it.
    """
    if img is None:
        _place_photo(page, ctx, None, box, item, index)
        page.draw_oval(box, color=INK, width=1)
        return
    dx, dy, scale = _tweaks(item)
    fit = box.width / img.width * 1.3 * scale
    width, height = img.width * fit, img.height * fit
    cx = box.x0 + box.width / 2 + dx
    cy = box.y0 + box.height / 2 + dy
    rect = fitz.Rect(cx - width / 2, cy - height * level, cx + width / 2, cy + height * (1 - level))

    # Crop the visible part, white behind it, masked to the oval
    source = Image.open(io.BytesIO(img.data)).convert("RGBA")
    px_per_pt = source.width / rect.width
    crop = source.crop((
        round((box.x0 - rect.x0) * px_per_pt), round((box.y0 - rect.y0) * px_per_pt),
        round((box.x1 - rect.x0) * px_per_pt), round((box.y1 - rect.y0) * px_per_pt),
    ))
    out_w = max(1, min(900, round(box.width * 3)))
    out_h = max(1, round(out_w * box.height / box.width))
    crop = crop.resize((out_w, out_h), Image.LANCZOS)
    canvas = Image.new("RGBA", (out_w, out_h), (255, 255, 255, 255))
    canvas.alpha_composite(crop)
    mask = Image.new("L", (out_w, out_h), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, out_w - 1, out_h - 1), fill=255)
    canvas.putalpha(mask)
    buffer = io.BytesIO()
    canvas.save(buffer, format="PNG")
    page.insert_image(box, stream=buffer.getvalue())
    page.draw_oval(box, color=INK, width=1)
    ctx.slots.append({"item": index, "rect": list(rect), "box": list(box), "missing": False})


def draw_seats(page: fitz.Page, ctx: Ctx, spec: dict) -> None:
    _chrome(page, ctx, "bg_gallery")
    baseline = _title(page, spec.get("title"), spec.get("subtitle"))
    items = (spec.get("items") or [])[:MAX_SEAT_ITEMS]
    size = 12 if len(items) <= 5 else 11
    for index, (item, (box, side)) in enumerate(zip(items, seat_boxes(len(items), max(CONTENT_TOP, baseline + 14) + 8))):
        product, variation = resolve_item(item, ctx.data)
        img = ctx.images.load(item_image_url(item, product, variation))
        level = SEAT_LEVEL.get((product or {}).get("spec_profile"), 0.52)
        _place_in_oval(page, ctx, img, box, item, index, level)
        caption = item.get("caption")
        if caption is None:
            caption = seat_caption(product, variation)
        if side == "right":
            lines = len(_wrap(caption, "regular", size, 230))
            top = box.y0 + box.height / 2 - (lines * size * 1.15) / 2 - 4
            _caption(page, box.x1 + 40, top, caption, size, max_width=230)
        else:
            _caption(page, box.x0, box.y1 + 10, caption, size, max_width=260)
    _banner(page, ctx, spec.get("tagline"))
    _footer(page, ctx)


# ---------------------------------------------------------------------------
# Table bases: many small captioned bases, a sizes / weights table in the panel
# ---------------------------------------------------------------------------

MAX_BASE_ITEMS = 12
KG_PER_LB = 0.45359237


def base_rows(items: list[dict], data: CatalogData) -> list[list[str]]:
    """Default sizes table: model and shipping weight "lbs / kg" per base on the page."""
    rows, seen = [], set()
    for item in items:
        product, variation = resolve_item(item, data)
        label = model_label(product, variation)
        if not label or label in seen:
            continue
        seen.add(label)
        weight = None
        for source in (variation, product):
            if source:
                weight = source.get("shipping_weight") or source.get("weight")
                if weight:
                    break
        rows.append([label, f"{float(weight):g} / {float(weight) * KG_PER_LB:.1f}" if weight else ""])
    return rows


def _base_layout(count: int, top: float, bottom: float) -> list[fitz.Rect]:
    rows = 1 if count <= 4 else 2 if count <= 8 else 3
    cols = -(-count // rows)
    return _grid(count, cols, top=top, bottom=bottom, left=18, right=594, gap=10, caption=30)


def _small_table(page: fitz.Page, x: float, top: float, bottom: float, header: list[str], rows: list[list[str]], widths: list[float]) -> None:
    """Plain two-or-more column list (no grid), shrunk to fit between top and bottom."""
    leading = min(12.5, (bottom - top - 16) / max(len(rows), 1))
    size = min(10.0, leading * 0.85)
    col_x = [x]
    for w in widths[:-1]:
        col_x.append(col_x[-1] + w)
    for i, head in enumerate(header):
        _text(page, col_x[i], top + 11, head, role="bold", size=11, max_width=widths[i] - 4)
    y = top + 11 + leading + 1
    for row in rows:
        for i, cell in enumerate(row[: len(col_x)]):
            _text(page, col_x[i] + (6 if i else 0), y, cell, size=size, max_width=widths[i] - 8)
        y += leading


def draw_bases(page: fitz.Page, ctx: Ctx, spec: dict) -> None:
    _chrome(page, ctx, "bg_spec")
    baseline = _title(page, spec.get("title"), spec.get("subtitle"))
    _, text_top, text_bottom = PANELS["tall"]
    items = (spec.get("items") or [])[:MAX_BASE_ITEMS]
    size = 10 if len(items) <= 8 else 9
    top = max(CONTENT_TOP, baseline + 14) + 4
    for index, (item, box) in enumerate(zip(items, _base_layout(len(items), top, 589))):
        product, variation = resolve_item(item, ctx.data)
        img = ctx.images.load(item_image_url(item, product, variation))
        rect = _place_photo(page, ctx, img, box, item, index)
        caption = item.get("caption")
        if caption is None:
            caption = model_label(product, variation)
        x = max(min(rect.x0, box.x0 + box.width / 2 - 20), 18)
        _caption(page, x, min(rect.y1, box.y1) + 4, caption, size, max_width=box.width + 6)

    _layer(page, ctx, "spec_panel_tall")
    header = [h for h in (spec.get("table_header") or []) if h and h.strip()][:2] or ["Sizes", "Weight  lbs/kg"]
    rows = spec.get("table_rows") or base_rows(items, ctx.data)
    if rows:
        _small_table(page, 34, text_top - 2, text_bottom, header, rows, [118, 150])
    _html_box(
        page,
        fitz.Rect(310 if rows else 34, text_top, 574, text_bottom),
        [("", spec.get("features")), ("Environmental consideration", spec.get("environmental"))],
    )
    _footer(page, ctx)


# ---------------------------------------------------------------------------
# Chart: a ruled table (table top / base compatibility), split in two halves
# ---------------------------------------------------------------------------

MAX_CHART_ROWS = 120
CHART_TAGLINE = "Please contact the factory if you are uncertain of the base sizes needed for your project."


def draw_chart(page: fitz.Page, ctx: Ctx, spec: dict) -> None:
    _chrome(page, ctx, "bg_gallery")
    baseline = _title(page, spec.get("title"), spec.get("subtitle"))
    header = [str(h or "") for h in (spec.get("table_header") or [])][:6]
    rows = [[str(c or "") for c in row][:6] for row in (spec.get("table_rows") or [])][:MAX_CHART_ROWS]
    columns = max([len(header)] + [len(r) for r in rows]) if (header or rows) else 0
    if columns:
        header += [""] * (columns - len(header))
        head_lines = max(len(h.splitlines()) or 1 for h in header)
        top, bottom = max(150.0, baseline + 30), 712.0
        head_h = 15 * head_lines + 6
        # One table when it fits at a comfortable row height, else two halves side by side
        halves = 1 if len(rows) * 18 <= bottom - top - head_h or columns > 3 else 2
        per_half = -(-len(rows) // halves) if rows else 0
        row_h = min(18.0, (bottom - top - head_h) / max(per_half, 1))
        size = min(11.0, row_h * 0.62)
        gap = 18
        half_w = (564 - gap * (halves - 1)) / halves
        cell_w = half_w / columns
        for h in range(halves):
            x0 = 24 + h * (half_w + gap)
            for c, head in enumerate(header):
                for n, line in enumerate(head.splitlines()):
                    _text(page, x0 + (c + 0.5) * cell_w, top + 14 + n * 15, line, role="bold", size=12.5,
                          align="center", max_width=cell_w - 4)
            chunk = rows[h * per_half:(h + 1) * per_half]
            y = top + head_h
            for row in chunk:
                for c in range(columns):
                    cell = fitz.Rect(x0 + c * cell_w, y, x0 + (c + 1) * cell_w, y + row_h)
                    page.draw_rect(cell, color=INK, width=0.6)
                    value = row[c] if c < len(row) else ""
                    _text(page, cell.x0 + 4, cell.y1 - (row_h - size) / 2 - 1, value, size=size, max_width=cell_w - 8)
                y += row_h
    elif ctx.preview:
        _text(page, PAGE_WIDTH / 2, 400, "Add rows in the Table tab", size=14, color=GREY, align="center")
    _banner(page, ctx, spec.get("tagline"))
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
