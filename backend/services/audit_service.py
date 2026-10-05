"""
Admin audit trail

Every write under /api/v1/admin and /api/v1/cms-admin is recorded in
admin_audit_logs by audit_admin_request, a router-level dependency, so
routes don't log individually. Each entry records who, what (action +
resource + id), the request body with secrets removed, and where from.
Requests refused for lack of permission are recorded too, with action
"denied" (details.attempted holds what they tried).

details.changes holds before/after values for every row the request
changed through the ORM, captured from the request's own session by
ChangeRecorder (SQLAlchemy after_flush), so routes don't have to report
their changes. Bulk UPDATE/DELETE statements bypass the ORM and show up
only through the request body.
Sign-ins and sign-outs are recorded by the auth routes through record().
"""

import enum
import json
import logging
from contextlib import nullcontext
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, AsyncGenerator, Optional

from fastapi import Depends
from sqlalchemy import event, inspect
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import HTTPConnection, Request

from backend.core.admin_permissions import ADMIN_PREFIX, CMS_PREFIX
from backend.core.config import settings
from backend.core.exceptions import InsufficientPermissionsError
from backend.database.base import get_db
from backend.models.company import AdminAuditLog

logger = logging.getLogger(__name__)

_READ_METHODS = ("GET", "HEAD", "OPTIONS")

# POST paths ending in one of these name the action itself
_VERBS = {
    "reorder", "assign", "duplicate", "invite", "test", "send", "apply",
    "decline", "apply-edit", "export-all", "sample", "batch",
    "reset-password", "reset-security", "unlock", "restore",
}

_SECRET_KEY_PARTS = ("password", "token", "secret", "two_factor", "credential", "otp")
_MAX_STRING = 300
_MAX_ITEMS = 50
_MAX_DETAILS_CHARS = 8000

# Body fields that name the record, shown in the activity log
_LABEL_KEYS = ("name", "title", "company_name", "quote_number", "username", "email", "sku", "label")


def _redact(value: Any, depth: int = 0) -> Any:
    """Drop secrets and trim long strings / lists so details stay small"""
    if depth > 6:
        return "…"
    if isinstance(value, dict):
        return {
            key: "[redacted]" if any(part in str(key).lower() for part in _SECRET_KEY_PARTS)
            else _redact(item, depth + 1)
            for key, item in value.items()
        }
    if isinstance(value, list):
        trimmed = [_redact(item, depth + 1) for item in value[:_MAX_ITEMS]]
        if len(value) > _MAX_ITEMS:
            trimmed.append(f"… {len(value) - _MAX_ITEMS} more")
        return trimmed
    if isinstance(value, str) and len(value) > _MAX_STRING:
        return value[:_MAX_STRING] + "…"
    return value


def _label(body: Any) -> Optional[str]:
    if not isinstance(body, dict):
        return None
    for key in _LABEL_KEYS:
        value = body.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()[:120]
    return None


def describe_request(method: str, path: str) -> dict[str, Any]:
    """
    Turn an admin write into action / resource_type / resource_id / target.

    DELETE /api/v1/admin/products/12/variations/5
        -> delete, products, 12, target "variations/5"
    PATCH  /api/v1/admin/catalog/colors/3      -> update, colors, 3
    POST   /api/v1/admin/bulk/finishes         -> bulk_edit, finishes
    POST   /api/v1/admin/bulk/finishes/delete  -> permanent_delete, finishes
    POST   /api/v1/cms-admin/hero-slides       -> create, hero-slides
    """
    method = method.upper()
    if path.startswith(ADMIN_PREFIX):
        rest = path[len(ADMIN_PREFIX):]
    elif path.startswith(CMS_PREFIX):
        rest = path[len(CMS_PREFIX):]
    else:
        rest = path
    segments = [s for s in rest.strip("/").split("/") if s]
    if not segments:
        return {"action": method.lower(), "resource_type": "admin", "resource_id": None, "target": None}

    if segments[0] == "bulk" and len(segments) > 1:
        action = "permanent_delete" if segments[-1] == "delete" else "bulk_edit"
        return {"action": action, "resource_type": segments[1], "resource_id": None, "target": None}

    # /admin/catalog/<resource>/... is a namespace; /admin/ai/<thing> keeps it
    if segments[0] == "catalog" and len(segments) > 1:
        segments = segments[1:]
    elif segments[0] == "ai" and len(segments) > 1:
        segments = [f"ai-{segments[1]}", *segments[2:]]

    resource_type = segments[0]
    resource_id = None
    tail = segments[1:]
    if tail and tail[0].isdigit():
        resource_id = int(tail[0])
        tail = tail[1:]

    if method == "DELETE":
        action = "delete"
    elif method == "POST" and tail and tail[-1] in _VERBS:
        action = tail[-1].replace("-", "_")
        tail = tail[:-1]
    elif method == "POST" and (resource_id is None or tail):
        action = "create"
    elif tail and tail[-1] == "status":
        action = "update_status"
        tail = tail[:-1]
    else:
        action = "update"

    return {
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "target": "/".join(tail) or None,
    }


