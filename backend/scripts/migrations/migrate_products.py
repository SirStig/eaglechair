"""
Product Migration Script

Migrates WordPress products to new EagleChair database:
- Product families (Alpine, Café Tesla, etc.)
- Individual products with model numbers
- Product variations (P, W, PF, WB.P suffixes)
- Product categories and subcategories

Usage:
    python -m backend.scripts.migrations.migrate_products [--dry-run]
"""

import argparse
import asyncio
import logging
import re
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.database.base import AsyncSessionLocal
from backend.models.chair import (
    Category,
    Chair,
    ProductFamily,
    ProductSubcategory,
    ProductVariation,
)
from .base_parser import get_sql_content

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Model number patterns (e.g., "3188", "4501", "5036W", "5311-22")
MODEL_NUMBER_PATTERN = re.compile(r'^(\d{3,4})([A-Z]{0,2})(?:-(\d+))?$')

# Variation suffixes we recognize
VARIATION_SUFFIXES = {
    'P': 'Padded',
    'W': 'Wood Seat',
    'PF': 'Padded with Frame',
    'PB': 'Padded Back',
    'WB': 'Wood Back',
    'V': 'Vinyl',
    'U': 'Upholstered',
    'A': 'Arms',
    'R': 'Reclining',
}


def parse_product_data(sql_content: str) -> dict:
    """Parse products and families from SQL."""
    data = {
        'product_families': [],
        'products': [],
    }
    
    # Pattern for products in wp_posts
    product_pattern = re.compile(
        r"\((\d+),\s*\d+,\s*'[^']+',\s*'[^']+',\s*'([^']*)',\s*'([^']+)',\s*'([^']*)',\s*'publish'[^)]*'product'",
        re.IGNORECASE
    )
    
    matches = product_pattern.findall(sql_content)
    
    for post_id, excerpt, title, description in matches:
        # Identify families by "Family" in title
        if 'family' in title.lower():
            data['product_families'].append({
                'wp_post_id': post_id,
                'name': title,
                'slug': title.lower().replace(' family', '').replace(' ', '-'),
                'description': description or excerpt,
            })
            logger.info(f"Found family: {title}")
        
        # Capture individual products (model numbers)
        elif re.match(r'^\d{3,4}', title):
            match = MODEL_NUMBER_PATTERN.match(title.strip())
            if match:
                base_model, suffix, variant = match.groups()
                data['products'].append({
                    'wp_post_id': post_id,
                    'model_number': base_model,
                    'model_suffix': suffix or None,
                    'variant_number': variant or None,
                    'full_model': title.strip(),
                    'description': description or excerpt,
                })
                logger.debug(f"Found product: {title}")
    
    logger.info(f"✓ Parsed {len(data['product_families'])} families")
    logger.info(f"✓ Parsed {len(data['products'])} products")
    
    return data


