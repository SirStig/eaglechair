"""
EagleChair Database Base Module

Configures async SQLAlchemy with PostgreSQL support and YokedCache integration
"""

import logging
from datetime import datetime
from typing import AsyncGenerator

import orjson
from sqlalchemy import Column, DateTime, create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Session, declared_attr, sessionmaker
from sqlalchemy.pool import NullPool

from backend.core.config import settings

logger = logging.getLogger(__name__)


def orjson_serializer(obj):
    """
    Serialize object to JSON using orjson
    """
    # OPT_NON_STR_KEYS: column names are str subclasses (quoted_name), which
    # orjson otherwise rejects as dict keys
    return orjson.dumps(obj, option=orjson.OPT_NON_STR_KEYS).decode("utf-8")


def orjson_deserializer(obj):
    """
    Deserialize JSON to object using orjson
    """
    return orjson.loads(obj)


# NullPool does not accept pool_size/max_overflow kwargs, so only include
# them when we're not forcing NullPool (i.e. not in TESTING mode).
_async_engine_kwargs = dict(
    echo=settings.DATABASE_ECHO,
    pool_pre_ping=True,
    json_serializer=orjson_serializer,
    json_deserializer=orjson_deserializer,
)
if settings.TESTING:
    _async_engine_kwargs["poolclass"] = NullPool
else:
    _async_engine_kwargs["pool_size"] = settings.DATABASE_POOL_SIZE
    _async_engine_kwargs["max_overflow"] = settings.DATABASE_MAX_OVERFLOW

# MySQL (and shared hosts in front of it) drop idle connections after
# wait_timeout; recycle pooled connections before that so workers don't hand
# out dead connections. pool_pre_ping (above) covers any that slip through.
_IS_MYSQL = settings.database_url_async.startswith("mysql")
MYSQL_POOL_RECYCLE_SECONDS = 280
if _IS_MYSQL:
    _async_engine_kwargs["pool_recycle"] = MYSQL_POOL_RECYCLE_SECONDS

# Create async engine
engine = create_async_engine(settings.database_url_async, **_async_engine_kwargs)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Build a sync-driver URL for the background-task engine. Convert the
# async driver prefixes to their sync equivalents:
#   postgresql+asyncpg:// -> postgresql+psycopg2://
#   mysql+aiomysql://     -> mysql+pymysql://
#   sqlite+aiosqlite://   -> sqlite://
_sync_database_url = (
    settings.database_url_async.replace("+asyncpg", "")
    .replace("postgresql://", "postgresql+psycopg2://")
    .replace("mysql+aiomysql://", "mysql+pymysql://")
    .replace("sqlite+aiosqlite://", "sqlite://")
)

_sync_engine_kwargs = dict(
    echo=settings.DATABASE_ECHO,
    pool_pre_ping=True,
    json_serializer=orjson_serializer,
    json_deserializer=orjson_deserializer,
)
if settings.TESTING:
    _sync_engine_kwargs["poolclass"] = NullPool
else:
    # The sync engine only serves background jobs (catalog PDF parsing) and
    # scripts, so keep its pool small; each Gunicorn worker gets its own.
    _sync_engine_kwargs["pool_size"] = 2
    _sync_engine_kwargs["max_overflow"] = 3
if _IS_MYSQL:
    _sync_engine_kwargs["pool_recycle"] = MYSQL_POOL_RECYCLE_SECONDS

# Create sync engine for background tasks (PDF parsing, etc.)
sync_engine = create_engine(_sync_database_url, **_sync_engine_kwargs)

