"""
Document Library Service

Backs the admin document picker overlay, the document counterpart of
media_library_service: lists every file under /uploads/documents plus every
document a catalog/content record points at, and works out which records
use each one, so admins can reuse an uploaded PDF instead of re-uploading it
and search documents by the product / family / catalog that uses them.

Quote models are deliberately not scanned: quote PDFs and attachments are
customer files and must never be offered for reuse on public records.
"""

import logging
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlsplit

from sqlalchemy import String, Text, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from backend.database.base import Base
from backend.services.media_library_service import _LABEL_COLUMNS, Usage, _row_label, _type_label, sort_files, summarize

logger = logging.getLogger(__name__)

# String columns whose name says they hold a document URL.
_DOCUMENT_COLUMN_RE = re.compile(r"(pdf|file_url|document_url|spec_sheet|drawing_url|cad_file)", re.I)

# Only public catalog/content records; see module docstring.
_SCAN_MODULES = ("backend.models.chair", "backend.models.content")

# Groups for the type filter: extension -> kind
KINDS = {
    ".pdf": "pdf",
    ".doc": "word",
    ".docx": "word",
    ".zip": "zip",
    ".dwg": "cad",
    ".dxf": "cad",
    ".skp": "cad",
    ".rfa": "cad",
    ".xls": "spreadsheet",
    ".xlsx": "spreadsheet",
    ".csv": "spreadsheet",
}


def kind_of(filename: str) -> str:
    return KINDS.get(Path(filename).suffix.lower(), "other")


def normalize_url(url: str) -> str | None:
    """Reduce a document URL to its '/uploads/documents/...' path, or None if it isn't one."""
    if not url or not isinstance(url, str):
        return None
    try:
        path = urlsplit(url.strip()).path
    except ValueError:
        return None
    if path.startswith("uploads/"):
        path = "/" + path
    if not path.startswith("/uploads/documents/"):
        return None
    return path


def library_key(value) -> str | None:
    """
    Library key for a document reference stored on a record: an uploaded
    '/uploads/documents/...' path (absolute URLs on any host collapse to it so
    they match the file on disk), or any other site path / external URL as-is.
    """
    if not isinstance(value, str):
        return None
    raw = value.strip()
    if not raw or len(raw) > 1000 or raw.startswith("data:"):
        return None
    uploads = normalize_url(raw)
    if uploads:
        return uploads
    if not raw.startswith(("/", "http://", "https://", "//")):
        return None
    return raw


def _scan_targets():
    """(class, label columns, document columns, has thumbnail_url) for every catalog/content model with document columns."""
    targets = []
    for mapper in Base.registry.mappers:
        cls = mapper.class_
        if not cls.__module__.startswith(_SCAN_MODULES):
            continue
        cols = {c.key: c for c in mapper.columns}
        if "id" not in cols:
            continue
        doc_cols = [
            key for key, col in cols.items()
            if isinstance(col.type, (String, Text)) and _DOCUMENT_COLUMN_RE.search(key)
        ]
        if not doc_cols:
            continue
        label_cols = [c for c in ("model_number", *_LABEL_COLUMNS) if c in cols and c not in doc_cols]
        targets.append((cls, label_cols, doc_cols, "thumbnail_url" in cols))
    return targets


async def find_usages(db: AsyncSession) -> tuple[dict[str, list[Usage]], dict[str, str]]:
    """
    Map each document reference (see library_key) to the records that use it,
    plus a cover image per document where a using record has one (catalogs).
    """
    usages: dict[str, list[Usage]] = {}
    covers: dict[str, str] = {}
    for cls, label_cols, doc_cols, has_thumb in _scan_targets():
        columns = [cls.id, *(getattr(cls, c) for c in label_cols), *(getattr(cls, c) for c in doc_cols)]
        if has_thumb:
            columns.append(cls.thumbnail_url)
        try:
            result = await db.execute(select(*columns))
        except Exception as exc:  # a table missing in this environment shouldn't break the picker
            logger.warning(f"Document usage scan skipped {cls.__name__}: {exc}")
            await db.rollback()
            continue
        type_label = _type_label(cls.__name__)
        for row in result.mappings():
            fields_by_key: dict[str, list[str]] = {}
            for c in doc_cols:
                k = library_key(row.get(c))
                if k:
                    fields_by_key.setdefault(k, []).append(c)
            if not fields_by_key:
                continue
            label = _row_label(cls.__name__, dict(row))
            for k, fields in fields_by_key.items():
                usages.setdefault(k, []).append(Usage(
                    type=type_label, id=row["id"], label=label, model=cls.__name__, fields=tuple(fields),
                ))
                if has_thumb and row.get("thumbnail_url") and k not in covers:
                    covers[k] = row["thumbnail_url"]
    return usages, covers