def _client_ip(conn: HTTPConnection) -> Optional[str]:
    return conn.client.host if conn.client else None


def _json_body(conn: HTTPConnection) -> Any:
    """
    The JSON body if the route already read it. Never reads the stream:
    by now the response may be sent, and multipart uploads aren't kept.
    """
    if not isinstance(conn, Request):
        return None
    raw = getattr(conn, "_body", None)
    if not raw or "json" not in conn.headers.get("content-type", ""):
        return None
    try:
        return json.loads(raw)
    except (ValueError, UnicodeDecodeError):
        return None


def _bounded(details: dict[str, Any]) -> dict[str, Any]:
    try:
        size = len(json.dumps(details, default=str))
    except (TypeError, ValueError):
        size = _MAX_DETAILS_CHARS + 1
    if size <= _MAX_DETAILS_CHARS:
        return details
    body = details.get("body")
    trimmed = {k: v for k, v in details.items() if k != "body"}
    if isinstance(body, dict):
        trimmed["body"] = {"_truncated": True, "fields": sorted(map(str, body))[:_MAX_ITEMS]}
    else:
        trimmed["body"] = {"_truncated": True}
    return trimmed


def build_entry(
    admin_id: int,
    action: str,
    resource_type: str,
    resource_id: Optional[int] = None,
    details: Optional[dict[str, Any]] = None,
    conn: Optional[HTTPConnection] = None,
) -> AdminAuditLog:
    return AdminAuditLog(
        admin_id=admin_id,
        action=action[:255],
        resource_type=(resource_type or "admin")[:100],
        resource_id=resource_id,
        details=_bounded(details or {}),
        ip_address=_client_ip(conn) if conn is not None else None,
        user_agent=(conn.headers.get("user-agent") or "")[:500] if conn is not None else None,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


async def record(
    db: AsyncSession,
    admin_id: int,
    action: str,
    resource_type: str,
    resource_id: Optional[int] = None,
    details: Optional[dict[str, Any]] = None,
    conn: Optional[HTTPConnection] = None,
) -> None:
    """Write one audit entry and commit. Never raises."""
    try:
        db.add(build_entry(admin_id, action, resource_type, resource_id, details, conn))
        await db.commit()
    except Exception as e:
        logger.error(f"Could not write admin audit entry ({action} {resource_type}): {e}")
        try:
            await db.rollback()
        except Exception:
            pass


def _request_details(conn: HTTPConnection, info: dict[str, Any], outcome: str) -> dict[str, Any]:
    body = _json_body(conn)
    details: dict[str, Any] = {
        "method": conn.scope.get("method"),
        "path": conn.url.path,
        "outcome": outcome,
    }
    if info.get("target"):
        details["target"] = info["target"]
    if conn.url.query:
        details["query"] = _redact(dict(conn.query_params))
    if body is not None:
        details["body"] = _redact(body)
        label = _label(body)
        if label:
            details["label"] = label
        if isinstance(body, dict) and isinstance(body.get("ids"), list):
            details["count"] = len(body["ids"])
    return details


# Columns never copied into the audit trail
_NOISE_COLUMNS = {"updated_at", "created_at", "last_activity", "view_count", "views"}
_MAX_CHANGED_ROWS = 50


def _jsonable(value: Any) -> Any:
    if isinstance(value, enum.Enum):
        return value.value
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (bytes, bytearray)):
        return f"<{len(value)} bytes>"
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def _value(key: str, value: Any) -> Any:
    if any(part in key.lower() for part in _SECRET_KEY_PARTS):
        return "[redacted]"
    return _redact(_jsonable(value))


