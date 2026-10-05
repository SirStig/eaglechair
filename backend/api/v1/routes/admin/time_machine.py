"""
Admin Time Machine Routes - super admins only (Permission.TIME_MACHINE)

GET  /admin/time-machine/summary                Retention, how much is kept
GET  /admin/time-machine/changes                Change sets, newest first, with filters
GET  /admin/time-machine/changes/{set_id}       One change set with every field change
GET  /admin/time-machine/records/{table}/{key}  Every change to one record
GET  /admin/time-machine/preview                What undoing a change set / rewinding a record would do
POST /admin/time-machine/restore                Do it (recorded, so it can be undone too)

History is written by backend/services/history_service.py and restored by
backend/services/history_restore.py.
"""

import logging
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field, ValidationError, model_validator
from sqlalchemy import String, and_, cast, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import get_current_admin
from backend.core.config import settings
from backend.database.base import get_db
from backend.models.company import AdminUser
from backend.models.history import HistoryChangeSet, HistoryEntry
from backend.services import history_restore as restore_svc
from backend.services.history_labels import table_label, table_section
from backend.services.history_service import (
    NOISE_COLUMNS,
    OP_CREATED,
    OP_DELETED,
    OP_UPDATED,
    is_secret,
    key_clause,
)
from backend.services.history_service import table as get_table

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin - Time Machine"])

_HIDDEN = "[hidden]"
_MAX_DETAIL_ENTRIES = 1000
_HEADLINE_ENTRIES = 4
_HEADLINE_CANDIDATES = 50


# ---------------------------------------------------------------------------
# Serialization
# ---------------------------------------------------------------------------

def _utc(value: Optional[datetime]) -> Optional[str]:
    """Naive UTC -> ISO with offset, so browsers convert to local time"""
    return value.replace(tzinfo=timezone.utc).isoformat() if value else None


def _parse_when(value: Optional[str], field: str) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail=f"{field} must be an ISO date or datetime")
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def _admin_name(admin: Optional[AdminUser]) -> Optional[str]:
    if admin is None:
        return None
    return f"{admin.first_name or ''} {admin.last_name or ''}".strip() or admin.username


async def _admins(db: AsyncSession, ids: set) -> dict[int, AdminUser]:
    ids = {i for i in ids if i is not None}
    if not ids:
        return {}
    rows = (await db.execute(select(AdminUser).where(AdminUser.id.in_(ids)))).scalars().all()
    return {a.id: a for a in rows}


def _shown(name: str, value: Any) -> Any:
    return _HIDDEN if is_secret(name) and value is not None else value


def _fields(entry: HistoryEntry) -> list[dict]:
    data = entry.data or {}
    before, after = data.get("before") or {}, data.get("after") or {}
    if entry.op == OP_UPDATED:
        return [
            {"name": name, "before": _shown(name, before.get(name)), "after": _shown(name, after.get(name))}
            for name in before
        ]
    if entry.op == OP_DELETED:
        return [
            {"name": name, "value": _shown(name, value)}
            for name, value in before.items()
            if name not in NOISE_COLUMNS and value not in (None, "", [], {})
        ]
    return []


def _is_link(table_name: str) -> bool:
    tbl = get_table(table_name)
    return tbl is not None and restore_svc.is_link_table(tbl)


def _link_values(entry: HistoryEntry) -> dict:
    data = entry.data or {}
    return {**(data.get("key") or {}), **(data.get("before") or {})}


def _entry_label(entry: HistoryEntry, names: dict[tuple[str, str], str]) -> Optional[str]:
    """Stored label, or for a link row "Product “Lobo” ↔ Category “Seating”" """
    if entry.label or not _is_link(entry.table_name):
        return entry.label
    values = _link_values(entry)
    parts = []
    for fk in get_table(entry.table_name).foreign_keys:
        value = values.get(fk.parent.name)
        if value is None:
            continue
        ref = fk.column.table.name
        name = names.get((ref, str(value)))
        parts.append(f"{table_label(ref)} “{name}”" if name else f"{table_label(ref)} #{value}")
    return " ↔ ".join(parts) or None


