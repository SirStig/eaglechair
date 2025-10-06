"""
EagleChair Database Base Module

Configures async SQLAlchemy with PostgreSQL support
"""

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
    async_sessionmaker
)
from sqlalchemy.orm import DeclarativeBase, declared_attr
from sqlalchemy.pool import NullPool
from datetime import datetime
from sqlalchemy import Column, DateTime

from backend.core.config import settings


# Create async engine
engine = create_async_engine(
    settings.database_url_async,
    echo=settings.DATABASE_ECHO,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    pool_pre_ping=True,
    poolclass=NullPool if settings.TESTING else None,
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
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
        return cls.__name__.lower() + 's'
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
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
            await session.commit()
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

