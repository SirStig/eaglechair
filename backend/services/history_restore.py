"""
Time Machine restores (history recorded by backend/services/history_service.py)

Two kinds of target:

  - a change set: undo everything one admin request did
  - an entry: rewind one record to just before that change - every later
    change to the record is undone too, along with its link rows (product
    <-> category etc.) and, for a delete, the rows removed with it

plan() checks every step against the database without changing anything:

  restore   re-insert a deleted row     noop if it's back already; blocked
                                        if a row it points at is gone
  revert    put old field values back   conflict if the field has changed
                                        since (force overwrites); blocked if
                                        the row no longer exists
  remove    delete a created row        noop if already gone; blocked if
                                        other rows still need it

apply() runs the plan in one transaction - restores (parents first), then
reverts (newest first), then removes - all or nothing. It goes through the
admin request's session, so the restore is itself recorded and can be
undone the same way.
"""

import logging
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Table, delete, func, insert, select, update
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.base import Base
from backend.models.history import HistoryChangeSet, HistoryEntry
from backend.services.history_labels import table_label
from backend.services.history_service import (
    OP_CREATED,
    OP_DELETED,
    OP_UPDATED,
    decode_row,
    decode_value,
    encode_value,
    identity_columns,
    key_clause,
    references,
    row_key,
)
from backend.services.history_service import table as get_table

logger = logging.getLogger(__name__)

RESTORE, REVERT, REMOVE = "restore", "revert", "remove"
OK, NOOP, CONFLICT, BLOCKED = "ok", "noop", "conflict", "blocked"

_KIND = {OP_DELETED: RESTORE, OP_UPDATED: REVERT, OP_CREATED: REMOVE}
_MAX_RESTORE_PASSES = 8


class RestoreError(Exception):
    pass


@dataclass
class Step:
    entry: HistoryEntry
    kind: str
    status: str = OK
    message: Optional[str] = None
    conflicts: list[dict] = field(default_factory=list)

    @property
    def table(self) -> Optional[Table]:
        return get_table(self.entry.table_name)

    @property
    def key(self) -> dict:
        return (self.entry.data or {}).get("key") or {}

    def to_dict(self) -> dict:
        return {
            "entry_id": self.entry.id,
            "kind": self.kind,
            "status": self.status,
            "message": self.message,
            "conflicts": self.conflicts,
        }


@dataclass
class Plan:
    steps: list[Step]

    @property
    def blocked(self) -> list[Step]:
        return [s for s in self.steps if s.status == BLOCKED]

    @property
    def conflicts(self) -> list[Step]:
        return [s for s in self.steps if s.status == CONFLICT]

    @property
    def actionable(self) -> list[Step]:
        return [s for s in self.steps if s.status in (OK, CONFLICT)]


# ---------------------------------------------------------------------------
# What to undo
# ---------------------------------------------------------------------------

async def entries_for_change_set(db: AsyncSession, set_id: str) -> list[HistoryEntry]:
    return list((await db.execute(
        select(HistoryEntry).where(HistoryEntry.change_set_id == set_id).order_by(HistoryEntry.id)
    )).scalars().all())


def is_link_table(tbl: Table) -> bool:
    """Association table: every key column is a foreign key"""
    cols = identity_columns(tbl)
    return bool(cols) and all(c.foreign_keys for c in cols)


def _points_at(entry: HistoryEntry, fk_column, referenced_value) -> bool:
    data = entry.data or {}
    for part in ("key", "before"):
        value = (data.get(part) or {}).get(fk_column.name)
        if value is not None and str(value) == str(referenced_value):
            return True
    return False


