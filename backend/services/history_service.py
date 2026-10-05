"""
Time Machine: revertible history of admin changes

audit_admin_request attaches a HistoryRecorder to the request's session for
every admin / CMS write. The recorder listens to the session and stores, in
the same transaction as the change itself:

  - update: old and new values of the changed columns only
  - delete: the whole row, plus every row the database removes or unlinks
            with it (ON DELETE CASCADE / SET NULL), found from the foreign
            keys, so a restore brings back variations, images and links too
  - create: the new row's key (undoing it means deleting the row)

ORM flushes are read from the unit of work (no extra queries for ordinary
edits). Bulk UPDATE / DELETE / INSERT statements are caught in do_orm_execute
and the affected rows read once before (and, for updates, after) they run.
Rolled-back work takes its history with it, savepoints included.

Admin accounts, sign-in state, analytics, AI chats and carts are not tracked.
Secret columns (passwords, tokens) are never captured for updates, so a
revert can't bring back an old password; a deleted row keeps them so it can
be restored whole, and the API never shows them.

backend/services/history_restore.py plans and applies reverts.
"""

import asyncio
import base64
import enum
import logging
import uuid
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any, Callable, Iterable, Optional

from sqlalchemy import Table, and_, delete, event, insert, inspect, select
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import ORMExecuteState, Session
from sqlalchemy.sql import ClauseElement, sqltypes

from backend.core.config import settings
from backend.database.base import Base
from backend.models.history import HistoryChangeSet, HistoryEntry

logger = logging.getLogger(__name__)

# Not part of the Time Machine: accounts and sign-in state (never revertible
# by design), logs, analytics, AI working state, shopping carts
UNTRACKED_TABLES = frozenset({
    "admin_users",
    "admin_sessions",
    "admin_passkey_credentials",
    "admin_audit_logs",
    "analytics_events",
    "ai_chat_sessions",
    "ai_chat_messages",
    "ai_memory",
    "ai_uploaded_files",
    "ai_proposed_edits",
    "ai_training_documents",
    "carts",
    "cart_items",
    "saved_configurations",
    HistoryChangeSet.__tablename__,
    HistoryEntry.__tablename__,
})

# Changes to these columns alone aren't worth a history entry
NOISE_COLUMNS = frozenset({"updated_at", "created_at", "last_activity", "view_count", "views", "quote_count"})

_SECRET_PARTS = ("password", "token", "secret", "two_factor", "credential", "otp")

# Most rows one bulk statement may touch and still be recorded
MAX_STATEMENT_ROWS = 5000
_MAX_CASCADE_DEPTH = 6

_LABEL_COLUMNS = (
    "name", "title", "company_name", "quote_number", "sku", "model_number",
    "pricing_tier_name", "pattern_name", "question", "label", "page_name",
    "section_key", "key", "slug", "email",
)

OP_CREATED, OP_UPDATED, OP_DELETED = "created", "updated", "deleted"


def is_tracked(table_name: str) -> bool:
    return table_name not in UNTRACKED_TABLES


def is_secret(column_name: str) -> bool:
    lowered = column_name.lower()
    return any(part in lowered for part in _SECRET_PARTS)


def table(name: str) -> Optional[Table]:
    return Base.metadata.tables.get(name)


# ---------------------------------------------------------------------------
# Values: DB value <-> JSON, decoded by the column's type
# ---------------------------------------------------------------------------

