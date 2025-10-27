"""
Seed Categories and Subcategories

Creates the proper category and subcategory structure based on the
client's existing WordPress categories.

Main Categories:
- Chairs
- Barstools  
- Table Tops
- Table Bases
- Benches & Ottomans
- Booths/Banquettes
- Outdoor/Patio

Subcategories vary by category (Wood, Metal, Lounge, Arm, Outdoor, etc)

Usage:
    python -m backend.scripts.migrations.seed_categories
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import select

from backend.database.base import AsyncSessionLocal
from backend.models.chair import Category, ProductSubcategory

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Category and Subcategory structure based on client's WordPress setup
CATEGORY_STRUCTURE = [
    {
        'name': 'Chairs',
        'slug': 'chairs',
        'description': 'Chair frames designed by us with reinforcements, manufactured with your choice of stain color, upholstery, and add-ons.',
        'subcategories': [
            {'name': 'Wood Chairs', 'slug': 'wood-chairs', 'description': 'European Alpine beech chairs, FSC/PEFC certified'},
            {'name': 'Metal Chairs', 'slug': 'metal-chairs', 'description': 'Built with exceptional strength and contemporary design'},
            {'name': 'Lounge Chairs', 'slug': 'lounge-chairs', 'description': 'Comfortable lounge seating'},
            {'name': 'Arm Chairs', 'slug': 'arm-chairs', 'description': 'Chairs with armrests'},
            {'name': 'Outdoor Chairs', 'slug': 'outdoor-chairs', 'description': 'Durable outdoor seating rated for aluminum or zinc-plated construction'},
        ]
    },
    {
        'name': 'Barstools',
        'slug': 'barstools',
        'description': 'Perfect for any counter or bar, you will be sure to find the Eagle Chair look that will fit your establishment.',
        'subcategories': [
            {'name': 'Wood Barstools', 'slug': 'wood-barstools', 'description': 'Sustainable wooden barstools with full range of design options'},
            {'name': 'Metal Barstools', 'slug': 'metal-barstools', 'description': 'Strong and stylish metal barstools'},
            {'name': 'Backless Stools', 'slug': 'backless-barstools', 'description': 'Backless barstool designs'},
            {'name': 'Swivel Barstools', 'slug': 'swivel-barstools', 'description': 'Barstools with swivel functionality'},
            {'name': 'Outdoor Barstools', 'slug': 'outdoor-barstools', 'description': 'Exceptional durability and easy maintenance for patio or terrace'},
        ]
    },
    {
        'name': 'Table Tops',
        'slug': 'table-tops',
        'description': 'Table tops manufactured to size with various lamination and edging choices for indoor and outdoor use.',
        'subcategories': [
            {'name': 'Indoor Table Tops', 'slug': 'indoor-table-tops', 'description': 'Table tops for indoor use'},
            {'name': 'Outdoor Table Tops', 'slug': 'outdoor-table-tops', 'description': 'Weather-resistant table tops'},
        ]
    },
    {
        'name': 'Table Bases',
        'slug': 'table-bases',
        'description': 'Sturdy table bases in various styles and materials.',
        'subcategories': [
            {'name': 'Cast Iron Bases', 'slug': 'cast-iron-bases', 'description': 'Heavy-duty cast iron table bases'},
            {'name': 'Metal Bases', 'slug': 'metal-table-bases', 'description': 'Metal table base options'},
        ]
    },
    {
        'name': 'Benches & Ottomans',
        'slug': 'benches-ottomans',
        'description': 'Benches and ottomans built to size for waiting lobbies or movable additional seating.',
        'subcategories': [
            {'name': 'Wood Benches', 'slug': 'wood-benches', 'description': 'Wooden benches'},
            {'name': 'Ottomans', 'slug': 'ottomans', 'description': 'Ottomans manufactured to custom length, width, height, and upholstery'},
        ]
    },
    {
        'name': 'Booths/Banquettes',
        'slug': 'booths-banquettes',
        'description': 'Custom booth and banquette seating solutions.',
        'subcategories': [
            {'name': 'Settee Booths', 'slug': 'settee-booths', 'description': 'Settee-style booth seating'},
            {'name': 'Upholstered Booths', 'slug': 'upholstered-booths', 'description': 'Fully upholstered booth seating'},
            {'name': 'Wood Booths', 'slug': 'wood-booths', 'description': 'Wood-framed booth seating'},
            {'name': 'Outdoor Booths', 'slug': 'outdoor-booths', 'description': 'Weather-resistant booth seating'},
        ]
    },
    {
        'name': 'Outdoor/Patio',
        'slug': 'outdoor-patio',
        'description': 'All outdoor and patio furniture designed to withstand the elements.',
        'subcategories': []  # This category shows items from other outdoor subcategories
    },
]


async def seed_categories():
    """Create categories and subcategories."""
    logger.info("=" * 70)
    logger.info("SEEDING CATEGORIES AND SUBCATEGORIES")
    logger.info("=" * 70)
    logger.info("")
    
    async with AsyncSessionLocal() as db:
        try:
            category_count = 0
            subcategory_count = 0
            
            for cat_data in CATEGORY_STRUCTURE:
                # Check if category exists
                result = await db.execute(
                    select(Category).where(Category.slug == cat_data['slug'])
                )
                category = result.scalar_one_or_none()
                
                if not category:
                    category = Category(
                        name=cat_data['name'],
                        slug=cat_data['slug'],
                        description=cat_data['description'],
                        is_active=True,
                        display_order=category_count,
                    )
                    db.add(category)
                    await db.flush()
                    category_count += 1
                    logger.info(f"✓ Created category: {category.name}")
                else:
                    logger.info(f"⊗ Category exists: {category.name}")
                
                # Create subcategories
                for subcat_data in cat_data['subcategories']:
                    result = await db.execute(
                        select(ProductSubcategory).where(
                            ProductSubcategory.slug == subcat_data['slug']
                        )
                    )
                    subcategory = result.scalar_one_or_none()
                    
                    if not subcategory:
                        subcategory = ProductSubcategory(
                            name=subcat_data['name'],
                            slug=subcat_data['slug'],
                            description=subcat_data['description'],
                            category_id=category.id,
                            is_active=True,
                        )
                        db.add(subcategory)
                        subcategory_count += 1
                        logger.info(f"  ↳ Created subcategory: {subcategory.name}")
                    else:
                        logger.info(f"  ⊗ Subcategory exists: {subcategory.name}")
            
            await db.commit()
            
            logger.info("")
            logger.info("=" * 70)
            logger.info(f"✓ Created {category_count} categories")
            logger.info(f"✓ Created {subcategory_count} subcategories")
            logger.info("=" * 70)
            logger.info("")
            
        except Exception as e:
            logger.error(f"✗ Seeding failed: {e}", exc_info=True)
            await db.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(seed_categories())
