"""
Media Manager Service

Backs the admin Media Library page: every uploaded image and document in one
place. Builds on media_library_service / document_library_service (file
listing and the scan of which records use each file) and adds:

  - details: where a file is used (record fields, plus records that only
    mention it inside free text), image dimensions, earlier versions
  - detach: take a file off one, some or all of the records using it
  - replace: store a new file (an upload or the image editor's output), point
    every record at it and keep the old file as a version (models/media.py)
  - restore / delete versions, delete files (to the upload trash while the
    Time Machine is on)
  - background removal for the image editor

Record changes go through the ORM in the request's session, so the audit log
and Time Machine record them like any other admin edit. Callers commit.
"""

import importlib.util
import io
import json
import logging
import threading
from pathlib import Path

import numpy as np
from PIL import Image
from sqlalchemy import JSON, String, Text, cast, delete, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from backend.database.base import Base
from backend.models.media import MediaVersion
from backend.services import document_library_service, media_library_service, media_service
from backend.services.media_library_service import Usage, _LABEL_COLUMNS, _row_label, _type_label

logger = logging.getLogger(__name__)

KINDS = ("image", "document")

# Rows that exist only to hold one image: detaching the image deletes the row
_DELETE_ROW_ON_DETACH = frozenset({"ProductImage"})

# Tables whose text mentions an old URL without using it (logs, history, AI
# working state, the version index itself)
_NOT_MENTIONS = frozenset({
    "admin_audit_logs", "admin_sessions", "history_change_sets", "history_entries",
    "analytics_events", "ai_chat_sessions", "ai_chat_messages", "ai_memory",
    "ai_uploaded_files", "ai_proposed_edits", "ai_training_documents", "media_versions",
})


class MediaError(Exception):
    """A request the media library refuses; `status` is the HTTP status to answer with."""

    def __init__(self, message: str, status: int = 409):
        super().__init__(message)
        self.message = message
        self.status = status


# ---------------------------------------------------------------------------
# Keys and paths
# ---------------------------------------------------------------------------

def library_key(kind: str, url: str) -> str | None:
    """The form the library lists a file under (uploads URLs collapse to their path)."""
    if kind == "image":
        return media_library_service.library_key(url, True)
    return document_library_service.library_key(url)


def resolve_path(kind: str, url: str, upload_base: Path) -> Path | None:
    """The uploaded file behind `url`, or None when it isn't one of ours."""
    if kind == "image":
        return media_service.resolve_uploaded_image_path(url, upload_base)
    return document_library_service.resolve_document_path(url, upload_base)


def folder_of(kind: str, url: str) -> str:
    """Upload subfolder of an uploads URL ('' for the root or anything else)."""
    prefix = "/uploads/images/" if kind == "image" else "/uploads/documents/"
    key = library_key(kind, url) or ""
    if not key.startswith(prefix):
        return ""
    parts = key[len(prefix):].split("/")
    return parts[0] if len(parts) > 1 else ""


def _models() -> dict[str, type]:
    return {m.class_.__name__: m.class_ for m in Base.registry.mappers}


async def _usages(db: AsyncSession, kind: str) -> dict[str, list[Usage]]:
    if kind == "image":
        return await media_library_service.find_usages(db)
    usages, _ = await document_library_service.find_usages(db)
    return usages


def _key_fn(kind: str, cls: type, column: str):
    """library_key for a value stored in cls.column, as the usage scan reads it."""
    if kind == "image":
        image_named = bool(media_library_service._IMAGE_COLUMN_RE.search(column))
        return lambda v: media_library_service.library_key(v, image_named)
    return document_library_service.library_key


# ---------------------------------------------------------------------------
# Versions
# ---------------------------------------------------------------------------

async def version_index(db: AsyncSession, kind: str) -> tuple[dict[str, int], set[str]]:
    """(number of earlier versions per current URL, every earlier-version URL)."""
    rows = (await db.execute(
        select(MediaVersion.url, MediaVersion.version_url).where(MediaVersion.kind == kind)
    )).all()
    counts: dict[str, int] = {}
    for url, _ in rows:
        counts[url] = counts.get(url, 0) + 1
    return counts, {v for _, v in rows}


def _file_facts(kind: str, url: str, upload_base: Path) -> dict:
    path = resolve_path(kind, url, upload_base)
    if path is None:
        return {"on_disk": False, "size": 0}
    try:
        stat = path.stat()
    except OSError:
        return {"on_disk": False, "size": 0}
    return {"on_disk": True, "size": stat.st_size, "modified": stat.st_mtime}