@dataclass
class DocumentFile:
    url: str
    folder: str
    filename: str
    size: int
    modified: float | None
    used_by: list[Usage] = field(default_factory=list)
    on_disk: bool = True


def scan_files(upload_base: Path) -> list[DocumentFile]:
    """Every file under upload_base/documents, newest first."""
    root = upload_base / "documents"
    if not root.is_dir():
        return []
    root_resolved = root.resolve()
    files: list[DocumentFile] = []
    for dirpath, dirnames, filenames in os.walk(root_resolved):
        dirnames[:] = [d for d in dirnames if not d.startswith(".")]
        for name in filenames:
            if name.startswith("."):
                continue
            path = Path(dirpath) / name
            try:
                stat = path.stat()
            except OSError:
                continue
            rel = path.relative_to(root_resolved)
            files.append(DocumentFile(
                url=f"/uploads/documents/{rel.as_posix()}",
                folder=rel.parts[0] if len(rel.parts) > 1 else "",
                filename=name,
                size=stat.st_size,
                modified=stat.st_mtime,
            ))
    files.sort(key=lambda f: f.modified, reverse=True)
    return files


def resolve_document_path(raw_url: str, upload_base: Path) -> Path | None:
    """Map a document URL to its file under upload_base/documents, or None (traversal, other folders)."""
    path = normalize_url(raw_url or "")
    if not path:
        return None
    root = (upload_base / "documents").resolve()
    try:
        candidate = (upload_base / path.removeprefix("/uploads/")).resolve()
    except (OSError, ValueError):
        return None
    if candidate == root or not candidate.is_relative_to(root):
        return None
    return candidate


def _referenced_only(key: str) -> DocumentFile:
    """Library entry for a document a record uses that isn't in the uploads folder."""
    parts = urlsplit(key)
    segments = [p for p in parts.path.split("/") if p]
    if parts.netloc:
        folder = parts.netloc
    else:
        folder = segments[0] if len(segments) > 1 else ""
    return DocumentFile(
        url=key, folder=folder, filename=segments[-1] if segments else key,
        size=0, modified=None, on_disk=False,
    )


def _matches(doc: DocumentFile, tokens: list[str]) -> bool:
    haystack = " ".join([
        doc.url,
        doc.filename,
        doc.folder,
        *(f"{u.type} {u.label}" for u in doc.used_by),
    ]).lower()
    return all(t in haystack for t in tokens)


async def list_documents(
    db: AsyncSession,
    upload_base: Path,
    *,
    q: str = "",
    folder: str = "",
    kind: str = "",
    usage: str = "all",
    used_by_type: str = "",
    page: int = 1,
    page_size: int = 60,
    sort: str = "newest",
    versions: dict[str, int] | None = None,
    hidden: set[str] | frozenset = frozenset(),
) -> dict:
    """`versions` / `hidden`: as for media_library_service.list_images."""
    files = await run_in_threadpool(scan_files, upload_base)
    usages, covers = await find_usages(db)
    on_disk = {f.url for f in files}
    for f in files:
        f.used_by = usages.get(f.url, [])
    # Every document a record uses belongs in the library, wherever the file lives
    referenced = [_referenced_only(k) for k in usages if k not in on_disk]
    for f in referenced:
        f.used_by = usages[f.url]
    referenced.sort(key=lambda f: (f.folder, f.filename.lower()))
    docs = [f for f in files + referenced if f.used_by or f.url not in hidden]
    versions = versions or {}

    folders: dict[str, int] = {}
    types: dict[str, int] = {}
    kinds: dict[str, int] = {}
    for f in docs:
        folders[f.folder] = folders.get(f.folder, 0) + 1
        k = kind_of(f.filename)
        kinds[k] = kinds.get(k, 0) + 1
        for t in {u.type for u in f.used_by}:
            types[t] = types.get(t, 0) + 1

    tokens = [t for t in (q or "").lower().split() if t]
    filtered = [
        f for f in docs
        if (not folder or f.folder == folder)
        and (not kind or kind_of(f.filename) == kind)
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
                "folder": f.folder,
                "filename": f.filename,
                "kind": kind_of(f.filename),
                "size": f.size,
                "modified": f.modified,
                "on_disk": f.on_disk,
                "cover_url": covers.get(f.url),
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
        "kinds": [{"name": k, "count": v} for k, v in sorted(kinds.items())],
        "summary": summarize(docs),
    }
