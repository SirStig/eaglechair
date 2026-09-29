"""
Media Service

Stores uploaded images at full resolution and writes a ladder of WebP
renditions next to them, so the frontend can load an image progressively
(tiny blurred preview -> size that fits the layout -> full resolution when
displayed large) using only the stored URL (no DB column needed):

    /uploads/images/products/chair_1712_ab12cd.jpg        original, untouched (full res)
    /uploads/images/products/chair_1712_ab12cd.w32.webp   blurred placeholder
    /uploads/images/products/chair_1712_ab12cd.w320.webp  \\
    ...                                                     > responsive widths (srcset)
    /uploads/images/products/chair_1712_ab12cd.w2400.webp /
    /uploads/images/products/chair_1712_ab12cd.full.webp  full resolution, WebP-compressed

Every name is always written (a source narrower than a width is saved at its
native size under that name) so the naming rule never 404s. When the original
is already WebP it doubles as the full-resolution rendition and no .full.webp
is written.

Keep the widths and naming in sync with the image helpers in
frontend/src/utils/apiHelpers.js.
"""

import io
import logging
import re
from pathlib import Path

from PIL import Image, ImageCms, ImageOps

logger = logging.getLogger(__name__)

VARIANT_WIDTHS = (320, 640, 1024, 1600, 2400)
PLACEHOLDER_WIDTH = 32
FULL_SUFFIX = ".full.webp"

VARIANT_QUALITY = 80
FULL_QUALITY = 90
PLACEHOLDER_QUALITY = 50
WEBP_MAX_DIMENSION = 16383  # hard limit of the WebP format

# Raster formats we can decode and render variants for. SVG is vector; GIF may be animated.
TRANSFORMABLE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".bmp"}
# Originals browsers can display directly; anything else is converted on upload.
WEB_SAFE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

_DERIVED_RE = re.compile(r"\.(w\d+|full)\.webp$", re.IGNORECASE)

# Guard against decompression bombs (~ 16k x 16k)
Image.MAX_IMAGE_PIXELS = 268_000_000


def is_variant_path(path: Path | str) -> bool:
    """True for any file derived from an original (width variants, placeholder, full)."""
    return bool(_DERIVED_RE.search(str(path)))


def variant_path(master: Path, width: int) -> Path:
    return master.with_name(f"{master.stem}.w{width}.webp")


def placeholder_path(master: Path) -> Path:
    return variant_path(master, PLACEHOLDER_WIDTH)


def full_path(master: Path) -> Path:
    """Full-resolution rendition; a WebP original serves as its own."""
    if master.suffix.lower() == ".webp":
        return master
    return master.with_name(f"{master.stem}{FULL_SUFFIX}")


def variant_paths(master: Path) -> list[Path]:
    """Every derived file for `master` (excluding the original itself)."""
    paths = [variant_path(master, w) for w in (PLACEHOLDER_WIDTH, *VARIANT_WIDTHS)]
    full = full_path(master)
    if full != master:
        paths.append(full)
    return paths


def _to_srgb(img: Image.Image) -> Image.Image:
    """Normalize orientation and colour space so WebP output looks right."""
    img = ImageOps.exif_transpose(img)

    icc = img.info.get("icc_profile")
    if img.mode == "CMYK":
        # CMYK scans shift badly with a naive convert(); honour the embedded profile.
        if icc:
            try:
                src = ImageCms.ImageCmsProfile(io.BytesIO(icc))
                dst = ImageCms.createProfile("sRGB")
                return ImageCms.profileToProfile(img, src, dst, outputMode="RGB")
            except Exception as exc:
                logger.debug(f"ICC transform failed, falling back to convert(): {exc}")
        return img.convert("RGB")

    if img.mode in ("P", "LA", "PA"):
        return img.convert("RGBA")
    if img.mode not in ("RGB", "RGBA"):
        return img.convert("RGB")
    return img


def _encode(img: Image.Image, quality: int) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=quality, method=4)
    return buf.getvalue()


def _resize_to_width(img: Image.Image, width: int) -> Image.Image:
    if img.width <= width:
        return img
    height = max(1, round(img.height * width / img.width))
    return img.resize((width, height), Image.LANCZOS)


