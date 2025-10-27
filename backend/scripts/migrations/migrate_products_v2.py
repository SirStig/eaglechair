"""
Product Migration Script v2

Migrates WordPress products to new EagleChair database with proper category mapping:
- Maps WordPress categories to our Category/Subcategory structure
- Product families (Alpine, Café Tesla) remain as ProductFamily
- Extracts product images from wp_postmeta (_thumbnail_id)
- Uses wp-content/uploads URLs for backward compatibility
- Cleans HTML from descriptions
- Handles product variations

Usage:
    python -m backend.scripts.migrations.migrate_products_v2 [--dry-run] [--image-base-url https://eaglechair.com]
"""

import argparse
import asyncio
import html
import logging
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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


# WordPress category slug to our Category/Subcategory mapping
WP_CATEGORY_MAP = {
    # Chairs category
    'chairs': ('chairs', None),
    'wood-chairs': ('chairs', 'wood-chairs'),
    'metal-chairs': ('chairs', 'metal-chairs'),
    'lounge-chairs': ('chairs', 'lounge-chairs'),
    'arm-chairs': ('chairs', 'arm-chairs'),  # Will need to create if not exists
    'outdoor-chairs': ('chairs', 'outdoor-chairs'),
    'chairs-outdoor': ('chairs', 'outdoor-chairs'),  # Alternate slug
    
    # Barstools category
    'barstools': ('barstools', None),
    'wood-barstools': ('barstools', 'wood-barstools'),
    'metal-barstools': ('barstools', 'metal-barstools'),
    'backless-barstools': ('barstools', 'backless-barstools'),
    'backless-bars tools': ('barstools', 'backless-barstools'),  # Handle variations
    'swivel-barstools': ('barstools', 'swivel-barstools'),
    'swivel': ('barstools', 'swivel-barstools'),
    'outdoor-barstools': ('barstools', 'outdoor-barstools'),
    'barstools-outdoor': ('barstools', 'outdoor-barstools'),
    
    # Table Tops category
    'tables': ('table-tops', None),
    'table-tops': ('table-tops', None),
    'indoor-table-tops': ('table-tops', 'indoor-table-tops'),
    'outdoor-table-tops': ('table-tops', 'outdoor-table-tops'),
    'tables-outdoor': ('table-tops', 'outdoor-table-tops'),
    'woodedge': ('table-tops', 'indoor-table-tops'),  # Wood edge indoor
    
    # Table Bases category
    'tablebases': ('table-bases', None),
    'table-bases': ('table-bases', None),
    'castiron': ('table-bases', 'cast-iron-bases'),
    'cast-iron-bases': ('table-bases', 'cast-iron-bases'),
    
    # Benches & Ottomans category
    'benchottoman': ('benches-ottomans', None),
    'benches-benchottoman': ('benches-ottomans', 'wood-benches'),
    'wood-benches': ('benches-ottomans', 'wood-benches'),
    'ottomans-benchottoman': ('benches-ottomans', 'ottomans'),
    'ottomans': ('benches-ottomans', 'ottomans'),
    
    # Booths category
    'booths_banquettes': ('booths-banquettes', None),
    'settee-booths': ('booths-banquettes', 'settee-booths'),
    'upholstered-booths': ('booths-banquettes', 'upholstered-booths'),
    'wood-booths': ('booths-banquettes', 'wood-booths'),
    'outdoor-booths': ('booths-banquettes', 'outdoor-booths'),
    'outdoorbooths': ('booths-banquettes', 'outdoor-booths'),
    
    # Outdoor/Patio (cross-category)
    'outdoorpatio': ('outdoor-patio', None),
    'outdoor-patio': ('outdoor-patio', None),
}

# Model number patterns
# Flexible pattern to match product titles (allows extra text)
MODEL_NUMBER_PATTERN = re.compile(r'^(\d{3,4})([A-Z]{0,2})(?:-(\d+))?')  # Removed $ to allow text after
# Pattern to identify if a title is a product (not a family)
PRODUCT_TITLE_PATTERN = re.compile(r'^\d{3,4}|Series|Add-On|^T[A-Z]?\d*\s+Series', re.IGNORECASE)

# Variation suffixes
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

# Fallback category when mapping is missing
DEFAULT_CATEGORY_FALLBACK = 'chairs'


