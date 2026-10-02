"""
Loads uploaded product / install photos for catalog pages.

Only files under the uploads/images folder are read (no remote URLs). Product
photos are transparent cut-outs, so the transparent margin is trimmed to let
layouts fit the visible chair. Results are cached in memory: previews
re-render the same photos on every edit.
"""

import io
import logging
import threading
from collections import OrderedDict
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

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


def _prepare(path: Path, max_px: int) -> LoadedImage:
    with Image.open(path) as src:
        img = _to_srgb(src)  # orientation + CMYK/ICC to sRGB, as for site renditions
        has_alpha = img.mode in ("RGBA", "LA", "PA") or (img.mode == "P" and "transparency" in img.info)
        img = img.convert("RGBA" if has_alpha else "RGB")
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

    def load(self, url: Optional[str]) -> Optional[LoadedImage]:
        if not url:
            return None
        path = resolve_uploaded_image_path(url, self.base_dir, allow_absolute_urls=False)
        if path is None or not path.is_file():
            return None
        try:
            key = (str(path), path.stat().st_mtime_ns, self.max_px)
        except OSError:
            return None
        with _cache_lock:
            if key in _cache:
                _cache.move_to_end(key)
                return _cache[key]
        try:
            loaded = _prepare(path, self.max_px)
        except Exception:
            logger.warning("Catalog: could not load image %s", url, exc_info=True)
            return None
        with _cache_lock:
            _cache[key] = loaded
            while len(_cache) > _CACHE_SIZE:
                _cache.popitem(last=False)
        return loaded