async def _link_names(db: AsyncSession, entries: list[HistoryEntry]) -> dict[tuple[str, str], str]:
    """Names of the rows that link-table entries point at"""
    wanted: dict[str, set] = defaultdict(set)
    for e in entries:
        if e.label or not _is_link(e.table_name):
            continue
        values = _link_values(e)
        for fk in get_table(e.table_name).foreign_keys:
            if values.get(fk.parent.name) is not None:
                wanted[fk.column.table.name].add(values[fk.parent.name])
    names = {}
    for table_name, ids in wanted.items():
        tbl = get_table(table_name)
        pk = list(tbl.primary_key.columns)
        label_col = next((tbl.c[c] for c in ("name", "title", "sku", "label") if c in tbl.c), None)
        if label_col is None or len(pk) != 1:
            continue
        for row_id, name in (await db.execute(select(pk[0], label_col).where(pk[0].in_(ids)))).all():
            if name:
                names[(table_name, str(row_id))] = name
    return names


def _entry_dict(entry: HistoryEntry, names: dict, parent_id: Optional[int] = None, full: bool = True) -> dict:
    out = {
        "id": entry.id,
        "change_set_id": entry.change_set_id,
        "table": entry.table_name,
        "type_label": table_label(entry.table_name),
        "section": table_section(entry.table_name),
        "row_key": entry.row_key,
        "op": entry.op,
        "label": _entry_label(entry, names),
        "created_at": _utc(entry.created_at),
        "parent_id": parent_id,
        "is_link": _is_link(entry.table_name),
    }
    if full:
        out["fields"] = _fields(entry)
    return out


def _set_dict(change_set: HistoryChangeSet, admin: Optional[AdminUser]) -> dict:
    admin_name = _admin_name(admin) or (f"Admin #{change_set.admin_id}" if change_set.admin_id else "System")
    return {
        "id": change_set.id,
        "admin": {"id": change_set.admin_id, "name": admin_name},
        "action": change_set.action,
        "resource_type": change_set.resource_type,
        "resource_id": change_set.resource_id,
        "method": change_set.method,
        "path": change_set.path,
        "created_at": _utc(change_set.created_at),
        "reverted_at": _utc(change_set.reverted_at),
        "reverted_by_set_id": change_set.reverted_by_set_id,
        "restores_set_id": change_set.restores_set_id,
        "restores_entry_id": change_set.restores_entry_id,
    }


def _headline(entries: list[HistoryEntry]) -> list[HistoryEntry]:
    """The entries that best describe a change set: whole records before their parts and links"""
    def rank(e: HistoryEntry):
        return (_is_link(e.table_name), restore_svc.table_order(e.table_name), e.id)

    return sorted(entries, key=rank)[:_HEADLINE_ENTRIES]


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------

