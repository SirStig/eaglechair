"""
Create variation_families association table (variation_id, family_id).
Allows each product variation to be shown in one or more families with its own image/info.

Usage:
    python -m backend.scripts.migrations.add_variation_families [--confirm]
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
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS variation_families (
                variation_id INTEGER NOT NULL REFERENCES product_variations(id) ON DELETE CASCADE,
                family_id INTEGER NOT NULL REFERENCES product_families(id) ON DELETE CASCADE,
                PRIMARY KEY (variation_id, family_id)
            )
        """))
        logger.info("Created table variation_families.")
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_variation_families_family_id ON variation_families (family_id)"
        ))
        logger.info("Created index ix_variation_families_family_id.")


def main():
    parser = argparse.ArgumentParser(
        description="Create variation_families table for per-variation family assignment"
    )
    parser.add_argument("--confirm", action="store_true", help="Execute the migration")
    args = parser.parse_args()
    asyncio.run(run_migration(confirm=args.confirm))


if __name__ == "__main__":
    main()
