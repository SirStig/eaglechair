"""
CMS Content Routes - API v1

Public routes for CMS-managed content (hero slides, features, values, milestones, etc.)
All endpoints under /content/ prefix
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.database.base import get_db
from backend.models.chair import Chair
from backend.models.content import (
    ClientLogo,
    CompanyInfo,
    CompanyMilestone,
    CompanyValue,
    Feature,
    Feedback,
    HeroSlide,
    Installation,
    PageContent,
    SalesRepresentative,
    SiteSettings,
    TeamMember,
)
from backend.services.default_content_service import default_content

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/content", tags=["CMS Content"])


# ============================================================================
# Site Settings
# ============================================================================

@router.get(
    "/site-settings",
    summary="Get site settings",
    description="Retrieve global site settings (company info, contact, social links)"
)
async def get_site_settings(db: AsyncSession = Depends(get_db)):
    """
    Get site settings.
    
    **Public endpoint** - No authentication required.
    """
    logger.info("Fetching site settings")
    
    result = await db.execute(
        select(SiteSettings)
        .limit(1)
    )
    settings = result.scalar_one_or_none()
    
    if not settings:
        # Return default settings from service
        return default_content.get_site_settings()
    
    return {
        "id": settings.id,
        "companyName": settings.company_name,
        "companyTagline": settings.company_tagline,
        "logoUrl": settings.logo_url,
        "faviconUrl": settings.favicon_url,
        "primaryEmail": settings.primary_email,
        "primaryPhone": settings.primary_phone,
        "salesEmail": settings.sales_email,
        "salesPhone": settings.sales_phone,
        "supportEmail": settings.support_email,
        "supportPhone": settings.support_phone,
        "addressLine1": settings.address_line1,
        "addressLine2": settings.address_line2,
        "city": settings.city,
        "state": settings.state,
        "zipCode": settings.zip_code,
        "country": settings.country,
        "businessHoursWeekdays": settings.business_hours_weekdays,
        "businessHoursSaturday": settings.business_hours_saturday,
        "businessHoursSunday": settings.business_hours_sunday,
        "facebookUrl": settings.facebook_url,
        "instagramUrl": settings.instagram_url,
        "linkedinUrl": settings.linkedin_url,
        "twitterUrl": settings.twitter_url,
        "youtubeUrl": settings.youtube_url,
        "googleMapsUrl": settings.google_maps_url,
        "metaDescription": settings.meta_description,
        "metaKeywords": settings.meta_keywords
    }


# ============================================================================
# Hero Slides
# ============================================================================

@router.get(
    "/hero-slides",
    summary="Get hero slides",
    description="Retrieve all active hero slides for homepage carousel"
)
async def get_hero_slides(db: AsyncSession = Depends(get_db)):
    """
    Get all active hero slides ordered by display order.
    
    **Public endpoint** - No authentication required.
    """
    logger.info("Fetching hero slides")
    
    result = await db.execute(
        select(HeroSlide)
        .where(HeroSlide.is_active == True)
        .order_by(HeroSlide.display_order, HeroSlide.id)
    )
    slides = result.scalars().all()
    
    # Return default content if no slides in database
    if not slides:
        return default_content.get_hero_slides()
    
    return [
        {
            "id": slide.id,
            "title": slide.title,
            "subtitle": slide.subtitle,
            "image": slide.background_image_url,
            "ctaText": slide.cta_text,
            "ctaLink": slide.cta_link,
            "displayOrder": slide.display_order
        }
        for slide in slides
    ]


# ============================================================================
# Features (Why Choose Us)
# ============================================================================

@router.get(
    "/features",
    summary="Get features",
    description="Retrieve features/benefits (Why Choose Us section)"
)
async def get_features(
    type: Optional[str] = Query(None, description="Filter by feature type"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all active features.
    
    **Public endpoint** - No authentication required.
    
    Can filter by type (e.g., 'home_page', 'about_page')
    """
    logger.info(f"Fetching features (type={type})")
    
    query = select(Feature).where(Feature.is_active == True)
    
    if type:
        query = query.where(Feature.feature_type == type)
    
    query = query.order_by(Feature.display_order, Feature.id)
    
    result = await db.execute(query)
    features = result.scalars().all()
    
    # Return default content if no features in database
    if not features:
        return default_content.get_features(type or "general")
    
    return [
        {
            "id": feature.id,
            "title": feature.title,
            "description": feature.description,
            "icon": feature.icon,
            "featureType": feature.feature_type,
            "displayOrder": feature.display_order
        }
        for feature in features
    ]