async def list_versions(db: AsyncSession, kind: str, url: str, upload_base: Path) -> list[dict]:
    from backend.models.company import AdminUser

    key = library_key(kind, url) or url
    rows = (await db.execute(
        select(MediaVersion).where(MediaVersion.kind == kind, MediaVersion.url == key)
        .order_by(MediaVersion.created_at.desc(), MediaVersion.id.desc())
    )).scalars().all()
    admin_ids = {r.admin_id for r in rows if r.admin_id}
    names = {}
    if admin_ids:
        names = dict((await db.execute(
            select(AdminUser.id, AdminUser.username).where(AdminUser.id.in_(admin_ids))
        )).all())
    out = []
    for r in rows:
        facts = await run_in_threadpool(_file_facts, kind, r.version_url, upload_base)
        out.append({
            "id": r.id,
            "url": r.version_url,
            "thumbnail_url": media_library_service._thumbnail(r.version_url) if kind == "image" else None,
            "filename": r.version_url.rsplit("/", 1)[-1],
            "action": r.action,
            "note": r.note,
            "admin": names.get(r.admin_id),
            "created_at": r.created_at.isoformat() if r.created_at else None,
            **facts,
        })
    return out


# ---------------------------------------------------------------------------
# Free-text mentions
# ---------------------------------------------------------------------------

def _text_columns(cls: type) -> list[str]:
    return [
        c.key for c in cls.__mapper__.columns
        if isinstance(c.type, (String, Text, JSON)) and not getattr(c.type, "enums", None)
    ]


async def find_mentions(db: AsyncSession, key: str, exclude: set[tuple[str, int]] = frozenset()) -> list[Usage]:
    """
    Records whose text (rich text, notes, JSON) contains an uploads path
    without the usage scan counting it as a field reference, e.g. an <img>
    inside page HTML. `exclude`: (model, id) pairs already listed as usages.
    """
    if not key.startswith("/uploads/"):
        return []
    needle = key.lstrip("/")
    escaped = needle.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    pattern = f"%{escaped}%"
    found: list[Usage] = []
    for cls in _models().values():
        table = getattr(cls, "__table__", None)
        if table is None or table.name in _NOT_MENTIONS or "id" not in table.columns:
            continue
        text_cols = _text_columns(cls)
        if not text_cols:
            continue
        label_cols = [c for c in ("model_number", *_LABEL_COLUMNS) if c in table.columns and c not in text_cols]
        try:
            result = await db.execute(
                select(cls.id, *(getattr(cls, c) for c in label_cols), *(getattr(cls, c) for c in text_cols))
                .where(or_(*(cast(getattr(cls, c), Text).like(pattern, escape="\\") for c in text_cols)))
                .limit(50)
            )
        except Exception as exc:  # a table missing in this environment
            logger.warning(f"Mention scan skipped {cls.__name__}: {exc}")
            await db.rollback()
            continue
        for row in result.mappings():
            if (cls.__name__, row["id"]) in exclude:
                continue
            fields = tuple(
                c for c in text_cols
                if row.get(c) is not None and needle in (row[c] if isinstance(row[c], str) else json.dumps(row[c]))
            )
            found.append(Usage(
                type=_type_label(cls.__name__), id=row["id"], label=_row_label(cls.__name__, dict(row)),
                model=cls.__name__, fields=fields,
            ))
    return found


# ---------------------------------------------------------------------------
# Rewriting references
# ---------------------------------------------------------------------------

def _transform(value, matches, replacement, remove: bool, json_column: bool):
    """
    (new value, changed) with every string `matches` accepts replaced by
    `replacement`, or removed: dropped from lists (a list item that is an
    object holding the reference, like {"url": ..., "alt": ...}, goes with
    it) and set to None elsewhere.
    """
    if isinstance(value, str):
        if matches(value):
            return (None if remove else replacement), True
        # Older rows hold JSON encoded a second time inside a JSON column
        if json_column and value.lstrip()[:1] in ("[", "{"):
            try:
                decoded = json.loads(value)
            except ValueError:
                return value, False
            new, changed = _transform(decoded, matches, replacement, remove, False)
            return (new if changed else value), changed
        return value, False
    if isinstance(value, list):
        out, changed = [], False
        for item in value:
            if remove and isinstance(item, str) and matches(item):
                changed = True
                continue
            if remove and isinstance(item, dict) and any(isinstance(v, str) and matches(v) for v in item.values()):
                changed = True
                continue
            new, item_changed = _transform(item, matches, replacement, remove, False)
            out.append(new)
            changed = changed or item_changed
        return out, changed
    if isinstance(value, dict):
        out, changed = {}, False
        for k, v in value.items():
            new, item_changed = _transform(v, matches, replacement, remove, False)
            out[k] = new
            changed = changed or item_changed
        return out, changed
    return value, False


