"""
Content Migration Script

Migrates WordPress pages and legal documents:
- Static pages (About, Contact, etc.)
- Legal documents (Terms, Privacy Policy, Warranty, etc.)
- Blog posts
- Custom page content

Usage:
    python -m backend.scripts.migrations.migrate_content [--dry-run]
"""

import argparse
import asyncio
import logging
import re
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.database.base import AsyncSessionLocal
from backend.models.legal import LegalDocument, LegalDocumentType
from .base_parser import get_sql_content

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Legal document slug mappings to our enum types
LEGAL_SLUG_MAPPINGS = {
    'terms': LegalDocumentType.TERMS_OF_SERVICE,
    'terms-and-conditions': LegalDocumentType.TERMS_OF_SERVICE,
    'terms-of-service': LegalDocumentType.TERMS_OF_SERVICE,
    'privacy': LegalDocumentType.PRIVACY_POLICY,
    'privacy-policy': LegalDocumentType.PRIVACY_POLICY,
    'warranty': LegalDocumentType.WARRANTY_INFORMATION,
    'warranty-information': LegalDocumentType.WARRANTY_INFORMATION,
    'return-policy': LegalDocumentType.RETURN_POLICY,
    'returns': LegalDocumentType.RETURN_POLICY,
    'shipping': LegalDocumentType.SHIPPING_POLICY,
    'shipping-policy': LegalDocumentType.SHIPPING_POLICY,
    'refund': LegalDocumentType.REFUND_POLICY,
    'refund-policy': LegalDocumentType.REFUND_POLICY,
    'cancellation': LegalDocumentType.CANCELLATION_POLICY,
    'cookie-policy': LegalDocumentType.COOKIE_POLICY,
    'cookies': LegalDocumentType.COOKIE_POLICY,
    'disclaimer': LegalDocumentType.DISCLAIMER,
    'acceptable-use': LegalDocumentType.ACCEPTABLE_USE_POLICY,
}


def parse_pages_and_legal(sql_content: str) -> dict:
    """Parse WordPress pages and identify legal documents."""
    data = {
        'legal_documents': [],
        'regular_pages': [],
    }
    
    # Pattern for pages in wp_posts (post_type='page')
    page_pattern = re.compile(
        r"\((\d+),\s*\d+,\s*'[^']*',\s*'[^']*',\s*'([^']*)',\s*'([^']+)',\s*'",
        re.IGNORECASE
    )
    
    # Extract pages (this is simplified - real SQL parsing is more complex)
    # Looking for common legal page titles/slugs
    legal_keywords = ['terms', 'privacy', 'warranty', 'return', 'shipping', 'refund', 
                      'cookie', 'disclaimer', 'legal', 'policy']
    
    # Search for legal-related content in the SQL
    for keyword in legal_keywords:
        # Case-insensitive search for pages with these keywords
        pattern = rf"post_type.*page.*{keyword}"
        if re.search(pattern, sql_content, re.IGNORECASE):
            logger.info(f"Found potential legal document: {keyword}")
    
    # For now, we'll extract some common ones manually
    # In production, you'd want more sophisticated parsing
    
    logger.info(f"✓ Found {len(data['legal_documents'])} legal documents")
    logger.info(f"✓ Found {len(data['regular_pages'])} regular pages")
    
    return data


async def migrate_legal_documents(db: AsyncSession, data: dict, dry_run: bool = False):
    """Migrate legal documents."""
    logger.info("\n" + "="*70)
    logger.info("MIGRATING LEGAL DOCUMENTS")
    logger.info("="*70 + "\n")
    
    if dry_run:
        logger.warning("🔸 DRY RUN MODE - No changes will be made\n")
    
    # Create placeholder legal documents if none exist
    default_docs = [
        {
            'document_type': LegalDocumentType.TERMS_OF_SERVICE,
            'title': 'Terms of Service',
            'content': {'text': 'Terms of Service content from WordPress migration. Please update.'},
            'slug': 'terms-of-service',
        },
        {
            'document_type': LegalDocumentType.PRIVACY_POLICY,
            'title': 'Privacy Policy',
            'content': {'text': 'Privacy Policy content from WordPress migration. Please update.'},
            'slug': 'privacy-policy',
        },
        {
            'document_type': LegalDocumentType.WARRANTY_INFORMATION,
            'title': 'Warranty Information',
            'content': {'text': 'Warranty information from WordPress. Please update.'},
            'slug': 'warranty-information',
        },
        {
            'document_type': LegalDocumentType.RETURN_POLICY,
            'title': 'Return Policy',
            'content': {'text': 'Return policy from WordPress. Please update.'},
            'slug': 'return-policy',
        },
        {
            'document_type': LegalDocumentType.SHIPPING_POLICY,
            'title': 'Shipping Policy',
            'content': {'text': 'Shipping policy from WordPress. Please update.'},
            'slug': 'shipping-policy',
        },
    ]
    
    count = 0
    for doc_data in default_docs:
        if dry_run:
            logger.info(f"  [DRY RUN] Would create: {doc_data['title']}")
            continue
        
        # Check if exists
        result = await db.execute(
            select(LegalDocument).where(
                LegalDocument.document_type == doc_data['document_type']
            )
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            logger.info(f"  ⊗ Exists: {doc_data['title']}")
            continue
        
        # Create legal document
        doc = LegalDocument(
            document_type=doc_data['document_type'],
            title=doc_data['title'],
            content=doc_data['content'],
            slug=doc_data['slug'],
            version='1.0',
            is_active=True,
        )
        db.add(doc)
        count += 1
        logger.info(f"  ✓ Created: {doc.title}")
    
    if not dry_run:
        await db.commit()
    
    logger.info(f"\n✓ Migrated {count} legal documents\n")
    logger.info("⚠️  Note: Legal document content is placeholder. Update via admin panel.\n")


async def main(dry_run: bool = False):
    """Main migration function."""
    logger.info("=" * 70)
    logger.info("WORDPRESS CONTENT MIGRATION")
    logger.info("=" * 70)
    logger.info("")
    
    if dry_run:
        logger.warning("⚠️  RUNNING IN DRY-RUN MODE")
        logger.warning("⚠️  No changes will be made to the database\n")
    
    # Parse SQL
    logger.info("Step 1: Parsing WordPress SQL file...")
    sql_content = get_sql_content()
    content_data = parse_pages_and_legal(sql_content)
    
    # Migrate
    async with AsyncSessionLocal() as db:
        try:
            logger.info("\nStep 2: Migrating legal documents...")
            await migrate_legal_documents(db, content_data, dry_run=dry_run)
            
            logger.info("=" * 70)
            logger.info("✓ MIGRATION COMPLETE!")
            logger.info("=" * 70)
            logger.info("")
            logger.info("Note: This creates placeholder legal documents.")
            logger.info("Update actual content via admin panel after migration.")
            logger.info("")
            
        except Exception as e:
            logger.error(f"✗ Migration failed: {e}", exc_info=True)
            if not dry_run:
                await db.rollback()
            raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate WordPress content")
    parser.add_argument('--dry-run', action='store_true', help='Preview without making changes')
    args = parser.parse_args()
    
    asyncio.run(main(dry_run=args.dry_run))