def _write_atomic(target: Path, data: bytes) -> None:
    tmp = target.with_name(target.name + ".tmp")
    tmp.write_bytes(data)
    tmp.replace(target)


def _load(source: Path) -> Image.Image:
    with Image.open(source) as src:
        src.load()
        return _to_srgb(src)


def write_variants(master: Path, force: bool = False) -> int:
    """
    Write the placeholder, responsive widths and full-resolution rendition for
    `master`. Only missing or stale files are written unless `force`.
    Returns the number of files written.
    """
    targets = variant_paths(master)
    if not force:
        src_mtime = master.stat().st_mtime
        targets = [t for t in targets if not t.exists() or t.stat().st_mtime < src_mtime]
    if not targets:
        return 0

    img = _load(master)
    written = 0

    full = full_path(master)
    if full in targets:
        full_img = img
        if max(img.size) > WEBP_MAX_DIMENSION:
            full_img = img.copy()
            full_img.thumbnail((WEBP_MAX_DIMENSION, WEBP_MAX_DIMENSION), Image.LANCZOS)
        _write_atomic(full, _encode(full_img, FULL_QUALITY))
        written += 1

    # Largest first so each step downsamples from an already smaller image.
    widths = sorted((PLACEHOLDER_WIDTH, *VARIANT_WIDTHS), reverse=True)
    for width in widths:
        target = variant_path(master, width)
        img = _resize_to_width(img, width)
        if target not in targets:
            continue
        quality = PLACEHOLDER_QUALITY if width == PLACEHOLDER_WIDTH else VARIANT_QUALITY
        _write_atomic(target, _encode(img, quality))
        written += 1
    return written


def _convert_to_web_safe(content: bytes) -> tuple[bytes, str]:
    """Full-resolution conversion for originals browsers can't show (TIFF, BMP)."""
    with Image.open(io.BytesIO(content)) as src:
        src.load()
        img = _to_srgb(src)
    buf = io.BytesIO()
    if img.mode == "RGBA":
        img.save(buf, format="PNG", optimize=True)
        return buf.getvalue(), ".png"
    img.save(buf, format="JPEG", quality=95, subsampling=0, optimize=True)
    return buf.getvalue(), ".jpg"


def store_image(content: bytes, dest_dir: Path, base_name: str, ext: str) -> tuple[Path, int]:
    """
    Persist an uploaded image at full resolution plus its renditions.

    The original bytes are kept as-is when the browser can display them
    (JPEG/PNG/WebP); SVG/GIF are stored untouched without renditions.
    Returns (path_of_original, bytes_written_for_original). Blocking: call via
    run_in_threadpool from async code.
    """
    dest_dir.mkdir(parents=True, exist_ok=True)
    ext = ".jpg" if ext.lower() == ".jpeg" else ext.lower()

    if ext in TRANSFORMABLE_EXTENSIONS and ext not in WEB_SAFE_EXTENSIONS:
        try:
            content, ext = _convert_to_web_safe(content)
        except Exception as exc:
            logger.warning(f"Could not convert {ext} upload, storing original: {exc}")

    path = dest_dir / f"{base_name}{ext}"
    _write_atomic(path, content)

    if ext in TRANSFORMABLE_EXTENSIONS:
        try:
            write_variants(path, force=True)
        except Exception as exc:
            # The original is still usable; the frontend falls back to it.
            logger.warning(f"Rendition generation failed for {path.name}: {exc}")
    return path, len(content)


def encode_master(content: bytes, max_dimension: int = 2400) -> bytes:
    """Single downscaled WebP (no renditions). Used by legacy scripts."""
    with Image.open(io.BytesIO(content)) as src:
        src.load()
        img = _to_srgb(src)
    if img.width > max_dimension or img.height > max_dimension:
        img.thumbnail((max_dimension, max_dimension), Image.LANCZOS)
    return _encode(img, FULL_QUALITY)


def delete_image_files(master: Path) -> None:
    """Delete a stored image and every rendition derived from it."""
    for p in [master, *variant_paths(master)]:
        try:
            p.unlink(missing_ok=True)
        except OSError as exc:
            logger.warning(f"Could not delete {p}: {exc}")