def clean_html_description(text: str) -> str:
    """Remove HTML tags and decode HTML entities."""
    if not text:
        return ""
    
    clean = re.sub(r'<[^>]+>', '', text)
    clean = html.unescape(clean)
    clean = clean.replace('&nbsp;', ' ')
    clean = re.sub(r'\s+', ' ', clean)
    return clean.strip()


def extract_wordpress_terms(sql_content: str) -> dict:
    """Extract all terms from wp_terms table."""
    # Find INSERT INTO wp_terms
    term_start = sql_content.find("INSERT INTO `wp_terms`")
    if term_start == -1:
        logger.warning("No wp_terms found")
        return {}
    
    values_start = sql_content.find("VALUES", term_start)
    next_insert = sql_content.find("\nINSERT INTO `wp_term", values_start)
    if next_insert == -1:
        next_insert = values_start + 50000
    
    terms_section = sql_content[values_start:next_insert]
    
    # Parse: (term_id, 'name', 'slug', term_group, term_order)
    term_pattern = re.compile(r"\((\d+),\s*'([^']+)',\s*'([^']+)',\s*\d+,\s*\d+\)")
    terms = {}
    for term_id, name, slug in term_pattern.findall(terms_section):
        name = name.replace('&amp;', '&')
        terms[term_id] = {'name': name, 'slug': slug}
    
    logger.info(f"Extracted {len(terms)} WordPress terms")
    return terms


def extract_taxonomy_relationships(sql_content: str) -> tuple[dict, dict]:
    """Extract term taxonomy (which terms are product_cat) and post relationships."""
    # Extract taxonomy data
    taxonomy_start = sql_content.find("INSERT INTO `wp_term_taxonomy`")
    if taxonomy_start == -1:
        return {}, {}
    
    values_start = sql_content.find("VALUES", taxonomy_start)
    next_insert = sql_content.find("\nINSERT INTO", values_start + 10)
    if next_insert == -1:
        next_insert = values_start + 100000
    
    taxonomy_section = sql_content[values_start:next_insert]
    
    # Parse: (term_taxonomy_id, term_id, 'taxonomy', 'description', parent, count)
    tax_pattern = re.compile(r"\((\d+),\s*(\d+),\s*'([^']+)',\s*'[^']*',\s*(\d+),\s*\d+\)")
    
    product_cat_terms = {}  # term_id -> parent_term_id
    for tax_id, term_id, taxonomy, parent in tax_pattern.findall(taxonomy_section):
        if taxonomy == 'product_cat':
            product_cat_terms[term_id] = parent if parent != '0' else None
    
    # Extract post-to-term relationships
    rel_start = sql_content.find("INSERT INTO `wp_term_relationships`")
    if rel_start == -1:
        return product_cat_terms, {}
    
    values_start = sql_content.find("VALUES", rel_start)
    next_insert = sql_content.find("\nINSERT INTO", values_start + 10)
    if next_insert == -1:
        next_insert = values_start + 100000
    
    rel_section = sql_content[values_start:next_insert]
    
    # Parse: (post_id, term_id, order)
    rel_pattern = re.compile(r"\((\d+),\s*(\d+),\s*\d+\)")
    
    post_terms = defaultdict(list)  # post_id -> [term_ids]
    for post_id, term_id in rel_pattern.findall(rel_section):
        if term_id in product_cat_terms:  # Only product categories
            post_terms[post_id].append(term_id)
    
    logger.info(f"Found {len(product_cat_terms)} product categories")
    logger.info(f"Found relationships for {len(post_terms)} posts")
    
    return product_cat_terms, dict(post_terms)


def extract_product_metadata(sql_content: str) -> dict:
    """Extract product metadata (images, prices, stock status) from wp_postmeta."""
    meta_start = sql_content.find("INSERT INTO `wp_postmeta`")
    if meta_start == -1:
        logger.warning("No wp_postmeta found")
        return {}
    
    values_start = sql_content.find("VALUES", meta_start)
    next_insert = sql_content.find("\nINSERT INTO `wp_posts`", values_start)  # Next major table
    if next_insert == -1:
        next_insert = values_start + 5000000  # Large section
    
    meta_section = sql_content[values_start:next_insert]
    
    # Parse: (meta_id, post_id, 'meta_key', 'meta_value')
    # Handle escaped quotes and special chars
    meta_pattern = re.compile(r"\((\d+),\s*(\d+),\s*'([^']+)',\s*'([^']*)'\)")
    
    product_meta = defaultdict(dict)  # post_id -> {meta_key: meta_value}
    for meta_id, post_id, meta_key, meta_value in meta_pattern.findall(meta_section):
        if meta_key in ['_thumbnail_id', '_regular_price', '_sale_price', '_stock_status']:
            product_meta[post_id][meta_key] = meta_value
    
    logger.info(f"Extracted metadata for {len(product_meta)} posts")
    return dict(product_meta)


