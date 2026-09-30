"""
Media Schemas - Version 1

Progressive image renditions returned next to image URL fields, so API clients
(e.g. the mobile app) don't have to rebuild rendition URLs themselves. See
backend/services/media_service.py for the files these point at.
"""

from typing import Any, Optional

from pydantic import BaseModel

from backend.services.media_service import rendition_urls


class ImageSize(BaseModel):
    """One responsive width; the file is at most `width` pixels wide."""

    width: int
    url: str


class ImageRenditions(BaseModel):
    """
    Every stored version of one image.

    Show `placeholder` first (tiny, blurred), then the smallest entry in
    `sizes` whose width covers the displayed width in pixels, and `full` only
    when shown larger than the biggest size (zoom). When the image has no
    renditions (SVG, legacy/external URL) `placeholder` and `full` are null and
    `sizes` is empty: use `original`. Fall back to `original` if a rendition
    fails to load (an older upload whose renditions were never generated).
    """

    original: str
    placeholder: Optional[str] = None
    sizes: list[ImageSize] = []
    full: Optional[str] = None


def image_renditions(url: Optional[str]) -> Optional[ImageRenditions]:
    data = rendition_urls(url)
    return ImageRenditions(**data) if data else None


def _item_url(item: Any) -> Optional[str]:
    if isinstance(item, str):
        return item
    if isinstance(item, dict):
        return item.get("url")
    return getattr(item, "url", None)


def image_renditions_list(images: Optional[list[Any]]) -> list[Optional[ImageRenditions]]:
    """Renditions for a list of URLs or {"url": ...} items, index-aligned with it."""
    return [image_renditions(_item_url(item)) for item in images or []]