class _CascadeIndex:
    """
    Within one change set: which deleted / unlinked rows point at which row,
    through ON DELETE CASCADE / SET NULL foreign keys (built once, O(n))
    """

    def __init__(self, entries: list[HistoryEntry]):
        self._by_target: dict[tuple[str, str, str], list[HistoryEntry]] = defaultdict(list)
        for e in entries:
            tbl = get_table(e.table_name)
            if tbl is None or e.op == OP_CREATED:
                continue
            data = e.data or {}
            before = data.get("before") or {}
            values = {**(data.get("key") or {}), **before}
            for fk in tbl.foreign_keys:
                if (fk.ondelete or "").upper() not in ("CASCADE", "SET NULL"):
                    continue
                if e.op == OP_UPDATED and fk.parent.name not in before:
                    continue  # an edit, not an unlink
                value = values.get(fk.parent.name)
                if value is not None:
                    self._by_target[(fk.column.table.name, fk.column.name, str(value))].append(e)

    def children(self, parent: HistoryEntry) -> list[HistoryEntry]:
        if parent.op != OP_DELETED:
            return []
        before = (parent.data or {}).get("before") or {}
        out = []
        for column, value in before.items():
            if value is not None:
                out += self._by_target.get((parent.table_name, column, str(value)), [])
        return [e for e in out if e.id != parent.id]


def dependents_in_set(entries: list[HistoryEntry], root: HistoryEntry) -> list[HistoryEntry]:
    """Rows of the same change set removed or unlinked because `root` was deleted (recursively)"""
    index = _CascadeIndex(entries)
    found: dict[int, HistoryEntry] = {}
    queue = [root]
    while queue:
        for child in index.children(queue.pop()):
            if child.id not in found and child.id != root.id:
                found[child.id] = child
                queue.append(child)
    return sorted(found.values(), key=lambda e: e.id)


def cascade_parents(entries: list[HistoryEntry]) -> dict[int, int]:
    """{entry id: id of the deleted entry it went with} for one change set"""
    index = _CascadeIndex(entries)
    parents: dict[int, int] = {}
    deleted = sorted(
        (e for e in entries if e.op == OP_DELETED),
        key=lambda e: (_TABLE_ORDER.get(e.table_name, 0), e.id),
    )
    for parent in deleted:
        for child in index.children(parent):
            if child.id not in parents and child.id != parent.id:
                parents[child.id] = parent.id
    return parents


async def entries_for_record(db: AsyncSession, entry: HistoryEntry) -> list[HistoryEntry]:
    """
    Entries undone by rewinding entry's record to just before it: this and
    every later change to the record, later link-row changes that point at
    it, and the rows each of its deletes took with it.
    """
    record = list((await db.execute(
        select(HistoryEntry)
        .where(
            HistoryEntry.table_name == entry.table_name,
            HistoryEntry.row_key == entry.row_key,
            HistoryEntry.id >= entry.id,
        )
        .order_by(HistoryEntry.id)
    )).scalars().all())
    picked = {e.id: e for e in record}

    tbl = get_table(entry.table_name)
    key = (entry.data or {}).get("key") or {}
    if tbl is not None:
        links = [(o, c, r) for o, c, r, _ in references(tbl) if is_link_table(o) and r.name in key]
        if links:
            candidates = (await db.execute(
                select(HistoryEntry).where(
                    HistoryEntry.id > entry.id,
                    HistoryEntry.table_name.in_({o.name for o, _, _ in links}),
                )
            )).scalars().all()
            for e in candidates:
                if any(e.table_name == o.name and _points_at(e, c, key[r.name]) for o, c, r in links):
                    picked[e.id] = e

    for deleted in [e for e in record if e.op == OP_DELETED]:
        siblings = await entries_for_change_set(db, deleted.change_set_id)
        for e in dependents_in_set(siblings, deleted):
            picked[e.id] = e
    return sorted(picked.values(), key=lambda e: e.id)


# ---------------------------------------------------------------------------
# Planning
# ---------------------------------------------------------------------------

_TABLE_ORDER = {t.name: i for i, t in enumerate(Base.metadata.sorted_tables)}


def table_order(name: str) -> int:
    """Position in foreign-key order: parents before the rows that point at them"""
    return _TABLE_ORDER.get(name, 0)


def _same(column, a: Any, b: Any) -> bool:
    if a == b:
        return True
    try:
        return decode_value(column, a) == decode_value(column, b)
    except (TypeError, ValueError, KeyError, ArithmeticError):
        return False


