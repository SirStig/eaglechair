"""
Media Service

Encodes uploaded raster images to WebP and writes a fixed set of responsive
width variants next to the master file, so the frontend can build a srcset
from the stored URL alone (no DB column needed):

    /uploads/images/products/foo_1712_ab12cd.webp        (master, <= 2400px)
    /uploads/images/products/foo_1712_ab12cd.w320.webp
    /uploads/images/products/foo_1712_ab12cd.w640.webp
    /uploads/images/products/foo_1712_ab12cd.w1024.webp
    /uploads/images/products/foo_1712_ab12cd.w1600.webp

Every width in VARIANT_WIDTHS is always written (a source narrower than a
width is saved at its native size under that name) so the naming rule never
404s. Keep VARIANT_WIDTHS in sync with IMAGE_VARIANT_WIDTHS in
frontend/src/utils/apiHelpers.js.
"""

import io
import logging
import re
from pathlib import Path

from PIL import Image, ImageCms, ImageOps

logger = logging.getLogger(__name__)

MAX_IMAGE_DIMENSION = 2400
VARIANT_WIDTHS = (320, 640, 1024, 1600)
WEBP_QUALITY = 82
VARIANT_QUALITY = 78

# Raster formats we re-encode. SVG is vector; GIF may be animated.
TRANSFORMABLE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".bmp"}

_VARIANT_RE = re.compile(r"\.w\d+\.webp$", re.IGNORECASE)

# Guard against decompression bombs (~ 16k x 16k)
Image.MAX_IMAGE_PIXELS = 268_000_000


def is_variant_path(path: Path | str) -> bool:
    return bool(_VARIANT_RE.search(str(path)))


def variant_path(master: Path, width: int) -> Path:
    return master.with_name(f"{master.stem}.w{width}.webp")


def variant_paths(master: Path) -> list[Path]:
    return [variant_path(master, w) for w in VARIANT_WIDTHS]


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


def encode_master(content: bytes) -> bytes:
    """Decode arbitrary raster bytes and return the WebP master (<= MAX_IMAGE_DIMENSION)."""
    with Image.open(io.BytesIO(content)) as src:
        src.load()
        img = _to_srgb(src)
    if img.width > MAX_IMAGE_DIMENSION or img.height > MAX_IMAGE_DIMENSION:
        img.thumbnail((MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION), Image.LANCZOS)
    return _encode(img, WEBP_QUALITY)


def write_variants(master: Path, source: Path | None = None, force: bool = False) -> int:
    """
    Write the responsive width variants for `master`.

    `source` is the file to read pixels from (defaults to `master`); the backfill
    uses it when the master is a legacy .jpg/.png. Returns number of files written.
    """
    source = source or master
    targets = variant_paths(master)
    if not force:
        src_mtime = source.stat().st_mtime
        targets = [t for t in targets if not t.exists() or t.stat().st_mtime < src_mtime]
    if not targets:
        return 0

    with Image.open(source) as src:
        src.load()
        img = _to_srgb(src)

    written = 0
    # Largest first so each step downsamples from a smaller image.
    for target in sorted(targets, key=lambda p: -int(p.stem.rsplit(".w", 1)[1])):
        width = int(target.stem.rsplit(".w", 1)[1])
        img = _resize_to_width(img, width)
        tmp = target.with_suffix(".tmp")
        tmp.write_bytes(_encode(img, VARIANT_QUALITY))
        tmp.replace(target)
        written += 1
    return written


def store_image(content: bytes, dest_dir: Path, base_name: str, fallback_ext: str) -> tuple[Path, int]:
    """
    Encode and persist an uploaded image plus its variants.

    Returns (path_of_master, bytes_written_for_master). Falls back to storing
    the original bytes untouched if Pillow can't decode it. Blocking: call via
    run_in_threadpool from async code.
    """
    dest_dir.mkdir(parents=True, exist_ok=True)

    if fallback_ext not in TRANSFORMABLE_EXTENSIONS:
        path = dest_dir / f"{base_name}{fallback_ext}"
        path.write_bytes(content)
        return path, len(content)

    try:
        data = encode_master(content)
    except Exception as exc:
        logger.warning(f"Image processing failed, storing original: {exc}")
        path = dest_dir / f"{base_name}{fallback_ext}"
        path.write_bytes(content)
        return path, len(content)

    path = dest_dir / f"{base_name}.webp"
    path.write_bytes(data)
    try:
        write_variants(path, force=True)
    except Exception as exc:
        # Master is usable on its own; the frontend falls back to it.
        logger.warning(f"Variant generation failed for {path.name}: {exc}")
    return path, len(data)


def delete_image_files(master: Path) -> None:
    """Delete a stored image and any variants derived from it."""
    for p in [master, *variant_paths(master)]:
        try:
            p.unlink(missing_ok=True)
        except OSError as exc:
            logger.warning(f"Could not delete {p}: {exc}")