def _replace_text(value, old: str, new: str):
    """(value with every occurrence of `old` inside its strings replaced, changed)."""
    if isinstance(value, str):
        return (value.replace(old, new), True) if old in value else (value, False)
    if isinstance(value, list):
        pairs = [_replace_text(v, old, new) for v in value]
        return [p[0] for p in pairs], any(p[1] for p in pairs)
    if isinstance(value, dict):
        pairs = {k: _replace_text(v, old, new) for k, v in value.items()}
        return {k: p[0] for k, p in pairs.items()}, any(p[1] for p in pairs.values())
    return value, False


async def rewrite_references(
    db: AsyncSession,
    kind: str,
    url: str,
    *,
    replacement: str | None = None,
    remove: bool = False,
    only: set[tuple[str, int]] | None = None,
) -> list[dict]:
    """
    Point every record field that uses `url` at `replacement`, or take the
    file off those records (`remove`). `only` limits it to (model, id) pairs.
    Returns the records changed. Raises MediaError when a record can't lose
    the file (a required field), before anything is changed.
    """
    key = library_key(kind, url)
    if not key:
        raise MediaError("Not a media URL", 400)
    models = _models()
    usages = [
        u for u in (await _usages(db, kind)).get(key, [])
        if only is None or (u.model, u.id) in only
    ]

    plan = []
    for u in usages:
        cls = models.get(u.model)
        if cls is None:
            continue
        obj = await db.get(cls, u.id)
        if obj is None:
            continue
        delete_row = False
        updates = {}
        for field in u.fields:
            column = cls.__mapper__.columns[field]
            is_json = isinstance(column.type, JSON)
            key_fn = _key_fn(kind, cls, field)
            new, changed = _transform(
                getattr(obj, field), lambda s, f=key_fn: f(s) == key, replacement, remove, is_json,
            )
            if not changed:
                continue
            if new is None and not column.nullable:
                if u.model in _DELETE_ROW_ON_DETACH:
                    delete_row = True
                    break
                raise MediaError(f"{u.type} {u.label}: {field.replace('_', ' ')} is required, so it can't be removed. Replace the file instead.")
            updates[field] = new
        if delete_row or updates:
            plan.append((u, obj, delete_row, updates))

    touched = []
    for u, obj, delete_row, updates in plan:
        if delete_row:
            await db.delete(obj)
        else:
            for field, value in updates.items():
                setattr(obj, field, value)
        touched.append({**u.as_dict(), "deleted": delete_row})
    await db.flush()
    return touched


async def _rewrite_mentions(db: AsyncSession, old_key: str, new_key: str, exclude: set[tuple[str, int]]) -> list[dict]:
    """Swap an uploads path inside free text (see find_mentions)."""
    models = _models()
    touched = []
    for m in await find_mentions(db, old_key, exclude):
        obj = await db.get(models[m.model], m.id)
        if obj is None:
            continue
        changed_any = False
        for field in m.fields:
            new, changed = _replace_text(getattr(obj, field), old_key.lstrip("/"), new_key.lstrip("/"))
            if changed:
                setattr(obj, field, new)
                changed_any = True
        if changed_any:
            touched.append(m.as_dict())
    await db.flush()
    return touched


def touches_site_content(touched: list[dict]) -> bool:
    """True when a changed record is CMS content, so contentData.json needs re-exporting."""
    models = _models()
    return any(
        getattr(models.get(t["model"]), "__module__", "").startswith(("backend.models.content", "backend.models.legal"))
        for t in touched
    )


# ---------------------------------------------------------------------------
# Details, replace, restore, delete
# ---------------------------------------------------------------------------

def image_info(path: Path) -> dict | None:
    """Pixel facts for an image file (None for SVG / unreadable files)."""
    try:
        with Image.open(path) as img:
            return {
                "width": img.width,
                "height": img.height,
                "format": img.format,
                "has_alpha": img.mode in ("RGBA", "LA", "PA") or "transparency" in img.info,
                "frames": getattr(img, "n_frames", 1),
            }
    except Exception:
        return None


