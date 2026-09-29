"""
Seed Admin User Script

Creates an initial admin user for the system.
Run this script after setting up the database.

Usage:
    python -m backend.scripts.seed_admin [--password PASSWORD]

Without --password a strong random password is generated and printed once.
"""

import argparse
import asyncio
import logging
import secrets
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.core.config import settings
from backend.core.security import SecurityManager
from backend.database.base import ensure_token_version_columns
from backend.models.company import AdminRole, AdminUser, Company, CompanyStatus

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def seed_admin_user(password: str | None = None):
    """Create admin user and company"""
    generated = password is None
    if generated:
        password = secrets.token_urlsafe(24)

    # Create async engine (convert postgresql:// to postgresql+asyncpg://)
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif db_url.startswith("postgresql+psycopg2://"):
        db_url = db_url.replace("postgresql+psycopg2://", "postgresql+asyncpg://", 1)

    engine = create_async_engine(db_url, echo=False, future=True)

    # Make sure the token_version columns exist before touching the models
    await ensure_token_version_columns(engine)

    # Create async session factory
    async_session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with async_session_factory() as session:
        try:
            # Check if admin already exists
            result = await session.execute(
                select(AdminUser).where(AdminUser.email == "admin@eaglechair.com")
            )
            existing_admin = result.scalar_one_or_none()

            if existing_admin:
                logger.info("❌ Admin user already exists: admin@eaglechair.com")
                return

            # Create Eagle Chair company if it doesn't exist
            result = await session.execute(
                select(Company).where(Company.company_name == "Eagle Chair Admin")
            )
            company = result.scalar_one_or_none()

            if not company:
                logger.info("Creating Eagle Chair admin company...")
                company = Company(
                    company_name="Eagle Chair Admin",
                    legal_name="Eagle Chair Manufacturing LLC",
                    rep_first_name="System",
                    rep_last_name="Administrator",
                    rep_email="admin@eaglechair.com",
                    rep_phone="(713) 555-0100",
                    # Placeholder company: random password nobody knows
                    hashed_password=SecurityManager.hash_password(
                        secrets.token_urlsafe(32)
                    ),
                    billing_address_line1="123 Furniture Boulevard",
                    billing_city="Houston",
                    billing_state="TX",
                    billing_zip="77001",
                    billing_country="USA",
                    status=CompanyStatus.ACTIVE,
                    is_verified=True,
                    is_active=True,
                )
                session.add(company)
                await session.flush()
                logger.info(f"✅ Created company: {company.company_name}")
            else:
                logger.info(f"✅ Company already exists: {company.company_name}")

            # Create admin user
            logger.info("Creating admin user...")
            admin = AdminUser(
                email="admin@eaglechair.com",
                username="admin",
                first_name="System",
                last_name="Administrator",
                hashed_password=SecurityManager.hash_password(password),
                role=AdminRole.SUPER_ADMIN,
                is_active=True,
            )
            session.add(admin)
            await session.commit()

            logger.info("✅ Created admin user: admin (admin@eaglechair.com)")
            if generated:
                # Printed once - it is not stored anywhere in plain text
                print(f"\nAdmin password (save it now, it will not be shown again): {password}\n")

        except Exception as e:
            logger.error(f"❌ Error creating admin user: {e}")
            import traceback

            traceback.print_exc()
            await session.rollback()
            raise
        finally:
            await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create the initial admin user")
    parser.add_argument(
        "--password",
        help="Admin password to set (default: generate a strong random password)",
    )
    args = parser.parse_args()
    asyncio.run(seed_admin_user(args.password))
