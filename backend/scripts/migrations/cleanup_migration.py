"""
Cleanup Migration Data

Removes all migrated products, families, variations, and categories
to prepare for a fresh migration run.

Usage:
    python -m backend.scripts.migrations.cleanup_migration [--confirm]
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import delete, select

from backend.database.base import AsyncSessionLocal
from backend.models.chair import (
    Category,
    Chair,
    ProductFamily,
    ProductSubcategory,
    ProductVariation,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def cleanup_all_data(confirm: bool = False):
    """Delete all migration data."""
    logger.info("=" * 70)
    logger.info("DATABASE CLEANUP - MIGRATION DATA")
    logger.info("=" * 70)
    logger.info("")
    
    if not confirm:
        logger.warning("⚠️  THIS WILL DELETE ALL PRODUCTS, FAMILIES, AND CATEGORIES!")
        logger.warning("⚠️  Run with --confirm flag to proceed")
        logger.info("")
        return
    
    async with AsyncSessionLocal() as db:
        try:
            # Count before deletion
            result = await db.execute(select(ProductVariation))
            variation_count = len(result.scalars().all())
            
            result = await db.execute(select(Chair))
            product_count = len(result.scalars().all())
            
            result = await db.execute(select(ProductFamily))
            family_count = len(result.scalars().all())
            
            result = await db.execute(select(Category))
            category_count = len(result.scalars().all())
            
            result = await db.execute(select(ProductSubcategory))
            subcategory_count = len(result.scalars().all())
            
            logger.info(f"Found:")
            logger.info(f"  - {variation_count} product variations")
            logger.info(f"  - {product_count} products")
            logger.info(f"  - {family_count} product families")
            logger.info(f"  - {category_count} categories")
            logger.info(f"  - {subcategory_count} subcategories")
            logger.info("")
            
            if variation_count + product_count + family_count + category_count + subcategory_count == 0:
                logger.info("✓ Database is already clean")
                return
            
            # Delete in order to respect foreign keys
            logger.info("Deleting data...")
            
            # 1. Product variations (references products)
            await db.execute(delete(ProductVariation))
            logger.info(f"  ✓ Deleted {variation_count} product variations")
            
            # 2. Products (references families and categories)
            await db.execute(delete(Chair))
            logger.info(f"  ✓ Deleted {product_count} products")
            
            # 3. Families (references categories)
            await db.execute(delete(ProductFamily))
            logger.info(f"  ✓ Deleted {family_count} product families")
            
            # 4. Subcategories (references categories)
            await db.execute(delete(ProductSubcategory))
            logger.info(f"  ✓ Deleted {subcategory_count} subcategories")
            
            # 5. Categories
            await db.execute(delete(Category))
            logger.info(f"  ✓ Deleted {category_count} categories")
            
            await db.commit()
            
            logger.info("")
            logger.info("=" * 70)
            logger.info("✓ CLEANUP COMPLETE - Database is clean")
            logger.info("=" * 70)
            logger.info("")
            
        except Exception as e:
            logger.error(f"✗ Cleanup failed: {e}", exc_info=True)
            await db.rollback()
            raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Cleanup migration data")
    parser.add_argument('--confirm', action='store_true', 
                       help='Confirm deletion of all data')
    args = parser.parse_args()
    
    asyncio.run(cleanup_all_data(confirm=args.confirm))
