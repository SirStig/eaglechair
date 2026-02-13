"""
Make quotes.company_id nullable to support guest quotes.

Usage:
    python -m backend.scripts.migrations.migrate_quote_company_id_nullable [--confirm]
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import text

from backend.database.base import engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def run_migration(confirm: bool = False):
    if not confirm:
        logger.warning("Run with --confirm to execute the migration.")
        return

    async with engine.begin() as conn:
        await conn.execute(text("ALTER TABLE quotes ALTER COLUMN company_id DROP NOT NULL"))
    logger.info("Migration complete: quotes.company_id is now nullable")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--confirm", action="store_true", help="Execute the migration")
    args = parser.parse_args()
    asyncio.run(run_migration(confirm=args.confirm))


if __name__ == "__main__":
    main()