async def migrate_families(db: AsyncSession, data: dict) -> dict[str, ProductFamily]:
    """Migrate product families."""
    logger.info("\n" + "="*70)
    logger.info("MIGRATING PRODUCT FAMILIES")
    logger.info("="*70 + "\n")
    
    # Get default category
    result = await db.execute(
        select(Category).where(Category.name == "Chairs")
    )
    default_category = result.scalar_one_or_none()
    
    families_map = {}
    count = 0
    
    for family_data in data['product_families']:
        # Check if exists
        result = await db.execute(
            select(ProductFamily).where(ProductFamily.slug == family_data['slug'])
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            families_map[family_data['slug']] = existing
            logger.info(f"  ⊗ Family exists: {family_data['name']}")
            continue
        
        # Create family
        family = ProductFamily(
            name=family_data['name'],
            slug=family_data['slug'],
            description=family_data['description'],
            category_id=default_category.id if default_category else None,
            is_active=True,
        )
        db.add(family)
        await db.flush()
        families_map[family_data['slug']] = family
        count += 1
        logger.info(f"  ✓ Created: {family.name}")
    
    await db.commit()
    logger.info(f"\n✓ Migrated {count} new families\n")
    return families_map


async def migrate_products(db: AsyncSession, data: dict, dry_run: bool = False):
    """Migrate products and variations."""
    logger.info("\n" + "="*70)
    logger.info("MIGRATING PRODUCTS")
    logger.info("="*70 + "\n")
    
    if dry_run:
        logger.warning("🔸 DRY RUN MODE - No changes will be made\n")
    
    # Get default category
    result = await db.execute(
        select(Category).where(Category.name == "Chairs")
    )
    default_category = result.scalar_one_or_none()
    
    # Group products by base model
    products_by_model = {}
    for product in data['products']:
        base = product['model_number']
        if base not in products_by_model:
            products_by_model[base] = []
        products_by_model[base].append(product)
    
    logger.info(f"Found {len(products_by_model)} unique base models")
    logger.info(f"Total variations: {len(data['products'])}\n")
    
    product_count = 0
    variation_count = 0
    
    for base_model, variations in products_by_model.items():
        # Get base product (no suffix) or first variation
        base_product_data = next(
            (p for p in variations if not p['model_suffix']),
            variations[0]
        )
        
        if dry_run:
            logger.info(f"  [DRY RUN] Would create: {base_model}")
            if len(variations) > 1:
                logger.info(f"    Variations: {[p['full_model'] for p in variations]}")
            continue
        
        # Check if exists
        result = await db.execute(
            select(Chair).where(Chair.sku == base_model)
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            logger.info(f"  ⊗ Product exists: {base_model}")
            continue
        
        # Create product
        product = Chair(
            name=f"Model {base_model}",
            sku=base_model,
            description=base_product_data.get('description', ''),
            category_id=default_category.id if default_category else None,
            price=0.0,  # Will be updated later
            is_active=True,
        )
        db.add(product)
        await db.flush()
        product_count += 1
        logger.info(f"  ✓ Created: {base_model}")
        
        # Create variations if multiple suffixes exist
        if len(variations) > 1:
            for var_data in variations:
                suffix = var_data['model_suffix']
                if not suffix:
                    continue
                
                variation_name = VARIATION_SUFFIXES.get(suffix, f"Variant {suffix}")
                
                variation = ProductVariation(
                    product_id=product.id,
                    model_suffix=suffix,
                    name=variation_name,
                    price_adjustment=0.0,
                    is_active=True,
                )
                db.add(variation)
                variation_count += 1
                logger.info(f"    ↳ Variation: {var_data['full_model']} ({variation_name})")
    
    if not dry_run:
        await db.commit()
    
    logger.info(f"\n✓ Migrated {product_count} products")
    logger.info(f"✓ Created {variation_count} variations\n")


async def main(dry_run: bool = False):
    """Main migration function."""
    logger.info("=" * 70)
    logger.info("WORDPRESS PRODUCT MIGRATION")
    logger.info("=" * 70)
    logger.info("")
    
    if dry_run:
        logger.warning("⚠️  RUNNING IN DRY-RUN MODE")
        logger.warning("⚠️  No changes will be made to the database\n")
    
    # Parse SQL
    logger.info("Step 1: Parsing WordPress SQL file...")
    sql_content = get_sql_content()
    product_data = parse_product_data(sql_content)
    
    # Migrate
    async with AsyncSessionLocal() as db:
        try:
            if not dry_run:
                logger.info("\nStep 2: Migrating product families...")
                await migrate_families(db, product_data)
            else:
                logger.info(f"\n[DRY RUN] Would migrate {len(product_data['product_families'])} families\n")
            
            logger.info("Step 3: Migrating products...")
            await migrate_products(db, product_data, dry_run=dry_run)
            
            logger.info("=" * 70)
            logger.info("✓ MIGRATION COMPLETE!")
            logger.info("=" * 70)
            logger.info("")
            
        except Exception as e:
            logger.error(f"✗ Migration failed: {e}", exc_info=True)
            if not dry_run:
                await db.rollback()
            raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate WordPress products")
    parser.add_argument('--dry-run', action='store_true', help='Preview without making changes')
    args = parser.parse_args()
    
    asyncio.run(main(dry_run=args.dry_run))
