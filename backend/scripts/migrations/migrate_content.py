"""
Content Migration Script

Seeds and migrates site content from two sources:
- WordPress SQL dump (pages, potential legal and resource content)
- Known-good demo data (hero slides, gallery images, company info)

What this script does now:
- Seeds hero slides, gallery images, about/company info, team, values, milestones
- Seeds features and client logos
- Seeds basic contact location
- Seeds baseline legal documents and shipping/warranty policy placeholders

Notes:
- Idempotent: re-runs will upsert (create-if-missing, otherwise skip/update minimal)
- Dry-run supported (no DB writes)
- Image base prefix supported via IMAGE_BASE_URL env var or --image-base-url flag

Usage:
    python -m backend.scripts.migrations.migrate_content [--dry-run] [--image-base-url https://eaglechair.com]
"""

import argparse
import asyncio
import logging
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402

from backend.database.base import AsyncSessionLocal  # noqa: E402
from backend.models.content import (  # noqa: E402
    ClientLogo,
    CompanyInfo,
    CompanyMilestone,
    CompanyValue,
    ContactLocation,
    Feature,
    HeroSlide,
    Installation,
    TeamMember,
)
from backend.models.legal import (  # noqa: E402
    LegalDocument,
    LegalDocumentType,
    ShippingPolicy,
    WarrantyInformation,
)

# Handle both direct execution and module execution
try:
    from .base_parser import get_sql_content  # noqa: E402
except ImportError:
    from base_parser import get_sql_content  # noqa: E402

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Legal document slug mappings to our enum types (aligned with backend.models.legal)
LEGAL_SLUG_MAPPINGS = {
    'terms': LegalDocumentType.TERMS,
    'terms-and-conditions': LegalDocumentType.CONDITIONS_OF_SALE,
    'terms-of-service': LegalDocumentType.TERMS,
    'privacy': LegalDocumentType.PRIVACY_POLICY,
    'privacy-policy': LegalDocumentType.PRIVACY_POLICY,
    'warranty': LegalDocumentType.WARRANTY,
    'warranty-information': LegalDocumentType.WARRANTY,
    'returns': LegalDocumentType.RETURNS,
    'return-policy': LegalDocumentType.RETURNS,
    'cancellations': LegalDocumentType.CANCELLATIONS,
    'shipping-policy': LegalDocumentType.OTHER,  # Shipping has dedicated model; keep placeholder if parsed via WP
    'cookie-policy': LegalDocumentType.OTHER,
    'disclaimer': LegalDocumentType.IP_DISCLAIMER,
}


def _apply_base_url(url: Optional[str], base_url: Optional[str]) -> Optional[str]:
    """Prefix relative URLs with a base URL if provided."""
    if not url:
        return url
    if url.startswith('http://') or url.startswith('https://'):
        return url
    if base_url:
        return base_url.rstrip('/') + '/' + url.lstrip('/')
    return url


def parse_pages_and_legal(sql_content: str) -> dict:
    """Parse WordPress pages and identify legal documents."""
    data = {
        'legal_documents': [],
        'regular_pages': [],
    }
    
    # Pattern for pages in wp_posts (post_type='page')
    # NOTE: For more robust parsing, expand the base_parser utilities
    
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
    
    logger.info(f"✓ Found {len(data['legal_documents'])} legal documents (parsed) [placeholder]")
    logger.info(f"✓ Found {len(data['regular_pages'])} regular pages (parsed) [placeholder]")
    
    return data


