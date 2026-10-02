"""
Share Image Service

Renders the 1200x630 cards that link previews show (Facebook, LinkedIn,
Slack, iMessage, X, Teams ...) when someone shares an Eagle Chair page:

    product     product photo(s) on a white panel | dark brand panel with the
                category + model number, product name, key specs and logo.
                Families and categories without a banner use up to three
                member products side by side.
    photo       installation photo filling the card, darkened toward the
                brand text (categories with a banner photo)

Product photos are shot on white, so the white panel shows them without a
visible box; surrounding whitespace is trimmed so the chair fills the panel.

Cards are deterministic for their inputs: card_key() hashes everything that
changes the pixels, and the prerender job (seo_prerender.py) stores each card
under that hash, so an unchanged card is never rendered twice and a changed
one gets a new URL (social networks cache images per URL for weeks).
"""

import hashlib
import io
import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import Iterable, Optional
from urllib.parse import urlsplit

from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageOps

from backend.core.config import settings
from backend.services.media_service import resolve_uploaded_image_path, variant_path

logger = logging.getLogger(__name__)

CARD_W, CARD_H = 1200, 630
# Bump to re-render every card after a design change
TEMPLATE_VERSION = 1

ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets"
FONTS_DIR = ASSETS_DIR / "fonts"
LOGO_PATH = ASSETS_DIR / "eagle-chair-logo.png"

# Brand palette (frontend/tailwind.config.js)
WHITE = (255, 255, 255)
COAL = (20, 20, 20)  # between dark-900 and dark-800
GOLD = (212, 175, 55)  # primary-600
CREAM = (245, 242, 237)  # cream-100
MUTED = (163, 163, 163)  # dark-100
FOOTER = (212, 212, 212)  # dark-50
RULE = (45, 45, 45)  # dark-600

SPLIT_X = 620  # white image panel | brand panel
PAD = 56
JPEG_QUALITY = 86
# Rendition read from disk: wide enough for the 620px panel
SOURCE_WIDTH = 1024
FETCH_TIMEOUT_SECONDS = 10
FETCH_MAX_BYTES = 15 * 1024 * 1024


# ---------------------------------------------------------------------------
# Fonts and text
# ---------------------------------------------------------------------------

@lru_cache(maxsize=64)
def _font(family: str, weight: str, size: int) -> ImageFont.FreeTypeFont:
    """Brand font at a named weight (Merriweather / Inter variable fonts, OFL)."""
    try:
        font = ImageFont.truetype(str(FONTS_DIR / f"{family}.ttf"), size)
        font.set_variation_by_name(weight)
        return font
    except OSError:
        logger.warning(f"Font {family} unavailable, using Pillow's default")
        return ImageFont.load_default(size)


