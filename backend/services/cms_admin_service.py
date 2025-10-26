"""
CMS Admin Service

Extended content service that handles admin updates and triggers static file export.
"""

import logging
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.exceptions import ResourceNotFoundError
from backend.models.content import (
    HeroSlide,
    Installation,
    SalesRepresentative,
    SiteSettings,
)
from backend.utils.static_content_exporter import export_content_after_update

logger = logging.getLogger(__name__)


class CMSAdminService:
    """
    Admin service for CMS content management with static file export.
    
    This extends ContentService with admin-only operations that:
    1. Update database
    2. Trigger static file export to frontend
    """
    
    # ========================================================================
    # Site Settings
    # ========================================================================
    
    @staticmethod
    async def update_site_settings(
        db: AsyncSession,
        **updates
    ) -> SiteSettings:
        """
        Update site settings and export to static file.
        
        Args:
            db: Database session
            **updates: Settings to update
            
        Returns:
            Updated SiteSettings instance
        """
        try:
            # Get or create site settings
            result = await db.execute(select(SiteSettings).limit(1))
            settings = result.scalar_one_or_none()
            
            if not settings:
                settings = SiteSettings()
                db.add(settings)
            
            # Update fields
            for key, value in updates.items():
                if hasattr(settings, key):
                    setattr(settings, key, value)
            
            await db.commit()
            await db.refresh(settings)
            
            # Export to static file
            settings_dict = {
                'companyName': settings.company_name,
                'companyTagline': settings.company_tagline,
                'logoUrl': settings.logo_url,
                'primaryEmail': settings.primary_email,
                'primaryPhone': settings.primary_phone,
                'salesEmail': settings.sales_email,
                'salesPhone': settings.sales_phone,
                'supportEmail': settings.support_email,
                'supportPhone': settings.support_phone,
                'addressLine1': settings.address_line1,
                'addressLine2': settings.address_line2,
                'city': settings.city,
                'state': settings.state,
                'zipCode': settings.zip_code,
                'country': settings.country,
                'businessHoursWeekdays': settings.business_hours_weekdays,
                'businessHoursSaturday': settings.business_hours_saturday,
                'businessHoursSunday': settings.business_hours_sunday,
                'facebookUrl': settings.facebook_url,
                'instagramUrl': settings.instagram_url,
                'linkedinUrl': settings.linkedin_url,
                'twitterUrl': settings.twitter_url,
                'youtubeUrl': settings.youtube_url,
            }
            
            await export_content_after_update('siteSettings', settings_dict)
            
            logger.info("Site settings updated and exported")
            return settings
            
        except Exception as e:
            logger.error(f"Failed to update site settings: {e}", exc_info=True)
            await db.rollback()
            raise
    
    # ========================================================================
    # Hero Slides
    # ========================================================================
    
    @staticmethod
    async def create_hero_slide(
        db: AsyncSession,
        title: str,
        background_image_url: str,
        subtitle: Optional[str] = None,
        cta_text: Optional[str] = None,
        cta_link: Optional[str] = None,
        display_order: int = 0,
        is_active: bool = True
    ) -> HeroSlide:
        """Create hero slide and export."""
        slide = HeroSlide(
            title=title,
            subtitle=subtitle,
            background_image_url=background_image_url,
            cta_text=cta_text,
            cta_link=cta_link,
            display_order=display_order,
            is_active=is_active
        )
        db.add(slide)
        await db.commit()
        await db.refresh(slide)
        
        # Export all slides
        await CMSAdminService._export_all_hero_slides(db)
        
        logger.info(f"Created hero slide: {title}")
        return slide
    
    @staticmethod
    async def update_hero_slide(
        db: AsyncSession,
        slide_id: int,
        **updates
    ) -> HeroSlide:
        """Update hero slide and export."""
        result = await db.execute(select(HeroSlide).where(HeroSlide.id == slide_id))
        slide = result.scalar_one_or_none()
        
        if not slide:
            raise ResourceNotFoundError(resource_type="Hero Slide", resource_id=slide_id)
        
        for key, value in updates.items():
            if hasattr(slide, key):
                setattr(slide, key, value)
        
        await db.commit()
        await db.refresh(slide)
        
        # Export all slides
        await CMSAdminService._export_all_hero_slides(db)
        
        logger.info(f"Updated hero slide {slide_id}")
        return slide
    
    @staticmethod
    async def delete_hero_slide(db: AsyncSession, slide_id: int) -> None:
        """Delete hero slide and export."""
        result = await db.execute(select(HeroSlide).where(HeroSlide.id == slide_id))
        slide = result.scalar_one_or_none()
        
        if not slide:
            raise ResourceNotFoundError(resource_type="Hero Slide", resource_id=slide_id)
        
        await db.delete(slide)
        await db.commit()
        
        # Export all slides
        await CMSAdminService._export_all_hero_slides(db)
        
        logger.info(f"Deleted hero slide {slide_id}")
    
    @staticmethod
    async def _export_all_hero_slides(db: AsyncSession):
        """Export all hero slides to static file."""
        result = await db.execute(
            select(HeroSlide)
            .where(HeroSlide.is_active)
            .order_by(HeroSlide.display_order)
        )
        slides = result.scalars().all()
        
        slides_data = [
            {
                'id': slide.id,
                'title': slide.title,
                'subtitle': slide.subtitle,
                'image': slide.background_image_url,
                'ctaText': slide.cta_text,
                'ctaLink': slide.cta_link,
            }
            for slide in slides
        ]
        
        await export_content_after_update('heroSlides', slides_data)
    
    # ========================================================================
    # Sales Representatives
    # ========================================================================
    
    @staticmethod
    async def create_sales_rep(
        db: AsyncSession,
        name: str,
        email: str,
        phone: str,
        territory_name: str,
        states_covered: List[str],
        **optional_fields
    ) -> SalesRepresentative:
        """Create sales rep and export."""
        rep = SalesRepresentative(
            name=name,
            email=email,
            phone=phone,
            territory_name=territory_name,
            states_covered=states_covered,
            **optional_fields
        )
        db.add(rep)
        await db.commit()
        await db.refresh(rep)
        
        # Export all reps
        await CMSAdminService._export_all_sales_reps(db)
        
        logger.info(f"Created sales rep: {name}")
        return rep
    
    @staticmethod
    async def update_sales_rep(
        db: AsyncSession,
        rep_id: int,
        **updates
    ) -> SalesRepresentative:
        """Update sales rep and export."""
        result = await db.execute(
            select(SalesRepresentative).where(SalesRepresentative.id == rep_id)
        )
        rep = result.scalar_one_or_none()
        
        if not rep:
            raise ResourceNotFoundError(resource_type="Sales Rep", resource_id=rep_id)
        
        for key, value in updates.items():
            if hasattr(rep, key):
                setattr(rep, key, value)
        
        await db.commit()
        await db.refresh(rep)
        
        # Export all reps
        await CMSAdminService._export_all_sales_reps(db)
        
        logger.info(f"Updated sales rep {rep_id}")
        return rep
    
    @staticmethod
    async def delete_sales_rep(db: AsyncSession, rep_id: int) -> None:
        """Delete sales rep and export."""
        result = await db.execute(
            select(SalesRepresentative).where(SalesRepresentative.id == rep_id)
        )
        rep = result.scalar_one_or_none()
        
        if not rep:
            raise ResourceNotFoundError(resource_type="Sales Rep", resource_id=rep_id)
        
        await db.delete(rep)
        await db.commit()
        
        # Export all reps
        await CMSAdminService._export_all_sales_reps(db)
        
        logger.info(f"Deleted sales rep {rep_id}")
    
    @staticmethod
    async def _export_all_sales_reps(db: AsyncSession):
        """Export all sales reps to static file."""
        result = await db.execute(
            select(SalesRepresentative)
            .where(SalesRepresentative.is_active)
            .order_by(SalesRepresentative.display_order)
        )
        reps = result.scalars().all()
        
        reps_data = [
            {
                'id': rep.id,
                'name': rep.name,
                'email': rep.email,
                'phone': rep.phone,
                'territory': rep.territory_name,
                'states': rep.states_covered,
                'photoUrl': rep.photo_url,
            }
            for rep in reps
        ]
        
        await export_content_after_update('salesReps', reps_data)
    
    # ========================================================================
    # Gallery/Installation Images
    # ========================================================================
    
    @staticmethod
    async def create_installation(
        db: AsyncSession,
        project_name: str,
        images: List[str],
        **optional_fields
    ) -> Installation:
        """Create installation entry and export."""
        import json
        
        installation = Installation(
            project_name=project_name,
            images=json.dumps(images),
            **optional_fields
        )
        db.add(installation)
        await db.commit()
        await db.refresh(installation)
        
        # Export all installations
        await CMSAdminService._export_all_gallery_images(db)
        
        logger.info(f"Created installation: {project_name}")
        return installation
    
    @staticmethod
    async def update_installation(
        db: AsyncSession,
        installation_id: int,
        **updates
    ) -> Installation:
        """Update installation and export."""
        import json
        
        result = await db.execute(
            select(Installation).where(Installation.id == installation_id)
        )
        installation = result.scalar_one_or_none()
        
        if not installation:
            raise ResourceNotFoundError(resource_type="Installation", resource_id=installation_id)
        
        for key, value in updates.items():
            if hasattr(installation, key):
                # Handle images list conversion
                if key == 'images' and isinstance(value, list):
                    setattr(installation, key, json.dumps(value))
                else:
                    setattr(installation, key, value)
        
        await db.commit()
        await db.refresh(installation)
        
        # Export all installations
        await CMSAdminService._export_all_gallery_images(db)
        
        logger.info(f"Updated installation {installation_id}")
        return installation
    
    @staticmethod
    async def delete_installation(db: AsyncSession, installation_id: int) -> None:
        """Delete installation and export."""
        result = await db.execute(
            select(Installation).where(Installation.id == installation_id)
        )
        installation = result.scalar_one_or_none()
        
        if not installation:
            raise ResourceNotFoundError(resource_type="Installation", resource_id=installation_id)
        
        await db.delete(installation)
        await db.commit()
        
        # Export all installations
        await CMSAdminService._export_all_gallery_images(db)
        
        logger.info(f"Deleted installation {installation_id}")
    
    @staticmethod
    async def _export_all_gallery_images(db: AsyncSession):
        """Export all installation gallery images to static file."""
        import json
        
        result = await db.execute(
            select(Installation)
            .where(Installation.is_active)
            .order_by(Installation.display_order)
        )
        installations = result.scalars().all()
        
        gallery_data = []
        for inst in installations:
            images = json.loads(inst.images) if inst.images else []
            primary_image = inst.primary_image or (images[0] if images else None)
            
            gallery_data.append({
                'id': inst.id,
                'url': primary_image,
                'title': inst.project_name,
                'category': inst.project_type or 'General',
                'location': inst.location,
                'images': images,
            })
        
        await export_content_after_update('galleryImages', gallery_data)
    
    # ========================================================================
    # Page Content Operations
    # ========================================================================
    
    @staticmethod
    async def update_page_content(
        db: AsyncSession,
        page_slug: str,
        section_key: str,
        title: Optional[str] = None,
        subtitle: Optional[str] = None,
        content: Optional[str] = None,
        image_url: Optional[str] = None
    ) -> dict:
        """
        Update page content section and export to static files.
        
        Args:
            db: Database session
            page_slug: Page identifier (e.g., 'home', 'about')
            section_key: Section identifier (e.g., 'hero', 'cta')
            title: Optional title update
            subtitle: Optional subtitle update
            content: Optional content update
            image_url: Optional image URL update
            
        Returns:
            Updated page content data
        """
        from backend.models.content import PageContent
        
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
        
        # Update fields if provided
        if title is not None:
            page_content.title = title
        if subtitle is not None:
            page_content.subtitle = subtitle
        if content is not None:
            page_content.content = content
        if image_url is not None:
            page_content.image_url = image_url
        
        await db.commit()
        await db.refresh(page_content)
        
        logger.info(f"Updated page content: {page_slug}/{section_key}")
        
        # Export all page content to static files
        await CMSAdminService._export_all_page_content(db)
        
        return {
            "id": page_content.id,
            "pageSlug": page_content.page_slug,
            "sectionKey": page_content.section_key,
            "title": page_content.title,
            "subtitle": page_content.subtitle,
            "content": page_content.content,
            "imageUrl": page_content.image_url
        }
    
    @staticmethod
    async def _export_all_page_content(db: AsyncSession):
        """Export all page content to static files."""
        from backend.models.content import PageContent
        
        result = await db.execute(
            select(PageContent).where(PageContent.is_active == True)
        )
        page_contents = result.scalars().all()
        
        # Group by page_slug
        pages_data = {}
        for pc in page_contents:
            if pc.page_slug not in pages_data:
                pages_data[pc.page_slug] = {}
            
            pages_data[pc.page_slug][pc.section_key] = {
                'id': pc.id,
                'title': pc.title,
                'subtitle': pc.subtitle,
                'content': pc.content,
                'imageUrl': pc.image_url,
                'videoUrl': pc.video_url,
                'ctaText': pc.cta_text,
                'ctaLink': pc.cta_link,
                'ctaStyle': pc.cta_style,
                'extraData': pc.extra_data,
                'displayOrder': pc.display_order
            }
        
        await export_content_after_update('pageContent', pages_data)
    
    # ========================================================================
    # Bulk Export (for initial setup or full refresh)
    # ========================================================================
    
    @staticmethod
    async def export_all_static_content(db: AsyncSession) -> bool:
        """
        Export all CMS content to static files.
        Useful for initial setup or manual refresh.
        
        Args:
            db: Database session
            
        Returns:
            True if successful
        """
        try:
            # Export each content type
            await CMSAdminService._export_all_hero_slides(db)
            await CMSAdminService._export_all_sales_reps(db)
            await CMSAdminService._export_all_gallery_images(db)
            
            # Export site settings
            result = await db.execute(select(SiteSettings).limit(1))
            settings = result.scalar_one_or_none()
            if settings:
                settings_dict = {
                    'companyName': settings.company_name,
                    'companyTagline': settings.company_tagline,
                    'logoUrl': settings.logo_url,
                    'primaryEmail': settings.primary_email,
                    'primaryPhone': settings.primary_phone,
                    'salesEmail': settings.sales_email,
                    'salesPhone': settings.sales_phone,
                    # ... (include all fields)
                }
                await export_content_after_update('siteSettings', settings_dict)
            
            logger.info("Successfully exported all static content")
            return True
            
        except Exception as e:
            logger.error(f"Failed to export all content: {e}", exc_info=True)
            return False