class ChangeRecorder:
    """
    Collects before/after values of ORM rows flushed through one session
    while attached. Listens on the sync session behind the AsyncSession.
    """

    def __init__(self, db: AsyncSession):
        self._session = db.sync_session
        self._rows: dict[tuple[str, Any], dict] = {}
        self._overflow = 0

    def __enter__(self) -> "ChangeRecorder":
        event.listen(self._session, "after_flush", self._after_flush)
        return self

    def __exit__(self, *exc) -> None:
        if event.contains(self._session, "after_flush", self._after_flush):
            event.remove(self._session, "after_flush", self._after_flush)

    def _entry(self, obj, kind: str) -> Optional[dict]:
        state = inspect(obj)
        identity = state.identity
        key = (obj.__tablename__, identity[0] if identity and len(identity) == 1 else identity)
        if key not in self._rows:
            if len(self._rows) >= _MAX_CHANGED_ROWS:
                self._overflow += 1
                return None
            row = {"table": key[0], "id": _jsonable(key[1]), "change": kind, "fields": {}}
            name = next(
                (getattr(obj, a, None) for a in _LABEL_KEYS if isinstance(getattr(obj, a, None), str) and getattr(obj, a)),
                None,
            )
            if name:
                row["name"] = name[:120]
            self._rows[key] = row
        return self._rows[key]

    def _after_flush(self, session, flush_context) -> None:
        for obj in session.new:
            if isinstance(obj, AdminAuditLog):
                continue
            entry = self._entry(obj, "created")
            if entry is None:
                continue
            for attr in inspect(obj).mapper.column_attrs:
                key = attr.key
                value = getattr(obj, key, None)
                if key in _NOISE_COLUMNS or value is None:
                    continue
                entry["fields"][key] = [None, _value(key, value)]
        for obj in session.dirty:
            if isinstance(obj, AdminAuditLog) or not session.is_modified(obj, include_collections=False):
                continue
            state = inspect(obj)
            changed = {}
            for attr in state.mapper.column_attrs:
                key = attr.key
                if key in _NOISE_COLUMNS:
                    continue
                history = state.attrs[key].history
                if not history.has_changes():
                    continue
                old = history.deleted[0] if history.deleted else None
                new = history.added[0] if history.added else None
                if old == new:
                    continue
                changed[key] = [_value(key, old), _value(key, new)]
            if changed:
                entry = self._entry(obj, "updated")
                if entry is not None:
                    for key, (old, new) in changed.items():
                        # Keep the first "before" when a row is flushed more than once
                        before = entry["fields"].get(key, [old])[0]
                        entry["fields"][key] = [before, new]
        for obj in session.deleted:
            if isinstance(obj, AdminAuditLog):
                continue
            entry = self._entry(obj, "deleted")
            if entry is None:
                continue
            entry["change"] = "deleted"

    def summary(self) -> Optional[dict]:
        rows = [r for r in self._rows.values() if r["fields"] or r["change"] != "updated"]
        if not rows:
            return None
        out = {"changes": rows}
        if self._overflow:
            out["changes_omitted"] = self._overflow
        return out


async def audit_admin_request(
    conn: HTTPConnection,
    db: AsyncSession = Depends(get_db),
) -> AsyncGenerator[None, None]:
    """
    Router dependency: after an admin write, record it. Takes HTTPConnection
    (not Request) so it can attach to WebSocket routes too, which it skips.
    Uses the request's own session (get_db is cached per request), so the
    entry lands only once the route's work has been committed.
    get_current_admin stores the admin on request.state.
    """
    recorder = ChangeRecorder(db)
    history = _history_recorder(conn, db)
    try:
        with recorder, history or nullcontext():
            yield
    except InsufficientPermissionsError as e:
        admin = getattr(conn.state, "admin", None)
        if admin is not None and conn.scope["type"] == "http":
            info = describe_request(conn.scope["method"], conn.url.path)
            details = _request_details(conn, info, "denied")
            details["attempted"] = info["action"]
            details["reason"] = e.message
            # Refused before the route ran, so the session holds nothing to undo
            await record(db, admin.id, "denied", info["resource_type"], info["resource_id"], details, conn)
        raise

    if conn.scope["type"] != "http" or conn.scope["method"] in _READ_METHODS:
        return
    admin = getattr(conn.state, "admin", None)
    if admin is None:
        return
    info = describe_request(conn.scope["method"], conn.url.path)
    details = _request_details(conn, info, "success")
    if history is not None and history.entry_count:
        details["history_set"] = history.set_id
    changes = recorder.summary()
    if changes:
        details.update(changes)
        if "label" not in details:
            name = _changed_name(changes["changes"], info)
            if name:
                details["label"] = name
    await record(db, admin.id, info["action"], info["resource_type"], info["resource_id"], details, conn)


def _history_recorder(conn: HTTPConnection, db: AsyncSession):
    """
    Time Machine recorder for an admin write (history_service), or None.
    Stored on request.state.history so the restore route can label its set.
    """
    if not settings.HISTORY_ENABLED or conn.scope["type"] != "http" or conn.scope["method"] in _READ_METHODS:
        return None
    from backend.services.history_service import HistoryRecorder

    def admin_id():
        admin = getattr(conn.state, "admin", None)
        return admin.id if admin is not None else None

    history = HistoryRecorder(
        db,
        admin_id,
        describe_request(conn.scope["method"], conn.url.path),
        method=conn.scope["method"],
        path=conn.url.path,
    )
    conn.state.history = history
    return history


def _changed_name(rows: list[dict], info: dict) -> Optional[str]:
    """Name of the request's main record, from its captured values"""
    for row in rows:
        if info["resource_id"] is not None and row["id"] != info["resource_id"]:
            continue
        if row.get("name"):
            return row["name"]
    return None