class _World:
    """The database as the plan would leave it, read lazily"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.rows: dict[tuple[str, str], Optional[dict]] = {}

    async def get(self, tbl: Table, key: dict) -> Optional[dict]:
        k = (tbl.name, row_key(key))
        if k not in self.rows:
            row = (await self.db.execute(select(tbl).where(key_clause(tbl, key)))).mappings().first()
            self.rows[k] = {n: encode_value(v) for n, v in dict(row).items()} if row else None
        return self.rows[k]

    def set(self, tbl: Table, key: dict, row: Optional[dict]) -> None:
        self.rows[(tbl.name, row_key(key))] = row

    async def parent_exists(self, fk, value) -> bool:
        parent = fk.column.table
        if [c.name for c in identity_columns(parent)] == [fk.column.name]:
            return await self.get(parent, {fk.column.name: value}) is not None
        found = (await self.db.execute(
            select(func.count()).select_from(parent).where(fk.column == decode_value(fk.column, value))
        )).scalar_one()
        return bool(found)


async def _missing_parent(world: _World, tbl: Table, values: dict) -> Optional[str]:
    for fk in tbl.foreign_keys:
        value = values.get(fk.parent.name)
        if value is None:
            continue
        if fk.column.table is tbl and str(value) == str(values.get(fk.column.name)):
            continue  # points at itself
        if not await world.parent_exists(fk, value):
            return f"needs {table_label(fk.column.table.name)} #{value}, which no longer exists"
    return None


async def _blocking_dependents(db: AsyncSession, tbl: Table, row: dict) -> Optional[str]:
    """Rows that would stop `row` being deleted (FKs without ON DELETE CASCADE / SET NULL)"""
    for other, column, referenced, ondelete in references(tbl):
        if ondelete in ("CASCADE", "SET NULL") or other is tbl:
            continue
        value = row.get(referenced.name)
        if value is None:
            continue
        count = (await db.execute(
            select(func.count()).select_from(other).where(column == decode_value(referenced, value))
        )).scalar_one()
        if count:
            noun = table_label(other.name).lower()
            return f"still used by {count} {noun}{'' if count == 1 else 's'}"
    return None


def _ordered(steps: list[Step]) -> list[Step]:
    restores = sorted(
        (s for s in steps if s.kind == RESTORE),
        key=lambda s: (_TABLE_ORDER.get(s.entry.table_name, 0), s.entry.id),
    )
    reverts = sorted((s for s in steps if s.kind == REVERT), key=lambda s: -s.entry.id)
    removes = sorted((s for s in steps if s.kind == REMOVE), key=lambda s: -s.entry.id)
    return restores + reverts + removes


async def plan(db: AsyncSession, entries: list[HistoryEntry]) -> Plan:
    steps = _ordered([Step(e, _KIND[e.op]) for e in entries if e.op in _KIND])
    world = _World(db)

    for step in steps:
        if step.table is None:
            step.status, step.message = BLOCKED, f"{step.entry.table_name} no longer exists"

    # Restores go in passes, so a row whose parent is restored later in the
    # plan (self-referencing tables) still goes through
    pending = [s for s in steps if s.kind == RESTORE and s.status == OK]
    reasons: dict[int, str] = {}
    for _ in range(_MAX_RESTORE_PASSES):
        progress = False
        for step in list(pending):
            before = (step.entry.data or {}).get("before") or {}
            if await world.get(step.table, step.key) is not None:
                step.status, step.message = NOOP, "already exists"
                pending.remove(step)
                continue
            reason = await _missing_parent(world, step.table, before)
            if reason:
                reasons[step.entry.id] = reason
                continue
            world.set(step.table, step.key, dict(before))
            pending.remove(step)
            progress = True
        if not pending or not progress:
            break
    for step in pending:
        step.status, step.message = BLOCKED, reasons.get(step.entry.id, "can't be restored")

    for step in steps:
        if step.status != OK or step.kind == RESTORE:
            continue
        current = await world.get(step.table, step.key)
        if step.kind == REVERT:
            if current is None:
                step.status, step.message = BLOCKED, "the record no longer exists"
                continue
            data = step.entry.data or {}
            before = {k: v for k, v in (data.get("before") or {}).items() if k in step.table.c}
            after = data.get("after") or {}
            if all(_same(step.table.c[k], current.get(k), v) for k, v in before.items()):
                step.status, step.message = NOOP, "already has these values"
                continue
            reason = await _missing_parent(world, step.table, before)
            if reason:
                step.status, step.message = BLOCKED, reason
                continue
            for name in before:
                if name in after and not _same(step.table.c[name], current.get(name), after[name]):
                    step.conflicts.append({"field": name, "expected": after[name], "current": current.get(name)})
            if step.conflicts:
                step.status = CONFLICT
                step.message = "changed again since; restoring overwrites the newer value"
            world.set(step.table, step.key, {**current, **before})
        else:  # REMOVE
            if current is None:
                step.status, step.message = NOOP, "already gone"
                continue
            reason = await _blocking_dependents(db, step.table, current)
            if reason:
                step.status, step.message = BLOCKED, reason
                continue
            world.set(step.table, step.key, None)
    return Plan(steps)


# ---------------------------------------------------------------------------
# Applying
# ---------------------------------------------------------------------------

async def apply(db: AsyncSession, the_plan: Plan, force: bool = False) -> dict:
    """
    Run the plan's ok (and, with force, conflict) steps. Raises RestoreError
    if anything is blocked or a statement fails; the caller rolls back.
    Returns {"counts": {kind: n}, "touched": [(table, row values)]}.
    """
    if the_plan.blocked:
        raise RestoreError(the_plan.blocked[0].message or "Some changes can't be undone")
    if the_plan.conflicts and not force:
        raise RestoreError("Some records changed again since; confirm to overwrite them")

    counts: dict[str, int] = defaultdict(int)
    touched: list[tuple[Table, dict]] = []
    steps = the_plan.actionable

    pending = [s for s in steps if s.kind == RESTORE]
    for _ in range(_MAX_RESTORE_PASSES):
        failed = []
        for step in pending:
            values = decode_row(step.table, (step.entry.data or {}).get("before") or {})
            try:
                async with db.begin_nested():
                    await db.execute(insert(step.table).values(**values))
            except DBAPIError:
                failed.append(step)
                continue
            counts[RESTORE] += 1
            touched.append((step.table, values))
        progress = len(failed) < len(pending)
        pending = failed
        if not pending or not progress:
            break
    if pending:
        step = pending[0]
        raise RestoreError(
            f"Couldn't restore {step.entry.label or table_label(step.entry.table_name)}: "
            "it clashes with a newer record (same name, SKU or slug?)"
        )

    for step in steps:
        if step.kind == RESTORE:
            continue
        where = key_clause(step.table, step.key)
        try:
            if step.kind == REVERT:
                values = decode_row(step.table, (step.entry.data or {}).get("before") or {})
                if not values:
                    continue
                await db.execute(update(step.table).where(where).values(**values))
                counts[REVERT] += 1
                current = (await db.execute(select(step.table).where(where))).mappings().first()
                touched.append((step.table, dict(current) if current else values))
            else:  # REMOVE
                current = (await db.execute(select(step.table).where(where))).mappings().first()
                await db.execute(delete(step.table).where(where))
                counts[REMOVE] += 1
                if current:
                    touched.append((step.table, dict(current)))
        except DBAPIError as exc:
            logger.warning(f"[HISTORY] Restore step for entry {step.entry.id} failed: {exc}")
            raise RestoreError(
                f"Couldn't undo the change to {step.entry.label or table_label(step.entry.table_name)}"
            )
    return {"counts": dict(counts), "touched": touched}


async def mark_reverted(db: AsyncSession, set_ids: list[str], by_set_id: Optional[str]) -> None:
    if not set_ids:
        return
    await db.execute(
        update(HistoryChangeSet)
        .where(HistoryChangeSet.id.in_(set_ids))
        .values(reverted_at=datetime.utcnow(), reverted_by_set_id=by_set_id)
    )