async def details(db: AsyncSession, kind: str, url: str, upload_base: Path) -> dict:
    key = library_key(kind, url)
    if not key:
        raise MediaError("Not a media URL", 400)
    used_by = (await _usages(db, kind)).get(key, [])
    mentions = await find_mentions(db, key, {(u.model, u.id) for u in used_by})
    path = resolve_path(kind, key, upload_base)
    facts = await run_in_threadpool(_file_facts, kind, key, upload_base)
    info = None
    if kind == "image" and facts["on_disk"] and path is not None:
        info = await run_in_threadpool(image_info, path)
    version_of = (await db.execute(
        select(MediaVersion.url).where(MediaVersion.version_url == key)
    )).scalar_one_or_none()
    renditions = media_service.rendition_urls(key) if kind == "image" else None
    return {
        "url": key,
        "kind": kind,
        "filename": key.rsplit("/", 1)[-1],
        "folder": folder_of(kind, key),
        "thumbnail_url": media_library_service._thumbnail(key) if kind == "image" else None,
        "renditions": renditions if renditions and renditions.get("sizes") else None,
        "info": info,
        "used_by": [u.as_dict() for u in used_by],
        "mentions": [m.as_dict() for m in mentions],
        "versions": await list_versions(db, kind, key, upload_base),
        # Set when this file is itself an earlier version (still used somewhere)
        "version_of": version_of,
        **facts,
    }


async def replace(
    db: AsyncSession,
    kind: str,
    old_url: str,
    new_url: str,
    *,
    action: str = "replaced",
    note: str | None = None,
    admin_id: int | None = None,
) -> list[dict]:
    """
    Make `new_url` the current file in place of `old_url`: every record
    using the old file now uses the new one, and the old file becomes the
    newest earlier version. Returns the records changed.
    """
    old_key = library_key(kind, old_url)
    new_key = library_key(kind, new_url)
    if not old_key or not new_key:
        raise MediaError("Not a media URL", 400)
    if old_key == new_key:
        raise MediaError("The new file is the same as the current one", 400)

    touched = await rewrite_references(db, kind, old_key, replacement=new_key)
    if new_key.startswith("/uploads/"):
        touched += await _rewrite_mentions(db, old_key, new_key, {(t["model"], t["id"]) for t in touched})

    # Earlier versions follow the file forward; the new file stops being a version
    await db.execute(delete(MediaVersion).where(MediaVersion.version_url.in_((old_key, new_key))))
    await db.execute(
        update(MediaVersion).where(MediaVersion.kind == kind, MediaVersion.url == old_key).values(url=new_key)
    )
    db.add(MediaVersion(kind=kind, url=new_key, version_url=old_key, action=action, note=(note or None) and note[:255], admin_id=admin_id))
    await db.flush()
    return touched


async def restore_version(db: AsyncSession, version_id: int, upload_base: Path, admin_id: int | None = None) -> tuple[str, list[dict]]:
    """Make an earlier version current again. Returns (its URL, records changed)."""
    version = await db.get(MediaVersion, version_id)
    if version is None:
        raise MediaError("Version not found", 404)
    path = resolve_path(version.kind, version.version_url, upload_base)
    if version.version_url.startswith("/uploads/") and (path is None or not path.is_file()):
        raise MediaError("That version's file is no longer on the server")
    kind, current, target = version.kind, version.url, version.version_url
    if kind == "image" and path is not None:
        # Renditions may have been cleaned up while it was an old version
        await run_in_threadpool(_ensure_renditions, path)
    touched = await replace(db, kind, current, target, action="restored", admin_id=admin_id)
    return target, touched


def _ensure_renditions(path: Path) -> None:
    if path.suffix.lower() in media_service.TRANSFORMABLE_EXTENSIONS:
        try:
            media_service.write_variants(path)
        except Exception as exc:
            logger.warning(f"Rendition refresh failed for {path.name}: {exc}")


async def _refuse_if_used(db: AsyncSession, kind: str, key: str, what: str) -> None:
    used_by = (await _usages(db, kind)).get(key, [])
    mentions = await find_mentions(db, key, {(u.model, u.id) for u in used_by})
    if used_by or mentions:
        labels = ", ".join(f"{u.type} {u.label}" for u in [*used_by, *mentions][:5])
        raise MediaError(f"{what} is still used by: {labels}")


