"""
Time Machine history (backend/services/history_service.py)

One HistoryChangeSet per admin request that changed tracked rows, and one
HistoryEntry per row it created, updated or deleted. Entries hold only what
a revert needs: the old values of the changed columns for an update, the
full row for a delete, the key for a create. Rows older than
HISTORY_RETENTION_DAYS are purged daily.

No foreign keys: history outlives the admins and rows it describes.
"""

from sqlalchemy import JSON, BigInteger, Column, DateTime, Index, Integer, String

from backend.database.base import Base

# BIGINT autoincrement isn't supported by SQLite (tests); INTEGER is its rowid
_BigId = BigInteger().with_variant(Integer, "sqlite")


class HistoryChangeSet(Base):
    __tablename__ = "history_change_sets"
    __table_args__ = (Index("ix_history_change_sets_created_at", "created_at"),)

    id = Column(String(32), primary_key=True)  # uuid4 hex
    admin_id = Column(Integer, nullable=True, index=True)
    # From audit_service.describe_request, for the timeline sentence
    action = Column(String(64), nullable=False)
    resource_type = Column(String(100), nullable=False)
    resource_id = Column(Integer, nullable=True)
    method = Column(String(10), nullable=True)
    path = Column(String(500), nullable=True)
    # Set when this change set was itself a Time Machine restore
    restores_set_id = Column(String(32), nullable=True)
    restores_entry_id = Column(_BigId, nullable=True)
    # Set when a later restore undid this change set
    reverted_at = Column(DateTime, nullable=True)
    reverted_by_set_id = Column(String(32), nullable=True)


class HistoryEntry(Base):
    __tablename__ = "history_entries"
    __table_args__ = (
        Index("ix_history_entries_row", "table_name", "row_key"),
        Index("ix_history_entries_created_at", "created_at"),
    )

    id = Column(_BigId, primary_key=True, autoincrement=True)
    change_set_id = Column(String(32), nullable=False, index=True)
    table_name = Column(String(64), nullable=False)
    # Primary key values joined with "|" (or the identifying columns of a
    # key-less link row), for finding a record's versions
    row_key = Column(String(191), nullable=False)
    op = Column(String(10), nullable=False)  # created / updated / deleted
    label = Column(String(200), nullable=True)
    # "table:row_key" of the deleted row this one was removed with (cascades)
    via = Column(String(260), nullable=True)
    # {"key": {col: v}, "before": {col: v}, "after": {col: v}} - values
    # encoded by history_service.encode_value
    data = Column(JSON, nullable=False)
