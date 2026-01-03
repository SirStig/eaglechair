"""
Test Seed Products

Creates minimal test data to verify the cache timestamps endpoint works.
This creates one product with basic finishes, colors, and upholsteries.

Usage:
    python -m backend.scripts.test_seed_products
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import select

from backend.database.base import AsyncSessionLocal
from backend.models.chair import (
    Category,
    Chair,
    Color,
    Finish,
    ProductFamily,
    ProductSubcategory,
    ProductVariation,
    Upholstery,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def seed_test_data():
    """Create minimal test data for cache timestamps testing."""
    logger.info("=" * 70)
    logger.info("SEEDING TEST DATA FOR CACHE TIMESTAMPS")
    logger.info("=" * 70)

    async with AsyncSessionLocal() as db:
        try:
            # Get first category and subcategory
            cat_result = await db.execute(select(Category).limit(1))
            category = cat_result.scalar_one_or_none()

            subcat_result = await db.execute(select(ProductSubcategory).limit(1))
            subcategory = subcat_result.scalar_one_or_none()

            if not category or not subcategory:
                logger.error("No categories or subcategories found. Run seed_categories.py first.")
                return

            # Create test color
            color = Color(
                name="Test Walnut",
                color_code="TW-001",
                hex_value="#8B4513",
                category="wood",
                is_active=True,
                display_order=1,
            )
            db.add(color)
            await db.flush()
            logger.info("✓ Created test color: Test Walnut")

            # Create test finish
            finish = Finish(
                name="Walnut Stain",
                finish_code="WS-001",
                finish_type="Wood Stain",
                color_id=color.id,
                is_active=True,
                display_order=1,
                additional_cost=0,
            )
            db.add(finish)
            await db.flush()
            logger.info("✓ Created test finish: Walnut Stain")

            # Create test upholstery
            upholstery = Upholstery(
                name="Black Vinyl",
                material_code="BV-001",
                material_type="Vinyl",
                grade="A",
                color_id=color.id,
                is_active=True,
                display_order=1,
                additional_cost=0,
                grade_a_cost=0,
            )
            db.add(upholstery)
            await db.flush()
            logger.info("✓ Created test upholstery: Black Vinyl")

            # Create test product family
            family = ProductFamily(
                name="Test Family",
                slug="test-family",
                category_id=category.id,
                subcategory_id=subcategory.id,
                is_active=True,
                display_order=1,
            )
            db.add(family)
            await db.flush()
            logger.info("✓ Created test product family: Test Family")

            # Create test product
            product = Chair(
                model_number="TEST-001",
                name="Test Chair",
                slug="test-chair",
                short_description="Test product for cache timestamps",
                base_price=10000,  # $100.00
                category_id=category.id,
                subcategory_id=subcategory.id,
                family_id=family.id,
                is_active=True,
                display_order=1,
                stock_status="In Stock",
                available_finishes=[finish.id],
                available_colors=[color.id],
                available_upholsteries=[upholstery.id],
                images='[]',  # Empty JSON array
            )
            db.add(product)
            await db.flush()
            logger.info("✓ Created test product: Test Chair")

            # Create test product variation
            variation = ProductVariation(
                product_id=product.id,
                sku="TEST-001-WS-BV",
                finish_id=finish.id,
                upholstery_id=upholstery.id,
                color_id=color.id,
                price_adjustment=0,
                images='[]',
                stock_status="Available",
                is_available=True,
                display_order=1,
            )
            db.add(variation)
            await db.flush()
            logger.info("✓ Created test product variation: TEST-001-WS-BV")

            await db.commit()

            logger.info("")
            logger.info("=" * 70)
            logger.info("✓ Test data seeding completed successfully!")
            logger.info("✓ You can now test /api/v1/cache/timestamps")
            logger.info("=" * 70)

        except Exception as e:
            logger.error(f"✗ Seeding failed: {e}", exc_info=True)
            await db.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(seed_test_data())