async def migrate_legal_documents(db: AsyncSession, data: dict, dry_run: bool = False):
    """Migrate legal documents."""
    logger.info("\n" + "="*70)
    logger.info("MIGRATING LEGAL DOCUMENTS")
    logger.info("="*70 + "\n")
    
    if dry_run:
        logger.warning("🔸 DRY RUN MODE - No changes will be made\n")
    
    # Create placeholder legal documents if none exist (aligned with enum)
    default_docs = [
        {
            'document_type': LegalDocumentType.TERMS,
            'title': 'Terms and Conditions',
            'content': 'Terms and Conditions placeholder. Please update with official content.',
            'slug': 'terms',
        },
        {
            'document_type': LegalDocumentType.PRIVACY_POLICY,
            'title': 'Privacy Policy',
            'content': 'Privacy Policy placeholder. Please update with official content.',
            'slug': 'privacy-policy',
        },
        {
            'document_type': LegalDocumentType.WARRANTY,
            'title': 'Warranty',
            'content': 'Warranty information placeholder. Please update with official content.',
            'slug': 'warranty',
        },
        {
            'document_type': LegalDocumentType.RETURNS,
            'title': 'Returns',
            'content': 'Returns policy placeholder. Please update with official content.',
            'slug': 'returns',
        },
        {
            'document_type': LegalDocumentType.CONDITIONS_OF_SALE,
            'title': 'Conditions of Sale',
            'content': 'Conditions of Sale placeholder. Please update with official content.',
            'slug': 'conditions-of-sale',
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
            content=doc_data['content'],  # Text column
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


async def migrate_shipping_and_warranty(db: AsyncSession, dry_run: bool = False):
    """Seed basic ShippingPolicy and WarrantyInformation placeholders if missing."""
    logger.info("\n" + "="*70)
    logger.info("MIGRATING SHIPPING/WARRANTY POLICIES")
    logger.info("="*70 + "\n")

    created = 0

    # Shipping Policy
    sp_name = "Standard Shipping Policy"
    if dry_run:
        logger.info(f"  [DRY RUN] Would ensure ShippingPolicy exists: {sp_name}")
    else:
        res = await db.execute(select(ShippingPolicy).where(ShippingPolicy.policy_name == sp_name))
        existing = res.scalar_one_or_none()
        if not existing:
            sp = ShippingPolicy(
                policy_name=sp_name,
                description="Shipping policy placeholder. Please update via admin.",
                freight_classification=None,
                shipping_timeframe=None,
                special_instructions=None,
                damage_claim_process=None,
                is_active=True,
            )
            db.add(sp)
            created += 1
            logger.info(f"  ✓ Created ShippingPolicy: {sp_name}")
        else:
            logger.info(f"  ⊗ ShippingPolicy exists: {sp_name}")

    # Warranty Information
    w_title = "Limited Warranty"
    if dry_run:
        logger.info(f"  [DRY RUN] Would ensure WarrantyInformation exists: {w_title}")
    else:
        res = await db.execute(select(WarrantyInformation).where(WarrantyInformation.title == w_title))
        existing = res.scalar_one_or_none()
        if not existing:
            wi = WarrantyInformation(
                warranty_type="Limited Warranty",
                title=w_title,
                description="Warranty information placeholder. Please update via admin.",
                duration=None,
                coverage=None,
                exclusions=None,
                claim_process=None,
                is_active=True,
                display_order=0,
            )
            db.add(wi)
            created += 1
            logger.info(f"  ✓ Created WarrantyInformation: {w_title}")
        else:
            logger.info(f"  ⊗ WarrantyInformation exists: {w_title}")

    if not dry_run:
        await db.commit()
    logger.info(f"\n✓ Shipping/Warranty seeded (created {created})\n")


def load_demo_seed_data(base_url: Optional[str]) -> Dict[str, Any]:
    """Return curated demo seed data we trust to insert."""
    # Hero slides
    hero_slides = [
        {
            "title": "Welcome to Eagle Chair",
            "subtitle": "Premium Commercial Furniture for Restaurants & Hospitality",
            "background_image_url": _apply_base_url("https://www.eaglechair.com/wp-content/uploads/2018/04/Carmine.6305P.install-v.10-e1691698608946-960x600.jpg", base_url),
            "cta_text": "Explore Products",
            "cta_link": "/products",
            "cta_style": "primary",
            "secondary_cta_text": None,
            "secondary_cta_link": None,
            "secondary_cta_style": None,
            "display_order": 1,
            "is_active": True,
        },
        {
            "title": "Crafted with Excellence",
            "subtitle": "Family-Owned. American-Made. Built to Last.",
            "background_image_url": _apply_base_url("https://www.eaglechair.com/wp-content/uploads/2014/10/Cafe-Neustadt.5001V.6016V.install-v2y-e1691698549306-960x600.jpg", base_url),
            "cta_text": "Our Story",
            "cta_link": "/about",
            "cta_style": "primary",
            "secondary_cta_text": None,
            "secondary_cta_link": None,
            "secondary_cta_style": None,
            "display_order": 2,
            "is_active": True,
        },
        {
            "title": "Complete Furniture Solutions",
            "subtitle": "Chairs, Tables, Barstools & Booths for Every Commercial Space",
            "background_image_url": _apply_base_url("https://www.eaglechair.com/wp-content/uploads/2017/06/Budapest-Cafe.6018V.install-v2-e1691698439957-960x600.jpg", base_url),
            "cta_text": "View Gallery",
            "cta_link": "/gallery",
            "cta_style": "primary",
            "secondary_cta_text": "Contact Us",
            "secondary_cta_link": "/contact",
            "secondary_cta_style": "outline",
            "display_order": 3,
            "is_active": True,
        },
    ]

    # Gallery images (will be stored as one Installation entry with images array)
    demo_gallery_images = [
        {
            "url": _apply_base_url("https://www.eaglechair.com/wp-content/uploads/2024/01/IMG_8681-960x600.jpeg", base_url),
            "title": "Restaurant Installation",
        },
        {
            "url": _apply_base_url("https://www.eaglechair.com/wp-content/uploads/2023/10/IMG_0694-960x600.jpeg", base_url),
            "title": "Commercial Dining Space",
        },
        {
            "url": _apply_base_url("https://www.eaglechair.com/wp-content/uploads/2014/10/Cafe-Neustadt.5001V.6016V.install-v2y-e1691698549306-960x600.jpg", base_url),
            "title": "Cafe Neustadt - Models 5001V & 6016V",
        },
        {
            "url": _apply_base_url("https://www.eaglechair.com/wp-content/uploads/2018/04/Carmine.6305P.install-v.10-e1691698608946-960x600.jpg", base_url),
            "title": "Carmine Restaurant - Model 6305P",
        },
        {
            "url": _apply_base_url("https://www.eaglechair.com/wp-content/uploads/2021/02/Baja-Sur.8621-Lanzac.6576.Atlanta-bases-400-table..install-v507-copy-e1691698160654-960x600.jpg", base_url),
            "title": "Baja Sur - 8621 & 6576 with Atlanta Bases",
        },
        {
            "url": _apply_base_url("https://www.eaglechair.com/wp-content/uploads/2017/06/Budapest-Cafe.6018V.install-v2-e1691698439957-960x600.jpg", base_url),
            "title": "Budapest Cafe - Model 6018V",
        },
    ]

    # Company information (About page)
    about_story = (
        "Founded in Houston, Texas in 1984 by the Yuglich Family, Eagle Chair has grown into a "
        "trusted name in commercial furniture manufacturing. Under the leadership of Katarina Kac-Statton "
        "and Maximilian Kac, we've maintained our commitment to quality, craftsmanship, and customer satisfaction.\n\n"
        "Our furniture graces thousands of restaurants, hotels, and hospitality venues across the country. "
        "Each piece is a testament to our dedication to excellence and our understanding of the demanding needs of commercial environments.\n\n"
        "As a family-owned business, we take pride in treating every customer like family. Your success is our success, and we're here to support you every step of the way."
    )

    team = [
        {
            "name": "Katarina Kac-Statton",
            "title": "Leadership",
            "bio": "Leading Eagle Chair with dedication to quality and customer satisfaction.",
            "photo_url": _apply_base_url("/team/katarina.jpg", base_url),
            "display_order": 1,
        },
        {
            "name": "Maximilian Kac",
            "title": "Leadership",
            "bio": "Continuing the Yuglich Family legacy of excellence in commercial furniture.",
            "photo_url": _apply_base_url("/team/maximilian.jpg", base_url),
            "display_order": 2,
        },
    ]

    values = [
        {"title": "Quality First", "subtitle": "Excellence in Every Detail", "description": "We never compromise on materials or craftsmanship. Every piece is built to last.", "image_url": _apply_base_url("https://images.unsplash.com/photo-1556912172-45b7abe8b7e1?w=400", base_url), "display_order": 1},
        {"title": "Customer Partnership", "subtitle": "Your Success is Our Success", "description": "We build lasting relationships with our clients, supporting them every step of the way.", "image_url": _apply_base_url("https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400", base_url), "display_order": 2},
        {"title": "American Made", "subtitle": "Proudly Made in the USA", "description": "Proudly manufacturing in the USA, supporting local communities and jobs.", "image_url": _apply_base_url("https://images.unsplash.com/photo-1565891741441-64926e441838?w=400", base_url), "display_order": 3},
        {"title": "Sustainability", "subtitle": "Eco-Friendly Practices", "description": "Committed to environmentally responsible practices and materials.", "image_url": _apply_base_url("https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=400", base_url), "display_order": 4},
    ]

    milestones = [
        {"year": "1984", "title": "Company Founded", "description": "Eagle Chair was established in Houston, Texas by the Yuglich Family", "image_url": None, "display_order": 1},
        {"year": "1995", "title": "Expansion", "description": "Opened new manufacturing facility and doubled capacity", "image_url": None, "display_order": 2},
        {"year": "2005", "title": "National Distribution", "description": "Expanded distribution network to serve nationwide", "image_url": None, "display_order": 3},
        {"year": "2024", "title": "Continued Excellence", "description": "Continuing the Yuglich Family legacy of quality craftsmanship", "image_url": None, "display_order": 4},
    ]

    features = [
        {"title": "American Made", "description": "All our furniture is manufactured in the USA with premium materials and superior craftsmanship.", "icon": "🇺🇸", "icon_color": "#1e40af", "image_url": _apply_base_url("https://images.unsplash.com/photo-1565891741441-64926e441838?w=600", base_url), "feature_type": "home_page", "display_order": 1},
        {"title": "Commercial Grade", "description": "Built to withstand heavy daily use in the most demanding commercial environments.", "icon": "🛡️", "icon_color": "#047857", "image_url": _apply_base_url("https://images.unsplash.com/photo-1556912172-45b7abe8b7e1?w=600", base_url), "feature_type": "home_page", "display_order": 2},
        {"title": "Custom Options", "description": "Extensive customization options including finishes, fabrics, and sizes to match your vision.", "icon": "🎨", "icon_color": "#7c3aed", "image_url": _apply_base_url("https://images.unsplash.com/photo-1503602642458-232111445657?w=600", base_url), "feature_type": "home_page", "display_order": 3},
        {"title": "Quick Turnaround", "description": "Fast production and shipping to get your furniture delivered when you need it.", "icon": "⚡", "icon_color": "#ea580c", "image_url": _apply_base_url("https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600", base_url), "feature_type": "home_page", "display_order": 4},
        {"title": "Warranty Backed", "description": "Comprehensive warranty coverage because we stand behind the quality of our products.", "icon": "✓", "icon_color": "#0891b2", "image_url": _apply_base_url("https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=600", base_url), "feature_type": "home_page", "display_order": 5},
        {"title": "Expert Support", "description": "Dedicated sales representatives to help you choose the perfect furniture for your space.", "icon": "👥", "icon_color": "#dc2626", "image_url": _apply_base_url("https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=600", base_url), "feature_type": "home_page", "display_order": 6},
    ]

    client_logos = [
        {"name": "Major Restaurant Chain", "logo_url": _apply_base_url("/logos/client-1.png", base_url), "website_url": None, "display_order": 1},
        {"name": "Hotel Group", "logo_url": _apply_base_url("/logos/client-2.png", base_url), "website_url": None, "display_order": 2},
        {"name": "Healthcare Facility", "logo_url": _apply_base_url("/logos/client-3.png", base_url), "website_url": None, "display_order": 3},
    ]

    contact_locations = [
        {
            "location_name": "Main Office & Showroom",
            "description": "Visit our showroom to see our furniture in person",
            "address_line1": "4816 Campbell Rd",
            "address_line2": None,
            "city": "Houston",
            "state": "Texas",
            "zip_code": "77041",
            "country": "USA",
            "phone": "(832) 555-0100",
            "fax": None,
            "email": "info@eaglechair.com",
            "toll_free": "1-800-EAGLE-01",
            "business_hours": "Mon-Fri: 8:00 AM - 5:00 PM CST\nSat: By Appointment\nSun: Closed",
            "image_url": None,
            "map_embed_url": None,
            "location_type": "office",
            "display_order": 1,
            "is_active": True,
            "is_primary": True,
        }
    ]

    company_info_sections = [
        {"section_key": "about_hero", "title": "Our Story", "content": "Family-owned and operated since 1984, continuing the Yuglich Family legacy of quality commercial furniture manufacturing in Houston, Texas.", "image_url": None, "display_order": 1},
        {"section_key": "about_story", "title": "Craftsmanship & Dedication", "content": about_story, "image_url": None, "display_order": 2},
    ]

    return {
        "hero_slides": hero_slides,
        "gallery_images": demo_gallery_images,
        "team": team,
        "values": values,
        "milestones": milestones,
        "features": features,
        "client_logos": client_logos,
        "contact_locations": contact_locations,
        "company_info": company_info_sections,
    }


async def migrate_hero_slides(db: AsyncSession, slides: List[Dict[str, Any]], dry_run: bool = False):
    logger.info("\n" + "="*70)
    logger.info("MIGRATING HERO SLIDES")
    logger.info("="*70 + "\n")
    created = 0
    for s in slides:
        if dry_run:
            logger.info(f"  [DRY RUN] Would upsert HeroSlide: {s['title']}")
            continue
        res = await db.execute(select(HeroSlide).where(HeroSlide.title == s['title']))
        existing = res.scalar_one_or_none()
        if existing:
            # Update minimal fields if changed
            updated = False
            if existing.background_image_url != s['background_image_url']:
                existing.background_image_url = s['background_image_url']
                updated = True
            if updated:
                logger.info(f"  ↻ Updated: {s['title']}")
        else:
            hs = HeroSlide(
                title=s['title'],
                subtitle=s.get('subtitle'),
                background_image_url=s['background_image_url'],
                cta_text=s.get('cta_text'),
                cta_link=s.get('cta_link'),
                cta_style=s.get('cta_style', 'primary'),
                secondary_cta_text=s.get('secondary_cta_text'),
                secondary_cta_link=s.get('secondary_cta_link'),
                secondary_cta_style=s.get('secondary_cta_style'),
                display_order=s.get('display_order', 0),
                is_active=s.get('is_active', True),
            )
            db.add(hs)
            created += 1
            logger.info(f"  ✓ Created: {s['title']}")
    if not dry_run:
        await db.commit()
    logger.info(f"\n✓ Hero slides upserted (created {created})\n")


async def migrate_installations(db: AsyncSession, gallery_images: List[Dict[str, Any]], dry_run: bool = False):
    logger.info("\n" + "="*70)
    logger.info("MIGRATING INSTALLATION GALLERY")
    logger.info("="*70 + "\n")

    # We'll store as a single installation gallery entry
    project_name = "Eagle Chair Installations"
    images_json = []
    for idx, img in enumerate(gallery_images, start=1):
        images_json.append({
            "url": img["url"],
            "title": img.get("title"),
            "description": None,
            "order": idx,
        })

    if dry_run:
        logger.info(f"  [DRY RUN] Would upsert Installation gallery: {project_name} with {len(images_json)} images")
        return

    res = await db.execute(select(Installation).where(Installation.project_name == project_name))
    existing = res.scalar_one_or_none()
    if existing:
        existing.images = images_json
        existing.primary_image = images_json[0]["url"] if images_json else None
        logger.info(f"  ↻ Updated gallery images: {project_name}")
    else:
        inst = Installation(
            project_name=project_name,
            client_name=None,
            location=None,
            project_type=None,
            description=None,
            images=images_json,
            primary_image=images_json[0]["url"] if images_json else None,
            products_used=None,
            completion_date=None,
            display_order=0,
            is_active=True,
            is_featured=False,
            view_count=0,
        )
        db.add(inst)
        logger.info(f"  ✓ Created gallery: {project_name}")
    await db.commit()
    logger.info("\n✓ Installation gallery upserted\n")


async def migrate_company_info(db: AsyncSession, company_info: List[Dict[str, Any]], dry_run: bool = False):
    logger.info("\n" + "="*70)
    logger.info("MIGRATING COMPANY INFO SECTIONS")
    logger.info("="*70 + "\n")
    created = 0
    for sec in company_info:
        key = sec["section_key"]
        if dry_run:
            logger.info(f"  [DRY RUN] Would upsert CompanyInfo[{key}]")
            continue
        res = await db.execute(select(CompanyInfo).where(CompanyInfo.section_key == key))
        existing = res.scalar_one_or_none()
        if existing:
            # Update title/content if changed
            updated = False
            if existing.title != sec["title"]:
                existing.title = sec["title"]
                updated = True
            if existing.content != sec["content"]:
                existing.content = sec["content"]
                updated = True
            if existing.image_url != sec.get("image_url"):
                existing.image_url = sec.get("image_url")
                updated = True
            if updated:
                logger.info(f"  ↻ Updated CompanyInfo[{key}]")
            else:
                logger.info(f"  ⊗ Exists CompanyInfo[{key}]")
        else:
            ci = CompanyInfo(
                section_key=key,
                title=sec["title"],
                content=sec["content"],
                image_url=sec.get("image_url"),
                display_order=sec.get("display_order", 0),
                is_active=True,
            )
            db.add(ci)
            created += 1
            logger.info(f"  ✓ Created CompanyInfo[{key}]")
    if not dry_run:
        await db.commit()
    logger.info(f"\n✓ CompanyInfo upserted (created {created})\n")


async def migrate_team_values_milestones(db: AsyncSession, team: List[Dict[str, Any]], values: List[Dict[str, Any]], milestones: List[Dict[str, Any]], dry_run: bool = False):
    logger.info("\n" + "="*70)
    logger.info("MIGRATING TEAM / VALUES / MILESTONES")
    logger.info("="*70 + "\n")
    created_tm = created_val = created_ms = 0

    # Team
    for m in team:
        if dry_run:
            logger.info(f"  [DRY RUN] Would upsert TeamMember: {m['name']}")
        else:
            res = await db.execute(select(TeamMember).where(TeamMember.name == m['name']))
            existing = res.scalar_one_or_none()
            if not existing:
                tm = TeamMember(
                    name=m['name'],
                    title=m.get('title'),
                    bio=m.get('bio'),
                    email=None,
                    phone=None,
                    photo_url=m.get('photo_url'),
                    linkedin_url=None,
                    display_order=m.get('display_order', 0),
                    is_active=True,
                    is_featured=True,
                )
                db.add(tm)
                created_tm += 1
                logger.info(f"  ✓ Created TeamMember: {m['name']}")

    # Values
    for v in values:
        if dry_run:
            logger.info(f"  [DRY RUN] Would upsert CompanyValue: {v['title']}")
        else:
            res = await db.execute(select(CompanyValue).where(CompanyValue.title == v['title']))
            existing = res.scalar_one_or_none()
            if not existing:
                cv = CompanyValue(
                    title=v['title'],
                    subtitle=v.get('subtitle'),
                    description=v['description'],
                    icon=None,
                    image_url=v.get('image_url'),
                    display_order=v.get('display_order', 0),
                    is_active=True,
                )
                db.add(cv)
                created_val += 1
                logger.info(f"  ✓ Created CompanyValue: {v['title']}")

    # Milestones
    for ms in milestones:
        key = (ms['year'], ms['title'])
        if dry_run:
            logger.info(f"  [DRY RUN] Would upsert CompanyMilestone: {key}")
        else:
            res = await db.execute(select(CompanyMilestone).where(CompanyMilestone.year == ms['year']).where(CompanyMilestone.title == ms['title']))
            existing = res.scalar_one_or_none()
            if not existing:
                cm = CompanyMilestone(
                    year=ms['year'],
                    title=ms['title'],
                    description=ms['description'],
                    image_url=ms.get('image_url'),
                    display_order=ms.get('display_order', 0),
                    is_active=True,
                )
                db.add(cm)
                created_ms += 1
                logger.info(f"  ✓ Created CompanyMilestone: {key}")

    if not dry_run:
        await db.commit()
    logger.info(f"\n✓ Team({created_tm}) / Values({created_val}) / Milestones({created_ms}) upserted\n")


async def migrate_features_and_logos(db: AsyncSession, features: List[Dict[str, Any]], logos: List[Dict[str, Any]], dry_run: bool = False):
    logger.info("\n" + "="*70)
    logger.info("MIGRATING FEATURES AND CLIENT LOGOS")
    logger.info("="*70 + "\n")
    created_feat = created_logo = 0

    for f in features:
        if dry_run:
            logger.info(f"  [DRY RUN] Would upsert Feature: {f['title']}")
        else:
            res = await db.execute(select(Feature).where(Feature.title == f['title']))
            existing = res.scalar_one_or_none()
            if not existing:
                ft = Feature(
                    title=f['title'],
                    description=f['description'],
                    icon=f.get('icon'),
                    icon_color=f.get('icon_color'),
                    image_url=f.get('image_url'),
                    feature_type=f.get('feature_type', 'general'),
                    display_order=f.get('display_order', 0),
                    is_active=True,
                )
                db.add(ft)
                created_feat += 1
                logger.info(f"  ✓ Created Feature: {f['title']}")

    for c in logos:
        if dry_run:
            logger.info(f"  [DRY RUN] Would upsert ClientLogo: {c['name']}")
        else:
            res = await db.execute(select(ClientLogo).where(ClientLogo.name == c['name']))
            existing = res.scalar_one_or_none()
            if not existing:
                cl = ClientLogo(
                    name=c['name'],
                    logo_url=c.get('logo_url'),
                    website_url=c.get('website_url'),
                    display_order=c.get('display_order', 0),
                    is_active=True,
                )
                db.add(cl)
                created_logo += 1
                logger.info(f"  ✓ Created ClientLogo: {c['name']}")

    if not dry_run:
        await db.commit()
    logger.info(f"\n✓ Features({created_feat}) and ClientLogos({created_logo}) upserted\n")


async def migrate_contact_locations(db: AsyncSession, locations: List[Dict[str, Any]], dry_run: bool = False):
    logger.info("\n" + "="*70)
    logger.info("MIGRATING CONTACT LOCATIONS")
    logger.info("="*70 + "\n")
    created = 0
    for loc in locations:
        if dry_run:
            logger.info(f"  [DRY RUN] Would upsert ContactLocation: {loc['location_name']}")
            continue
        res = await db.execute(select(ContactLocation).where(ContactLocation.location_name == loc['location_name']))
        existing = res.scalar_one_or_none()
        if not existing:
            cl = ContactLocation(
                location_name=loc['location_name'],
                description=loc.get('description'),
                address_line1=loc.get('address_line1'),
                address_line2=loc.get('address_line2'),
                city=loc.get('city'),
                state=loc.get('state'),
                zip_code=loc.get('zip_code'),
                country=loc.get('country', 'USA'),
                phone=loc.get('phone'),
                fax=loc.get('fax'),
                email=loc.get('email'),
                toll_free=loc.get('toll_free'),
                business_hours=loc.get('business_hours'),
                image_url=loc.get('image_url'),
                map_embed_url=loc.get('map_embed_url'),
                location_type=loc.get('location_type', 'office'),
                display_order=loc.get('display_order', 0),
                is_active=loc.get('is_active', True),
                is_primary=loc.get('is_primary', False),
            )
            db.add(cl)
            created += 1
            logger.info(f"  ✓ Created ContactLocation: {loc['location_name']}")
        else:
            logger.info(f"  ⊗ Exists ContactLocation: {loc['location_name']}")
    if not dry_run:
        await db.commit()
    logger.info(f"\n✓ Contact locations upserted (created {created})\n")


async def main(dry_run: bool = False, image_base_url: Optional[str] = None):
    """Main migration function."""
    logger.info("=" * 70)
    logger.info("WORDPRESS CONTENT MIGRATION")
    logger.info("=" * 70)
    logger.info("")
    
    if dry_run:
        logger.warning("⚠️  RUNNING IN DRY-RUN MODE")
        logger.warning("⚠️  No changes will be made to the database\n")
    
    # Image base url
    base_url = image_base_url or os.environ.get("IMAGE_BASE_URL")
    if base_url:
        logger.info(f"Image base URL set: {base_url}")

    # Parse SQL (placeholder for future enrichments)
    logger.info("Step 1: Parsing WordPress SQL file...")
    sql_content = get_sql_content()
    content_data = parse_pages_and_legal(sql_content)
    
    # Load curated demo data for seeding
    demo = load_demo_seed_data(base_url)

    # Migrate
    async with AsyncSessionLocal() as db:
        try:
            logger.info("\nStep 2: Migrating legal documents...")
            await migrate_legal_documents(db, content_data, dry_run=dry_run)
            await migrate_shipping_and_warranty(db, dry_run=dry_run)

            logger.info("\nStep 3: Seeding hero slides...")
            await migrate_hero_slides(db, demo["hero_slides"], dry_run=dry_run)

            logger.info("\nStep 4: Seeding installation gallery...")
            await migrate_installations(db, demo["gallery_images"], dry_run=dry_run)

            logger.info("\nStep 5: Seeding company info, team, values, milestones...")
            await migrate_company_info(db, demo["company_info"], dry_run=dry_run)
            await migrate_team_values_milestones(db, demo["team"], demo["values"], demo["milestones"], dry_run=dry_run)

            logger.info("\nStep 6: Seeding features and client logos...")
            await migrate_features_and_logos(db, demo["features"], demo["client_logos"], dry_run=dry_run)

            logger.info("\nStep 7: Seeding contact locations...")
            await migrate_contact_locations(db, demo["contact_locations"], dry_run=dry_run)
            
            logger.info("=" * 70)
            logger.info("✓ MIGRATION COMPLETE!")
            logger.info("=" * 70)
            logger.info("")
            logger.info("Note: Legal documents, shipping, and warranty are placeholders.")
            logger.info("Use admin to refine content or expand mappings to pull from the SQL dump/web.")
            logger.info("")
            
        except Exception as e:
            logger.error(f"✗ Migration failed: {e}", exc_info=True)
            if not dry_run:
                await db.rollback()
            raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate WordPress content")
    parser.add_argument('--dry-run', action='store_true', help='Preview without making changes')
    parser.add_argument('--image-base-url', type=str, default=None, help='Base URL to prefix relative images (or set IMAGE_BASE_URL env)')
    args = parser.parse_args()

    asyncio.run(main(dry_run=args.dry_run, image_base_url=args.image_base_url))
