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


async def init_db() -> None:
    """
    Initialize database - create all tables

    Note: In production, use Alembic migrations instead
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db() -> None:
    """Close database engine and cleanup connections"""
    await engine.dispose()