def extract_attachment_urls(sql_content: str) -> dict:
    """Extract attachment (image) URLs from wp_postmeta '_wp_attached_file'.

    Returns: dict mapping attachment post_id (str) -> uploads URL (str)
    """
    meta_start = sql_content.find("INSERT INTO `wp_postmeta`")
    if meta_start == -1:
        logger.warning("No wp_postmeta found for attachments")
        return {}

    values_start = sql_content.find("VALUES", meta_start)
    next_insert = sql_content.find("\nINSERT INTO `wp_posts`", values_start)
    if next_insert == -1:
        next_insert = values_start + 5000000

    meta_section = sql_content[values_start:next_insert]

    # Parse only rows with meta_key = '_wp_attached_file'
    attach_pattern = re.compile(r"\((\d+),\s*(\d+),\s*'_wp_attached_file',\s*'([^']*)'\)")
    attachments: dict[str, str] = {}
    for _meta_id, post_id, rel_path in attach_pattern.findall(meta_section):
        # Unescape and build URL under wp-content/uploads
        clean_path = rel_path.replace("\\'", "'").replace('\\"', '"').replace('\\\\', '\\')
        url = f"/wp-content/uploads/{clean_path}".replace('//', '/')
        attachments[post_id] = url

    logger.info(f"Extracted {len(attachments)} attachment images")
    return attachments


def parse_products_from_wp_posts(sql_content: str, terms: dict, post_terms: dict, metadata: dict) -> dict:
    """Parse products and families from wp_posts - handles multiple INSERT statements."""
    logger.info("Parsing products from wp_posts...")
    
    families = []
    products = []
    
    # WordPress has MANY INSERT INTO wp_posts statements (185+)
    # We need to process ALL of them, not just the first
    start_pos = 0
    section_num = 0
    
    while True:
        # Find next wp_posts INSERT
        posts_start = sql_content.find("INSERT INTO `wp_posts`", start_pos)
        if posts_start == -1:
            break
        
        section_num += 1
        values_start = sql_content.find("VALUES", posts_start)
        next_insert = sql_content.find("\nINSERT INTO", values_start + 10)
        if next_insert == -1:
            next_insert = len(sql_content)
        
        posts_section = sql_content[values_start:next_insert]
        
        # Pattern to match product posts
        # (ID, author, 'date', 'date', 'content', 'title', 'excerpt', 'publish', ...)
        post_pattern = re.compile(
            r"\((\d+),\s*\d+,\s*'[^']+',\s*'[^']+',\s*'((?:[^'\\]|\\.|'')*?)',\s*'((?:[^'\\]|\\.|'')*?)',\s*'((?:[^'\\]|\\.|'')*?)',\s*'publish'.*?'product'.*?\)",
            re.IGNORECASE | re.DOTALL
        )
        
        for post_id, content, title, excerpt in post_pattern.findall(posts_section):
            # Clean the title (should be simple)
            title = title.strip()
            clean_desc = clean_html_description(content or excerpt)
            
            # Get categories for this post
            wp_category_slugs = []
            if post_id in post_terms:
                for term_id in post_terms[post_id]:
                    if term_id in terms:
                        wp_category_slugs.append(terms[term_id]['slug'])
            
            # Get metadata
            meta = metadata.get(post_id, {})
            thumbnail_id = meta.get('_thumbnail_id')
            price = meta.get('_regular_price', '0')
            sale_price = meta.get('_sale_price')
            stock_status = meta.get('_stock_status', 'instock')
            
            # Determine if it's a family or individual product
            if 'family' in title.lower():
                families.append({
                    'wp_post_id': post_id,
                    'name': title,
                    'slug': title.lower().replace(' family', '').replace(' ', '-'),
                    'description': clean_desc,
                    'wp_categories': wp_category_slugs,
                    'thumbnail_id': thumbnail_id,
                })
            elif PRODUCT_TITLE_PATTERN.search(title):  # Use flexible pattern
                # Try to extract model number (may not always work for "Series" products)
                match = MODEL_NUMBER_PATTERN.match(title.strip())
                if match:
                    base_model, suffix, variant = match.groups()
                else:
                    # For products like "TR Series, Boston" or "Add-On: Nails"
                    # Extract first word/number as model
                    base_model = title.split()[0].replace(':', '').replace(',', '')
                    suffix = ''
                    variant = ''
                
                products.append({
                    'wp_post_id': post_id,
                    'model_number': base_model,
                    'suffix': suffix or '',
                    'variant': variant or '',
                    'full_model': title.strip(),
                    'description': clean_desc,
                    'wp_categories': wp_category_slugs,
                    'thumbnail_id': thumbnail_id,
                    'price': price,
                    'sale_price': sale_price,
                    'stock_status': stock_status,
                })
        
        # Move to next section
        start_pos = next_insert
    
    logger.info(f"Parsed {len(families)} families and {len(products)} products")
    return {'families': families, 'products': products}


