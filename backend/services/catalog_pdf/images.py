"""
Loads uploaded product / install photos for catalog pages.

Only files under the uploads/images folder are read (no remote URLs). Product
photos are transparent cut-outs, so the transparent margin is trimmed to let
layouts fit the visible chair. Product photos shot on pure white get that
white made transparent first (the site hides it with CSS mix-blend-mode:
multiply; a PDF needs real transparency). Results are cached in memory:
previews re-render the same photos on every edit.
"""

import io
import logging
import math
import threading
from collections import OrderedDict
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np
from PIL import Image

from backend.services.media_service import _to_srgb, resolve_uploaded_image_path

logger = logging.getLogger(__name__)

PREVIEW_MAX_PX = 900
EXPORT_MAX_PX = 2400

_CACHE_SIZE = 96


@dataclass(frozen=True)
class LoadedImage:
    data: bytes  # PNG (with alpha) or JPEG
    width: int
    height: int


_cache: "OrderedDict[tuple, LoadedImage]" = OrderedDict()
_cache_lock = threading.Lock()


def _encode(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    if img.mode == "RGBA":
        img.save(buf, format="PNG", compress_level=6)
    else:
        img.save(buf, format="JPEG", quality=88)
    return buf.getvalue()


# Background removal: a pixel is "white" when its darkest channel is at least
# WHITE_LEVEL; a photo has a white background when most of its border is white.
WHITE_LEVEL = 240
WHITE_BORDER_SHARE = 0.6
# Edge pixels next to the removed background fade out between these levels
EDGE_SOFT_FROM = 190
# The connected background is traced on a copy reduced to about this size
TRACE_SIZE = 320


def _grow(region: np.ndarray, allowed: np.ndarray, max_steps: int) -> np.ndarray:
    """Expand region (4-connected) through allowed pixels until it stops."""
    for _ in range(max_steps):
        grown = region.copy()
        grown[1:] |= region[:-1]
        grown[:-1] |= region[1:]
        grown[:, 1:] |= region[:, :-1]
        grown[:, :-1] |= region[:, 1:]
        grown &= allowed
        if np.array_equal(grown, region):
            break
        region = grown
    return region


def _border(mask: np.ndarray) -> np.ndarray:
    seeds = np.zeros_like(mask)
    seeds[0], seeds[-1], seeds[:, 0], seeds[:, -1] = mask[0], mask[-1], mask[:, 0], mask[:, -1]
    return seeds


def remove_white_background(img: Image.Image) -> Image.Image:
    """
    RGBA copy of an opaque photo with its white background made transparent,
    or the image unchanged when its border isn't mostly white.

    Only white connected to the edge of the photo is removed, so white parts
    of the product itself (a white seat inside the frame) stay. Pixels along
    the cut fade with their whiteness, keeping anti-aliased edges smooth.
    """
    rgb = np.asarray(img.convert("RGB"))
    whiteness = rgb.min(axis=2)
    height, width = whiteness.shape
    edge = np.concatenate([whiteness[0], whiteness[-1], whiteness[:, 0], whiteness[:, -1]])
    if (edge >= WHITE_LEVEL).mean() < WHITE_BORDER_SHARE:
        return img
    white = whiteness >= WHITE_LEVEL

    # Trace the background on a block-minimum reduction: any dark pixel darkens
    # its block, so thin legs still wall off white areas inside the product
    factor = max(1, math.ceil(max(height, width) / TRACE_SIZE))
    padded = np.full((math.ceil(height / factor) * factor, math.ceil(width / factor) * factor), 255, dtype=whiteness.dtype)
    padded[:height, :width] = whiteness
    small = padded.reshape(padded.shape[0] // factor, factor, padded.shape[1] // factor, factor).min(axis=(1, 3))
    small_white = small >= WHITE_LEVEL
    small_bg = _grow(_border(small_white), small_white, sum(small.shape))

    # Back to full size, then close the gap the coarse blocks left at the outline
    background = np.repeat(np.repeat(small_bg, factor, axis=0), factor, axis=1)[:height, :width] & white
    background = _grow(background | _border(white), white, factor * 2 + 2)

    alpha = np.full((height, width), 255, dtype=np.uint8)
    alpha[background] = 0
    near = _grow(background, np.ones_like(background), 1) & ~background
    soft = np.clip((255 - whiteness.astype(np.int32)) * 255 // (255 - EDGE_SOFT_FROM), 0, 255).astype(np.uint8)
    alpha[near] = np.minimum(alpha[near], soft[near])
    return Image.fromarray(np.dstack([rgb, alpha]), "RGBA")


def _prepare(path: Path, max_px: int, cutout: bool) -> LoadedImage:
    with Image.open(path) as src:
        img = _to_srgb(src)  # orientation + CMYK/ICC to sRGB, as for site renditions
        has_alpha = img.mode in ("RGBA", "LA", "PA") or (img.mode == "P" and "transparency" in img.info)
        img = img.convert("RGBA" if has_alpha else "RGB")
    if cutout and not has_alpha:
        # Shrink first: the trace is per pixel, and the PDF never needs more than max_px
        img.thumbnail((max_px, max_px), Image.LANCZOS)
        img = remove_white_background(img)
        has_alpha = img.mode == "RGBA"
    if has_alpha:
        bbox = img.getchannel("A").getbbox()
        if bbox is None:
            raise ValueError("image is fully transparent")
        img = img.crop(bbox)
    img.thumbnail((max_px, max_px), Image.LANCZOS)
    return LoadedImage(_encode(img), img.width, img.height)


class ImageLoader:
    """Resolves image URLs from catalog documents to embeddable bytes."""

    def __init__(self, base_dir: Path, max_px: int = EXPORT_MAX_PX):
        self.base_dir = base_dir
        self.max_px = max_px

    def load(self, url: Optional[str], cutout: bool = True) -> Optional[LoadedImage]:
        """
        The photo at url, ready to embed. cutout: product photo, so a white
        background is removed (pass False for full-bleed install photos).
        """
        if not url:
            return None
        path = resolve_uploaded_image_path(url, self.base_dir, allow_absolute_urls=False)
        if path is None or not path.is_file():
            return None
        try:
            key = (str(path), path.stat().st_mtime_ns, self.max_px, cutout)
        except OSError:
            return None
        with _cache_lock:
            if key in _cache:
                _cache.move_to_end(key)
                return _cache[key]
        try:
            loaded = _prepare(path, self.max_px, cutout)
        except Exception:
            logger.warning("Catalog: could not load image %s", url, exc_info=True)
            return None
        with _cache_lock:
            _cache[key] = loaded
            while len(_cache) > _CACHE_SIZE:
                _cache.popitem(last=False)
        return loaded