# Create sync session factory for background tasks
SessionLocal = sessionmaker(
    sync_engine,
    class_=Session,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """
    Base class for all database models

    Provides common functionality like tablename generation and timestamps
    """

    @declared_attr.directive
    def __tablename__(cls) -> str:
        """Generate __tablename__ automatically from class name"""
        return cls.__name__.lower() + "s"

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency for getting async database sessions

    Yields:
        AsyncSession: Database session
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# Tables that carry a `token_version` column (JWT revocation counter)
TOKEN_VERSION_TABLES = ("companies", "admin_users")


def _token_version_column_missing(sync_conn, table: str) -> bool:
    """True if `table` exists and has no token_version column"""
    from sqlalchemy import inspect

    inspector = inspect(sync_conn)
    if table not in inspector.get_table_names():
        return False
    return not any(col["name"] == "token_version" for col in inspector.get_columns(table))


def _add_token_version_column(sync_conn, table: str) -> bool:
    """
    Add token_version to `table` if it exists and lacks the column.

    Returns True if the column was added. Portable across MySQL, SQLite and
    PostgreSQL (plain ADD COLUMN with a constant default).
    """
    from sqlalchemy import text

    if not _token_version_column_missing(sync_conn, table):
        return False
    quoted = sync_conn.dialect.identifier_preparer.quote(table)
    sync_conn.execute(
        text(f"ALTER TABLE {quoted} ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0")
    )
    return True


async def ensure_token_version_columns(target_engine=None) -> list[str]:
    """
    Idempotently add the token_version column to existing tables.

    create_all() does not add columns to tables that already exist, so this
    runs at startup (and via backend/scripts/add_token_version_columns.py).
    Each table is altered in its own transaction; a concurrent worker adding
    the same column first is tolerated.

    Returns:
        Names of tables that were altered
    """
    target_engine = target_engine or engine
    added = []
    for table in TOKEN_VERSION_TABLES:
        try:
            async with target_engine.begin() as conn:
                if await conn.run_sync(_add_token_version_column, table):
                    added.append(table)
                    logger.info(f"[DB] Added token_version column to {table}")
        except Exception as e:
            # Another worker may have added it concurrently - re-check
            async with target_engine.connect() as conn:
                still_missing = await conn.run_sync(_token_version_column_missing, table)
            if still_missing:
                logger.error(f"[DB] Failed to add token_version column to {table}: {e}")
                raise
    return added


# Tables that carry a `spec_profile` column (which spec symbols product pages show)
SPEC_PROFILE_TABLES = ("categories", "product_subcategories")

# One-time defaults by slug, applied only when the column is first added so the
# existing catalog shows spec symbols without manual setup. Admins change them
# afterwards in the category editor.
SPEC_PROFILE_DEFAULTS = {
    "chairs": "chair",
    "outdoor-chairs": "chair",
    "barstools": "barstool",
    "outdoor-barstools": "barstool",
    "benches-ottomans": "bench",
    "table-bases": "table_base",
    "outdoor-bases": "table_base",
    "table": "table",
    "outdoor-tables": "table",
    "booths-banquettes": "booth",
}


def _spec_profile_column_missing(sync_conn, table: str) -> bool:
    """True if `table` exists and has no spec_profile column"""
    from sqlalchemy import inspect

    inspector = inspect(sync_conn)
    if table not in inspector.get_table_names():
        return False
    return not any(col["name"] == "spec_profile" for col in inspector.get_columns(table))


def _add_spec_profile_column(sync_conn, table: str) -> bool:
    """
    Add spec_profile to `table` if it exists and lacks the column, then fill
    in SPEC_PROFILE_DEFAULTS by slug. Returns True if the column was added.
    """
    from sqlalchemy import text

    if not _spec_profile_column_missing(sync_conn, table):
        return False
    quoted = sync_conn.dialect.identifier_preparer.quote(table)
    sync_conn.execute(text(f"ALTER TABLE {quoted} ADD COLUMN spec_profile VARCHAR(32)"))
    for slug, profile in SPEC_PROFILE_DEFAULTS.items():
        sync_conn.execute(
            text(f"UPDATE {quoted} SET spec_profile = :profile WHERE slug = :slug"),
            {"profile": profile, "slug": slug},
        )
    return True


async def ensure_spec_profile_columns(target_engine=None) -> list[str]:
    """
    Idempotently add the spec_profile column to the category tables.

    Same approach as ensure_token_version_columns (create_all() does not add
    columns to existing tables). Returns names of tables that were altered.
    """
    target_engine = target_engine or engine
    added = []
    for table in SPEC_PROFILE_TABLES:
        try:
            async with target_engine.begin() as conn:
                if await conn.run_sync(_add_spec_profile_column, table):
                    added.append(table)
                    logger.info(f"[DB] Added spec_profile column to {table}")
        except Exception as e:
            # Another worker may have added it concurrently - re-check
            async with target_engine.connect() as conn:
                still_missing = await conn.run_sync(_spec_profile_column_missing, table)
            if still_missing:
                logger.error(f"[DB] Failed to add spec_profile column to {table}: {e}")
                raise
    return added


# Product option columns added after chairs / product_variations first shipped.
# Listed in add order; each is a plain ADD COLUMN that MySQL, SQLite and
# PostgreSQL all accept.
PRODUCT_OPTION_COLUMNS = {
    "chairs": {
        "available_laminates": "JSON",
        "upholstery_amount": "FLOAT",
        "upholstery_enabled": "BOOLEAN NOT NULL DEFAULT TRUE",
        "colors_enabled": "BOOLEAN NOT NULL DEFAULT TRUE",
        "laminates_enabled": "BOOLEAN NOT NULL DEFAULT TRUE",
        "material_sources": "JSON",
    },
    "product_variations": {
        "upholstery_amount": "FLOAT",
        "upholstery_enabled": "BOOLEAN",
        "colors_enabled": "BOOLEAN",
        "laminates_enabled": "BOOLEAN",
    },
}


def _missing_product_option_columns(sync_conn) -> list[tuple[str, str]]:
    """(table, column) pairs of PRODUCT_OPTION_COLUMNS that don't exist yet"""
    from sqlalchemy import inspect

    inspector = inspect(sync_conn)
    tables = set(inspector.get_table_names())
    missing = []
    for table, columns in PRODUCT_OPTION_COLUMNS.items():
        if table not in tables:
            continue
        present = {col["name"] for col in inspector.get_columns(table)}
        missing.extend((table, column) for column in columns if column not in present)
    return missing


def _add_product_option_column(sync_conn, table: str, column: str) -> bool:
    from sqlalchemy import text

    if (table, column) not in _missing_product_option_columns(sync_conn):
        return False
    quoted = sync_conn.dialect.identifier_preparer.quote(table)
    sync_conn.execute(
        text(f"ALTER TABLE {quoted} ADD COLUMN {column} {PRODUCT_OPTION_COLUMNS[table][column]}")
    )
    return True


async def ensure_product_option_columns(target_engine=None) -> list[str]:
    """
    Idempotently add product option columns to existing tables.

    Same approach as ensure_token_version_columns. Returns "table.column"
    names that were added.
    """
    target_engine = target_engine or engine
    async with target_engine.connect() as conn:
        missing = await conn.run_sync(_missing_product_option_columns)
    added = []
    for table, column in missing:
        try:
            async with target_engine.begin() as conn:
                if await conn.run_sync(_add_product_option_column, table, column):
                    added.append(f"{table}.{column}")
                    logger.info(f"[DB] Added {table}.{column}")
        except Exception as e:
            # Another worker may have added it concurrently - re-check
            async with target_engine.connect() as conn:
                still_missing = (table, column) in await conn.run_sync(_missing_product_option_columns)
            if still_missing:
                logger.error(f"[DB] Failed to add {table}.{column}: {e}")
                raise
    return added


def _missing_analytics_columns(sync_conn) -> list[str]:
    """Columns of ANALYTICS_ADDED_COLUMNS the analytics_events table lacks"""
    from sqlalchemy import inspect

    from backend.models.analytics import ANALYTICS_ADDED_COLUMNS

    inspector = inspect(sync_conn)
    if "analytics_events" not in inspector.get_table_names():
        return []
    present = {col["name"] for col in inspector.get_columns("analytics_events")}
    return [name for name in ANALYTICS_ADDED_COLUMNS if name not in present]


def _add_analytics_column(sync_conn, column: str) -> bool:
    from sqlalchemy import text

    from backend.models.analytics import ANALYTICS_ADDED_COLUMNS

    if column not in _missing_analytics_columns(sync_conn):
        return False
    sync_conn.execute(
        text(f"ALTER TABLE analytics_events ADD COLUMN {column} {ANALYTICS_ADDED_COLUMNS[column]}")
    )
    return True


async def ensure_analytics_columns(target_engine=None) -> list[str]:
    """
    Idempotently add columns introduced after analytics_events first shipped.

    Same approach as ensure_token_version_columns. Returns the added columns.
    """
    target_engine = target_engine or engine
    async with target_engine.connect() as conn:
        missing = await conn.run_sync(_missing_analytics_columns)
    added = []
    for column in missing:
        try:
            async with target_engine.begin() as conn:
                if await conn.run_sync(_add_analytics_column, column):
                    added.append(column)
                    logger.info(f"[DB] Added analytics_events.{column}")
        except Exception as e:
            # Another worker may have added it concurrently - re-check
            async with target_engine.connect() as conn:
                still_missing = column in await conn.run_sync(_missing_analytics_columns)
            if still_missing:
                logger.error(f"[DB] Failed to add analytics_events.{column}: {e}")
                raise

    # Indexes added with those columns (create_all() skips existing tables too)
    try:
        async with target_engine.begin() as conn:
            await conn.run_sync(_ensure_analytics_indexes)
    except Exception as e:
        logger.warning(f"[DB] Could not add analytics_events indexes: {e}")
    return added


def _ensure_analytics_indexes(sync_conn) -> None:
    from sqlalchemy import inspect

    from backend.models.analytics import AnalyticsEvent

    inspector = inspect(sync_conn)
    if "analytics_events" not in inspector.get_table_names():
        return
    present = {ix["name"] for ix in inspector.get_indexes("analytics_events")}
    for index in AnalyticsEvent.__table__.indexes:
        if index.name not in present:
            index.create(sync_conn)
            logger.info(f"[DB] Added index {index.name}")


def _admin_permissions_column_missing(sync_conn) -> bool:
    from sqlalchemy import inspect

    inspector = inspect(sync_conn)
    if "admin_users" not in inspector.get_table_names():
        return False
    return not any(col["name"] == "permissions" for col in inspector.get_columns("admin_users"))


def _add_admin_permissions_column(sync_conn) -> bool:
    from sqlalchemy import text

    if not _admin_permissions_column_missing(sync_conn):
        return False
    sync_conn.execute(text("ALTER TABLE admin_users ADD COLUMN permissions JSON"))
    return True


def _ensure_admin_audit_indexes(sync_conn) -> None:
    from sqlalchemy import inspect

    from backend.models.company import AdminAuditLog

    inspector = inspect(sync_conn)
    if "admin_audit_logs" not in inspector.get_table_names():
        return
    present = {ix["name"] for ix in inspector.get_indexes("admin_audit_logs")}
    for index in AdminAuditLog.__table__.indexes:
        if index.name not in present:
            index.create(sync_conn)
            logger.info(f"[DB] Added index {index.name}")


async def ensure_admin_access_schema(target_engine=None) -> bool:
    """
    Idempotently add admin_users.permissions and the admin_audit_logs
    indexes to existing tables. Same approach as ensure_token_version_columns.

    Returns:
        True if the permissions column was added
    """
    target_engine = target_engine or engine
    added = False
    try:
        async with target_engine.begin() as conn:
            added = await conn.run_sync(_add_admin_permissions_column)
            if added:
                logger.info("[DB] Added admin_users.permissions")
    except Exception as e:
        # Another worker may have added it concurrently - re-check
        async with target_engine.connect() as conn:
            if await conn.run_sync(_admin_permissions_column_missing):
                logger.error(f"[DB] Failed to add admin_users.permissions: {e}")
                raise
    try:
        async with target_engine.begin() as conn:
            await conn.run_sync(_ensure_admin_audit_indexes)
    except Exception as e:
        logger.warning(f"[DB] Could not add admin_audit_logs indexes: {e}")
    return added


async def init_db() -> None:
    """
    Initialize database - create all tables

    Note: In production, use Alembic migrations instead
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await ensure_token_version_columns()
    await ensure_spec_profile_columns()
    await ensure_analytics_columns()
    await ensure_product_option_columns()
    await ensure_admin_access_schema()


async def close_db() -> None:
    """Close database engine and cleanup connections"""
    await engine.dispose()