async def delete_version(db: AsyncSession, version_id: int, upload_base: Path) -> str:
    version = await db.get(MediaVersion, version_id)
    if version is None:
        raise MediaError("Version not found", 404)
    await _refuse_if_used(db, version.kind, version.version_url, "This version")
    path = resolve_path(version.kind, version.version_url, upload_base)
    url = version.version_url
    await db.delete(version)
    await db.flush()
    if path is not None and path.is_file():
        await run_in_threadpool(media_service.delete_image_files, path, upload_base)
    return url


async def delete_file(db: AsyncSession, kind: str, url: str, upload_base: Path, *, detach: bool = False) -> dict:
    """
    Delete a file and its earlier versions. With `detach`, first take it off
    every record using it; otherwise refuse while anything uses it. Files go
    to the upload trash when the Time Machine is on.
    """
    key = library_key(kind, url)
    if not key:
        raise MediaError("Not a media URL", 400)
    used_by = (await _usages(db, kind)).get(key, [])
    mentions = await find_mentions(db, key, {(u.model, u.id) for u in used_by})
    if mentions:
        labels = ", ".join(f"{m.type} {m.label}" for m in mentions[:5])
        raise MediaError(f"It appears inside the text of: {labels}. Edit those first.")
    touched = []
    if used_by:
        if not detach:
            labels = ", ".join(f"{u.type} {u.label}" for u in used_by[:5])
            raise MediaError(f"Still used by: {labels}")
        touched = await rewrite_references(db, kind, key, remove=True)

    paths = []
    path = resolve_path(kind, key, upload_base)
    if path is not None:
        paths.append(path)
    elif key.startswith("/uploads/"):
        raise MediaError("Invalid file path", 400)
    versions = (await db.execute(
        select(MediaVersion).where(MediaVersion.kind == kind, MediaVersion.url == key)
    )).scalars().all()
    usages = await _usages(db, kind)
    for v in versions:
        # An old version a record still uses stays, as a file of its own
        if usages.get(v.version_url):
            continue
        vpath = resolve_path(kind, v.version_url, upload_base)
        if vpath is not None:
            paths.append(vpath)
        await db.delete(v)
    await db.execute(delete(MediaVersion).where(MediaVersion.version_url == key))
    await db.flush()

    for p in paths:
        if p.is_file():
            await run_in_threadpool(media_service.delete_image_files, p, upload_base)
    return {"url": key, "detached": touched, "files_removed": len(paths)}


# ---------------------------------------------------------------------------
# Background removal (image editor)
# ---------------------------------------------------------------------------

AI_MODEL = "isnet-general-use"
_ai_session = None
_ai_lock = threading.Lock()


def ai_background_available() -> bool:
    """AI cut-outs need the optional `rembg` package (and its model download on first use)."""
    return importlib.util.find_spec("rembg") is not None


def _png(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=False, compress_level=6)
    return buf.getvalue()


def remove_background(content: bytes, method: str) -> bytes:
    """
    PNG with the background made transparent. `white`: the tuned white-backdrop
    trace used for catalog PDFs (keeps white parts inside the product); `ai`:
    rembg segmentation for any backdrop. Blocking: run in a thread.
    """
    from backend.services.catalog_pdf.images import remove_white_background

    with Image.open(io.BytesIO(content)) as src:
        src.load()
        img = media_service._to_srgb(src)
    if method == "white":
        if img.mode == "RGBA":
            # Trace the backdrop on the visible pixels, keep existing transparency
            alpha = img.getchannel("A")
            flat = Image.new("RGB", img.size, (255, 255, 255))
            flat.paste(img, mask=alpha)
            out = remove_white_background(flat)
            if out is flat:
                raise MediaError("No white background found around the edges", 422)
            out.putalpha(Image.fromarray(np.minimum(np.asarray(out.getchannel("A")), np.asarray(alpha))))
            return _png(out)
        out = remove_white_background(img)
        if out is img:
            raise MediaError("No white background found around the edges", 422)
        return _png(out)
    if method == "ai":
        if not ai_background_available():
            raise MediaError("AI background removal isn't installed on this server", 501)
        global _ai_session
        from rembg import new_session, remove

        with _ai_lock:
            if _ai_session is None:
                _ai_session = new_session(AI_MODEL)
            out = remove(img.convert("RGB") if img.mode not in ("RGB", "RGBA") else img, session=_ai_session)
        return _png(out)
    raise MediaError("Unknown method", 400)