@router.get("/summary", summary="Time Machine retention and size")
async def summary(
    current: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    sets, oldest = (await db.execute(
        select(func.count(HistoryChangeSet.id), func.min(HistoryChangeSet.created_at))
    )).one()
    entries = (await db.execute(select(func.count(HistoryEntry.id)))).scalar_one()
    tables = (await db.execute(select(HistoryEntry.table_name).distinct())).scalars().all()
    return {
        "enabled": settings.HISTORY_ENABLED,
        "retention_days": settings.HISTORY_RETENTION_DAYS,
        "change_sets": sets,
        "entries": entries,
        "oldest": _utc(oldest),
        "tables": sorted(
            ({"table": t, "label": table_label(t)} for t in tables if not _is_link(t)),
            key=lambda t: t["label"],
        ),
    }


@router.get("/changes", summary="Change history, newest first")
async def list_changes(
    admin_id: Optional[int] = Query(None),
    table: Optional[str] = Query(None, max_length=64),
    op: Optional[str] = Query(None, pattern="^(created|updated|deleted)$"),
    q: Optional[str] = Query(None, max_length=200, description="Record name, id or any stored value"),
    date_from: Optional[str] = Query(None, description="ISO date/datetime, inclusive"),
    date_to: Optional[str] = Query(None, description="ISO date/datetime, exclusive"),
    include_reverted: bool = Query(True),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    current: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    conditions = []
    if admin_id is not None:
        conditions.append(HistoryChangeSet.admin_id == admin_id)
    start, end = _parse_when(date_from, "date_from"), _parse_when(date_to, "date_to")
    if start:
        conditions.append(HistoryChangeSet.created_at >= start)
    if end:
        conditions.append(HistoryChangeSet.created_at < end)
    if not include_reverted:
        conditions.append(HistoryChangeSet.reverted_at.is_(None))
    entry_filters = []
    if table:
        entry_filters.append(HistoryEntry.table_name == table)
    if op:
        entry_filters.append(HistoryEntry.op == op)
    if q and q.strip():
        like = f"%{q.strip()}%"
        entry_filters.append(or_(
            HistoryEntry.label.ilike(like),
            HistoryEntry.row_key == q.strip(),
            cast(HistoryEntry.data, String).ilike(like),
        ))
    if entry_filters:
        conditions.append(exists().where(and_(HistoryEntry.change_set_id == HistoryChangeSet.id, *entry_filters)))

    total = (await db.execute(select(func.count(HistoryChangeSet.id)).where(*conditions))).scalar_one()
    sets = (await db.execute(
        select(HistoryChangeSet)
        .where(*conditions)
        .order_by(HistoryChangeSet.created_at.desc(), HistoryChangeSet.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )).scalars().all()
    set_ids = [s.id for s in sets]

    counts: dict[str, Counter] = defaultdict(Counter)
    candidates: dict[str, list[HistoryEntry]] = defaultdict(list)
    if set_ids:
        for set_id, entry_op, n in (await db.execute(
            select(HistoryEntry.change_set_id, HistoryEntry.op, func.count())
            .where(HistoryEntry.change_set_id.in_(set_ids))
            .group_by(HistoryEntry.change_set_id, HistoryEntry.op)
        )).all():
            counts[set_id][entry_op] = n
        # Headline candidates, without the (possibly large) row data
        rows = (await db.execute(
            select(
                HistoryEntry.id, HistoryEntry.change_set_id, HistoryEntry.table_name,
                HistoryEntry.row_key, HistoryEntry.op, HistoryEntry.label, HistoryEntry.created_at,
            )
            .where(HistoryEntry.change_set_id.in_(set_ids), *entry_filters)
            .order_by(HistoryEntry.id)
            .limit(_HEADLINE_CANDIDATES * len(set_ids))
        )).all()
        for row in rows:
            if len(candidates[row.change_set_id]) < _HEADLINE_CANDIDATES:
                candidates[row.change_set_id].append(HistoryEntry(
                    id=row.id, change_set_id=row.change_set_id, table_name=row.table_name,
                    row_key=row.row_key, op=row.op, label=row.label, created_at=row.created_at, data={},
                ))
    admins = await _admins(db, {s.admin_id for s in sets})

    items = []
    for change_set in sets:
        item = _set_dict(change_set, admins.get(change_set.admin_id))
        item["counts"] = {o: counts[change_set.id].get(o, 0) for o in (OP_CREATED, OP_UPDATED, OP_DELETED)}
        item["entry_count"] = sum(item["counts"].values())
        item["headline"] = [_entry_dict(e, {}, full=False) for e in _headline(candidates[change_set.id])]
        items.append(item)
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, -(-total // page_size)),
    }


@router.get("/changes/{set_id}", summary="One change set with every field change")
async def get_change(
    set_id: str,
    current: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    change_set = await db.get(HistoryChangeSet, set_id)
    if change_set is None:
        raise HTTPException(status_code=404, detail="Change not found (it may be older than the history kept)")
    entries = await restore_svc.entries_for_change_set(db, set_id)
    parents = restore_svc.cascade_parents(entries)
    shown = entries[:_MAX_DETAIL_ENTRIES]
    names = await _link_names(db, shown)
    admins = await _admins(db, {change_set.admin_id})
    return {
        **_set_dict(change_set, admins.get(change_set.admin_id)),
        "entries": [_entry_dict(e, names, parents.get(e.id)) for e in shown],
        "entry_count": len(entries),
        "truncated": len(entries) > len(shown),
    }


@router.get("/records/{table_name}/{row_key}", summary="Every change kept for one record")
async def record_history(
    table_name: str,
    row_key: str,
    current: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    tbl = get_table(table_name)
    if tbl is None:
        raise HTTPException(status_code=404, detail="Unknown record type")
    entries = (await db.execute(
        select(HistoryEntry)
        .where(HistoryEntry.table_name == table_name, HistoryEntry.row_key == row_key)
        .order_by(HistoryEntry.id.desc())
        .limit(500)
    )).scalars().all()
    exists_now = False
    key = ((entries[0].data or {}).get("key") or {}) if entries else {}
    if key:
        exists_now = bool((await db.execute(
            select(func.count()).select_from(tbl).where(key_clause(tbl, key))
        )).scalar_one())
    sets = {}
    if entries:
        sets = {s.id: s for s in (await db.execute(
            select(HistoryChangeSet).where(HistoryChangeSet.id.in_({e.change_set_id for e in entries}))
        )).scalars().all()}
    admins = await _admins(db, {s.admin_id for s in sets.values()})
    names = await _link_names(db, entries)
    return {
        "table": table_name,
        "type_label": table_label(table_name),
        "section": table_section(table_name),
        "row_key": row_key,
        "label": next((e.label for e in entries if e.label), None),
        "exists": exists_now,
        "entries": [
            {
                **_entry_dict(e, names),
                "change_set": _set_dict(sets[e.change_set_id], admins.get(sets[e.change_set_id].admin_id))
                if e.change_set_id in sets else None,
            }
            for e in entries
        ],
    }


# ---------------------------------------------------------------------------
# Preview + restore
# ---------------------------------------------------------------------------

class RestoreTarget(BaseModel):
    change_set_id: Optional[str] = Field(None, max_length=32)
    entry_id: Optional[int] = None

    @model_validator(mode="after")
    def _one_target(self):
        if bool(self.change_set_id) == (self.entry_id is not None):
            raise ValueError("Give either change_set_id or entry_id")
        return self


class RestoreRequest(RestoreTarget):
    force: bool = Field(False, description="Overwrite fields that changed again since")


async def _target_entries(db: AsyncSession, target: RestoreTarget) -> list[HistoryEntry]:
    if target.change_set_id:
        if await db.get(HistoryChangeSet, target.change_set_id) is None:
            raise HTTPException(status_code=404, detail="Change not found")
        return await restore_svc.entries_for_change_set(db, target.change_set_id)
    entry = await db.get(HistoryEntry, target.entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Change not found")
    return await restore_svc.entries_for_record(db, entry)


def _plan_dict(the_plan: restore_svc.Plan, names: dict) -> dict:
    steps = the_plan.steps
    status_counts = Counter(s.status for s in steps)
    kind_counts = Counter(s.kind for s in the_plan.actionable)
    parents = restore_svc.cascade_parents([s.entry for s in steps])
    return {
        "steps": [
            {**s.to_dict(), "entry": _entry_dict(s.entry, names, parents.get(s.entry.id))}
            for s in steps[:_MAX_DETAIL_ENTRIES]
        ],
        "step_count": len(steps),
        "counts": {
            "restore": kind_counts.get(restore_svc.RESTORE, 0),
            "revert": kind_counts.get(restore_svc.REVERT, 0),
            "remove": kind_counts.get(restore_svc.REMOVE, 0),
            "noop": status_counts.get(restore_svc.NOOP, 0),
            "conflict": status_counts.get(restore_svc.CONFLICT, 0),
            "blocked": status_counts.get(restore_svc.BLOCKED, 0),
        },
        "can_apply": not the_plan.blocked and bool(the_plan.actionable),
        "needs_force": bool(the_plan.conflicts),
    }


@router.get("/preview", summary="What a restore would change, without changing anything")
async def preview(
    change_set_id: Optional[str] = Query(None, max_length=32),
    entry_id: Optional[int] = Query(None),
    current: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        target = RestoreTarget(change_set_id=change_set_id, entry_id=entry_id)
    except ValidationError:
        raise HTTPException(status_code=400, detail="Give either change_set_id or entry_id")
    entries = await _target_entries(db, target)
    the_plan = await restore_svc.plan(db, entries)
    return _plan_dict(the_plan, await _link_names(db, entries))


@router.post("/restore", summary="Undo a change set or rewind a record")
async def restore(
    body: RestoreRequest,
    request: Request,
    current: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    entries = await _target_entries(db, body)
    the_plan = await restore_svc.plan(db, entries)
    if not the_plan.actionable and not the_plan.blocked:
        raise HTTPException(status_code=400, detail="Nothing to undo: everything is already as it was")

    # Label the change set that records this restore (made by audit_admin_request)
    history = getattr(request.state, "history", None)
    if history is not None:
        history.restores_set_id = body.change_set_id
        history.restores_entry_id = body.entry_id

    try:
        result = await restore_svc.apply(db, the_plan, force=body.force)
        if body.change_set_id:
            await restore_svc.mark_reverted(db, [body.change_set_id], history.set_id if history else None)
        await db.commit()
    except restore_svc.RestoreError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail=str(exc))

    await _after_restore(db, result["touched"])
    logger.warning(
        "Admin %s used the Time Machine on %s: %s",
        current.username,
        f"change {body.change_set_id}" if body.change_set_id else f"entry {body.entry_id}",
        result["counts"],
    )
    return {
        "counts": {
            kind: result["counts"].get(kind, 0)
            for kind in (restore_svc.RESTORE, restore_svc.REVERT, restore_svc.REMOVE)
        },
        "history_set_id": history.set_id if history is not None and history.entry_count else None,
    }


async def _after_restore(db: AsyncSession, touched: list) -> None:
    """Bring back trashed images, drop cached products, re-export site content"""
    from backend.api.v1.routes.admin.upload import UPLOAD_BASE_DIR
    from backend.services import media_service

    product_ids = set()
    urls: set[str] = set()
    for tbl, values in touched:
        if tbl.name == "chairs" and values.get("id") is not None:
            product_ids.add(values["id"])
        elif tbl.name in ("product_variations", "product_images") and values.get("product_id") is not None:
            product_ids.add(values["product_id"])
        _collect_upload_urls(values, urls)

    for url in urls:
        path = media_service.resolve_uploaded_image_path(url, UPLOAD_BASE_DIR)
        if path is not None and not path.exists():
            try:
                media_service.restore_trashed_image(path, Path(UPLOAD_BASE_DIR))
            except Exception:
                logger.exception(f"Could not restore trashed image {url}")

    try:
        from backend.services.cache_service import cache_service

        for product_id in product_ids:
            await cache_service.invalidate_product(product_id)
    except Exception:
        logger.exception("Could not invalidate product cache after restore")

    try:
        from backend.utils.static_content_exporter import export_all_content_types

        await export_all_content_types(db)
    except Exception:
        logger.exception("Could not re-export site content after restore")


def _collect_upload_urls(value: Any, out: set) -> None:
    if isinstance(value, str):
        if "/uploads/images/" in value or value.startswith("uploads/images/"):
            out.add(value)
    elif isinstance(value, dict):
        for v in value.values():
            _collect_upload_urls(v, out)
    elif isinstance(value, (list, tuple)):
        for v in value:
            _collect_upload_urls(v, out)
