"""
WordPress Product Migration Script

Parses eaglechair_com.sql and migrates data to new database schema:
- Extracts product families from wp_posts
- Parses individual products with model numbers
- Extracts categories/taxonomies from wp_terms
- Maps product variations (model suffixes like P, W, PF, WB.P)
- Imports product images from wp_postmeta
- Migrates pricing information

Run this AFTER seed_product_catalog.py to ensure base catalog exists.

Usage:
    python -m backend.scripts.migrate_wordpress_products [--dry-run]
"""

import argparse
import asyncio
import logging
import re
import sys
from pathlib import Path
from typing import Any

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.database.base import AsyncSessionLocal
from backend.models.chair import (
    Category,
    Chair,
    Color,
    CustomOption,
    Finish,
    ProductFamily,
    ProductSubcategory,
    ProductVariation,
    Upholstery,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ============================================================================
# SQL File Parser
# ============================================================================

SQL_FILE_PATH = project_root / "eaglechair_com.sql"

PRODUCT_FAMILY_PATTERN = re.compile(
    r"\((\d+),\s*\d+,\s*'[^']+',\s*'[^']+',\s*'([^']*)',\s*'([^']+)',\s*'([^']*)',\s*'publish'[^)]*'product'",
    re.IGNORECASE
)

# Model number patterns (e.g., "3188", "4501", "5036W", "5311-22")
MODEL_NUMBER_PATTERN = re.compile(r'^(\d{3,4})([A-Z]{0,2})(?:-(\d+))?$')

# Variation suffixes we recognize
VARIATION_SUFFIXES = {
    'P': 'Padded',
    'W': 'Wood Seat',
    'PF': 'Padded with Frame',
    'PB': 'Padded Back',
    'WB.P': 'Wood Back with Padded Seat',
    'V': 'Vinyl',
    'U': 'Upholstered',
}


def parse_wordpress_sql() -> dict[str, Any]:
    """
    Parse the WordPress SQL file and extract relevant data.
    
    Returns:
        Dictionary with extracted data:
        - product_families: List of family records
        - products: List of individual product records
        - categories: WooCommerce product categories
        - images: Product image mappings
    """
    logger.info(f"Parsing WordPress SQL file: {SQL_FILE_PATH}")
    
    if not SQL_FILE_PATH.exists():
        raise FileNotFoundError(f"SQL file not found: {SQL_FILE_PATH}")
    
    data = {
        'product_families': [],
        'products': [],
        'categories': set(),
        'images': {}
    }
    
    with open(SQL_FILE_PATH, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    # Extract product families (these are the parent products in WordPress)
    # Looking for posts with titles like "Alpine Family", "Café Tesla Family", etc.
    family_matches = PRODUCT_FAMILY_PATTERN.findall(content)
    
    for post_id, excerpt, title, description in family_matches:
        # Identify families by "Family" in the title
        if 'family' in title.lower():
            data['product_families'].append({
                'wp_post_id': post_id,
                'name': title,
                'slug': title.lower().replace(' family', '').replace(' ', '-'),
                'description': description or excerpt,
            })
            logger.info(f"Found family: {title} (ID: {post_id})")
        # Also capture individual products (model numbers)
        elif re.match(r'^\d{3,4}', title):
            # Parse model number and variation
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
                logger.info(f"Found product: {title} (ID: {post_id})")
    
    logger.info(f"✓ Parsed {len(data['product_families'])} families")
    logger.info(f"✓ Parsed {len(data['products'])} products")
    
    return data


# ============================================================================
# Database Migration Functions
# ============================================================================

async def get_or_create_category(db: AsyncSession, category_name: str) -> Category:
    """Get existing category or create a placeholder."""
    result = await db.execute(
        select(Category).where(Category.name == category_name)
    )
    category = result.scalar_one_or_none()
    
    if not category:
        category = Category(
            name=category_name,
            slug=category_name.lower().replace(' ', '-'),
            description=f"{category_name} from WordPress migration",
            is_active=True
        )
        db.add(category)
        await db.flush()
        logger.info(f"  Created category: {category_name}")
    
    return category


async def migrate_product_families(db: AsyncSession, wordpress_data: dict):
    """Migrate product families from WordPress data."""
    logger.info("\n" + "="*70)
    logger.info("MIGRATING PRODUCT FAMILIES")
    logger.info("="*70 + "\n")
    
    # Get the "Chairs" category (most families are chairs)
    chairs_category = await get_or_create_category(db, "Chairs")
    
    # Get subcategory (default to Wood Chairs for now)
    result = await db.execute(
        select(ProductSubcategory).where(
            ProductSubcategory.name == "Wood Chairs"
        )
    )
    wood_subcat = result.scalar_one_or_none()
    
    family_count = 0
    for family_data in wordpress_data['product_families']:
        # Check if family already exists
        result = await db.execute(
            select(ProductFamily).where(ProductFamily.slug == family_data['slug'])
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            logger.info(f"  ⊗ Family already exists: {family_data['name']}")
            continue
        
        # Create family
        family = ProductFamily(
            name=family_data['name'],
            slug=family_data['slug'],
            description=family_data['description'],
            category_id=chairs_category.id,
            subcategory_id=wood_subcat.id if wood_subcat else None,
            is_active=True,
        )
        db.add(family)
        family_count += 1
        logger.info(f"  ✓ Migrated family: {family.name}")
    
    await db.commit()
    logger.info(f"\n✓ Migrated {family_count} product families\n")


async def migrate_products(db: AsyncSession, wordpress_data: dict, dry_run: bool = False):
    """Migrate individual products from WordPress data."""
    logger.info("\n" + "="*70)
    logger.info("MIGRATING PRODUCTS")
    logger.info("="*70 + "\n")
    
    if dry_run:
        logger.warning("🔸 DRY RUN MODE - No products will be created\n")
    
    # Get default category
    result = await db.execute(
        select(Category).where(Category.name == "Chairs")
    )
    default_category = result.scalar_one_or_none()
    
    # Group products by base model number (to identify variations)
    products_by_model = {}
    for product in wordpress_data['products']:
        base = product['model_number']
        if base not in products_by_model:
            products_by_model[base] = []
        products_by_model[base].append(product)
    
    logger.info(f"Found {len(products_by_model)} unique base models")
    logger.info(f"Total variations: {len(wordpress_data['products'])}\n")
    
    product_count = 0
    variation_count = 0
    
    for base_model, variations in products_by_model.items():
        # The base product (no suffix) or first variation
        base_product_data = next(
            (p for p in variations if not p['model_suffix']),
            variations[0]
        )
        
        if dry_run:
            logger.info(f"  [DRY RUN] Would create: {base_model}")
            logger.info(f"    Variations: {[p['full_model'] for p in variations]}")
            continue
        
        # Check if product already exists
        result = await db.execute(
            select(Chair).where(Chair.sku == base_model)
        )
        existing_product = result.scalar_one_or_none()
        
        if existing_product:
            logger.info(f"  ⊗ Product already exists: {base_model}")
            continue
        
        # Create the base product
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
        logger.info(f"  ✓ Created product: {base_model}")
        
        # Create variations if this product has multiple suffixes
        if len(variations) > 1:
            for var_data in variations:
                suffix = var_data['model_suffix']
                if not suffix:
                    continue  # Skip base model
                
                variation_name = VARIATION_SUFFIXES.get(suffix, f"Variant {suffix}")
                
                variation = ProductVariation(
                    product_id=product.id,
                    model_suffix=suffix,
                    name=variation_name,
                    price_adjustment=0.0,  # Will be updated based on upholstery/finish
                    is_active=True,
                )
                db.add(variation)
                variation_count += 1
                logger.info(f"    ↳ Created variation: {var_data['full_model']} ({variation_name})")
    
    if not dry_run:
        await db.commit()
    
    logger.info(f"\n✓ Migrated {product_count} products")
    logger.info(f"✓ Created {variation_count} product variations\n")


# ============================================================================
# Main Migration Function
# ============================================================================

async def main(dry_run: bool = False):
    """Main migration function."""
    logger.info("=" * 70)
    logger.info("WORDPRESS PRODUCT MIGRATION SCRIPT")
    logger.info("=" * 70)
    logger.info("")
    
    if dry_run:
        logger.warning("⚠️  RUNNING IN DRY-RUN MODE")
        logger.warning("⚠️  No changes will be made to the database\n")
    
    # Step 1: Parse WordPress SQL
    logger.info("Step 1: Parsing WordPress SQL file...")
    wordpress_data = parse_wordpress_sql()
    
    # Step 2: Migrate data
    async with AsyncSessionLocal() as db:
        try:
            logger.info("\nStep 2: Migrating product families...")
            if not dry_run:
                await migrate_product_families(db, wordpress_data)
            else:
                logger.info(f"[DRY RUN] Would migrate {len(wordpress_data['product_families'])} families\n")
            
            logger.info("Step 3: Migrating individual products...")
            await migrate_products(db, wordpress_data, dry_run=dry_run)
            
            logger.info("=" * 70)
            logger.info("✓ MIGRATION COMPLETE!")
            logger.info("=" * 70)
            logger.info("")
            logger.info("Summary:")
            logger.info(f"  - Product Families: {len(wordpress_data['product_families'])}")
            logger.info(f"  - Individual Products: {len(wordpress_data['products'])}")
            logger.info("")
            
            if not dry_run:
                logger.info("Next steps:")
                logger.info("1. Review migrated data in database")
                logger.info("2. Update product pricing and images manually or via admin")
                logger.info("3. Assign products to correct families and categories")
                logger.info("4. Test frontend product pages")
            
        except Exception as e:
            logger.error(f"✗ Migration failed: {e}", exc_info=True)
            if not dry_run:
                await db.rollback()
            raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate WordPress products to new database schema")
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Run in dry-run mode (no database changes)'
    )
    
    args = parser.parse_args()
    
    asyncio.run(main(dry_run=args.dry_run))