async def get_category_and_subcategory(
    db: AsyncSession,
    wp_category_slugs: list[str]
) -> tuple[int | None, int | None]:
    """Map WordPress category slugs to our Category and Subcategory IDs."""
    if not wp_category_slugs:
        return None, None
    
    # Try each WordPress category slug in order
    for wp_slug in wp_category_slugs:
        if wp_slug in WP_CATEGORY_MAP:
            category_slug, subcategory_slug = WP_CATEGORY_MAP[wp_slug]
            
            # Get category
            result = await db.execute(
                select(Category).where(Category.slug == category_slug)
            )
            category = result.scalar_one_or_none()
            
            if not category:
                continue
            
            # Get subcategory if specified
            subcategory_id = None
            if subcategory_slug:
                result = await db.execute(
                    select(ProductSubcategory).where(
                        ProductSubcategory.slug == subcategory_slug
                    )
                )
                subcategory = result.scalar_one_or_none()
                if subcategory:
                    subcategory_id = subcategory.id
            
            return category.id, subcategory_id
    
    return None, None


async def migrate_families(db: AsyncSession, families_data: list, dry_run: bool = False) -> dict:
    """Migrate product families."""
    logger.info("\n" + "="*70)
    logger.info("MIGRATING PRODUCT FAMILIES")
    logger.info("="*70 + "\n")
    
    families_map = {}  # slug -> ProductFamily
    count = 0
    
    # Attachment lookup (provided via attribute in main)
    attachment_lookup = getattr(migrate_families, "attachment_lookup", {})

    for family_data in families_data:
        # Check if exists
        result = await db.execute(
            select(ProductFamily).where(ProductFamily.slug == family_data['slug'])
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            families_map[family_data['slug']] = existing
            # If we have a thumbnail and attachment mapping (possibly with base URL), update image if different
            thumb_id = family_data.get('thumbnail_id')
            new_url = None
            if thumb_id and thumb_id in attachment_lookup:
                new_url = attachment_lookup[thumb_id]
            if new_url and existing.family_image != new_url:
                if dry_run:
                    logger.info(f"  [DRY RUN] Would update family image: {family_data['name']} → {new_url}")
                else:
                    existing.family_image = new_url
                    await db.flush()
                    logger.info(f"  ✓ Updated family image: {family_data['name']}")
            else:
                logger.info(f"  ⊗ Family exists: {family_data['name']}")
            continue
        
        if dry_run:
            logger.info(f"  [DRY RUN] Would create family: {family_data['name']}")
            thumb_id = family_data.get('thumbnail_id')
            if thumb_id and thumb_id in attachment_lookup:
                logger.info(f"    Image: {attachment_lookup[thumb_id]}")
            continue
        
        # Get category/subcategory
        category_id, subcategory_id = await get_category_and_subcategory(
            db, family_data['wp_categories']
        )
        
        # Create family
        # Resolve family image from thumbnail id if available
        family_image_url = None
        thumb_id = family_data.get('thumbnail_id')
        if thumb_id and thumb_id in attachment_lookup:
            family_image_url = attachment_lookup[thumb_id]

        family = ProductFamily(
            name=family_data['name'],
            slug=family_data['slug'],
            # Blank description per migration requirements
            description="",
            category_id=category_id,
            subcategory_id=subcategory_id,
            family_image=family_image_url,
            is_active=True,
        )
        db.add(family)
        await db.flush()
        families_map[family_data['slug']] = family
        count += 1
        
        cat_info = f" → {family_data['wp_categories'][0]}" if family_data['wp_categories'] else ""
        logger.info(f"  ✓ Created: {family.name}{cat_info}")
    
    if not dry_run:
        await db.commit()
    
    logger.info(f"\n✓ Migrated {count} families\n")
    return families_map


async def migrate_products(db: AsyncSession, products_data: list, dry_run: bool = False):
    """Migrate individual products."""
    logger.info("\n" + "="*70)
    logger.info("MIGRATING PRODUCTS")
    logger.info("="*70 + "\n")
    
    if dry_run:
        logger.warning("🔸 DRY RUN MODE\n")
    
    # Group by base model number
    by_model = defaultdict(list)
    for product in products_data:
        by_model[product['model_number']].append(product)
    
    logger.info(f"Found {len(by_model)} unique base models")
    logger.info(f"Total variations: {len(products_data)}\n")
    
    product_count = 0
    variation_count = 0
    
    # Build a lazy attachment lookup from SQL inside this function's closure
    # Note: to avoid re-parsing SQL here, we will attach a resolver at runtime via attribute if present
    attachment_lookup = getattr(migrate_products, "attachment_lookup", {})

    for base_model, variations in by_model.items():
        # Get base product (no suffix) or first one
        base_product = next(
            (p for p in variations if not p['suffix']),
            variations[0]
        )
        
        if dry_run:
            cat_info = f" → {base_product['wp_categories'][0]}" if base_product['wp_categories'] else ""
            logger.info(f"  [DRY RUN] Would create: {base_model}{cat_info}")
            if len(variations) > 1:
                logger.info(f"    Variations: {[p['full_model'] for p in variations]}")
            # Show image URL if available
            thumb_id = base_product.get('thumbnail_id')
            if thumb_id and thumb_id in attachment_lookup:
                logger.info(f"    Image: {attachment_lookup[thumb_id]}")
            continue
        
        # Check if exists
        result = await db.execute(
            select(Chair).where(Chair.model_number == base_model)
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            logger.info(f"  ⊗ Product exists: {base_model}")
            continue
        
        # Get category/subcategory
        category_id, subcategory_id = await get_category_and_subcategory(
            db, base_product['wp_categories']
        )
        # Fallback to default category if mapping failed
        if category_id is None:
            logger.warning(
                f"  ◊ No category mapping for model {base_model} (wp slugs: {base_product['wp_categories']}). "
                f"Falling back to '{DEFAULT_CATEGORY_FALLBACK}'."
            )
            category_id, _ = await get_category_and_subcategory(db, [DEFAULT_CATEGORY_FALLBACK])
            if category_id is None:
                logger.error(
                    f"  ✗ Fallback category '{DEFAULT_CATEGORY_FALLBACK}' not found in DB. Skipping {base_model}."
                )
                continue
        
        # Convert price (dollars to cents)
        try:
            base_price = int(float(base_product['price']) * 100) if base_product['price'] else 0
        except (ValueError, TypeError):
            base_price = 0
        
        # Create product
        product = Chair(
            name=f"Model {base_model}",
            model_number=base_model,
            slug=f"model-{base_model.lower()}",
            # Blank out descriptions to avoid inline images/text from WP
            short_description="",
            full_description=None,
            category_id=category_id,
            subcategory_id=subcategory_id,
            base_price=base_price,
            stock_status=base_product['stock_status'],
            is_active=True,
        )
        
        # Set primary image/thumbnail if available via attachments
        thumb_id = base_product.get('thumbnail_id')
        if thumb_id and thumb_id in attachment_lookup:
            url = attachment_lookup[thumb_id]
            product.primary_image_url = url
            product.thumbnail = url
            product.images = [
                {"url": url, "type": "gallery", "order": 1, "alt": f"Model {base_model}"}
            ]
        
        db.add(product)
        await db.flush()
        product_count += 1
        
        cat_name = base_product['wp_categories'][0] if base_product['wp_categories'] else 'uncategorized'
        logger.info(f"  ✓ Created: {base_model} → {cat_name}")
        
        # Create variations
        if len(variations) > 1:
            for var_data in variations:
                if not var_data['suffix']:
                    continue
                
                variation = ProductVariation(
                    product_id=product.id,
                    sku=var_data['full_model'],
                    price_adjustment=0,
                    stock_status=var_data['stock_status'],
                    is_available=True,
                )
                db.add(variation)
                variation_count += 1
                logger.info(f"    ↳ Variation: {var_data['full_model']}")
    
    if not dry_run:
        await db.commit()
    
    logger.info(f"\n✓ Migrated {product_count} products")
    logger.info(f"✓ Created {variation_count} variations\n")


def _apply_base_url(attachments: dict[str, str], base_url: str | None) -> dict[str, str]:
    """Optionally prefix a base URL to attachment paths.

    - If base_url is provided (e.g., https://eaglechair.com), convert
      '/wp-content/uploads/...' to 'https://eaglechair.com/wp-content/uploads/...'
    - Leaves entries unchanged if already absolute (http/https) or if no base provided.
    """
    if not base_url:
        return attachments

    normalized_base = base_url.rstrip('/')
    out: dict[str, str] = {}
    for k, v in attachments.items():
        # If already absolute, keep as-is
        if v.startswith('http://') or v.startswith('https://'):
            out[k] = v
            continue
        out[k] = f"{normalized_base}/{v.lstrip('/')}"
    return out


async def main(dry_run: bool = False, image_base_url: str | None = None):
    """Main migration function."""
    logger.info("=" * 70)
    logger.info("WORDPRESS PRODUCT MIGRATION V2")
    logger.info("=" * 70)
    logger.info("")
    
    if dry_run:
        logger.warning("⚠️  DRY RUN MODE - No database changes\n")
    
    # Step 1: Parse SQL file
    logger.info("Step 1: Loading WordPress SQL file...")
    sql_content = get_sql_content()
    logger.info("✓ SQL file loaded\n")
    
    # Step 2: Extract terms and taxonomy
    logger.info("Step 2: Extracting WordPress terms and categories...")
    terms = extract_wordpress_terms(sql_content)
    product_cat_terms, post_terms = extract_taxonomy_relationships(sql_content)
    logger.info("✓ Terms extracted\n")
    
    # Step 3: Extract metadata
    logger.info("Step 3: Extracting product metadata...")
    metadata = extract_product_metadata(sql_content)
    logger.info("✓ Metadata extracted\n")
    
    # Step 3b: Extract attachment image URLs
    logger.info("Step 3b: Extracting attachment images...")
    attachments = extract_attachment_urls(sql_content)
    # Allow env var override if CLI flag not provided
    if image_base_url is None:
        image_base_url = os.getenv('IMAGE_BASE_URL')
    # Apply optional base URL prefix so stored image URLs are absolute
    attachments = _apply_base_url(attachments, image_base_url)
    logger.info("✓ Attachments extracted\n")
    
    # Step 4: Parse products
    logger.info("Step 4: Parsing products and families...")
    data = parse_products_from_wp_posts(sql_content, terms, post_terms, metadata)
    logger.info("✓ Products parsed\n")
    
    # Step 5: Migrate to database
    async with AsyncSessionLocal() as db:
        try:
            logger.info("Step 5: Migrating families...")
            migrate_families.attachment_lookup = attachments
            await migrate_families(db, data['families'], dry_run=dry_run)
            
            logger.info("Step 6: Migrating products...")
            # Provide attachment lookup to migrate_products via attribute to avoid signature changes
            migrate_products.attachment_lookup = attachments
            await migrate_products(db, data['products'], dry_run=dry_run)
            
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
    parser = argparse.ArgumentParser(description="Migrate WordPress products v2")
    parser.add_argument('--dry-run', action='store_true', help='Preview without making changes')
    parser.add_argument('--image-base-url', type=str, default=None, help='Base URL to prefix image paths (e.g., https://eaglechair.com)')
    args = parser.parse_args()
    
    asyncio.run(main(dry_run=args.dry_run, image_base_url=args.image_base_url))
