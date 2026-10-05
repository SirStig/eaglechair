"""
CMS Admin Service

Extended content service that handles admin updates and triggers static file export.

Every write returns whether the static export (contentData.json) succeeded,
so routes can tell the admin when a change was saved but not published.
"""

import asyncio
import logging
from typing import Any, Dict, Iterable, Optional, Tuple, Type, TypeVar

from sqlalchemy import JSON, Enum, String, Text, cast, inspect, literal, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.exceptions import ResourceNotFoundError
from backend.database.base import Base
from backend.models.content import (
    ClientLogo,
    CompanyInfo,
    CompanyMilestone,
    CompanyValue,
    ContactLocation,
    Feature,
    HeroSlide,
    Installation,
    PageContent,
    SalesRepresentative,
    SiteSettings,
    TeamMember,
    Testimonial,
)
from backend.models.legal import (
    LegalDocument,
    LegalDocumentType,
    WarrantyInformation,
)
from backend.services import media_service
from backend.utils.serializers import parse_json_list
from backend.utils.static_content_exporter import (
    export_all_content_types,
    export_content_after_update,
)

logger = logging.getLogger(__name__)

ModelT = TypeVar("ModelT", bound=Base)

# Columns holding uploaded image URLs, per model. When a row is deleted or an
# image is replaced, files under /uploads/images that nothing references any
# more are removed.
_IMAGE_FIELDS: Dict[type, Tuple[str, ...]] = {
    HeroSlide: ("background_image_url",),
    TeamMember: ("photo_url",),
    ClientLogo: ("logo_url",),
    Testimonial: ("photo_url",),
    Installation: ("primary_image", "images"),
    Feature: ("image_url",),
    CompanyValue: ("image_url",),
    CompanyMilestone: ("image_url",),
    SalesRepresentative: ("photo_url",),
    ContactLocation: ("image_url",),
    CompanyInfo: ("image_url",),
    PageContent: ("image_url",),
    SiteSettings: ("logo_url", "logo_dark_url", "favicon_url"),
}


def _image_urls(obj: Any) -> set:
    """Image URLs currently stored on ``obj``."""
    urls = set()
    for field in _IMAGE_FIELDS.get(type(obj), ()):
        value = getattr(obj, field, None)
        if field == "images":
            for item in parse_json_list(value):
                url = item.get("url") if isinstance(item, dict) else item
                if isinstance(url, str) and url.strip():
                    urls.add(url.strip())
        elif isinstance(value, str) and value.strip():
            urls.add(value.strip())
    return urls


def apply_updates(obj: Any, updates: Dict[str, Any]) -> None:
    """
    Set column values on ``obj``.

    None clears a nullable column; it is skipped for NOT NULL columns (those
    can't be cleared). Keys that aren't columns are ignored.
    """
    columns = obj.__table__.columns
    for key, value in updates.items():
        column = columns.get(key)
        if column is None:
            continue
        if value is None and not column.nullable:
            logger.debug(f"Ignoring None for required column {obj.__tablename__}.{key}")
            continue
        setattr(obj, key, value)


def _upload_needle(url: str) -> Optional[str]:
    """'uploads/images/...' part of a local upload URL, as stored in any row."""
    path = url.strip().lstrip("/")
    return path if path.startswith("uploads/") else None


_NOT_REFERENCES = frozenset({"admin_audit_logs", "history_entries", "history_change_sets"})


async def _is_upload_referenced(db: AsyncSession, needle: str) -> bool:
    """True if any text/JSON column of any table still mentions ``needle``."""
    escaped = needle.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    pattern = f"%{escaped}%"
    existing_tables = set(
        await db.run_sync(lambda session: inspect(session.connection()).get_table_names())
    )
    for table in Base.metadata.sorted_tables:
        # Logs and Time Machine history mention old URLs without using them
        if table.name not in existing_tables or table.name in _NOT_REFERENCES:
            continue
        columns = [
            c
            for c in table.columns
            if isinstance(c.type, (String, JSON)) and not isinstance(c.type, Enum)
        ]
        if not columns:
            continue
        conditions = [cast(c, Text).like(pattern, escape="\\") for c in columns]
        result = await db.execute(
            select(literal(1)).select_from(table).where(or_(*conditions)).limit(1)
        )
        if result.first() is not None:
            return True
    return False


