"""
Media Library Service

Backs the admin image picker overlay: lists every uploaded original under
/uploads/images (renditions hidden) and works out which records use each
one, so admins can reuse an existing image instead of uploading a duplicate,
and search images by the product / record that uses them.
"""

import logging
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlsplit

from sqlalchemy import JSON, String, Text, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from backend.database.base import Base
from backend.services import media_service

logger = logging.getLogger(__name__)

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".tif", ".tiff", ".bmp"}

# String columns whose name says they hold an image URL.
_IMAGE_COLUMN_RE = re.compile(r"(image|logo|thumbnail|swatch|photo|banner|background|favicon|icon_url)", re.I)

# Untyped JSON columns are only scanned on catalog/content models; other modules
# (history snapshots, analytics, AI chat) are large and never hold live usages.
_JSON_SCAN_MODULES = ("backend.models.chair", "backend.models.content", "backend.models.catalog_project")

_LABEL_COLUMNS = ("name", "title", "label", "question", "company_name", "key", "sku", "slug")

_TYPE_LABELS = {
    "Chair": "Product",
    "ProductVariation": "Variation",
    "ProductFamily": "Family",
    "ProductSubcategory": "Subcategory",
    "ProductImage": "Product image",
}


def normalize_url(url: str) -> str | None:
    """Reduce an image URL to its '/uploads/images/...' path, or None if it isn't one."""
    if not url or not isinstance(url, str):
        return None
    try:
        path = urlsplit(url.strip()).path
    except ValueError:
        return None
    if path.startswith("uploads/"):
        path = "/" + path
    if not path.startswith("/uploads/images/"):
        return None
    return path


def _collect(value, out: set) -> None:
    if isinstance(value, str):
        norm = normalize_url(value)
        if norm:
            out.add(norm)
    elif isinstance(value, dict):
        for v in value.values():
            _collect(v, out)
    elif isinstance(value, (list, tuple)):
        for v in value:
            _collect(v, out)


def _type_label(cls_name: str) -> str:
    if cls_name in _TYPE_LABELS:
        return _TYPE_LABELS[cls_name]
    return re.sub(r"(?<!^)(?=[A-Z])", " ", cls_name)


def _row_label(cls_name: str, row: dict) -> str:
    if cls_name == "Chair":
        parts = [row.get("model_number"), row.get("name")]
        return " · ".join(str(p) for p in parts if p) or f"#{row.get('id')}"
    for col in _LABEL_COLUMNS:
        if row.get(col):
            return str(row[col])
    return f"#{row.get('id')}"


def _scan_targets():
    """(mapper class, label column names, image column names) for every model with image columns."""
    targets = []
    for mapper in Base.registry.mappers:
        cls = mapper.class_
        cols = {c.key: c for c in mapper.columns}
        if "id" not in cols:
            continue
        scan_json = cls.__module__.startswith(_JSON_SCAN_MODULES)
        image_cols = []
        for key, col in cols.items():
            if isinstance(col.type, (String, Text)) and _IMAGE_COLUMN_RE.search(key):
                image_cols.append(key)
            elif isinstance(col.type, JSON) and (scan_json or _IMAGE_COLUMN_RE.search(key)):
                image_cols.append(key)
        if not image_cols:
            continue
        label_cols = [c for c in ("model_number", *_LABEL_COLUMNS) if c in cols and c not in image_cols]
        targets.append((cls, label_cols, image_cols))
    return targets


@dataclass
class Usage:
    type: str
    id: int
    label: str

    def as_dict(self) -> dict:
        return {"type": self.type, "id": self.id, "label": self.label}


async def find_usages(db: AsyncSession) -> dict[str, list[Usage]]:
    """Map each '/uploads/images/...' path to the records that reference it."""
    usages: dict[str, list[Usage]] = {}
    for cls, label_cols, image_cols in _scan_targets():
        columns = [cls.id, *(getattr(cls, c) for c in label_cols), *(getattr(cls, c) for c in image_cols)]
        try:
            result = await db.execute(select(*columns))
        except Exception as exc:  # a table missing in this environment shouldn't break the picker
            logger.warning(f"Media usage scan skipped {cls.__name__}: {exc}")
            await db.rollback()
            continue
        type_label = _type_label(cls.__name__)
        for row in result.mappings():
            urls: set[str] = set()
            for c in image_cols:
                _collect(row.get(c), urls)
            if not urls:
                continue
            usage = Usage(type=type_label, id=row["id"], label=_row_label(cls.__name__, dict(row)))
            for u in urls:
                usages.setdefault(u, []).append(usage)
    return usages


@dataclass
class ImageFile:
    url: str
    folder: str
    filename: str
    size: int
    modified: float
    used_by: list[Usage] = field(default_factory=list)


def scan_files(upload_base: Path) -> list[ImageFile]:
    """Every uploaded original under upload_base/images (renditions skipped), newest first."""
    root = upload_base / "images"
    if not root.is_dir():
        return []
    root_resolved = root.resolve()
    files: list[ImageFile] = []
    for dirpath, dirnames, filenames in os.walk(root_resolved):
        dirnames[:] = [d for d in dirnames if not d.startswith(".")]
        for name in filenames:
            if name.startswith(".") or media_service.is_variant_path(name):
                continue
            if Path(name).suffix.lower() not in IMAGE_EXTENSIONS:
                continue
            path = Path(dirpath) / name
            try:
                stat = path.stat()
            except OSError:
                continue
            rel = path.relative_to(root_resolved)
            folder = rel.parts[0] if len(rel.parts) > 1 else ""
            files.append(ImageFile(
                url=f"/uploads/images/{rel.as_posix()}",
                folder=folder,
                filename=name,
                size=stat.st_size,
                modified=stat.st_mtime,
            ))
    files.sort(key=lambda f: f.modified, reverse=True)
    return files


def _matches(image: ImageFile, tokens: list[str]) -> bool:
    haystack = " ".join([
        image.filename,
        image.folder,
        *(f"{u.type} {u.label}" for u in image.used_by),
    ]).lower()
    return all(t in haystack for t in tokens)


def _thumbnail(url: str) -> str:
    renditions = media_service.rendition_urls(url)
    sizes = (renditions or {}).get("sizes") or []
    return sizes[0]["url"] if sizes else url


async def list_images(
    db: AsyncSession,
    upload_base: Path,
    *,
    q: str = "",
    folder: str = "",
    usage: str = "all",
    page: int = 1,
    page_size: int = 60,
) -> dict:
    files = await run_in_threadpool(scan_files, upload_base)
    usages = await find_usages(db)
    for f in files:
        f.used_by = usages.get(f.url, [])

    folders: dict[str, int] = {}
    for f in files:
        folders[f.folder] = folders.get(f.folder, 0) + 1

    tokens = [t for t in (q or "").lower().split() if t]
    filtered = [
        f for f in files
        if (not folder or f.folder == folder)
        and (usage != "used" or f.used_by)
        and (usage != "unused" or not f.used_by)
        and (not tokens or _matches(f, tokens))
    ]

    page = max(page, 1)
    start = (page - 1) * page_size
    items = filtered[start:start + page_size]
    return {
        "items": [
            {
                "url": f.url,
                "thumbnail_url": _thumbnail(f.url),
                "folder": f.folder,
                "filename": f.filename,
                "size": f.size,
                "modified": f.modified,
                "used_by": [u.as_dict() for u in f.used_by],
            }
            for f in items
        ],
        "total": len(filtered),
        "page": page,
        "page_size": page_size,
        "folders": [{"name": k, "count": v} for k, v in sorted(folders.items())],
    }
