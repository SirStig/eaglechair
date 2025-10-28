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
)
from backend.models.legal import (
    LegalDocument,
    LegalDocumentType,
    ShippingPolicy,
    WarrantyInformation,
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
            
            await export_content_after_update('siteSettings', db)
            
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
        
        await export_content_after_update('heroSlides', db)
    
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
        
        await export_content_after_update('salesReps', db)
    
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
        result = await db.execute(
            select(Installation)
            .where(Installation.is_active)
            .order_by(Installation.display_order)
        )
        installations = result.scalars().all()
        
        gallery_data = []
        for inst in installations:
            # images field is already a list (JSON type auto-deserializes)
            images = inst.images if inst.images else []
            primary_image = inst.primary_image or (images[0] if images else None)
            
            gallery_data.append({
                'id': inst.id,
                'url': primary_image,
                'title': inst.project_name,
                'category': inst.project_type or 'General',
                'location': inst.location,
                'images': images,
            })
        
        await export_content_after_update('galleryImages', db)
    
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
        result = await db.execute(
            select(PageContent).where(PageContent.is_active).order_by(PageContent.page_slug, PageContent.display_order)
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
        
        await export_content_after_update('pageContent', db)
    
    # ========================================================================
    # Features
    # ========================================================================
    
    @staticmethod
    async def create_feature(
        db: AsyncSession,
        title: str,
        description: str,
        feature_type: str = "general",
        icon: Optional[str] = None,
        icon_color: Optional[str] = None,
        image_url: Optional[str] = None,
        display_order: int = 0
    ) -> Feature:
        """Create feature and export."""
        feature = Feature(
            title=title,
            description=description,
            feature_type=feature_type,
            icon=icon,
            icon_color=icon_color,
            image_url=image_url,
            display_order=display_order,
            is_active=True
        )
        db.add(feature)
        await db.commit()
        await db.refresh(feature)
        
        await CMSAdminService._export_all_features(db)
        logger.info(f"Created feature: {feature.title}")
        return feature
    
    @staticmethod
    async def update_feature(
        db: AsyncSession,
        feature_id: int,
        **updates
    ) -> Feature:
        """Update feature and export."""
        result = await db.execute(select(Feature).where(Feature.id == feature_id))
        feature = result.scalar_one_or_none()
        
        if not feature:
            raise ResourceNotFoundError(f"Feature with id {feature_id} not found")
        
        for key, value in updates.items():
            if hasattr(feature, key):
                setattr(feature, key, value)
        
        await db.commit()
        await db.refresh(feature)
        
        await CMSAdminService._export_all_features(db)
        logger.info(f"Updated feature: {feature.title}")
        return feature
    
    @staticmethod
    async def delete_feature(db: AsyncSession, feature_id: int) -> None:
        """Delete feature and export."""
        result = await db.execute(select(Feature).where(Feature.id == feature_id))
        feature = result.scalar_one_or_none()
        
        if not feature:
            raise ResourceNotFoundError(f"Feature with id {feature_id} not found")
        
        await db.delete(feature)
        await db.commit()
        
        await CMSAdminService._export_all_features(db)
        logger.info(f"Deleted feature: {feature.title}")
    
    @staticmethod
    async def _export_all_features(db: AsyncSession):
        """Export all features to static file."""
        result = await db.execute(select(Feature).where(Feature.is_active).order_by(Feature.display_order))
        features = result.scalars().all()
        
        features_data = [
            {
                'id': f.id,
                'title': f.title,
                'description': f.description,
                'icon': f.icon,
                'iconColor': f.icon_color,
                'imageUrl': f.image_url,
                'featureType': f.feature_type,
                'displayOrder': f.display_order
            }
            for f in features
        ]
        
        await export_content_after_update('features', db)
    
    # ========================================================================
    # Company Values
    # ========================================================================
    
    @staticmethod
    async def create_company_value(
        db: AsyncSession,
        title: str,
        description: str,
        subtitle: Optional[str] = None,
        icon: Optional[str] = None,
        image_url: Optional[str] = None,
        display_order: int = 0
    ) -> CompanyValue:
        """Create company value and export."""
        value = CompanyValue(
            title=title,
            subtitle=subtitle,
            description=description,
            icon=icon,
            image_url=image_url,
            display_order=display_order,
            is_active=True
        )
        db.add(value)
        await db.commit()
        await db.refresh(value)
        
        await CMSAdminService._export_all_company_values(db)
        logger.info(f"Created company value: {value.title}")
        return value
    
    @staticmethod
    async def update_company_value(
        db: AsyncSession,
        value_id: int,
        **updates
    ) -> CompanyValue:
        """Update company value and export."""
        result = await db.execute(select(CompanyValue).where(CompanyValue.id == value_id))
        value = result.scalar_one_or_none()
        
        if not value:
            raise ResourceNotFoundError(f"Company value with id {value_id} not found")
        
        for key, value_update in updates.items():
            if hasattr(value, key):
                setattr(value, key, value_update)
        
        await db.commit()
        await db.refresh(value)
        
        await CMSAdminService._export_all_company_values(db)
        logger.info(f"Updated company value: {value.title}")
        return value
    
    @staticmethod
    async def delete_company_value(db: AsyncSession, value_id: int) -> None:
        """Delete company value and export."""
        result = await db.execute(select(CompanyValue).where(CompanyValue.id == value_id))
        value = result.scalar_one_or_none()
        
        if not value:
            raise ResourceNotFoundError(f"Company value with id {value_id} not found")
        
        await db.delete(value)
        await db.commit()
        
        await CMSAdminService._export_all_company_values(db)
        logger.info(f"Deleted company value: {value.title}")
    
    @staticmethod
    async def _export_all_company_values(db: AsyncSession):
        """Export all company values to static file."""
        result = await db.execute(select(CompanyValue).where(CompanyValue.is_active).order_by(CompanyValue.display_order))
        values = result.scalars().all()
        
        values_data = [
            {
                'id': v.id,
                'title': v.title,
                'subtitle': v.subtitle,
                'description': v.description,
                'icon': v.icon,
                'imageUrl': v.image_url,
                'displayOrder': v.display_order
            }
            for v in values
        ]
        
        await export_content_after_update('companyValues', db)
    
    # ========================================================================
    # Team Members
    # ========================================================================
    
    @staticmethod
    async def create_team_member(
        db: AsyncSession,
        name: str,
        title: str,
        bio: Optional[str] = None,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        photo_url: Optional[str] = None,
        linkedin_url: Optional[str] = None,
        display_order: int = 0
    ) -> TeamMember:
        """Create team member and export."""
        member = TeamMember(
            name=name,
            title=title,
            bio=bio,
            email=email,
            phone=phone,
            photo_url=photo_url,
            linkedin_url=linkedin_url,
            display_order=display_order,
            is_active=True
        )
        db.add(member)
        await db.commit()
        await db.refresh(member)
        
        await CMSAdminService._export_all_team_members(db)
        logger.info(f"Created team member: {member.name}")
        return member
    
    @staticmethod
    async def update_team_member(
        db: AsyncSession,
        member_id: int,
        **updates
    ) -> TeamMember:
        """Update team member and export."""
        result = await db.execute(select(TeamMember).where(TeamMember.id == member_id))
        member = result.scalar_one_or_none()
        
        if not member:
            raise ResourceNotFoundError(f"Team member with id {member_id} not found")
        
        for key, value in updates.items():
            if hasattr(member, key):
                setattr(member, key, value)
        
        await db.commit()
        await db.refresh(member)
        
        await CMSAdminService._export_all_team_members(db)
        logger.info(f"Updated team member: {member.name}")
        return member
    
    @staticmethod
    async def delete_team_member(db: AsyncSession, member_id: int) -> None:
        """Delete team member and export."""
        result = await db.execute(select(TeamMember).where(TeamMember.id == member_id))
        member = result.scalar_one_or_none()
        
        if not member:
            raise ResourceNotFoundError(f"Team member with id {member_id} not found")
        
        await db.delete(member)
        await db.commit()
        
        await CMSAdminService._export_all_team_members(db)
        logger.info(f"Deleted team member: {member.name}")
    
    @staticmethod
    async def _export_all_team_members(db: AsyncSession):
        """Export all team members to static file."""
        result = await db.execute(select(TeamMember).where(TeamMember.is_active).order_by(TeamMember.display_order))
        members = result.scalars().all()
        
        members_data = [
            {
                'id': m.id,
                'name': m.name,
                'title': m.title,
                'bio': m.bio,
                'email': m.email,
                'phone': m.phone,
                'photoUrl': m.photo_url,
                'linkedinUrl': m.linkedin_url,
                'displayOrder': m.display_order
            }
            for m in members
        ]
        
        await export_content_after_update('teamMembers', db)
    
    # ========================================================================
    # Client Logos
    # ========================================================================
    
    @staticmethod
    async def create_client_logo(
        db: AsyncSession,
        name: str,
        logo_url: str,
        website_url: Optional[str] = None,
        display_order: int = 0
    ) -> ClientLogo:
        """Create client logo and export."""
        logo = ClientLogo(
            name=name,
            logo_url=logo_url,
            website_url=website_url,
            display_order=display_order,
            is_active=True
        )
        db.add(logo)
        await db.commit()
        await db.refresh(logo)
        
        await CMSAdminService._export_all_client_logos(db)
        logger.info(f"Created client logo: {logo.name}")
        return logo
    
    @staticmethod
    async def update_client_logo(
        db: AsyncSession,
        logo_id: int,
        **updates
    ) -> ClientLogo:
        """Update client logo and export."""
        result = await db.execute(select(ClientLogo).where(ClientLogo.id == logo_id))
        logo = result.scalar_one_or_none()
        
        if not logo:
            raise ResourceNotFoundError(f"Client logo with id {logo_id} not found")
        
        for key, value in updates.items():
            if hasattr(logo, key):
                setattr(logo, key, value)
        
        await db.commit()
        await db.refresh(logo)
        
        await CMSAdminService._export_all_client_logos(db)
        logger.info(f"Updated client logo: {logo.name}")
        return logo
    
    @staticmethod
    async def delete_client_logo(db: AsyncSession, logo_id: int) -> None:
        """Delete client logo and export."""
        result = await db.execute(select(ClientLogo).where(ClientLogo.id == logo_id))
        logo = result.scalar_one_or_none()
        
        if not logo:
            raise ResourceNotFoundError(f"Client logo with id {logo_id} not found")
        
        await db.delete(logo)
        await db.commit()
        
        await CMSAdminService._export_all_client_logos(db)
        logger.info(f"Deleted client logo: {logo.name}")
    
    @staticmethod
    async def _export_all_client_logos(db: AsyncSession):
        """Export all client logos to static file."""
        result = await db.execute(select(ClientLogo).where(ClientLogo.is_active).order_by(ClientLogo.display_order))
        logos = result.scalars().all()
        
        logos_data = [
            {
                'id': logo.id,
                'name': logo.name,
                'logoUrl': logo.logo_url,
                'websiteUrl': logo.website_url,
                'displayOrder': logo.display_order
            }
            for logo in logos
        ]
        
        await export_content_after_update('clientLogos', db)
    
    # ========================================================================
    # Company Milestones
    # ========================================================================
    
    @staticmethod
    async def create_company_milestone(
        db: AsyncSession,
        year: str,
        title: str,
        description: str,
        image_url: Optional[str] = None,
        display_order: int = 0
    ) -> CompanyMilestone:
        """Create company milestone and export."""
        milestone = CompanyMilestone(
            year=year,
            title=title,
            description=description,
            image_url=image_url,
            display_order=display_order,
            is_active=True
        )
        db.add(milestone)
        await db.commit()
        await db.refresh(milestone)
        
        await CMSAdminService._export_all_company_milestones(db)
        logger.info(f"Created milestone: {milestone.year} - {milestone.title}")
        return milestone
    
    @staticmethod
    async def update_company_milestone(
        db: AsyncSession,
        milestone_id: int,
        **updates
    ) -> CompanyMilestone:
        """Update company milestone and export."""
        result = await db.execute(select(CompanyMilestone).where(CompanyMilestone.id == milestone_id))
        milestone = result.scalar_one_or_none()
        
        if not milestone:
            raise ResourceNotFoundError(f"Company milestone with id {milestone_id} not found")
        
        for key, value in updates.items():
            if hasattr(milestone, key):
                setattr(milestone, key, value)
        
        await db.commit()
        await db.refresh(milestone)
        
        await CMSAdminService._export_all_company_milestones(db)
        logger.info(f"Updated milestone: {milestone.year} - {milestone.title}")
        return milestone
    
    @staticmethod
    async def delete_company_milestone(db: AsyncSession, milestone_id: int) -> None:
        """Delete company milestone and export."""
        result = await db.execute(select(CompanyMilestone).where(CompanyMilestone.id == milestone_id))
        milestone = result.scalar_one_or_none()
        
        if not milestone:
            raise ResourceNotFoundError(f"Company milestone with id {milestone_id} not found")
        
        await db.delete(milestone)
        await db.commit()
        
        await CMSAdminService._export_all_company_milestones(db)
        logger.info(f"Deleted milestone: {milestone.year} - {milestone.title}")
    
    @staticmethod
    async def _export_all_company_milestones(db: AsyncSession):
        """Export all company milestones to static file."""
        result = await db.execute(select(CompanyMilestone).where(CompanyMilestone.is_active).order_by(CompanyMilestone.display_order))
        milestones = result.scalars().all()
        
        milestones_data = [
            {
                'id': m.id,
                'year': m.year,
                'title': m.title,
                'description': m.description,
                'imageUrl': m.image_url,
                'displayOrder': m.display_order
            }
            for m in milestones
        ]
        
        await export_content_after_update('companyMilestones', db)
    
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
            # Export each content type using the new auto-fetch export function
            await export_content_after_update('siteSettings', db)
            await export_content_after_update('heroSlides', db)
            await export_content_after_update('salesReps', db)
            await export_content_after_update('galleryImages', db)
            await export_content_after_update('pageContent', db)
            await export_content_after_update('features', db)
            await export_content_after_update('companyValues', db)
            await export_content_after_update('companyMilestones', db)
            await export_content_after_update('teamMembers', db)
            await export_content_after_update('clientLogos', db)
            await export_content_after_update('legalDocuments', db)
            await export_content_after_update('warranties', db)
            await export_content_after_update('faqs', db)
            await export_content_after_update('faqCategories', db)
            await export_content_after_update('catalogs', db)
            await export_content_after_update('finishes', db)
            await export_content_after_update('upholsteries', db)
            await export_content_after_update('hardware', db)
            await export_content_after_update('laminates', db)
            
            logger.info("Successfully exported all static content")
            return True
            
        except Exception as e:
            logger.error(f"Failed to export all content: {e}", exc_info=True)
            return False
    
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
                "displayOrder": doc.display_order,
                "isActive": doc.is_active
            }
            for doc in documents
        ]
    
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
    ) -> LegalDocument:
        """Create legal document and export."""
        document = LegalDocument(
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
            is_active=is_active
        )
        db.add(document)
        await db.commit()
        await db.refresh(document)
        
        # Export all legal documents
        await CMSAdminService._export_all_legal_documents(db)
        
        logger.info(f"Created legal document: {title}")
        return document
    
    @staticmethod
    async def update_legal_document(
        db: AsyncSession,
        document_id: int,
        **updates
    ) -> LegalDocument:
        """Update legal document and re-export."""
        result = await db.execute(
            select(LegalDocument).where(LegalDocument.id == document_id)
        )
        document = result.scalar_one_or_none()
        
        if not document:
            raise ResourceNotFoundError(f"Legal document {document_id} not found")
        
        for key, value in updates.items():
            if hasattr(document, key) and value is not None:
                setattr(document, key, value)
        
        await db.commit()
        await db.refresh(document)
        
        # Re-export all legal documents
        await CMSAdminService._export_all_legal_documents(db)
        
        logger.info(f"Updated legal document: {document.title}")
        return document
    
    @staticmethod
    async def delete_legal_document(db: AsyncSession, document_id: int) -> None:
        """Delete legal document and re-export."""
        result = await db.execute(
            select(LegalDocument).where(LegalDocument.id == document_id)
        )
        document = result.scalar_one_or_none()
        
        if not document:
            raise ResourceNotFoundError(f"Legal document {document_id} not found")
        
        await db.delete(document)
        await db.commit()
        
        # Re-export remaining documents
        await CMSAdminService._export_all_legal_documents(db)
        
        logger.info(f"Deleted legal document: {document.title}")
    
    @staticmethod
    async def _export_all_legal_documents(db: AsyncSession) -> None:
        """Export all legal documents to static file."""
        result = await db.execute(
            select(LegalDocument).where(LegalDocument.is_active == True)
            .order_by(LegalDocument.display_order, LegalDocument.title)
        )
        documents = result.scalars().all()
        
        documents_data = [
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
                "displayOrder": doc.display_order
            }
            for doc in documents
        ]
        
        await export_content_after_update('legalDocuments', db)
        logger.info(f"Exported {len(documents)} legal documents to static file")
    
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
    ) -> WarrantyInformation:
        """Create warranty and export."""
        warranty = WarrantyInformation(
            warranty_type=warranty_type,
            title=title,
            description=description,
            duration=duration,
            coverage=coverage,
            exclusions=exclusions,
            claim_process=claim_process,
            display_order=display_order,
            is_active=is_active
        )
        db.add(warranty)
        await db.commit()
        await db.refresh(warranty)
        
        # Export all warranties
        await CMSAdminService._export_all_warranties(db)
        
        logger.info(f"Created warranty: {title}")
        return warranty
    
    @staticmethod
    async def update_warranty(
        db: AsyncSession,
        warranty_id: int,
        **updates
    ) -> WarrantyInformation:
        """Update warranty and re-export."""
        result = await db.execute(
            select(WarrantyInformation).where(WarrantyInformation.id == warranty_id)
        )
        warranty = result.scalar_one_or_none()
        
        if not warranty:
            raise ResourceNotFoundError(f"Warranty {warranty_id} not found")
        
        for key, value in updates.items():
            if hasattr(warranty, key) and value is not None:
                setattr(warranty, key, value)
        
        await db.commit()
        await db.refresh(warranty)
        
        # Re-export all warranties
        await CMSAdminService._export_all_warranties(db)
        
        logger.info(f"Updated warranty: {warranty.title}")
        return warranty
    
    @staticmethod
    async def delete_warranty(db: AsyncSession, warranty_id: int) -> None:
        """Delete warranty and re-export."""
        result = await db.execute(
            select(WarrantyInformation).where(WarrantyInformation.id == warranty_id)
        )
        warranty = result.scalar_one_or_none()
        
        if not warranty:
            raise ResourceNotFoundError(f"Warranty {warranty_id} not found")
        
        await db.delete(warranty)
        await db.commit()
        
        # Re-export remaining warranties
        await CMSAdminService._export_all_warranties(db)
        
        logger.info(f"Deleted warranty: {warranty.title}")
    
    @staticmethod
    async def _export_all_warranties(db: AsyncSession) -> None:
        """Export all warranties to static file."""
        result = await db.execute(
            select(WarrantyInformation).where(WarrantyInformation.is_active == True)
            .order_by(WarrantyInformation.display_order, WarrantyInformation.id)
        )
        warranties = result.scalars().all()
        
        warranties_data = [
            {
                "id": w.id,
                "warrantyType": w.warranty_type,
                "title": w.title,
                "description": w.description,
                "duration": w.duration,
                "coverage": w.coverage,
                "exclusions": w.exclusions,
                "claimProcess": w.claim_process,
                "displayOrder": w.display_order
            }
            for w in warranties
        ]
        
        await export_content_after_update('warranties', db)
        logger.info(f"Exported {len(warranties)} warranties to static file")
