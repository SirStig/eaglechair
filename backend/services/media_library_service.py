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

_LABEL_COLUMNS = ("name", "title", "label", "question", "company_name", "key", "section_key", "sku", "slug")

_TYPE_LABELS = {
    "Chair": "Product",
    "ProductVariation": "Variation",
    "ProductFamily": "Family",
    "ProductSubcategory": "Subcategory",
    "ProductImage": "Product image",
}


_IMAGE_EXT_RE = re.compile(r"\.(jpe?g|png|gif|webp|svg|tiff?|bmp|avif)$", re.I)


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


def library_key(value: str, image_column: bool) -> str | None:
    """
    Library key for an image reference stored on a record, in any form the
    site has used: '/uploads/images/...' (relative, or absolute on any host,
    which collapses to the relative path so it matches the file on disk),
    other site paths like '/images/...', and external URLs. Strings in
    image-named columns count when they look like a path/URL; elsewhere (JSON
    blobs) they also need an image file extension.
    """
    if not isinstance(value, str):
        return None
    raw = value.strip()
    if not raw or len(raw) > 1000 or raw.startswith("data:"):
        return None
    uploads = normalize_url(raw)
    if uploads:
        return uploads
    if not (raw.startswith(("/", "http://", "https://", "//")) or raw.startswith(("images/", "uploads/"))):
        return None
    try:
        path = urlsplit(raw).path
    except ValueError:
        return None
    if path.startswith("/uploads/documents/") or path.startswith("uploads/documents/"):
        return None
    if not _IMAGE_EXT_RE.search(path) and not image_column:
        return None
    return raw


def _collect(value, out: set, image_column: bool) -> None:
    if isinstance(value, str):
        key = library_key(value, image_column)
        if key:
            out.add(key)
    elif isinstance(value, dict):
        for v in value.values():
            _collect(v, out, image_column)
    elif isinstance(value, (list, tuple)):
        for v in value:
            _collect(v, out, image_column)


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
    """(class, label columns, image columns, image-named columns) for every model with image columns."""
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
        image_named = {c for c in image_cols if _IMAGE_COLUMN_RE.search(c)}
        if not image_cols:
            continue
        label_cols = [c for c in ("model_number", *_LABEL_COLUMNS) if c in cols and c not in image_cols]
        targets.append((cls, label_cols, image_cols, image_named))
    return targets


@dataclass
class Usage:
    type: str
    id: int
    label: str
    # ORM class name and the columns holding the reference (for detach / edit links)
    model: str = ""
    fields: tuple[str, ...] = ()

    def as_dict(self) -> dict:
        return {"type": self.type, "id": self.id, "label": self.label, "model": self.model, "fields": list(self.fields)}


async def find_usages(db: AsyncSession) -> dict[str, list[Usage]]:
    """Map each image reference (see library_key) to the records that use it."""
    usages: dict[str, list[Usage]] = {}
    for cls, label_cols, image_cols, image_named in _scan_targets():
        columns = [cls.id, *(getattr(cls, c) for c in label_cols), *(getattr(cls, c) for c in image_cols)]
        try:
            result = await db.execute(select(*columns))
        except Exception as exc:  # a table missing in this environment shouldn't break the picker
            logger.warning(f"Media usage scan skipped {cls.__name__}: {exc}")
            await db.rollback()
            continue
        type_label = _type_label(cls.__name__)
        for row in result.mappings():
            fields_by_url: dict[str, list[str]] = {}
            for c in image_cols:
                urls: set[str] = set()
                _collect(row.get(c), urls, c in image_named)
                for u in urls:
                    fields_by_url.setdefault(u, []).append(c)
            if not fields_by_url:
                continue
            label = _row_label(cls.__name__, dict(row))
            for u, fields in fields_by_url.items():
                usages.setdefault(u, []).append(Usage(
                    type=type_label, id=row["id"], label=label, model=cls.__name__, fields=tuple(fields),
                ))
    return usages


