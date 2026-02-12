import asyncio
import logging
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from backend.core.config import settings
from backend.core.security import SecurityManager
from backend.models.company import AdminUser

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def reset_password():
    """Reset admin password to temp123"""

    db_url = settings.DATABASE_URL
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif db_url.startswith("postgresql+psycopg2://"):
        db_url = db_url.replace("postgresql+psycopg2://", "postgresql+asyncpg://", 1)

    engine = create_async_engine(db_url, echo=False, future=True)
    async_session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with async_session_factory() as session:
        try:
            # Find admin user
            result = await session.execute(
                select(AdminUser).where(AdminUser.email == "admin@eaglechair.com")
            )
            admin = result.scalar_one_or_none()

            if not admin:
                logger.error("❌ Admin user not found!")
                return

            # Update password
            new_hash = SecurityManager.hash_password("temp123")
            await session.execute(
                update(AdminUser)
                .where(AdminUser.email == "admin@eaglechair.com")
                .values(hashed_password=new_hash)
            )
            await session.commit()
            logger.info("✅ Password for admin@eaglechair.com reset to: temp123")

        except Exception as e:
            logger.error(f"❌ Error resetting password: {e}")
            await session.rollback()
        finally:
            await engine.dispose()


if __name__ == "__main__":
    asyncio.run(reset_password())