async def delete_orphaned_uploads(db: AsyncSession, urls: Iterable[str]) -> None:
    """
    Delete uploaded image files (and their renditions) that no row references.

    Only files under the app's own uploads/images directory are touched;
    remote URLs are never deleted. Call after the DB change is committed.
    Failures are logged, never raised: a leftover file is harmless.
    """
    from backend.api.v1.routes.admin.upload import UPLOAD_BASE_DIR

    for url in set(urls):
        try:
            if url.lower().startswith(("http://", "https://")):
                continue
            needle = _upload_needle(url)
            if needle is None:
                continue
            path = media_service.resolve_uploaded_image_path(
                url, UPLOAD_BASE_DIR, allow_absolute_urls=False
            )
            if path is None:
                continue
            if await _is_upload_referenced(db, needle):
                continue
            await asyncio.to_thread(media_service.delete_image_files, path, UPLOAD_BASE_DIR)
            logger.info(f"Deleted orphaned upload {url}")
        except Exception:
            logger.exception(f"Could not clean up upload {url}")


class CMSAdminService:
    """
    Admin service for CMS content management with static file export.

    This extends ContentService with admin-only operations that:
    1. Update database
    2. Trigger static file export to frontend

    Write methods return the export result (True if contentData.json was
    updated) alongside the saved row.
    """

    # ========================================================================
    # Generic helpers
    # ========================================================================

    @staticmethod
    async def _get_or_404(
        db: AsyncSession, model: Type[ModelT], obj_id: int, resource_type: str
    ) -> ModelT:
        result = await db.execute(select(model).where(model.id == obj_id))
        obj = result.scalar_one_or_none()
        if not obj:
            raise ResourceNotFoundError(resource_type=resource_type, resource_id=obj_id)
        return obj

    @staticmethod
    async def _create(
        db: AsyncSession, model: Type[ModelT], content_type: str, fields: Dict[str, Any]
    ) -> Tuple[ModelT, bool]:
        obj = model(**fields)
        db.add(obj)
        await db.commit()
        await db.refresh(obj)
        exported = await export_content_after_update(content_type, db)
        return obj, exported

    @staticmethod
    async def _update(
        db: AsyncSession,
        model: Type[ModelT],
        obj_id: int,
        resource_type: str,
        content_type: str,
        updates: Dict[str, Any],
    ) -> Tuple[ModelT, bool]:
        obj = await CMSAdminService._get_or_404(db, model, obj_id, resource_type)
        old_images = _image_urls(obj)
        apply_updates(obj, updates)
        await db.commit()
        await db.refresh(obj)
        exported = await export_content_after_update(content_type, db)
        await delete_orphaned_uploads(db, old_images - _image_urls(obj))
        return obj, exported

    @staticmethod
    async def _delete(
        db: AsyncSession,
        model: Type[ModelT],
        obj_id: int,
        resource_type: str,
        content_type: str,
    ) -> bool:
        obj = await CMSAdminService._get_or_404(db, model, obj_id, resource_type)
        old_images = _image_urls(obj)
        await db.delete(obj)
        await db.commit()
        exported = await export_content_after_update(content_type, db)
        await delete_orphaned_uploads(db, old_images)
        return exported

    # ========================================================================
    # Site Settings
    # ========================================================================

    @staticmethod
    async def update_site_settings(
        db: AsyncSession,
        **updates
    ) -> Tuple[SiteSettings, bool]:
        """
        Update site settings and export to static file.

        Args:
            db: Database session
            **updates: Settings to update (None clears a nullable setting)

        Returns:
            (Updated SiteSettings instance, export succeeded)
        """
        try:
            # Get or create site settings
            result = await db.execute(select(SiteSettings).limit(1))
            settings = result.scalar_one_or_none()

            if not settings:
                settings = SiteSettings()
                db.add(settings)

            old_images = _image_urls(settings)
            apply_updates(settings, updates)

            await db.commit()
            await db.refresh(settings)
        except Exception:
            logger.exception("Failed to update site settings")
            await db.rollback()
            raise

        exported = await export_content_after_update('siteSettings', db)
        await delete_orphaned_uploads(db, old_images - _image_urls(settings))

        logger.info("Site settings updated")
        return settings, exported

    # ========================================================================
    # Hero Slides
    # ========================================================================

    @staticmethod
    async def create_hero_slide(db: AsyncSession, **fields) -> Tuple[HeroSlide, bool]:
        """Create hero slide and export."""
        slide, exported = await CMSAdminService._create(db, HeroSlide, 'heroSlides', fields)
        logger.info(f"Created hero slide: {slide.title}")
        return slide, exported

    @staticmethod
    async def update_hero_slide(
        db: AsyncSession,
        slide_id: int,
        **updates
    ) -> Tuple[HeroSlide, bool]:
        """Update hero slide and export."""
        slide, exported = await CMSAdminService._update(
            db, HeroSlide, slide_id, "Hero Slide", 'heroSlides', updates
        )
        logger.info(f"Updated hero slide {slide_id}")
        return slide, exported

    @staticmethod
    async def delete_hero_slide(db: AsyncSession, slide_id: int) -> bool:
        """Delete hero slide and export."""
        exported = await CMSAdminService._delete(
            db, HeroSlide, slide_id, "Hero Slide", 'heroSlides'
        )
        logger.info(f"Deleted hero slide {slide_id}")
        return exported

    # ========================================================================
    # Sales Representatives
    # ========================================================================

    @staticmethod
    async def create_sales_rep(
        db: AsyncSession, **fields
    ) -> Tuple[SalesRepresentative, bool]:
        """Create sales rep and export."""
        rep, exported = await CMSAdminService._create(
            db, SalesRepresentative, 'salesReps', fields
        )
        logger.info(f"Created sales rep: {rep.name}")
        return rep, exported

    @staticmethod
    async def update_sales_rep(
        db: AsyncSession,
        rep_id: int,
        **updates
    ) -> Tuple[SalesRepresentative, bool]:
        """Update sales rep and export."""
        rep, exported = await CMSAdminService._update(
            db, SalesRepresentative, rep_id, "Sales Rep", 'salesReps', updates
        )
        logger.info(f"Updated sales rep {rep_id}")
        return rep, exported

    @staticmethod
    async def delete_sales_rep(db: AsyncSession, rep_id: int) -> bool:
        """Delete sales rep and export."""
        exported = await CMSAdminService._delete(
            db, SalesRepresentative, rep_id, "Sales Rep", 'salesReps'
        )
        logger.info(f"Deleted sales rep {rep_id}")
        return exported

    # ========================================================================
    # Gallery/Installation Images
    # ========================================================================

    @staticmethod
    async def create_installation(
        db: AsyncSession, **fields
    ) -> Tuple[Installation, bool]:
        """Create installation entry and export."""
        # images is a JSON column: store the list itself, not a JSON string
        installation, exported = await CMSAdminService._create(
            db, Installation, 'galleryImages', fields
        )
        logger.info(f"Created installation: {installation.project_name}")
        return installation, exported

    @staticmethod
    async def update_installation(
        db: AsyncSession,
        installation_id: int,
        **updates
    ) -> Tuple[Installation, bool]:
        """Update installation and export."""
        installation, exported = await CMSAdminService._update(
            db, Installation, installation_id, "Installation", 'galleryImages', updates
        )
        logger.info(f"Updated installation {installation_id}")
        return installation, exported

    @staticmethod
    async def delete_installation(db: AsyncSession, installation_id: int) -> bool:
        """Delete installation and export."""
        exported = await CMSAdminService._delete(
            db, Installation, installation_id, "Installation", 'galleryImages'
        )
        logger.info(f"Deleted installation {installation_id}")
        return exported

    # ========================================================================
    # Page Content Operations
    # ========================================================================

    @staticmethod
    async def update_page_content(
        db: AsyncSession,
        page_slug: str,
        section_key: str,
        **updates
    ) -> Tuple[dict, bool]:
        """
        Update (or create) a page content section and export to static files.

        Args:
            db: Database session
            page_slug: Page identifier (e.g., 'home', 'about')
            section_key: Section identifier (e.g., 'hero', 'cta')
            **updates: Fields to set (title, subtitle, content, image_url,
                video_url, cta_text, cta_link, cta_style, extra_data,
                display_order, is_active). None clears a nullable field.

        Returns:
            (Updated page content data, export succeeded)
        """
        # Find existing content
        result = await db.execute(
            select(PageContent).where(
                PageContent.page_slug == page_slug,
                PageContent.section_key == section_key
            )
        )
        page_content = result.scalar_one_or_none()

        if not page_content:
            # Create new content if it doesn't exist
            page_content = PageContent(
                page_slug=page_slug,
                section_key=section_key,
                is_active=True
            )
            db.add(page_content)

        old_images = _image_urls(page_content)
        updates.pop("page_slug", None)
        updates.pop("section_key", None)
        apply_updates(page_content, updates)

        await db.commit()
        await db.refresh(page_content)

        logger.info(f"Updated page content: {page_slug}/{section_key}")

        # Export all page content to static files
        exported = await export_content_after_update('pageContent', db)
        await delete_orphaned_uploads(db, old_images - _image_urls(page_content))

        return {
            "id": page_content.id,
            "pageSlug": page_content.page_slug,
            "sectionKey": page_content.section_key,
            "title": page_content.title,
            "subtitle": page_content.subtitle,
            "content": page_content.content,
            "imageUrl": page_content.image_url,
            "videoUrl": page_content.video_url,
            "ctaText": page_content.cta_text,
            "ctaLink": page_content.cta_link,
            "ctaStyle": page_content.cta_style,
            "extraData": page_content.extra_data,
            "displayOrder": page_content.display_order,
            "isActive": page_content.is_active
        }, exported

    # ========================================================================
    # Features
    # ========================================================================

    @staticmethod
    async def create_feature(db: AsyncSession, **fields) -> Tuple[Feature, bool]:
        """Create feature and export."""
        feature, exported = await CMSAdminService._create(db, Feature, 'features', fields)
        logger.info(f"Created feature: {feature.title}")
        return feature, exported

    @staticmethod
    async def update_feature(
        db: AsyncSession,
        feature_id: int,
        **updates
    ) -> Tuple[Feature, bool]:
        """Update feature and export."""
        feature, exported = await CMSAdminService._update(
            db, Feature, feature_id, "Feature", 'features', updates
        )
        logger.info(f"Updated feature: {feature.title}")
        return feature, exported

    @staticmethod
    async def delete_feature(db: AsyncSession, feature_id: int) -> bool:
        """Delete feature and export."""
        exported = await CMSAdminService._delete(
            db, Feature, feature_id, "Feature", 'features'
        )
        logger.info(f"Deleted feature {feature_id}")
        return exported

    # ========================================================================
    # Company Values
    # ========================================================================

    @staticmethod
    async def create_company_value(
        db: AsyncSession, **fields
    ) -> Tuple[CompanyValue, bool]:
        """Create company value and export."""
        value, exported = await CMSAdminService._create(
            db, CompanyValue, 'companyValues', fields
        )
        logger.info(f"Created company value: {value.title}")
        return value, exported

    @staticmethod
    async def update_company_value(
        db: AsyncSession,
        value_id: int,
        **updates
    ) -> Tuple[CompanyValue, bool]:
        """Update company value and export."""
        value, exported = await CMSAdminService._update(
            db, CompanyValue, value_id, "Company Value", 'companyValues', updates
        )
        logger.info(f"Updated company value: {value.title}")
        return value, exported

    @staticmethod
    async def delete_company_value(db: AsyncSession, value_id: int) -> bool:
        """Delete company value and export."""
        exported = await CMSAdminService._delete(
            db, CompanyValue, value_id, "Company Value", 'companyValues'
        )
        logger.info(f"Deleted company value {value_id}")
        return exported

    # ========================================================================
    # Team Members
    # ========================================================================

    @staticmethod
    async def create_team_member(db: AsyncSession, **fields) -> Tuple[TeamMember, bool]:
        """Create team member and export."""
        member, exported = await CMSAdminService._create(
            db, TeamMember, 'teamMembers', fields
        )
        logger.info(f"Created team member: {member.name}")
        return member, exported

    @staticmethod
    async def update_team_member(
        db: AsyncSession,
        member_id: int,
        **updates
    ) -> Tuple[TeamMember, bool]:
        """Update team member and export."""
        member, exported = await CMSAdminService._update(
            db, TeamMember, member_id, "Team Member", 'teamMembers', updates
        )
        logger.info(f"Updated team member: {member.name}")
        return member, exported

    @staticmethod
    async def delete_team_member(db: AsyncSession, member_id: int) -> bool:
        """Delete team member and export."""
        exported = await CMSAdminService._delete(
            db, TeamMember, member_id, "Team Member", 'teamMembers'
        )
        logger.info(f"Deleted team member {member_id}")
        return exported

    # ========================================================================
    # Client Logos
    # ========================================================================

    @staticmethod
    async def create_client_logo(db: AsyncSession, **fields) -> Tuple[ClientLogo, bool]:
        """Create client logo and export."""
        logo, exported = await CMSAdminService._create(
            db, ClientLogo, 'clientLogos', fields
        )
        logger.info(f"Created client logo: {logo.name}")
        return logo, exported

    @staticmethod
    async def update_client_logo(
        db: AsyncSession,
        logo_id: int,
        **updates
    ) -> Tuple[ClientLogo, bool]:
        """Update client logo and export."""
        logo, exported = await CMSAdminService._update(
            db, ClientLogo, logo_id, "Client Logo", 'clientLogos', updates
        )
        logger.info(f"Updated client logo: {logo.name}")
        return logo, exported

    @staticmethod
    async def delete_client_logo(db: AsyncSession, logo_id: int) -> bool:
        """Delete client logo and export."""
        exported = await CMSAdminService._delete(
            db, ClientLogo, logo_id, "Client Logo", 'clientLogos'
        )
        logger.info(f"Deleted client logo {logo_id}")
        return exported

    # ========================================================================
    # Testimonials
    # ========================================================================

    @staticmethod
    async def create_testimonial(db: AsyncSession, **fields) -> Tuple[Testimonial, bool]:
        """Create testimonial and export."""
        testimonial, exported = await CMSAdminService._create(
            db, Testimonial, 'testimonials', fields
        )
        logger.info(f"Created testimonial from: {testimonial.author_name}")
        return testimonial, exported

    @staticmethod
    async def update_testimonial(
        db: AsyncSession,
        testimonial_id: int,
        **updates
    ) -> Tuple[Testimonial, bool]:
        """Update testimonial and export."""
        testimonial, exported = await CMSAdminService._update(
            db, Testimonial, testimonial_id, "Testimonial", 'testimonials', updates
        )
        logger.info(f"Updated testimonial {testimonial_id}")
        return testimonial, exported

    @staticmethod
    async def delete_testimonial(db: AsyncSession, testimonial_id: int) -> bool:
        """Delete testimonial and export."""
        exported = await CMSAdminService._delete(
            db, Testimonial, testimonial_id, "Testimonial", 'testimonials'
        )
        logger.info(f"Deleted testimonial {testimonial_id}")
        return exported

    # ========================================================================
    # Company Milestones
    # ========================================================================

    @staticmethod
    async def create_company_milestone(
        db: AsyncSession, **fields
    ) -> Tuple[CompanyMilestone, bool]:
        """Create company milestone and export."""
        milestone, exported = await CMSAdminService._create(
            db, CompanyMilestone, 'companyMilestones', fields
        )
        logger.info(f"Created milestone: {milestone.year} - {milestone.title}")
        return milestone, exported

    @staticmethod
    async def update_company_milestone(
        db: AsyncSession,
        milestone_id: int,
        **updates
    ) -> Tuple[CompanyMilestone, bool]:
        """Update company milestone and export."""
        milestone, exported = await CMSAdminService._update(
            db, CompanyMilestone, milestone_id, "Company Milestone",
            'companyMilestones', updates
        )
        logger.info(f"Updated milestone: {milestone.year} - {milestone.title}")
        return milestone, exported

    @staticmethod
    async def delete_company_milestone(db: AsyncSession, milestone_id: int) -> bool:
        """Delete company milestone and export."""
        exported = await CMSAdminService._delete(
            db, CompanyMilestone, milestone_id, "Company Milestone", 'companyMilestones'
        )
        logger.info(f"Deleted milestone {milestone_id}")
        return exported

    # ========================================================================
    # Contact Locations
    # ========================================================================

    @staticmethod
    async def create_contact_location(
        db: AsyncSession,
        **location_data
    ) -> Tuple[ContactLocation, bool]:
        """Create contact location and export to static file."""
        location, exported = await CMSAdminService._create(
            db, ContactLocation, 'contactLocations', location_data
        )
        logger.info(f"Created contact location: {location.location_name}")
        return location, exported

    @staticmethod
    async def update_contact_location(
        db: AsyncSession,
        location_id: int,
        **updates
    ) -> Tuple[ContactLocation, bool]:
        """Update contact location and export to static file."""
        location, exported = await CMSAdminService._update(
            db, ContactLocation, location_id, "Contact Location",
            'contactLocations', updates
        )
        logger.info(f"Updated contact location: {location.location_name}")
        return location, exported

    @staticmethod
    async def delete_contact_location(db: AsyncSession, location_id: int) -> bool:
        """Delete contact location and export to static file."""
        exported = await CMSAdminService._delete(
            db, ContactLocation, location_id, "Contact Location", 'contactLocations'
        )
        logger.info(f"Deleted contact location {location_id}")
        return exported

    # ========================================================================
    # Company Info
    # ========================================================================

    @staticmethod
    async def create_company_info(
        db: AsyncSession,
        **info_data
    ) -> Tuple[CompanyInfo, bool]:
        """Create company info section and export to static file."""
        info, exported = await CMSAdminService._create(
            db, CompanyInfo, 'companyInfo', info_data
        )
        logger.info(f"Created company info: {info.section_key}")
        return info, exported

    @staticmethod
    async def update_company_info(
        db: AsyncSession,
        info_id: int,
        **updates
    ) -> Tuple[CompanyInfo, bool]:
        """Update company info section and export to static file."""
        info, exported = await CMSAdminService._update(
            db, CompanyInfo, info_id, "Company Info", 'companyInfo', updates
        )
        logger.info(f"Updated company info: {info.section_key}")
        return info, exported

    @staticmethod
    async def delete_company_info(db: AsyncSession, info_id: int) -> bool:
        """Delete company info section and export to static file."""
        exported = await CMSAdminService._delete(
            db, CompanyInfo, info_id, "Company Info", 'companyInfo'
        )
        logger.info(f"Deleted company info {info_id}")
        return exported

    # ========================================================================
    # Bulk Export (for initial setup or full refresh)
    # ========================================================================

    @staticmethod
    async def export_all_static_content(db: AsyncSession) -> bool:
        """
        Export all CMS content to static files in a single write.
        Useful for initial setup or manual refresh.

        Args:
            db: Database session

        Returns:
            True if successful, False if the export failed (logged)
        """
        success = await export_all_content_types(db)
        if success:
            logger.info("Successfully exported all static content")
        return success

    # ========================================================================
    # Legal Documents
    # ========================================================================

    @staticmethod
    async def get_all_legal_documents(db: AsyncSession) -> list[dict]:
        """Get all legal documents for admin."""
        result = await db.execute(
            select(LegalDocument).order_by(LegalDocument.display_order, LegalDocument.title)
        )
        documents = result.scalars().all()

        return [
            {
                "id": doc.id,
                "documentType": doc.document_type.value,
                "title": doc.title,
                "content": doc.content,
                "shortDescription": doc.short_description,
                "slug": doc.slug,
                "version": doc.version,
                "effectiveDate": doc.effective_date,
                "metaTitle": doc.meta_title,
                "metaDescription": doc.meta_description,
                "displayOrder": doc.display_order,
                "isActive": doc.is_active,
                "updatedAt": doc.updated_at.isoformat() if doc.updated_at else None,
            }
            for doc in documents
        ]

    @staticmethod
    async def legal_document_type_taken(
        db: AsyncSession, document_type: LegalDocumentType, exclude_id: int | None = None
    ) -> bool:
        """Whether another legal document already uses this (unique) type."""
        query = select(LegalDocument.id).where(LegalDocument.document_type == document_type)
        if exclude_id is not None:
            query = query.where(LegalDocument.id != exclude_id)
        result = await db.execute(query.limit(1))
        return result.scalar_one_or_none() is not None

    @staticmethod
    async def create_legal_document(
        db: AsyncSession,
        document_type: LegalDocumentType,
        title: str,
        content: str,
        short_description: str | None = None,
        slug: str | None = None,
        version: str = "1.0",
        effective_date: str | None = None,
        meta_title: str | None = None,
        meta_description: str | None = None,
        display_order: int = 0,
        is_active: bool = True
    ) -> Tuple[LegalDocument, bool]:
        """Create legal document and export."""
        document, exported = await CMSAdminService._create(
            db,
            LegalDocument,
            'legalDocuments',
            dict(
                document_type=document_type,
                title=title,
                content=content,
                short_description=short_description,
                slug=slug,
                version=version,
                effective_date=effective_date,
                meta_title=meta_title,
                meta_description=meta_description,
                display_order=display_order,
                is_active=is_active,
            ),
        )
        logger.info(f"Created legal document: {title}")
        return document, exported

    @staticmethod
    async def update_legal_document(
        db: AsyncSession,
        document_id: int,
        **updates
    ) -> Tuple[LegalDocument, bool]:
        """Update legal document and re-export."""
        document, exported = await CMSAdminService._update(
            db, LegalDocument, document_id, "Legal Document", 'legalDocuments', updates
        )
        logger.info(f"Updated legal document: {document.title}")
        return document, exported

    @staticmethod
    async def delete_legal_document(db: AsyncSession, document_id: int) -> bool:
        """Delete legal document and re-export."""
        exported = await CMSAdminService._delete(
            db, LegalDocument, document_id, "Legal Document", 'legalDocuments'
        )
        logger.info(f"Deleted legal document {document_id}")
        return exported

    # ========================================================================
    # Warranties
    # ========================================================================

    @staticmethod
    async def get_all_warranties(db: AsyncSession) -> list[dict]:
        """Get all warranties for admin."""
        result = await db.execute(
            select(WarrantyInformation).order_by(WarrantyInformation.display_order, WarrantyInformation.id)
        )
        warranties = result.scalars().all()

        return [
            {
                "id": w.id,
                "warrantyType": w.warranty_type,
                "title": w.title,
                "description": w.description,
                "duration": w.duration,
                "coverage": w.coverage,
                "exclusions": w.exclusions,
                "claimProcess": w.claim_process,
                "displayOrder": w.display_order,
                "isActive": w.is_active
            }
            for w in warranties
        ]

    @staticmethod
    async def create_warranty(
        db: AsyncSession,
        warranty_type: str,
        title: str,
        description: str,
        duration: str | None = None,
        coverage: str | None = None,
        exclusions: str | None = None,
        claim_process: str | None = None,
        display_order: int = 0,
        is_active: bool = True
    ) -> Tuple[WarrantyInformation, bool]:
        """Create warranty and export."""
        warranty, exported = await CMSAdminService._create(
            db,
            WarrantyInformation,
            'warranties',
            dict(
                warranty_type=warranty_type,
                title=title,
                description=description,
                duration=duration,
                coverage=coverage,
                exclusions=exclusions,
                claim_process=claim_process,
                display_order=display_order,
                is_active=is_active,
            ),
        )
        logger.info(f"Created warranty: {title}")
        return warranty, exported

    @staticmethod
    async def update_warranty(
        db: AsyncSession,
        warranty_id: int,
        **updates
    ) -> Tuple[WarrantyInformation, bool]:
        """Update warranty and re-export."""
        warranty, exported = await CMSAdminService._update(
            db, WarrantyInformation, warranty_id, "Warranty", 'warranties', updates
        )
        logger.info(f"Updated warranty: {warranty.title}")
        return warranty, exported

    @staticmethod
    async def delete_warranty(db: AsyncSession, warranty_id: int) -> bool:
        """Delete warranty and re-export."""
        exported = await CMSAdminService._delete(
            db, WarrantyInformation, warranty_id, "Warranty", 'warranties'
        )
        logger.info(f"Deleted warranty {warranty_id}")
        return exported
