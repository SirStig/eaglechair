"""
Static Content Exporter

Exports CMS content from the database to a static JSON file
(contentData.json) for instant frontend loading. This eliminates API calls for
static content like hero images, site settings, reps, gallery images, etc.

Handles both development and production environments.

Concurrency: a partial export (one section after an admin save) is a
read-modify-write of the shared file, so it runs under a Redis lock shared by
every Gunicorn worker (falling back to an in-process lock if Redis is down).
Files are written atomically (temp file + os.replace), so readers never see a
half-written file and no separate backup copy is needed.
"""

import asyncio
import json
import logging
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any, Awaitable, Callable, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.core.redis_lock import redis_lock
from backend.models.chair import Category, Finish, Upholstery
from backend.models.content import (
    FAQ,
    Catalog,
    ClientLogo,
    CompanyInfo,
    CompanyMilestone,
    CompanyValue,
    ContactLocation,
    FAQCategory,
    Feature,
    Hardware,
    HeroSlide,
    Installation,
    Laminate,
    PageContent,
    SalesRepresentative,
    SiteSettings,
    TeamMember,
    Testimonial,
)
from backend.models.legal import LegalDocument, WarrantyInformation
from backend.utils.serializers import parse_json_list

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Serializes exports within this process; the Redis lock below serializes
# them across Gunicorn workers.
_export_lock = asyncio.Lock()

# Cross-worker lock around the contentData.json read-modify-write
EXPORT_LOCK_KEY = "eaglechair:lock:content_export"
EXPORT_LOCK_TTL_MS = 30_000
# A full export queries every section, so give it more headroom
FULL_EXPORT_LOCK_TTL_MS = 120_000

# Content key and file written separately from contentData.json (see __init__)
LEGAL_DOCUMENTS_KEY = "legalDocuments"
LEGAL_DOCUMENTS_FILENAME = "legalDocuments.json"

# Legacy backup copy, no longer written (see _remove_legacy_cache)
LEGACY_CACHE_FILENAME = ".contentData.json"