# ============================================================================
# Client Logos
# ============================================================================

@router.get(
    "/client-logos",
    summary="Get client logos",
    description="Retrieve client/partner logos for display"
)
async def get_client_logos(db: AsyncSession = Depends(get_db)):
    """
    Get all active client logos.
    
    **Public endpoint** - No authentication required.
    """
    logger.info("Fetching client logos")
    
    result = await db.execute(
        select(ClientLogo)
        .where(ClientLogo.is_active == True)
        .order_by(ClientLogo.display_order, ClientLogo.id)
    )
    logos = result.scalars().all()
    
    return [
        {
            "id": logo.id,
            "name": logo.name,
            "logoUrl": logo.logo_url,
            "websiteUrl": logo.website_url,
            "displayOrder": logo.display_order
        }
        for logo in logos
    ]


# ============================================================================
# Company Values
# ============================================================================

@router.get(
    "/company-values",
    summary="Get company values",
    description="Retrieve company core values for About page"
)
async def get_company_values(db: AsyncSession = Depends(get_db)):
    """
    Get all active company values.
    
    **Public endpoint** - No authentication required.
    """
    logger.info("Fetching company values")
    
    result = await db.execute(
        select(CompanyValue)
        .where(CompanyValue.is_active == True)
        .order_by(CompanyValue.display_order, CompanyValue.id)
    )
    values = result.scalars().all()
    
    # Return default content if no values in database
    if not values:
        return default_content.get_company_values()
    
    return [
        {
            "id": value.id,
            "title": value.title,
            "description": value.description,
            "icon": value.icon,
            "displayOrder": value.display_order
        }
        for value in values
    ]


# ============================================================================
# Company Milestones
# ============================================================================

@router.get(
    "/company-milestones",
    summary="Get company milestones",
    description="Retrieve company history milestones for About page timeline"
)
async def get_company_milestones(db: AsyncSession = Depends(get_db)):
    """
    Get all active company milestones.
    
    **Public endpoint** - No authentication required.
    """
    logger.info("Fetching company milestones")
    
    result = await db.execute(
        select(CompanyMilestone)
        .where(CompanyMilestone.is_active == True)
        .order_by(CompanyMilestone.year, CompanyMilestone.display_order)
    )
    milestones = result.scalars().all()
    
    # Return default content if no milestones in database
    if not milestones:
        return default_content.get_company_milestones()
    
    return [
        {
            "id": milestone.id,
            "year": milestone.year,
            "title": milestone.title,
            "description": milestone.description,
            "displayOrder": milestone.display_order
        }
        for milestone in milestones
    ]


# ============================================================================
# Team Members
# ============================================================================

@router.get(
    "/team-members",
    summary="Get team members",
    description="Retrieve team members for About page"
)
async def get_team_members(db: AsyncSession = Depends(get_db)):
    """
    Get all active team members.
    
    **Public endpoint** - No authentication required.
    """
    logger.info("Fetching team members")
    
    result = await db.execute(
        select(TeamMember)
        .where(TeamMember.is_active == True)
        .order_by(TeamMember.display_order, TeamMember.id)
    )
    members = result.scalars().all()
    
    # Return default content if no team members in database
    if not members:
        return default_content.get_team_members()
    
    return [
        {
            "id": member.id,
            "name": member.name,
            "role": member.title,
            "title": member.title,
            "bio": member.bio,
            "image": member.photo_url,
            "email": member.email,
            "phone": member.phone,
            "linkedinUrl": member.linkedin_url,
            "displayOrder": member.display_order
        }
        for member in members
    ]


# ============================================================================
# Company Info
# ============================================================================