@dataclass
class ImageFile:
    url: str
    folder: str
    filename: str
    size: int
    modified: float | None
    used_by: list[Usage] = field(default_factory=list)
    on_disk: bool = True


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


def _referenced_only(key: str) -> ImageFile:
    """Library entry for an image a record uses that isn't in the uploads folder."""
    parts = urlsplit(key)
    segments = [p for p in parts.path.split("/") if p]
    if parts.netloc:
        folder = parts.netloc
    elif len(segments) >= 3 and segments[0] in ("uploads", "images"):
        folder = segments[2] if segments[0] == "uploads" else segments[1]
    else:
        folder = segments[0] if len(segments) > 1 else ""
    return ImageFile(
        url=key, folder=folder, filename=segments[-1] if segments else key,
        size=0, modified=None, on_disk=False,
    )


def _matches(image: ImageFile, tokens: list[str]) -> bool:
    haystack = " ".join([
        image.url,
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
    used_by_type: str = "",
    page: int = 1,
    page_size: int = 60,
    sort: str = "newest",
    versions: dict[str, int] | None = None,
    hidden: set[str] | frozenset = frozenset(),
) -> dict:
    """
    `versions` maps a current image URL to its number of earlier versions;
    `hidden` holds URLs of earlier versions, which stay out of the list
    unless a record still uses them (see media_manager_service).
    """
    files = await run_in_threadpool(scan_files, upload_base)
    usages = await find_usages(db)
    on_disk = {f.url for f in files}
    for f in files:
        f.used_by = usages.get(f.url, [])
    # Every image a record uses belongs in the library, wherever the file lives
    referenced = [_referenced_only(k) for k in usages if k not in on_disk]
    for f in referenced:
        f.used_by = usages[f.url]
    referenced.sort(key=lambda f: (f.folder, f.filename.lower()))
    images = [f for f in files + referenced if f.used_by or f.url not in hidden]
    versions = versions or {}

    folders: dict[str, int] = {}
    types: dict[str, int] = {}
    for f in images:
        folders[f.folder] = folders.get(f.folder, 0) + 1
        for t in {u.type for u in f.used_by}:
            types[t] = types.get(t, 0) + 1

    tokens = [t for t in (q or "").lower().split() if t]
    filtered = [
        f for f in images
        if (not folder or f.folder == folder)
        and (usage != "used" or f.used_by)
        and (usage != "unused" or not f.used_by)
        and (not used_by_type or any(u.type == used_by_type for u in f.used_by))
        and (not tokens or _matches(f, tokens))
    ]
    sort_files(filtered, sort)

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
                "on_disk": f.on_disk,
                "used_by": [u.as_dict() for u in f.used_by],
                "versions": versions.get(f.url, 0),
            }
            for f in items
        ],
        "total": len(filtered),
        "page": page,
        "page_size": page_size,
        "folders": [{"name": k, "count": v} for k, v in sorted(folders.items())],
        "types": [{"name": k, "count": v} for k, v in sorted(types.items())],
        "summary": summarize(images),
    }


SORTS = ("newest", "oldest", "name", "size", "usage")


def sort_files(files: list, sort: str) -> None:
    """Sort library entries in place; files not on disk (no date/size) go last."""
    if sort == "oldest":
        files.sort(key=lambda f: (f.modified is None, f.modified or 0))
    elif sort == "name":
        files.sort(key=lambda f: f.filename.lower())
    elif sort == "size":
        files.sort(key=lambda f: f.size, reverse=True)
    elif sort == "usage":
        files.sort(key=lambda f: len(f.used_by), reverse=True)
    else:
        files.sort(key=lambda f: (f.modified is not None, f.modified or 0), reverse=True)


def summarize(files: list) -> dict:
    """Totals for the library header (before filters)."""
    stored = [f for f in files if f.on_disk]
    return {
        "count": len(files),
        "stored": len(stored),
        "bytes": sum(f.size for f in stored),
        "unused": sum(1 for f in stored if not f.used_by),
        "linked": len(files) - len(stored),
    }