class StaticContentExporter:
    """
    Exports database content to static JSON files in the frontend.

    Flow:
    1. Admin updates content in CMS
    2. Content saved to database
    3. This exporter rewrites contentData.json:
       - Development: frontend/public/data/contentData.json (served at /data/contentData.json)
       - Production: {FRONTEND_PATH}/data/contentData.json (no public folder after build)
    4. Frontend loads from /data/contentData.json (works in both environments)
    """

    def __init__(self, frontend_path: Optional[str] = None):
        """
        Initialize the exporter.

        Args:
            frontend_path: Path to frontend directory. If None, auto-detect.
        """
        self.frontend_path = self._resolve_frontend_path(frontend_path)

        # Detect environment: Development has public folder, production does not
        public_dir = self.frontend_path / "public"
        is_development = public_dir.exists() and public_dir.is_dir()

        if is_development:
            # Development mode: Write to public/data/contentData.json
            # This is served at /data/contentData.json by Vite dev server
            self.data_dir = public_dir / "data"
            logger.info(
                "StaticContentExporter initialized for DEVELOPMENT: writing to public/data"
            )
        else:
            # Production mode: Write to {FRONTEND_PATH}/data/contentData.json
            # No public folder exists after build, files are at root level of frontend directory
            self.data_dir = self.frontend_path / "data"
            logger.info(
                f"StaticContentExporter initialized for PRODUCTION: writing to {self.frontend_path}/data"
            )
        self.content_file = self.data_dir / "contentData.json"

        # Legal documents are large (~80% of the payload) and only used by the
        # Terms/Privacy/General Information pages, so they live in their own file
        # next to contentData.json instead of being downloaded on every page.
        self.legal_file = self.data_dir / LEGAL_DOCUMENTS_FILENAME

        # Ensure data directory exists
        self.data_dir.mkdir(parents=True, exist_ok=True)

        logger.info(f"Content file path: {self.content_file}")

    def _resolve_frontend_path(self, custom_path: Optional[str] = None) -> Path:
        """
        Resolve the frontend directory path.

        Priority order:
        1. Custom path (for testing)
        2. settings.FRONTEND_PATH (from config, which reads from env var)
        3. Environment variable FRONTEND_PATH (direct check)
        4. Auto-detection relative to backend directory (development)

        Args:
            custom_path: Optional custom path override

        Returns:
            Path to frontend directory
        """
        if custom_path:
            return Path(custom_path)

        # Check settings.FRONTEND_PATH (from config, which reads from env var)
        # This is the preferred method as it uses the config system
        from backend.core.config import settings

        if settings.FRONTEND_PATH and settings.FRONTEND_PATH != "frontend":
            # If FRONTEND_PATH is set to something other than default, use it
            # This handles production where it's set to /home/dh_wmujeb/joshua.eaglechair.com
            frontend_path = Path(settings.FRONTEND_PATH)
            if frontend_path.is_absolute() or frontend_path.exists():
                logger.info(f"Using FRONTEND_PATH from settings: {frontend_path}")
                return (
                    frontend_path.resolve() if frontend_path.exists() else frontend_path
                )

        # Check environment variable directly (fallback)
        env_path = os.getenv("FRONTEND_PATH")
        if env_path:
            env_path_obj = Path(env_path)
            logger.info(f"Using FRONTEND_PATH from environment: {env_path_obj}")
            return env_path_obj.resolve() if env_path_obj.exists() else env_path_obj

        # Auto-detect based on backend location (development)
        backend_dir = Path(__file__).resolve().parent.parent

        # Development: backend is sibling to frontend
        frontend_dev = backend_dir.parent / "frontend"
        if frontend_dev.exists():
            logger.info(
                f"Using development frontend path (auto-detected): {frontend_dev}"
            )
            return frontend_dev

        # Fallback: use settings.FRONTEND_PATH even if it's the default "frontend"
        if settings.FRONTEND_PATH:
            frontend_path = backend_dir.parent / settings.FRONTEND_PATH
            if frontend_path.exists():
                logger.info(
                    f"Using FRONTEND_PATH from settings (relative): {frontend_path}"
                )
                return frontend_path

        # Final fallback to development path (will be created if needed)
        logger.warning(f"Frontend path not found, using: {frontend_dev}")
        return frontend_dev

    # ------------------------------------------------------------------
    # File I/O (blocking; call through asyncio.to_thread from async code)
    # ------------------------------------------------------------------

    def load_existing_content(self) -> Optional[Dict[str, Any]]:
        """
        Read contentData.json without its metadata.

        Returns:
            The content sections, or None if the file is missing or unreadable
            (callers then rebuild every section instead of merging into it).
        """
        if not self.content_file.exists():
            return None
        try:
            with open(self.content_file, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            logger.warning(f"Could not read existing content file: {e}")
            return None
        if not isinstance(data, dict):
            logger.warning("Existing content file is not a JSON object; ignoring it")
            return None
        data.pop("_metadata", None)
        return data

    def _read_existing_content(self) -> Dict[str, Any]:
        """Existing content sections, or an empty dict if there are none."""
        return self.load_existing_content() or {}

    def write_sections(
        self,
        sections: Dict[str, Any],
        existing: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Merge ``sections`` into ``existing`` and write the result in one pass.

        Legal documents go to legalDocuments.json instead of contentData.json.

        Args:
            sections: Content sections to write, keyed by contentData.json key
            existing: Current contentData.json content to merge into, or None
                to write ``sections`` as the complete file

        Raises:
            Exception: If a file could not be written
        """
        sections = dict(sections)
        content = dict(existing) if existing is not None else {}

        if LEGAL_DOCUMENTS_KEY in sections:
            self._write_legal_documents(sections.pop(LEGAL_DOCUMENTS_KEY))
            # Only legal documents changed: rewrite contentData.json only if it
            # still carries legal documents from before they were split out.
            if not sections and existing is not None and LEGAL_DOCUMENTS_KEY not in existing:
                return

        content.update(sections)
        content.pop(LEGAL_DOCUMENTS_KEY, None)

        self._write_content_file(self.content_file, self._generate_json_file(content))
        self._remove_legacy_cache()
        logger.info(f"Successfully exported content to {self.content_file}")

    def export_all_content(self, content_data: Dict[str, Any]) -> bool:
        """
        Write ``content_data`` as the complete contentData.json.

        Args:
            content_data: Dictionary containing all content sections

        Returns:
            True if successful, False otherwise
        """
        try:
            self.write_sections(content_data)
            return True
        except Exception:
            logger.exception("Failed to export content")
            return False

    def _write_legal_documents(self, documents: List[Dict[str, Any]]):
        """
        Write legal documents to legalDocuments.json (atomic, same format as
        contentData.json: the section key plus _metadata).

        Args:
            documents: List of legal document dictionaries
        """
        self._write_content_file(
            self.legal_file,
            self._generate_json_file({LEGAL_DOCUMENTS_KEY: documents}),
        )
        logger.info(f"Successfully exported legal documents to {self.legal_file}")

    def _write_content_file(self, file_path: Path, content: str):
        """
        Write content to file atomically (temp file in the same directory,
        then os.replace), so readers never see a partially written file.

        Args:
            file_path: Path to write to
            content: Content to write
        """
        temp_file = file_path.with_name(f".{file_path.name}.{uuid.uuid4().hex}.tmp")
        try:
            with open(temp_file, "w", encoding="utf-8") as f:
                f.write(content)
                f.flush()
                os.fsync(f.fileno())
            os.replace(temp_file, file_path)
        finally:
            if temp_file.exists():
                try:
                    temp_file.unlink()
                except OSError:
                    pass

    def _remove_legacy_cache(self) -> None:
        """Delete the old non-atomic backup copy that sat in the public data dir."""
        legacy = self.data_dir / LEGACY_CACHE_FILENAME
        try:
            legacy.unlink(missing_ok=True)
        except OSError as e:
            logger.warning(f"Could not remove legacy cache file {legacy}: {e}")

    def _generate_json_file(self, content_data: Dict[str, Any]) -> str:
        """
        Generate the complete JSON file content.

        Args:
            content_data: Content sections dictionary

        Returns:
            Complete JSON file content as string
        """
        timestamp = datetime.utcnow().isoformat()

        # Add metadata to content data
        json_data = {
            **content_data,
            "_metadata": {
                "lastUpdated": timestamp,
                "version": "1.0.0",
                "generatedBy": "StaticContentExporter",
            },
        }

        # Serialize to JSON with proper formatting
        return json.dumps(json_data, indent=2, ensure_ascii=False)


# Singleton instance
_exporter_instance: Optional[StaticContentExporter] = None


def get_exporter() -> StaticContentExporter:
    """
    Get or create the singleton exporter instance.

    Returns:
        StaticContentExporter instance
    """
    global _exporter_instance
    if _exporter_instance is None:
        _exporter_instance = StaticContentExporter()
    return _exporter_instance


# ============================================================================
# Section builders: query the database and return one contentData.json section
# ============================================================================


async def _build_site_settings(db: "AsyncSession") -> Dict[str, Any]:
    result = await db.execute(select(SiteSettings).limit(1))
    settings = result.scalar_one_or_none()
    if not settings:
        return {}
    return {
        # Company Branding
        "companyName": settings.company_name,
        "companyTagline": settings.company_tagline,
        "logoUrl": settings.logo_url,
        "logoDarkUrl": settings.logo_dark_url,
        "faviconUrl": settings.favicon_url,
        # Primary Contact Info
        "primaryEmail": settings.primary_email,
        "primaryPhone": settings.primary_phone,
        "salesEmail": settings.sales_email,
        "salesPhone": settings.sales_phone,
        "supportEmail": settings.support_email,
        "supportPhone": settings.support_phone,
        # Primary Address
        "addressLine1": settings.address_line1,
        "addressLine2": settings.address_line2,
        "city": settings.city,
        "state": settings.state,
        "zipCode": settings.zip_code,
        "country": settings.country,
        # Business Hours
        "businessHoursWeekdays": settings.business_hours_weekdays,
        "businessHoursSaturday": settings.business_hours_saturday,
        "businessHoursSunday": settings.business_hours_sunday,
        # Social Media
        "facebookUrl": settings.facebook_url,
        "instagramUrl": settings.instagram_url,
        "linkedinUrl": settings.linkedin_url,
        "twitterUrl": settings.twitter_url,
        "youtubeUrl": settings.youtube_url,
        # SEO & Meta
        "metaTitle": settings.meta_title,
        "metaDescription": settings.meta_description,
        "metaKeywords": settings.meta_keywords,
        # Theme & Additional
        "themeColors": settings.theme_colors,
        "additionalSettings": settings.additional_settings,
    }


async def _build_categories(db: "AsyncSession") -> List[Dict[str, Any]]:
    # Export the catalog nav hierarchy: only primary (top-level) categories,
    # each with its children. Children are both product subcategories and
    # nested categories (categories with a parent_id) — a nested category is a
    # child and must never be exported as a primary category.
    from backend.services.product_service import ProductService

    children_by_category = await ProductService.get_category_children(
        db=db, include_inactive=False, with_counts=False
    )

    def _child_payload(child):
        return {
            "id": child["id"],
            "name": child["name"],
            "slug": child["slug"],
            "description": child["description"],
            "categoryId": child["category_id"],
            "displayOrder": child["display_order"],
            "isActive": child["is_active"],
            "type": child["type"],
            "specProfile": child.get("spec_profile"),
        }

    # Fetch active top-level categories
    result = await db.execute(
        select(Category)
        .where(Category.is_active == True, Category.parent_id.is_(None))
        .order_by(Category.display_order)
    )
    categories = result.scalars().all()

    return [
        {
            "id": c.id,
            "name": c.name,
            "slug": c.slug,
            "description": c.description,
            "parentId": c.parent_id,
            "displayOrder": c.display_order,
            "isActive": c.is_active,
            "iconUrl": c.icon_url,
            "bannerImageUrl": c.banner_image_url,
            "specProfile": c.spec_profile,
            "subcategories": [
                _child_payload(child) for child in children_by_category.get(c.id, [])
            ],
        }
        for c in categories
    ]


async def _build_hero_slides(db: "AsyncSession") -> List[Dict[str, Any]]:
    result = await db.execute(
        select(HeroSlide)
        .where(HeroSlide.is_active == True)
        .order_by(HeroSlide.display_order, HeroSlide.id)
    )
    return [
        {
            "id": s.id,
            "title": s.title,
            "subtitle": s.subtitle,
            "image": s.background_image_url,
            "ctaText": s.cta_text,
            "ctaLink": s.cta_link,
            "ctaStyle": s.cta_style,
            "secondaryCtaText": s.secondary_cta_text,
            "secondaryCtaLink": s.secondary_cta_link,
            "displayOrder": s.display_order,
        }
        for s in result.scalars().all()
    ]


async def _build_sales_reps(db: "AsyncSession") -> List[Dict[str, Any]]:
    result = await db.execute(
        select(SalesRepresentative)
        .where(SalesRepresentative.is_active == True)
        .order_by(
            SalesRepresentative.display_order,
            SalesRepresentative.territory_name,
        )
    )
    return [
        {
            "id": r.id,
            "name": r.name,
            "territoryName": r.territory_name,
            "statesCovered": r.states_covered,
            "email": r.email,
            "phone": r.phone,
            "photoUrl": r.photo_url,
            "title": r.title,
            "bio": r.bio,
            "mobilePhone": r.mobile_phone,
            "fax": r.fax,
            "linkedinUrl": r.linkedin_url,
            "displayOrder": r.display_order,
            "isActive": r.is_active,
        }
        for r in result.scalars().all()
    ]


PRODUCT_INSTALL = "product_install"  # install photos shown only on product pages, not in the Gallery


async def _build_product_installs(db: "AsyncSession") -> List[Dict[str, Any]]:
    result = await db.execute(
        select(Installation)
        .where(Installation.is_active == True)
        .where(Installation.project_type == PRODUCT_INSTALL)
        .order_by(Installation.display_order.desc())
    )
    return [
        {
            "id": i.id,
            "title": i.project_name,
            "url": i.primary_image,
            "productsUsed": [int(x) for x in parse_json_list(i.products_used) if str(x).isdigit()],
        }
        for i in result.scalars().all()
    ]


async def _build_gallery_images(db: "AsyncSession") -> List[Dict[str, Any]]:
    result = await db.execute(
        select(Installation)
        .where(Installation.is_active == True)
        .where(Installation.project_type.is_distinct_from(PRODUCT_INSTALL))
        .order_by(Installation.display_order.desc())
    )
    return [
        {
            "id": i.id,
            "title": i.project_name,
            "category": i.project_type,
            "url": i.primary_image,
            "images": parse_json_list(i.images),
            "description": i.description,
            "location": i.location,
            "clientName": i.client_name,
            "productsUsed": [int(x) for x in parse_json_list(i.products_used) if str(x).isdigit()],
        }
        for i in result.scalars().all()
    ]


async def _build_features(db: "AsyncSession") -> List[Dict[str, Any]]:
    result = await db.execute(
        select(Feature).where(Feature.is_active == True).order_by(Feature.display_order)
    )
    return [
        {
            "id": f.id,
            "title": f.title,
            "description": f.description,
            "icon": f.icon,
            "featureType": f.feature_type,
            "displayOrder": f.display_order,
        }
        for f in result.scalars().all()
    ]


async def _build_company_values(db: "AsyncSession") -> List[Dict[str, Any]]:
    result = await db.execute(
        select(CompanyValue)
        .where(CompanyValue.is_active == True)
        .order_by(CompanyValue.display_order)
    )
    return [
        {
            "id": v.id,
            "title": v.title,
            "subtitle": v.subtitle,
            "description": v.description,
            "icon": v.icon,
            "imageUrl": v.image_url,
        }
        for v in result.scalars().all()
    ]


async def _build_company_milestones(db: "AsyncSession") -> List[Dict[str, Any]]:
    result = await db.execute(
        select(CompanyMilestone)
        .where(CompanyMilestone.is_active == True)
        .order_by(CompanyMilestone.display_order, CompanyMilestone.year)
    )
    return [
        {
            "id": m.id,
            "year": m.year,
            "title": m.title,
            "description": m.description,
        }
        for m in result.scalars().all()
    ]


async def _build_team_members(db: "AsyncSession") -> List[Dict[str, Any]]:
    result = await db.execute(
        select(TeamMember)
        .where(TeamMember.is_active == True)
        .order_by(TeamMember.display_order)
    )
    return [
        {
            "id": m.id,
            "name": m.name,
            "title": m.title,
            "bio": m.bio,
            "email": m.email,
            "phone": m.phone,
            "image": m.photo_url,
            "linkedinUrl": m.linkedin_url,
        }
        for m in result.scalars().all()
    ]


async def _build_client_logos(db: "AsyncSession") -> List[Dict[str, Any]]:
    result = await db.execute(
        select(ClientLogo)
        .where(ClientLogo.is_active == True)
        .order_by(ClientLogo.display_order)
    )
    return [
        {
            "id": l.id,
            "name": l.name,
            "logoUrl": l.logo_url,
            "websiteUrl": l.website_url,
        }
        for l in result.scalars().all()
    ]


async def _build_testimonials(db: "AsyncSession") -> List[Dict[str, Any]]:
    result = await db.execute(
        select(Testimonial)
        .where(Testimonial.is_active == True)
        .order_by(Testimonial.display_order, Testimonial.id)
    )
    return [
        {
            "id": t.id,
            "quote": t.quote,
            "authorName": t.author_name,
            "authorTitle": t.author_title,
            "companyName": t.company_name,
            "location": t.location,
            "photoUrl": t.photo_url,
            "displayOrder": t.display_order,
        }
        for t in result.scalars().all()
    ]


async def _build_page_content(db: "AsyncSession") -> List[Dict[str, Any]]:
    result = await db.execute(
        select(PageContent)
        .where(PageContent.is_active == True)
        .order_by(PageContent.page_slug, PageContent.display_order)
    )
    return [
        {
            "id": p.id,
            "pageSlug": p.page_slug,
            "sectionKey": p.section_key,
            "title": p.title,
            "subtitle": p.subtitle,
            "content": p.content,
            "imageUrl": p.image_url,
            "videoUrl": p.video_url,
            "ctaText": p.cta_text,
            "ctaLink": p.cta_link,
            "ctaStyle": p.cta_style,
            "extraData": p.extra_data,
            "displayOrder": p.display_order,
            "isActive": p.is_active,
        }
        for p in result.scalars().all()
    ]


async def _build_legal_documents(db: "AsyncSession") -> List[Dict[str, Any]]:
    result = await db.execute(
        select(LegalDocument)
        .where(LegalDocument.is_active == True)
        .order_by(LegalDocument.display_order)
    )
    return [
        {
            "id": d.id,
            "documentType": d.document_type.value,
            "title": d.title,
            "content": d.content,
            "slug": d.slug,
            "version": d.version,
            "effectiveDate": d.effective_date,
            "shortDescription": d.short_description,
            "isActive": d.is_active,
            "displayOrder": d.display_order,
            "metaTitle": d.meta_title,
            "metaDescription": d.meta_description,
        }
        for d in result.scalars().all()
    ]


async def _build_faqs(db: "AsyncSession") -> List[Dict[str, Any]]:
    result = await db.execute(
        select(FAQ)
        .where(FAQ.is_active == True)
        .order_by(FAQ.category_id, FAQ.display_order)
    )
    return [
        {
            "id": f.id,
            "categoryId": f.category_id,
            "question": f.question,
            "answer": f.answer,
        }
        for f in result.scalars().all()
    ]


async def _build_faq_categories(db: "AsyncSession") -> List[Dict[str, Any]]:
    result = await db.execute(
        select(FAQCategory)
        .where(FAQCategory.is_active == True)
        .order_by(FAQCategory.display_order)
    )
    return [
        {"id": c.id, "name": c.name, "description": c.description}
        for c in result.scalars().all()
    ]


async def _build_catalogs(db: "AsyncSession") -> List[Dict[str, Any]]:
    result = await db.execute(
        select(Catalog)
        .options(selectinload(Catalog.category))
        .where(Catalog.is_active == True)
        .order_by(Catalog.display_order)
    )
    return [
        {
            "id": c.id,
            "title": c.title,
            "description": c.description,
            "catalogType": c.catalog_type.value if c.catalog_type else None,
            "category": c.category.name if c.category_id and c.category else None,
            "fileUrl": c.file_url,
            "fileType": c.file_type,
            "fileSize": c.file_size,
            "coverImageUrl": c.thumbnail_url,
            "version": c.version,
            "year": c.year,
            "pageCount": None,  # Could be added to model if needed
            "lastUpdated": None,  # Catalog model doesn't have updated_at field
            "isActive": c.is_active,
            "isFeatured": c.is_featured,
            "downloadCount": c.download_count,
        }
        for c in result.scalars().all()
    ]


async def _build_finishes(db: "AsyncSession") -> List[Dict[str, Any]]:
    # Eagerly load the color relationship to avoid lazy loading issues
    result = await db.execute(
        select(Finish)
        .options(selectinload(Finish.color))
        .where(Finish.is_active == True)
        .order_by(Finish.display_order, Finish.name)
    )
    return [
        {
            "id": f.id,
            "name": f.name,
            "finishCode": f.finish_code,
            "description": f.description,
            "finishType": f.finish_type,
            "grade": f.grade if hasattr(f, "grade") else "Standard",
            "colorHex": f.color_hex,
            "colorFamily": f.color.name if f.color_id and f.color else None,
            "imageUrl": f.image_url,
            "swatchImageUrl": f.image_url,  # Use image_url as swatch if no separate swatch field
            "isCustom": f.is_custom if hasattr(f, "is_custom") else False,
            "isToMatch": f.is_to_match if hasattr(f, "is_to_match") else False,
            "isActive": f.is_active,
            "isPopular": f.is_popular if hasattr(f, "is_popular") else False,
            "additionalCost": f.additional_cost,
        }
        for f in result.scalars().all()
    ]


async def _build_upholsteries(db: "AsyncSession") -> List[Dict[str, Any]]:
    result = await db.execute(
        select(Upholstery)
        .where(Upholstery.is_active == True)
        .order_by(Upholstery.display_order, Upholstery.name)
    )
    return [
        {
            "id": u.id,
            "name": u.name,
            "materialType": u.material_type,
            "fabricType": u.material_type,  # Alias for frontend
            "fabricCode": u.material_code,
            "description": u.description,
            "imageUrl": u.image_url,
            "swatchImageUrl": u.swatch_image_url,
            "grade": u.grade,
            "color": u.color,
            "colorHex": u.color_hex,
            "isActive": u.is_active,
            "isPopular": u.is_popular if hasattr(u, "is_popular") else False,
            "manufacturer": u.manufacturer if hasattr(u, "manufacturer") else None,
            "pattern": u.pattern,
            "textureDescription": u.texture_description,
            "isCom": u.is_com,
            "comRequirements": u.com_requirements,
            "flameRating": u.flame_rating,
            "cleanability": u.cleanability,
            "displayOrder": u.display_order,
            "content": u.content if hasattr(u, "content") else None,
            "durabilityRating": u.durability_rating
            if hasattr(u, "durability_rating")
            else None,
        }
        for u in result.scalars().all()
    ]


async def _build_hardware(db: "AsyncSession") -> List[Dict[str, Any]]:
    result = await db.execute(
        select(Hardware)
        .where(Hardware.is_active == True)
        .order_by(Hardware.display_order, Hardware.name)
    )
    return [
        {
            "id": h.id,
            "name": h.name,
            "description": h.description,
            "imageUrl": h.image_url,
            "category": h.category,
            "modelNumber": h.model_number,
            "sku": h.sku,
            "material": h.material,
            "finish": h.finish,
            "dimensions": h.dimensions,
            "weightCapacity": h.weight_capacity,
            "installationNotes": h.installation_notes,
            "compatibleWith": h.compatible_with,
            "thumbnailUrl": h.thumbnail_url,
            "additionalImages": h.additional_images or [],
            "displayOrder": h.display_order,
            "isActive": h.is_active,
            "isFeatured": h.is_featured if hasattr(h, "is_featured") else False,
        }
        for h in result.scalars().all()
    ]


async def _build_laminates(db: "AsyncSession") -> List[Dict[str, Any]]:
    result = await db.execute(
        select(Laminate)
        .where(Laminate.is_active == True)
        .order_by(Laminate.display_order, Laminate.brand, Laminate.pattern_name)
    )
    return [
        {
            "id": lam.id,
            "patternName": lam.pattern_name,
            "patternCode": lam.pattern_code,
            "brand": lam.brand,
            "description": lam.description,
            "swatchImageUrl": lam.swatch_image_url,
            "fullImageUrl": lam.full_image_url,
            "colorFamily": lam.color_family,
            "finishType": lam.finish_type,
            "thickness": lam.thickness,
            "grade": lam.grade,
            "supplierName": lam.supplier_name,
            "supplierWebsite": lam.supplier_website,
            "isInStock": lam.is_in_stock,
            "leadTimeDays": lam.lead_time_days,
            "isActive": lam.is_active,
            "isPopular": lam.is_popular,
            "isFeatured": lam.is_featured,
            "recommendedFor": lam.recommended_for,
            "careInstructions": lam.care_instructions,
            "displayOrder": lam.display_order,
        }
        for lam in result.scalars().all()
    ]


async def _build_warranties(db: "AsyncSession") -> List[Dict[str, Any]]:
    result = await db.execute(
        select(WarrantyInformation)
        .where(WarrantyInformation.is_active == True)
        .order_by(WarrantyInformation.display_order)
    )
    return [
        {
            "id": w.id,
            "warrantyType": w.warranty_type,
            "title": w.title,
            "description": w.description,
            "duration": w.duration,
            "coverage": w.coverage,
        }
        for w in result.scalars().all()
    ]


async def _build_contact_locations(db: "AsyncSession") -> List[Dict[str, Any]]:
    result = await db.execute(
        select(ContactLocation)
        .where(ContactLocation.is_active == True)
        .order_by(ContactLocation.display_order, ContactLocation.location_name)
    )
    return [
        {
            "id": loc.id,
            "locationName": loc.location_name,
            "description": loc.description,
            "addressLine1": loc.address_line1,
            "addressLine2": loc.address_line2,
            "city": loc.city,
            "state": loc.state,
            "zipCode": loc.zip_code,
            "country": loc.country,
            "phone": loc.phone,
            "fax": loc.fax,
            "email": loc.email,
            "tollFree": loc.toll_free,
            "businessHours": loc.business_hours,
            "imageUrl": loc.image_url,
            "mapEmbedUrl": loc.map_embed_url,
            "locationType": loc.location_type,
            "displayOrder": loc.display_order,
            "isActive": loc.is_active,
            "isPrimary": loc.is_primary,
        }
        for loc in result.scalars().all()
    ]


async def _build_company_info(db: "AsyncSession") -> List[Dict[str, Any]]:
    result = await db.execute(
        select(CompanyInfo)
        .where(CompanyInfo.is_active == True)
        .order_by(CompanyInfo.display_order)
    )
    return [
        {
            "id": i.id,
            "sectionKey": i.section_key,
            "title": i.title,
            "content": i.content,
            "imageUrl": i.image_url,
            "displayOrder": i.display_order,
            "isActive": i.is_active,
        }
        for i in result.scalars().all()
    ]


# Content type (also the contentData.json key) -> section builder.
# Order matches the key order of a full export.
SECTION_BUILDERS: Dict[str, Callable[["AsyncSession"], Awaitable[Any]]] = {
    "siteSettings": _build_site_settings,
    "heroSlides": _build_hero_slides,
    "salesReps": _build_sales_reps,
    "galleryImages": _build_gallery_images,
    "productInstalls": _build_product_installs,
    "pageContent": _build_page_content,
    "features": _build_features,
    "companyValues": _build_company_values,
    "companyMilestones": _build_company_milestones,
    "teamMembers": _build_team_members,
    "clientLogos": _build_client_logos,
    "testimonials": _build_testimonials,
    LEGAL_DOCUMENTS_KEY: _build_legal_documents,
    "warranties": _build_warranties,
    "faqs": _build_faqs,
    "faqCategories": _build_faq_categories,
    "categories": _build_categories,
    "catalogs": _build_catalogs,
    "finishes": _build_finishes,
    "upholsteries": _build_upholsteries,
    "hardware": _build_hardware,
    "laminates": _build_laminates,
    "contactLocations": _build_contact_locations,
    "companyInfo": _build_company_info,
}


async def _build_all_sections(db: "AsyncSession") -> Dict[str, Any]:
    return {key: await build(db) for key, build in SECTION_BUILDERS.items()}


async def export_content_after_update(content_type: str, db: "AsyncSession") -> bool:
    """
    Re-export one content section after a database update.

    This should be called after successful database commits. It queries the
    database for fresh data and rewrites contentData.json under the
    cross-worker export lock. If the file is missing or unreadable, every
    section is rebuilt so a partial export never publishes a file that
    contains only one section.

    Args:
        content_type: Type of content (siteSettings, heroSlides, salesReps, etc.)
        db: Database session (required)

    Returns:
        True if the export succeeded, False otherwise (the failure is logged)
    """
    build = SECTION_BUILDERS.get(content_type)
    if build is None:
        logger.warning(f"Unknown content type: {content_type}")
        return False

    try:
        exporter = get_exporter()
        async with redis_lock(EXPORT_LOCK_KEY, _export_lock, ttl_ms=EXPORT_LOCK_TTL_MS):
            existing = await asyncio.to_thread(exporter.load_existing_content)
            if existing is None:
                logger.warning(
                    "contentData.json missing or unreadable; rebuilding all sections"
                )
                sections = await _build_all_sections(db)
            else:
                sections = {content_type: await build(db)}
            await asyncio.to_thread(exporter.write_sections, sections, existing)
        return True
    except Exception:
        logger.exception(f"Export failed for {content_type}")
        return False


async def export_all_content_types(db: "AsyncSession") -> bool:
    """
    Rebuild every section in memory and write contentData.json (and
    legalDocuments.json) once.

    Returns:
        True if the export succeeded, False otherwise (the failure is logged)
    """
    try:
        exporter = get_exporter()
        async with redis_lock(
            EXPORT_LOCK_KEY, _export_lock, ttl_ms=FULL_EXPORT_LOCK_TTL_MS
        ):
            sections = await _build_all_sections(db)
            await asyncio.to_thread(exporter.write_sections, sections)
        return True
    except Exception:
        logger.exception("Full content export failed")
        return False