@router.get(
    "/company-info",
    summary="Get company information",
    description="Retrieve company information sections"
)
async def get_company_info(
    section_key: Optional[str] = Query(None, description="Filter by section key"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get company information.
    
    **Public endpoint** - No authentication required.
    
    Can filter by section_key (e.g., 'about_us', 'mission', 'history')
    """
    logger.info(f"Fetching company info (section_key={section_key})")
    
    query = select(CompanyInfo).where(CompanyInfo.is_active == True)
    
    if section_key:
        query = query.where(CompanyInfo.section_key == section_key)
        result = await db.execute(query)
        info = result.scalar_one_or_none()
        
        if not info:
            raise HTTPException(status_code=404, detail="Company info section not found")
        
        return {
            "id": info.id,
            "sectionKey": info.section_key,
            "title": info.title,
            "content": info.content,
            "imageUrl": info.image_url,
            "displayOrder": info.display_order
        }
    
    query = query.order_by(CompanyInfo.display_order, CompanyInfo.id)
    result = await db.execute(query)
    info_sections = result.scalars().all()
    
    return [
        {
            "id": section.id,
            "sectionKey": section.section_key,
            "title": section.title,
            "content": section.content,
            "imageUrl": section.image_url,
            "displayOrder": section.display_order
        }
        for section in info_sections
    ]


# ============================================================================
# Sales Representatives
# ============================================================================

@router.get(
    "/sales-reps",
    summary="Get sales representatives",
    description="Retrieve sales representatives for Find a Rep page"
)
async def get_sales_reps(
    state: Optional[str] = Query(None, description="Filter by state code"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all active sales representatives.
    
    **Public endpoint** - No authentication required.
    
    Can filter by state code (e.g., 'TX', 'CA')
    """
    logger.info(f"Fetching sales reps (state={state})")
    
    query = select(SalesRepresentative).where(SalesRepresentative.is_active == True)
    
    if state:
        # Filter by state in states_covered JSON array
        query = query.where(SalesRepresentative.states_covered.contains([state]))
    
    query = query.order_by(SalesRepresentative.territory_name, SalesRepresentative.name)
    
    result = await db.execute(query)
    reps = result.scalars().all()
    
    return [
        {
            "id": rep.id,
            "name": rep.name,
            "territoryName": rep.territory_name,
            "territory": rep.territory_name,
            "statesCovered": rep.states_covered,
            "states": rep.states_covered,
            "email": rep.email,
            "phone": rep.phone,
            "photoUrl": rep.photo_url
        }
        for rep in reps
    ]


# ============================================================================
# Installations (Gallery)
# ============================================================================

@router.get(
    "/installations",
    summary="Get installations",
    description="Retrieve installation gallery images"
)
async def get_installations(
    project_type: Optional[str] = Query(None, description="Filter by project type"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all active installations.
    
    **Public endpoint** - No authentication required.
    
    Can filter by project_type (e.g., 'restaurant', 'hotel', 'office')
    """
    logger.info(f"Fetching installations (project_type={project_type})")
    
    query = select(Installation).where(Installation.is_active == True)
    
    if project_type:
        query = query.where(Installation.project_type == project_type)
    
    query = query.order_by(Installation.display_order.desc(), Installation.completion_date.desc())
    
    result = await db.execute(query)
    installations = result.scalars().all()
    
    return [
        {
            "id": installation.id,
            "projectName": installation.project_name,
            "title": installation.project_name,
            "projectType": installation.project_type,
            "category": installation.project_type,
            "location": installation.location,
            "description": installation.description,
            "completionDate": installation.completion_date.isoformat() if installation.completion_date else None,
            "images": installation.images,
            "primaryImage": installation.primary_image,
            "url": installation.primary_image,
            "clientName": installation.client_name,
            "displayOrder": installation.display_order
        }
        for installation in installations
    ]


# ============================================================================
# Feedback Submission
# ============================================================================

@router.post(
    "/feedback",
    status_code=201,
    summary="Submit feedback",
    description="Submit feedback or contact form"
)
async def submit_feedback(
    feedback_data: dict,
    db: AsyncSession = Depends(get_db)
):
    """
    Submit feedback or contact form.
    
    **Public endpoint** - No authentication required.
    """
    logger.info(f"Feedback submission from {feedback_data.get('email')}")
    
    feedback = Feedback(
        name=feedback_data.get("name"),
        email=feedback_data.get("email"),
        phone=feedback_data.get("phone"),
        company_name=feedback_data.get("companyName"),
        subject=feedback_data.get("subject"),
        message=feedback_data.get("message"),
        feedback_type=feedback_data.get("feedbackType", "general")
    )
    
    db.add(feedback)
    await db.commit()
    
    return {
        "message": "Thank you for your feedback!",
        "detail": "We've received your message and will get back to you as soon as possible."
    }


# ============================================================================
# Page Content
# ============================================================================

@router.get(
    "/page-content/{page_slug}",
    summary="Get page content",
    description="Retrieve all content sections for a specific page"
)
async def get_page_content(
    page_slug: str,
    section_key: Optional[str] = Query(None, description="Filter by section key"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get page content sections.
    
    **Public endpoint** - No authentication required.
    
    Can filter by section_key (e.g., 'hero', 'story', 'cta')
    """
    logger.info(f"Fetching page content (page={page_slug}, section={section_key})")
    
    query = select(PageContent).where(
        PageContent.page_slug == page_slug,
        PageContent.is_active == True
    )
    
    if section_key:
        query = query.where(PageContent.section_key == section_key)
        result = await db.execute(query)
        content = result.scalar_one_or_none()
        
        if not content:
            # Return default content if available
            default = default_content.get_page_content(page_slug, section_key)
            return default if default else None
        
        return {
            "id": content.id,
            "pageSlug": content.page_slug,
            "sectionKey": content.section_key,
            "title": content.title,
            "subtitle": content.subtitle,
            "content": content.content,
            "imageUrl": content.image_url,
            "videoUrl": content.video_url,
            "ctaText": content.cta_text,
            "ctaLink": content.cta_link,
            "ctaStyle": content.cta_style,
            "extraData": content.extra_data,
            "displayOrder": content.display_order
        }
    
    query = query.order_by(PageContent.display_order, PageContent.id)
    result = await db.execute(query)
    contents = result.scalars().all()
    
    return [
        {
            "id": content.id,
            "pageSlug": content.page_slug,
            "sectionKey": content.section_key,
            "title": content.title,
            "subtitle": content.subtitle,
            "content": content.content,
            "imageUrl": content.image_url,
            "videoUrl": content.video_url,
            "ctaText": content.cta_text,
            "ctaLink": content.cta_link,
            "ctaStyle": content.cta_style,
            "extraData": content.extra_data,
            "displayOrder": content.display_order
        }
        for content in contents
    ]


# ============================================================================
# Featured Products
# ============================================================================

@router.get(
    "/featured-products",
    summary="Get featured products",
    description="Retrieve products marked as featured for homepage display"
)
async def get_featured_products(
    limit: int = Query(4, ge=1, le=20, description="Number of products to return"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get featured products.
    
    **Public endpoint** - No authentication required.
    """
    logger.info(f"Fetching featured products (limit={limit})")
    
    result = await db.execute(
        select(Chair)
        .where(Chair.is_active == True, Chair.is_featured == True)
        .order_by(Chair.display_order, Chair.id)
        .limit(limit)
    )
    products = result.scalars().all()
    
    return [
        {
            "id": product.id,
            "modelNumber": product.model_number,
            "name": product.name,
            "slug": product.slug,
            "shortDescription": product.short_description,
            "basePrice": float(product.base_price) if product.base_price else None,
            "msrp": float(product.msrp) if product.msrp else None,
            "primaryImage": product.primary_image,
            "thumbnail": product.thumbnail,
            "images": product.images,
            "isFeatured": product.is_featured,
            "isNew": product.is_new,
            "stockStatus": product.stock_status,
            "categoryId": product.category_id
        }
        for product in products
    ]


# ============================================================================
# UPDATE ENDPOINTS (Admin Only)
# ============================================================================

from pydantic import BaseModel

from backend.api.dependencies import get_current_admin


class PageContentUpdate(BaseModel):
    """Schema for updating page content"""
    title: Optional[str] = None
    subtitle: Optional[str] = None
    content: Optional[str] = None
    imageUrl: Optional[str] = None


@router.patch(
    "/page-content/{page_slug}/{section_key}",
    summary="Update page content",
    description="Update page content section (Admin only)"
)
async def update_page_content(
    page_slug: str,
    section_key: str,
    updates: PageContentUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin = Depends(get_current_admin)
):
    """
    Update page content.
    
    **Admin only** - Requires admin authentication.
    """
    logger.info(f"Updating page content (page={page_slug}, section={section_key})")
    
    # Find existing content
    result = await db.execute(
        select(PageContent).where(
            PageContent.page_slug == page_slug,
            PageContent.section_key == section_key
        )
    )
    content = result.scalar_one_or_none()
    
    if not content:
        # Create new content if it doesn't exist
        content = PageContent(
            page_slug=page_slug,
            section_key=section_key,
            is_active=True
        )
        db.add(content)
    
    # Update fields
    update_data = updates.dict(exclude_unset=True)
    for field, value in update_data.items():
        # Convert camelCase to snake_case
        snake_field = ''.join(['_' + c.lower() if c.isupper() else c for c in field]).lstrip('_')
        if hasattr(content, snake_field):
            setattr(content, snake_field, value)
    
    await db.commit()
    await db.refresh(content)
    
    logger.info(f"Updated page content: {page_slug}/{section_key}")
    
    return {
        "success": True,
        "message": "Content updated successfully",
        "data": {
            "id": content.id,
            "pageSlug": content.page_slug,
            "sectionKey": content.section_key,
            "title": content.title,
            "subtitle": content.subtitle,
            "content": content.content,
            "imageUrl": content.image_url
        }
    }

