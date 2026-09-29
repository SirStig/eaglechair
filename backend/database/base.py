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
    return orjson.dumps(obj).decode("utf-8")


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
_sync_database_url = (
    settings.database_url_async.replace("+asyncpg", "")
    .replace("postgresql://", "postgresql+psycopg2://")
    .replace("mysql+aiomysql://", "mysql+pymysql://")
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
    _sync_engine_kwargs["pool_size"] = settings.DATABASE_POOL_SIZE
    _sync_engine_kwargs["max_overflow"] = settings.DATABASE_MAX_OVERFLOW

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


async def init_db() -> None:
    """
    Initialize database - create all tables

    Note: In production, use Alembic migrations instead
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await ensure_token_version_columns()


async def close_db() -> None:
    """Close database engine and cleanup connections"""
    await engine.dispose()