def encode_value(value: Any) -> Any:
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, enum.Enum):
        return value.value
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (bytes, bytearray, memoryview)):
        return {"$b64": base64.b64encode(bytes(value)).decode("ascii")}
    if isinstance(value, dict):
        return {str(k): encode_value(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [encode_value(v) for v in value]
    return str(value)


def decode_value(column, value: Any) -> Any:
    if value is None:
        return None
    col_type = column.type
    if isinstance(col_type, sqltypes.JSON):
        return value
    if isinstance(value, dict) and "$b64" in value:
        return base64.b64decode(value["$b64"])
    if isinstance(col_type, sqltypes.Enum) and col_type.enum_class is not None:
        enum_class = col_type.enum_class
        try:
            return enum_class(value)
        except ValueError:
            return enum_class[value]
    if isinstance(value, str):
        if isinstance(col_type, sqltypes.DateTime):
            return datetime.fromisoformat(value)
        if isinstance(col_type, sqltypes.Date):
            return date.fromisoformat(value)
        if isinstance(col_type, sqltypes.Time):
            return time.fromisoformat(value)
        if isinstance(col_type, sqltypes.Numeric) and not isinstance(col_type, sqltypes.Float):
            return Decimal(value)
    return value


def decode_row(tbl: Table, values: dict) -> dict:
    """Encoded {column: value} -> DB values, dropping columns the table no longer has"""
    return {name: decode_value(tbl.c[name], v) for name, v in values.items() if name in tbl.c}


# ---------------------------------------------------------------------------
# Row identity
# ---------------------------------------------------------------------------

def identity_columns(tbl: Table) -> list:
    """Primary key columns, or every column for a table without one"""
    return list(tbl.primary_key.columns) or list(tbl.columns)


def key_of(tbl: Table, row: dict) -> Optional[dict]:
    cols = identity_columns(tbl)
    if any(row.get(c.name) is None for c in cols):
        return None
    return {c.name: encode_value(row[c.name]) for c in cols}


def row_key(key: dict) -> str:
    return "|".join(str(v) for v in key.values())[:191]


def key_clause(tbl: Table, key: dict):
    return and_(*(tbl.c[name] == decode_value(tbl.c[name], v) for name, v in key.items()))


def row_label(values: dict) -> Optional[str]:
    for name in _LABEL_COLUMNS:
        value = values.get(name)
        if isinstance(value, str) and value.strip():
            return value.strip()[:200]
    first, last = values.get("first_name"), values.get("last_name")
    if isinstance(first, str) and first:
        return f"{first} {last or ''}".strip()[:200]
    return None


def references(tbl: Table) -> Iterable[tuple[Table, Any, Any, str]]:
    """(referencing table, its fk column, referenced column, ON DELETE rule) for every FK into tbl"""
    for other in Base.metadata.tables.values():
        for fk in other.foreign_keys:
            if fk.column.table is tbl:
                yield other, fk.parent, fk.column, (fk.ondelete or "").upper()


# ---------------------------------------------------------------------------
# Recorder
# ---------------------------------------------------------------------------

class HistoryRecorder:
    """
    Records revertible history for one admin request. Use as a context
    manager around the work; `admin_id` is called when the first entry is
    written (the admin is known only once auth has run).
    """

    def __init__(
        self,
        db: AsyncSession,
        admin_id: Callable[[], Optional[int]],
        info: dict,
        method: Optional[str] = None,
        path: Optional[str] = None,
    ):
        self.set_id = uuid.uuid4().hex
        self.entry_count = 0
        self._session: Session = db.sync_session
        self._admin_id = admin_id
        self._info = info
        self._method = method
        self._path = path
        # Set by the Time Machine restore route before it applies a revert
        self.restores_set_id: Optional[str] = None
        self.restores_entry_id: Optional[int] = None
        self._flush_pending: list[dict] = []
        self._prefetched: dict[tuple[str, str], dict] = {}
        self._deleted: set[tuple[str, str]] = set()
        self._set_tx = None

    # -- lifecycle ----------------------------------------------------------

    def __enter__(self) -> "HistoryRecorder":
        event.listen(self._session, "before_flush", self._before_flush)
        event.listen(self._session, "after_flush", self._after_flush)
        event.listen(self._session, "do_orm_execute", self._do_orm_execute)
        return self

    def __exit__(self, *exc) -> None:
        for name, fn in (
            ("before_flush", self._before_flush),
            ("after_flush", self._after_flush),
            ("do_orm_execute", self._do_orm_execute),
        ):
            if event.contains(self._session, name, fn):
                event.remove(self._session, name, fn)

    # -- writing ------------------------------------------------------------

    def _write(self, conn: Connection, entries: list[dict]) -> None:
        if not entries:
            return
        now = datetime.utcnow()
        tx = self._session.get_transaction()
        if tx is not self._set_tx:
            # First write in this transaction: the set row may not exist yet,
            # or may have been rolled back with an earlier transaction
            sets = HistoryChangeSet.__table__
            if conn.execute(select(sets.c.id).where(sets.c.id == self.set_id)).first() is None:
                conn.execute(insert(sets).values(
                    id=self.set_id,
                    admin_id=self._admin_id(),
                    action=str(self._info.get("action") or "change")[:64],
                    resource_type=str(self._info.get("resource_type") or "admin")[:100],
                    resource_id=self._info.get("resource_id"),
                    method=self._method,
                    path=(self._path or "")[:500] or None,
                    restores_set_id=self.restores_set_id,
                    restores_entry_id=self.restores_entry_id,
                    created_at=now,
                    updated_at=now,
                ))
            self._set_tx = tx
        rows = [
            {
                "change_set_id": self.set_id,
                "table_name": e["table"],
                "row_key": row_key(e["key"]),
                "op": e["op"],
                "label": e.get("label"),
                "data": {k: e[k] for k in ("key", "before", "after") if k in e},
                "created_at": now,
                "updated_at": now,
            }
            for e in entries
        ]
        conn.execute(insert(HistoryEntry.__table__), rows)
        self.entry_count += len(rows)

    def _safely(self, what: str, fn, *args):
        try:
            return fn(*args)
        except Exception:
            # History must never break the admin's change
            logger.exception(f"[HISTORY] Could not record {what}")
            return None

    # -- deletes (and what the database removes with them) -------------------

    def _snapshot_delete(self, conn: Connection, tbl: Table, where, depth: int = 0) -> list[dict]:
        """Entries for every row `DELETE FROM tbl WHERE where` removes or unlinks"""
        rows = conn.execute(select(tbl).where(where).limit(MAX_STATEMENT_ROWS + 1)).mappings().all()
        if len(rows) > MAX_STATEMENT_ROWS:
            logger.warning(f"[HISTORY] Delete of over {MAX_STATEMENT_ROWS} {tbl.name} rows not recorded")
            return []
        entries = []
        fresh = []
        for row in rows:
            row = dict(row)
            key = key_of(tbl, row)
            if key is None or (tbl.name, row_key(key)) in self._deleted:
                continue
            self._deleted.add((tbl.name, row_key(key)))
            fresh.append(row)
            entries.append({
                "table": tbl.name,
                "op": OP_DELETED,
                "key": key,
                "label": row_label(row),
                "before": {name: encode_value(v) for name, v in row.items()},
            })
        if not fresh or depth >= _MAX_CASCADE_DEPTH:
            return entries

        for other, column, referenced, ondelete in references(tbl):
            if not is_tracked(other.name) or ondelete not in ("CASCADE", "SET NULL"):
                continue
            values = {r[referenced.name] for r in fresh if r.get(referenced.name) is not None}
            if not values:
                continue
            match = column.in_(values)
            if ondelete == "CASCADE":
                entries += self._snapshot_delete(conn, other, match, depth + 1)
            elif column.nullable:
                cols = list(dict.fromkeys([*identity_columns(other), column]))
                for linked in conn.execute(select(*cols).where(match).limit(MAX_STATEMENT_ROWS)).mappings():
                    linked = dict(linked)
                    key = key_of(other, linked)
                    if key is None or (other.name, row_key(key)) in self._deleted:
                        continue
                    entries.append({
                        "table": other.name,
                        "op": OP_UPDATED,
                        "key": key,
                        "before": {column.name: encode_value(linked[column.name])},
                        "after": {column.name: None},
                    })
        return entries

    # -- ORM flushes --------------------------------------------------------

    def _before_flush(self, session: Session, flush_context, instances) -> None:
        self._flush_pending = []
        self._prefetched = {}
        self._safely("flush", self._capture_before_flush, session)

    def _capture_before_flush(self, session: Session) -> None:
        conn = session.connection()
        with session.no_autoflush:
            for obj in list(session.deleted):
                tbl = _mapped_table(obj)
                if tbl is None:
                    continue
                key = _object_key(obj, tbl)
                if key is not None:
                    self._flush_pending += self._snapshot_delete(conn, tbl, key_clause(tbl, key))

            # Old values the session never loaded must be read before the
            # flush overwrites them
            missing: dict[Table, list[dict]] = {}
            for obj in list(session.dirty):
                tbl = _mapped_table(obj)
                if tbl is None or obj in session.deleted:
                    continue
                state = inspect(obj)
                for prop in state.mapper.column_attrs:
                    hist = state.attrs[prop.key].history
                    if hist.added and not hist.deleted:
                        key = _object_key(obj, tbl)
                        if key is not None:
                            missing.setdefault(tbl, []).append(key)
                        break
            for tbl, keys in missing.items():
                pk = identity_columns(tbl)
                if len(pk) == 1:
                    ids = [decode_value(pk[0], k[pk[0].name]) for k in keys]
                    rows = conn.execute(select(tbl).where(pk[0].in_(ids))).mappings().all()
                else:
                    rows = [
                        r for k in keys
                        for r in conn.execute(select(tbl).where(key_clause(tbl, k))).mappings().all()
                    ]
                for row in rows:
                    row = dict(row)
                    self._prefetched[(tbl.name, row_key(key_of(tbl, row)))] = row

    def _after_flush(self, session: Session, flush_context) -> None:
        entries = self._flush_pending
        self._flush_pending = []
        captured = self._safely("flush", self._capture_after_flush, session)
        if captured:
            entries += captured
        if entries:
            self._safely("flush", self._write, session.connection(), entries)

    def _capture_after_flush(self, session: Session) -> list[dict]:
        entries: list[dict] = []
        links: dict[tuple[str, str, str], dict] = {}

        for obj in session.new:
            tbl = _mapped_table(obj)
            if tbl is None:
                continue
            key = _object_key(obj, tbl)
            if key is not None:
                entries.append({
                    "table": tbl.name,
                    "op": OP_CREATED,
                    "key": key,
                    "label": row_label(_loaded_values(obj)),
                })

        for obj in session.dirty:
            if obj in session.deleted:
                continue
            tbl = _mapped_table(obj)
            if tbl is None:
                continue
            entry = self._update_entry(obj, tbl)
            if entry:
                entries.append(entry)

        # Many-to-many links (association tables aren't ORM objects)
        for obj in [*session.new, *session.dirty]:
            if obj in session.deleted:
                continue
            state = inspect(obj)
            for prop in state.mapper.relationships:
                sec = prop.secondary
                if sec is None or prop.viewonly or not is_tracked(sec.name):
                    continue
                hist = state.attrs[prop.key].history
                for op, related in ((OP_CREATED, hist.added), (OP_DELETED, hist.deleted)):
                    for other in related or ():
                        row = _link_row(prop, obj, other)
                        key = key_of(sec, row) if row else None
                        if key is None:
                            continue
                        entry = {"table": sec.name, "op": op, "key": key}
                        if op == OP_DELETED:
                            entry["before"] = {k: encode_value(v) for k, v in row.items()}
                        # A link and its backref show up twice
                        links[(sec.name, row_key(key), op)] = entry
        return entries + list(links.values())

    def _update_entry(self, obj, tbl: Table) -> Optional[dict]:
        state = inspect(obj)
        key = _object_key(obj, tbl)
        if key is None:
            return None
        prefetched = self._prefetched.get((tbl.name, row_key(key)), {})
        before, after = {}, {}
        for prop in state.mapper.column_attrs:
            column = prop.columns[0]
            if column.table is not tbl or column.name in NOISE_COLUMNS or is_secret(column.name):
                continue
            hist = state.attrs[prop.key].history
            if not hist.has_changes():
                continue
            new = hist.added[0] if hist.added else None
            if isinstance(new, ClauseElement):
                continue  # SQL expression: value unknown until read back
            if hist.deleted:
                old = hist.deleted[0]
            elif column.name in prefetched:
                old = prefetched[column.name]
            else:
                continue
            if old == new:
                continue
            before[column.name] = encode_value(old)
            after[column.name] = encode_value(new)
        if not before:
            return None
        return {
            "table": tbl.name,
            "op": OP_UPDATED,
            "key": key,
            "label": row_label(_loaded_values(obj)),
            "before": before,
            "after": after,
        }

    # -- bulk statements ----------------------------------------------------

    def _do_orm_execute(self, state: ORMExecuteState):
        if not (state.is_update or state.is_delete or state.is_insert):
            return None
        tbl = _statement_table(state.statement)
        if tbl is None or not is_tracked(tbl.name):
            return None
        conn = state.session.connection()
        params = state.parameters

        if state.is_delete:
            where = state.statement.whereclause
            if where is None:
                logger.warning(f"[HISTORY] Unfiltered DELETE on {tbl.name} not recorded")
                return None
            entries = self._safely("bulk delete", self._snapshot_delete, conn, tbl, where) or []
            self._safely("bulk delete", self._write, conn, entries)
            return None

        if state.is_insert:
            result = state.invoke_statement()
            self._safely("bulk insert", self._record_insert, conn, tbl, state, result)
            return result

        # UPDATE: read the touched columns before and after
        stmt = state.statement
        pk = identity_columns(tbl)
        set_cols = {_column_name(k) for k in (getattr(stmt, "_values", None) or {})}
        if isinstance(params, list):
            for p in params:
                set_cols.update(p or {})
        elif isinstance(params, dict):
            set_cols.update(params)
        set_cols = {c for c in set_cols if c in tbl.c and c not in NOISE_COLUMNS and not is_secret(c)}
        set_cols -= {c.name for c in pk}
        if not set_cols:
            return None
        if stmt.whereclause is not None:
            where = stmt.whereclause
        elif isinstance(params, list) and len(pk) == 1 and all(pk[0].name in (p or {}) for p in params):
            where = pk[0].in_([p[pk[0].name] for p in params])  # bulk update by primary key
        else:
            logger.warning(f"[HISTORY] Unfiltered UPDATE on {tbl.name} not recorded")
            return None
        cols = [*pk, *(tbl.c[c] for c in sorted(set_cols))]
        before = self._safely("bulk update", _read_rows, conn, tbl, cols, where)
        result = state.invoke_statement()
        if before:
            self._safely("bulk update", self._record_bulk_update, conn, tbl, cols, before)
        return result

    def _record_insert(self, conn: Connection, tbl: Table, state: ORMExecuteState, result) -> None:
        params = state.parameters
        rows = params if isinstance(params, list) else [params] if params else []
        values = getattr(state.statement, "_values", None) or {}
        if not rows and values:
            rows = [{_column_name(k): getattr(v, "value", v) for k, v in values.items()}]
        entries = []
        for row in rows:
            row = row or {}
            key = key_of(tbl, row)
            if key is None and len(rows) == 1:
                inserted = getattr(result, "inserted_primary_key", None)
                if inserted and all(v is not None for v in inserted):
                    key = {c.name: encode_value(v) for c, v in zip(identity_columns(tbl), inserted)}
            if key is not None:
                entries.append({"table": tbl.name, "op": OP_CREATED, "key": key, "label": row_label(row)})
        self._write(conn, entries)

    def _record_bulk_update(self, conn: Connection, tbl: Table, cols: list, before: dict) -> None:
        pk = identity_columns(tbl)
        if len(pk) == 1:
            ids = [decode_value(pk[0], row["__key"][pk[0].name]) for row in before.values()]
            after = _read_rows(conn, tbl, cols, pk[0].in_(ids)) or {}
        else:
            after = {}
            for row in before.values():
                after.update(_read_rows(conn, tbl, cols, key_clause(tbl, row["__key"])) or {})
        entries = []
        for k, old_row in before.items():
            new_row = after.get(k)
            if new_row is None:
                continue
            changed = [c for c in old_row if c != "__key" and old_row[c] != new_row.get(c)]
            if not changed:
                continue
            entries.append({
                "table": tbl.name,
                "op": OP_UPDATED,
                "key": old_row["__key"],
                "before": {c: old_row[c] for c in changed},
                "after": {c: new_row.get(c) for c in changed},
            })
        self._write(conn, entries)


def _column_name(key) -> str:
    return getattr(key, "name", None) or getattr(key, "key", None) or str(key)


def _read_rows(conn: Connection, tbl: Table, cols: list, where) -> Optional[dict]:
    """{row_key: {col: encoded value, "__key": key}}, or None when too many rows match"""
    rows = conn.execute(select(*cols).where(where).limit(MAX_STATEMENT_ROWS + 1)).mappings().all()
    if len(rows) > MAX_STATEMENT_ROWS:
        logger.warning(f"[HISTORY] Update of over {MAX_STATEMENT_ROWS} {tbl.name} rows not recorded")
        return None
    out = {}
    for row in rows:
        row = dict(row)
        key = key_of(tbl, row)
        if key is None:
            continue
        values = {c.name: encode_value(row[c.name]) for c in cols if c.name not in key}
        values["__key"] = key
        out[row_key(key)] = values
    return out


def _statement_table(stmt) -> Optional[Table]:
    target = getattr(stmt, "table", None)
    if isinstance(target, Table):
        return target
    try:
        return inspect(target).local_table
    except Exception:
        return None


def _mapped_table(obj) -> Optional[Table]:
    tbl = getattr(type(obj), "__table__", None)
    if isinstance(tbl, Table) and is_tracked(tbl.name):
        return tbl
    return None


def _object_key(obj, tbl: Table) -> Optional[dict]:
    state = inspect(obj)
    pk = identity_columns(tbl)
    identity = state.identity
    if identity is not None and len(identity) == len(pk):
        return {c.name: encode_value(v) for c, v in zip(pk, identity)}
    return key_of(tbl, {c.name: _column_value(obj, c) for c in pk})


def _loaded_values(obj) -> dict:
    state = inspect(obj)
    return {
        prop.columns[0].name: state.dict[prop.key]
        for prop in state.mapper.column_attrs
        if prop.key in state.dict
    }


def _link_row(prop, parent, child) -> Optional[dict]:
    """The association-table row linking parent and child through prop.secondary"""
    row = {}
    for local, sec_col in prop.synchronize_pairs:
        row[sec_col.name] = _column_value(parent, local)
    for remote, sec_col in prop.secondary_synchronize_pairs or ():
        row[sec_col.name] = _column_value(child, remote)
    return row if row and all(v is not None for v in row.values()) else None


def _column_value(obj, column) -> Any:
    state = inspect(obj)
    try:
        prop = state.mapper.get_property_by_column(column)
    except Exception:
        return None
    return state.dict.get(prop.key)


# ---------------------------------------------------------------------------
# Retention
# ---------------------------------------------------------------------------

PURGE_BATCH = 5000
PURGE_INTERVAL_SECONDS = 6 * 3600
_PURGE_KEY = "history:purged:{day}"


def retention_cutoff() -> datetime:
    return datetime.utcnow() - timedelta(days=settings.HISTORY_RETENTION_DAYS)


async def purge_expired(db: AsyncSession) -> int:
    """Delete history older than the retention window, in batches. Returns entries removed."""
    cutoff = retention_cutoff()
    removed = 0
    while True:
        ids = (await db.execute(
            select(HistoryEntry.id).where(HistoryEntry.created_at < cutoff).limit(PURGE_BATCH)
        )).scalars().all()
        if not ids:
            break
        await db.execute(delete(HistoryEntry).where(HistoryEntry.id.in_(ids)))
        await db.commit()
        removed += len(ids)
    await db.execute(delete(HistoryChangeSet).where(HistoryChangeSet.created_at < cutoff))
    await db.commit()
    return removed


async def purge_loop() -> None:
    """Background task: purge expired history and trashed uploads (once a day across workers)"""
    import redis.asyncio as redis

    from backend.database.base import AsyncSessionLocal

    await asyncio.sleep(60)
    while True:
        try:
            claimed = True
            try:
                client = redis.from_url(settings.REDIS_URL, socket_connect_timeout=2, socket_timeout=5)
                try:
                    day = datetime.utcnow().strftime("%Y-%m-%d")
                    claimed = bool(await client.set(_PURGE_KEY.format(day=day), "1", nx=True, ex=2 * 86400))
                finally:
                    await client.aclose()
            except Exception:
                pass  # no Redis: every worker purges; the deletes are idempotent
            if claimed:
                async with AsyncSessionLocal() as db:
                    removed = await purge_expired(db)
                files = await asyncio.to_thread(purge_upload_trash)
                if removed or files:
                    logger.info(f"[HISTORY] Purged {removed} history entries and {files} trashed files")
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning(f"[HISTORY] Purge failed: {exc}")
        await asyncio.sleep(PURGE_INTERVAL_SECONDS)


# ---------------------------------------------------------------------------
# Upload trash: deleted images wait here so a restore can bring them back
# ---------------------------------------------------------------------------

def upload_trash_dir(upload_base: Path) -> Path:
    if settings.UPLOAD_TRASH_DIR:
        return Path(settings.UPLOAD_TRASH_DIR)
    return upload_base.parent / ".upload-trash"


def trash_path(upload_base: Path, path: Path) -> Optional[Path]:
    try:
        relative = path.resolve().relative_to(upload_base.resolve())
    except (ValueError, OSError):
        return None
    return upload_trash_dir(upload_base) / relative


def purge_upload_trash() -> int:
    from backend.api.v1.routes.admin.upload import UPLOAD_BASE_DIR

    root = upload_trash_dir(UPLOAD_BASE_DIR)
    if not root.is_dir():
        return 0
    cutoff = datetime.now().timestamp() - settings.HISTORY_RETENTION_DAYS * 86400
    removed = 0
    for path in root.rglob("*"):
        try:
            if path.is_file() and path.stat().st_mtime < cutoff:
                path.unlink()
                removed += 1
        except OSError:
            continue
    return removed