def _wrap(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    """Greedy word wrap by rendered width."""
    lines: list[str] = []
    line = ""
    for word in text.split():
        candidate = f"{line} {word}".strip()
        if not line or font.getlength(candidate) <= max_width:
            line = candidate
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def _ellipsize(line: str, font: ImageFont.FreeTypeFont, max_width: int) -> str:
    while line and font.getlength(line + "…") > max_width:
        line = line[:-1].rstrip()
    return line + "…"


def _fit_text(
    text: str,
    family: str,
    weight: str,
    sizes: Iterable[int],
    max_width: int,
    max_lines: int,
) -> tuple[ImageFont.FreeTypeFont, list[str]]:
    """Largest size whose wrap fits max_lines; the smallest size ellipsizes."""
    font = None
    lines: list[str] = []
    for size in sizes:
        font = _font(family, weight, size)
        lines = _wrap(text, font, max_width)
        if len(lines) <= max_lines:
            return font, lines
    lines = lines[:max_lines]
    lines[-1] = _ellipsize(lines[-1], font, max_width)
    return font, lines


def _draw_tracked(draw: ImageDraw.ImageDraw, xy, text: str, font, fill, tracking: float) -> None:
    """Draw text with extra letter spacing (the small uppercase eyebrow)."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += font.getlength(ch) + tracking


def _tracked_width(text: str, font, tracking: float) -> float:
    return sum(font.getlength(ch) + tracking for ch in text) - tracking if text else 0


# ---------------------------------------------------------------------------
# Source images
# ---------------------------------------------------------------------------

def _allowed_remote_hosts() -> set[str]:
    hosts = set()
    for base in (settings.MEDIA_BASE_URL, settings.SITE_URL):
        host = urlsplit(base or "").hostname
        if host:
            hosts.add(host.lower())
    return hosts


def _fetch_remote(url: str) -> Optional[bytes]:
    """
    Download an image from one of our own hosts. Production reads uploads from
    disk; this covers dev machines without the uploads folder and legacy
    absolute URLs. Only MEDIA_BASE_URL / SITE_URL hosts are ever contacted.
    """
    import httpx

    host = (urlsplit(url).hostname or "").lower()
    if not url.startswith("https://") or host not in _allowed_remote_hosts():
        return None
    try:
        with httpx.Client(timeout=FETCH_TIMEOUT_SECONDS, follow_redirects=False) as client:
            with client.stream("GET", url) as response:
                if response.status_code != 200:
                    return None
                if not response.headers.get("content-type", "").startswith("image/"):
                    return None
                data = bytearray()
                for chunk in response.iter_bytes():
                    data.extend(chunk)
                    if len(data) > FETCH_MAX_BYTES:
                        return None
                return bytes(data)
    except httpx.HTTPError as e:
        logger.debug(f"Share image source fetch failed for {url}: {e}")
        return None


def _open(source) -> Optional[Image.Image]:
    """Decode a path or bytes to RGB, flattening transparency onto white."""
    try:
        img = Image.open(io.BytesIO(source) if isinstance(source, bytes) else source)
        img = ImageOps.exif_transpose(img)
        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGBA")
            background = Image.new("RGB", img.size, WHITE)
            background.paste(img, mask=img.getchannel("A"))
            return background
        return img.convert("RGB")
    except Exception as e:
        logger.debug(f"Could not decode share image source: {e}")
        return None


def load_source_image(url: Optional[str], upload_dir: Path) -> Optional[Image.Image]:
    """
    Load a stored image by its public URL ("/uploads/images/..." or an absolute
    URL on one of our hosts). Prefers the 1024px WebP rendition when present.
    """
    if not url or not isinstance(url, str):
        return None
    url = url.strip()
    master = resolve_uploaded_image_path(url, upload_dir)
    if master is not None:
        for candidate in (variant_path(master, SOURCE_WIDTH), master):
            if candidate.is_file():
                img = _open(candidate)
                if img is not None:
                    return img

    if url.startswith("/uploads/"):
        base = (settings.MEDIA_BASE_URL or "").rstrip("/")
        path = url.split("?")[0]
        stem, dot, ext = path.rpartition(".")
        candidates = []
        if dot and ext.lower() in ("jpg", "jpeg", "png", "webp") and path.startswith("/uploads/images/"):
            candidates.append(f"{base}{stem}.w{SOURCE_WIDTH}.webp")
        candidates.append(f"{base}{path}")
    else:
        candidates = [url]
    for candidate in candidates:
        data = _fetch_remote(candidate)
        if data:
            img = _open(data)
            if img is not None:
                return img
    return None


def _trim_white(img: Image.Image, threshold: int = 14) -> Image.Image:
    """Crop the near-white margin around a product shot."""
    diff = ImageChops.difference(img, Image.new("RGB", img.size, WHITE)).convert("L")
    bbox = diff.point(lambda p: 255 if p > threshold else 0).getbbox()
    return img.crop(bbox) if bbox else img


def _contain(img: Image.Image, box_w: int, box_h: int) -> Image.Image:
    img = img.copy()
    img.thumbnail((box_w, box_h), Image.LANCZOS)
    return img


@lru_cache(maxsize=4)
def _logo(height: int) -> Optional[Image.Image]:
    try:
        logo = Image.open(LOGO_PATH).convert("RGBA")
    except OSError:
        return None
    bbox = logo.getchannel("A").getbbox()  # drop the transparent margin
    if bbox:
        logo = logo.crop(bbox)
    width = round(logo.width * height / logo.height)
    return logo.resize((width, height), Image.LANCZOS)


# ---------------------------------------------------------------------------
# Card layouts
# ---------------------------------------------------------------------------

def _brand_text(
    card: Image.Image,
    x0: int,
    eyebrow: str,
    title: str,
    details: list[str],
    footer: str,
) -> None:
    """Logo, eyebrow, title, details and footer in the column from x0 to the right edge."""
    draw = ImageDraw.Draw(card)
    left = x0 + PAD
    width = CARD_W - PAD - left

    logo = _logo(62)
    if logo is not None:
        card.paste(logo, (left, PAD - 6), logo)

    eyebrow_font = _font("Inter", "SemiBold", 19)
    title_font, title_lines = _fit_text(title, "Merriweather", "Bold", range(54, 33, -2), width, 3)
    detail_font = _font("Inter", "Regular", 23)
    detail_lines: list[str] = []
    for detail in details:
        detail_lines += _wrap(detail, detail_font, width)
    detail_lines = detail_lines[:2]

    title_lh = round(title_font.size * 1.24)
    detail_lh = 32
    block_h = (
        (eyebrow_font.size + 22 if eyebrow else 0)
        + title_lh * len(title_lines)
        + (16 + detail_lh * len(detail_lines) if detail_lines else 0)
    )
    # Center the text block between the logo and the footer
    top, bottom = PAD + 84, CARD_H - PAD - 52
    y = top + max(0, (bottom - top - block_h) // 2)

    if eyebrow:
        eyebrow_text = eyebrow.upper()
        if _tracked_width(eyebrow_text, eyebrow_font, 2.2) > width:
            eyebrow_text = _ellipsize(eyebrow_text, eyebrow_font, width - 40)
        _draw_tracked(draw, (left, y), eyebrow_text, eyebrow_font, GOLD, 2.2)
        y += eyebrow_font.size + 22
    for line in title_lines:
        draw.text((left, y), line, font=title_font, fill=CREAM)
        y += title_lh
    if detail_lines:
        y += 16
        for line in detail_lines:
            draw.text((left, y), line, font=detail_font, fill=MUTED)
            y += detail_lh

    # Footer: hairline, domain, call to action
    fy = CARD_H - PAD - 24
    draw.line([(left, fy - 22), (CARD_W - PAD, fy - 22)], fill=RULE, width=2)
    footer_font = _font("Inter", "Medium", 20)
    draw.text((left, fy), footer, font=footer_font, fill=FOOTER)
    cta = "Request a quote"
    cta_font = _font("Inter", "SemiBold", 20)
    draw.text((CARD_W - PAD - cta_font.getlength(cta), fy), cta, font=cta_font, fill=GOLD)


def _place_products(card: Image.Image, images: list[Image.Image], x0: int, x1: int) -> None:
    """Up to three trimmed product shots, bottom-aligned, centered in the white panel."""
    images = [_trim_white(img) for img in images[:3]]
    pad_x, pad_y = 44, 52
    gap = 20
    slot_w = (x1 - x0 - 2 * pad_x - gap * (len(images) - 1)) // len(images)
    slot_h = CARD_H - 2 * pad_y
    fitted = [_contain(img, slot_w, slot_h) for img in images]
    tallest = max(img.height for img in fitted)
    floor = (CARD_H + tallest) // 2  # shared floor line, group centered vertically
    for i, img in enumerate(fitted):
        slot_x = x0 + pad_x + i * (slot_w + gap)
        card.paste(img, (slot_x + (slot_w - img.width) // 2, floor - img.height))


def _encode(card: Image.Image) -> bytes:
    out = io.BytesIO()
    card.save(out, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
    return out.getvalue()


def render_product_card(
    images: list[Image.Image],
    eyebrow: str,
    title: str,
    details: list[str],
    footer: str,
) -> bytes:
    """Product photo(s) on white + brand panel. Without a photo the brand panel fills the card."""
    card = Image.new("RGB", (CARD_W, CARD_H), WHITE)
    draw = ImageDraw.Draw(card)
    if images:
        _place_products(card, images, 0, SPLIT_X)
        draw.rectangle([SPLIT_X, 0, CARD_W, CARD_H], fill=COAL)
        _brand_text(card, SPLIT_X, eyebrow, title, details, footer)
    else:
        draw.rectangle([0, 0, CARD_W, CARD_H], fill=COAL)
        draw.rectangle([0, 0, 10, CARD_H], fill=GOLD)
        _brand_text(card, 40, eyebrow, title, details, footer)
    return _encode(card)


def render_photo_card(
    photo: Optional[Image.Image],
    eyebrow: str,
    title: str,
    details: list[str],
    footer: str,
) -> bytes:
    """
    Installation photo across the card, darkened toward the text column so the
    copy stays legible on any photo.
    """
    if photo is None:
        return render_product_card([], eyebrow, title, details, footer)
    card = ImageOps.fit(photo, (CARD_W, CARD_H), Image.LANCZOS, centering=(0.35, 0.5)).convert("RGBA")
    ramp = Image.new("L", (CARD_W, 1))
    start, end = int(CARD_W * 0.28), int(CARD_W * 0.56)
    for x in range(CARD_W):
        t = 0.0 if x < start else min(1.0, (x - start) / (end - start))
        ramp.putpixel((x, 0), int(244 * t))
    shade = Image.new("RGBA", (CARD_W, CARD_H), COAL + (0,))
    shade.putalpha(ramp.resize((CARD_W, CARD_H)))
    card = Image.alpha_composite(card, shade).convert("RGB")
    _brand_text(card, SPLIT_X, eyebrow, title, details, footer)
    return _encode(card)


def card_key(kind: str, payload: dict) -> str:
    """Short content hash of everything that affects a card's pixels."""
    raw = json.dumps({"v": TEMPLATE_VERSION, "kind": kind, **payload}, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()[:12]
