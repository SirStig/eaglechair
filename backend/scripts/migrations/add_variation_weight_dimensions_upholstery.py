"""
Add optional weight, dimensions, and upholstery_amount columns to product_variations.

When set on a variation, these override the product values on product detail and quick view.

Usage:
    python -m backend.scripts.migrations.add_variation_weight_dimensions_upholstery [--confirm]
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

COLUMNS = [
    ("width", "DOUBLE PRECISION"),
    ("depth", "DOUBLE PRECISION"),
    ("height", "DOUBLE PRECISION"),
    ("seat_width", "DOUBLE PRECISION"),
    ("seat_depth", "DOUBLE PRECISION"),
    ("seat_height", "DOUBLE PRECISION"),
    ("arm_height", "DOUBLE PRECISION"),
    ("back_height", "DOUBLE PRECISION"),
    ("additional_dimensions", "JSONB"),
    ("weight", "DOUBLE PRECISION"),
    ("shipping_weight", "DOUBLE PRECISION"),
    ("upholstery_amount", "DOUBLE PRECISION"),
]


async def run_migration(confirm: bool = False):
    if not confirm:
        logger.warning("Run with --confirm to execute the migration.")
        return

    async with engine.begin() as conn:
        for col_name, col_type in COLUMNS:
            await conn.execute(
                text(
                    f"ALTER TABLE product_variations ADD COLUMN IF NOT EXISTS {col_name} {col_type} NULL"
                )
            )
            logger.info("Added product_variations.%s", col_name)
    logger.info("Added all variation weight/dimensions/upholstery columns.")


def main():
    parser = argparse.ArgumentParser(
        description="Add weight, dimensions, upholstery_amount to product_variations"
    )
    parser.add_argument("--confirm", action="store_true", help="Execute the migration")
    args = parser.parse_args()
    asyncio.run(run_migration(confirm=args.confirm))


if __name__ == "__main__":
    main()
