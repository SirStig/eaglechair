"""
CMS Admin Routes - API v1

ADMIN-ONLY endpoints for managing CMS content with automatic static file export.

This file handles CREATE, UPDATE, DELETE operations for:
- Site settings (company info, contact, social links)
- Hero slides (homepage carousel)
- Sales representatives  
- Installation gallery images
- Page content sections

⚡ AUTOMATIC STATIC EXPORT:
All write operations (create/update/delete) automatically export updated content
to frontend/src/data/contentData.js for instant client-side loading.

🔒 AUTHENTICATION:
All endpoints require admin authentication via get_current_admin dependency.

For public READ operations, see cms_content.py.
For traditional content (FAQs, catalogs, team), see content.py.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import get_current_admin
from backend.api.v1.schemas.common import MessageResponse
from backend.database.base import get_db
from backend.models.company import Company
from backend.services.cms_admin_service import CMSAdminService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["CMS Admin"], prefix="/cms-admin")


# ============================================================================
# Request/Response Schemas
# ============================================================================

class SiteSettingsUpdate(BaseModel):
    """Site settings update request"""
    company_name: str | None = None
    company_tagline: str | None = None
    logo_url: str | None = None
    primary_email: str | None = None
    primary_phone: str | None = None
    sales_email: str | None = None
    sales_phone: str | None = None
    support_email: str | None = None
    support_phone: str | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    zip_code: str | None = None
    country: str | None = None
    business_hours_weekdays: str | None = None
    business_hours_saturday: str | None = None
    business_hours_sunday: str | None = None
    facebook_url: str | None = None
    instagram_url: str | None = None
    linkedin_url: str | None = None
    twitter_url: str | None = None
    youtube_url: str | None = None


class HeroSlideCreate(BaseModel):
    """Hero slide creation request"""
    title: str = Field(..., max_length=500)
    subtitle: str | None = Field(None, max_length=1000)
    background_image_url: str = Field(..., max_length=500)
    cta_text: str | None = Field(None, max_length=100)
    cta_link: str | None = Field(None, max_length=500)
    cta_style: str = Field(default="primary", max_length=50)
    secondary_cta_text: str | None = Field(None, max_length=100)
    secondary_cta_link: str | None = Field(None, max_length=500)
    display_order: int = Field(default=0, ge=0)
    is_active: bool = True


class HeroSlideUpdate(BaseModel):
    """Hero slide update request"""
    title: str | None = Field(None, max_length=500)
    subtitle: str | None = Field(None, max_length=1000)
    background_image_url: str | None = Field(None, max_length=500)
    cta_text: str | None = Field(None, max_length=100)
    cta_link: str | None = Field(None, max_length=500)
    cta_style: str | None = Field(None, max_length=50)
    secondary_cta_text: str | None = Field(None, max_length=100)
    secondary_cta_link: str | None = Field(None, max_length=500)
    display_order: int | None = Field(None, ge=0)
    is_active: bool | None = None


class SalesRepCreate(BaseModel):
    """Sales representative creation request"""
    name: str = Field(..., max_length=255)
    email: str = Field(..., max_length=255)
    phone: str = Field(..., max_length=20)
    territory_name: str = Field(..., max_length=255)
    states_covered: List[str] = Field(..., min_items=1)
    title: str | None = Field(None, max_length=100)
    photo_url: str | None = Field(None, max_length=500)
    bio: str | None = None
    mobile_phone: str | None = Field(None, max_length=20)
    fax: str | None = Field(None, max_length=20)
    linkedin_url: str | None = Field(None, max_length=500)
    display_order: int = Field(default=0, ge=0)
    is_active: bool = True


class SalesRepUpdate(BaseModel):
    """Sales representative update request"""
    name: str | None = Field(None, max_length=255)
    email: str | None = Field(None, max_length=255)
    phone: str | None = Field(None, max_length=20)
    territory_name: str | None = Field(None, max_length=255)
    states_covered: List[str] | None = None
    title: str | None = Field(None, max_length=100)
    photo_url: str | None = Field(None, max_length=500)
    bio: str | None = None
    mobile_phone: str | None = Field(None, max_length=20)
    fax: str | None = Field(None, max_length=20)
    linkedin_url: str | None = Field(None, max_length=500)
    display_order: int | None = Field(None, ge=0)
    is_active: bool | None = None


class InstallationCreate(BaseModel):
    """Installation/gallery entry creation request"""
    project_name: str = Field(..., max_length=255)
    images: List[str] = Field(..., min_items=1)
    client_name: str | None = Field(None, max_length=255)
    location: str | None = Field(None, max_length=255)
    project_type: str | None = Field(None, max_length=100)
    description: str | None = None
    primary_image: str | None = Field(None, max_length=500)
    products_used: str | None = None  # JSON string
    completion_date: str | None = Field(None, max_length=50)
    display_order: int = Field(default=0, ge=0)
    is_active: bool = True
    is_featured: bool = False


class InstallationUpdate(BaseModel):
    """Installation/gallery entry update request"""
    project_name: str | None = Field(None, max_length=255)
    images: List[str] | None = None
    client_name: str | None = Field(None, max_length=255)
    location: str | None = Field(None, max_length=255)
    project_type: str | None = Field(None, max_length=100)
    description: str | None = None
    primary_image: str | None = Field(None, max_length=500)
    products_used: str | None = None
    completion_date: str | None = Field(None, max_length=50)
    display_order: int | None = Field(None, ge=0)
    is_active: bool | None = None
    is_featured: bool | None = None


# ============================================================================
# Site Settings Endpoints
# ============================================================================

@router.put(
    "/site-settings",
    response_model=MessageResponse,
    summary="Update site settings",
    description="Update site-wide settings (logo, contact info, etc.) and export to static file"
)
async def update_site_settings(
    settings: SiteSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(get_current_admin)
):
    """
    Update site settings and export to frontend static file.
    
    **Admin only** - Requires admin authentication.
    
    Updates are automatically exported to contentData.js for instant frontend loading.
    """
    logger.info(f"Admin {admin.id} updating site settings")
    
    try:
        # Filter out None values
        updates = {k: v for k, v in settings.dict().items() if v is not None}
        
        if not updates:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No updates provided"
            )
        
        await CMSAdminService.update_site_settings(db, **updates)
        
        return MessageResponse(
            message="Site settings updated and exported successfully"
        )
        
    except Exception as e:
        logger.error(f"Failed to update site settings: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update site settings: {str(e)}"
        )


# ============================================================================
# Hero Slides Endpoints
# ============================================================================

@router.post(
    "/hero-slides",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create hero slide",
    description="Create a new homepage hero carousel slide and export"
)
async def create_hero_slide(
    slide: HeroSlideCreate,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(get_current_admin)
):
    """Create hero slide and export to static file."""
    logger.info(f"Admin {admin.id} creating hero slide: {slide.title}")
    
    try:
        await CMSAdminService.create_hero_slide(db, **slide.dict())
        
        return MessageResponse(
            message="Hero slide created and exported successfully"
        )
        
    except Exception as e:
        logger.error(f"Failed to create hero slide: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create hero slide: {str(e)}"
        )


@router.put(
    "/hero-slides/{slide_id}",
    response_model=MessageResponse,
    summary="Update hero slide",
    description="Update a hero slide and export"
)
async def update_hero_slide(
    slide_id: int,
    slide: HeroSlideUpdate,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(get_current_admin)
):
    """Update hero slide and export to static file."""
    logger.info(f"Admin {admin.id} updating hero slide {slide_id}")
    
    try:
        updates = {k: v for k, v in slide.dict().items() if v is not None}
        
        if not updates:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No updates provided"
            )
        
        await CMSAdminService.update_hero_slide(db, slide_id, **updates)
        
        return MessageResponse(
            message="Hero slide updated and exported successfully"
        )
        
    except Exception as e:
        logger.error(f"Failed to update hero slide: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update hero slide: {str(e)}"
        )


@router.delete(
    "/hero-slides/{slide_id}",
    response_model=MessageResponse,
    summary="Delete hero slide",
    description="Delete a hero slide and export"
)
async def delete_hero_slide(
    slide_id: int,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(get_current_admin)
):
    """Delete hero slide and export to static file."""
    logger.info(f"Admin {admin.id} deleting hero slide {slide_id}")
    
    try:
        await CMSAdminService.delete_hero_slide(db, slide_id)
        
        return MessageResponse(
            message="Hero slide deleted and exported successfully"
        )
        
    except Exception as e:
        logger.error(f"Failed to delete hero slide: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete hero slide: {str(e)}"
        )


# ============================================================================
# Sales Representatives Endpoints
# ============================================================================

@router.post(
    "/sales-reps",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create sales representative",
    description="Create a new sales rep and export"
)
async def create_sales_rep(
    rep: SalesRepCreate,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(get_current_admin)
):
    """Create sales rep and export to static file."""
    logger.info(f"Admin {admin.id} creating sales rep: {rep.name}")
    
    try:
        await CMSAdminService.create_sales_rep(db, **rep.dict())
        
        return MessageResponse(
            message="Sales representative created and exported successfully"
        )
        
    except Exception as e:
        logger.error(f"Failed to create sales rep: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create sales rep: {str(e)}"
        )


@router.put(
    "/sales-reps/{rep_id}",
    response_model=MessageResponse,
    summary="Update sales representative",
    description="Update a sales rep and export"
)
async def update_sales_rep(
    rep_id: int,
    rep: SalesRepUpdate,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(get_current_admin)
):
    """Update sales rep and export to static file."""
    logger.info(f"Admin {admin.id} updating sales rep {rep_id}")
    
    try:
        updates = {k: v for k, v in rep.dict().items() if v is not None}
        
        if not updates:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No updates provided"
            )
        
        await CMSAdminService.update_sales_rep(db, rep_id, **updates)
        
        return MessageResponse(
            message="Sales representative updated and exported successfully"
        )
        
    except Exception as e:
        logger.error(f"Failed to update sales rep: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update sales rep: {str(e)}"
        )


@router.delete(
    "/sales-reps/{rep_id}",
    response_model=MessageResponse,
    summary="Delete sales representative",
    description="Delete a sales rep and export"
)
async def delete_sales_rep(
    rep_id: int,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(get_current_admin)
):
    """Delete sales rep and export to static file."""
    logger.info(f"Admin {admin.id} deleting sales rep {rep_id}")
    
    try:
        await CMSAdminService.delete_sales_rep(db, rep_id)
        
        return MessageResponse(
            message="Sales representative deleted and exported successfully"
        )
        
    except Exception as e:
        logger.error(f"Failed to delete sales rep: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete sales rep: {str(e)}"
        )


# ============================================================================
# Gallery/Installation Endpoints
# ============================================================================

@router.post(
    "/gallery",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create gallery/installation entry",
    description="Create a new installation showcase entry and export"
)
async def create_installation(
    installation: InstallationCreate,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(get_current_admin)
):
    """Create installation entry and export to static file."""
    logger.info(f"Admin {admin.id} creating installation: {installation.project_name}")
    
    try:
        await CMSAdminService.create_installation(db, **installation.dict())
        
        return MessageResponse(
            message="Installation entry created and exported successfully"
        )
        
    except Exception as e:
        logger.error(f"Failed to create installation: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create installation: {str(e)}"
        )


@router.put(
    "/gallery/{installation_id}",
    response_model=MessageResponse,
    summary="Update gallery/installation entry",
    description="Update an installation entry and export"
)
async def update_installation(
    installation_id: int,
    installation: InstallationUpdate,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(get_current_admin)
):
    """Update installation entry and export to static file."""
    logger.info(f"Admin {admin.id} updating installation {installation_id}")
    
    try:
        updates = {k: v for k, v in installation.dict().items() if v is not None}
        
        if not updates:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No updates provided"
            )
        
        await CMSAdminService.update_installation(db, installation_id, **updates)
        
        return MessageResponse(
            message="Installation entry updated and exported successfully"
        )
        
    except Exception as e:
        logger.error(f"Failed to update installation: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update installation: {str(e)}"
        )


@router.delete(
    "/gallery/{installation_id}",
    response_model=MessageResponse,
    summary="Delete gallery/installation entry",
    description="Delete an installation entry and export"
)
async def delete_installation(
    installation_id: int,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(get_current_admin)
):
    """Delete installation entry and export to static file."""
    logger.info(f"Admin {admin.id} deleting installation {installation_id}")
    
    try:
        await CMSAdminService.delete_installation(db, installation_id)
        
        return MessageResponse(
            message="Installation entry deleted and exported successfully"
        )
        
    except Exception as e:
        logger.error(f"Failed to delete installation: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete installation: {str(e)}"
        )


# ============================================================================
# Page Content Endpoints
# ============================================================================

@router.patch(
    "/page-content/{page_slug}/{section_key}",
    response_model=dict,
    summary="Update page content section",
    description="Update a specific page content section"
)
async def update_page_content(
    page_slug: str,
    section_key: str,
    title: Optional[str] = None,
    subtitle: Optional[str] = None,
    content: Optional[str] = None,
    image_url: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(get_current_admin)
):
    """
    Update page content section.
    
    Automatically exports to static files after update.
    """
    logger.info(f"Admin {admin.id} updating page content: {page_slug}/{section_key}")
    
    try:
        # Update page content
        result = await CMSAdminService.update_page_content(
            db=db,
            page_slug=page_slug,
            section_key=section_key,
            title=title,
            subtitle=subtitle,
            content=content,
            image_url=image_url
        )
        
        return {
            "success": True,
            "message": "Page content updated successfully",
            "data": result
        }
        
    except Exception as e:
        logger.error(f"Failed to update page content: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update page content: {str(e)}"
        )


# ============================================================================
# Utility Endpoints
# ============================================================================

@router.post(
    "/export-all",
    response_model=MessageResponse,
    summary="Export all CMS content",
    description="Manually trigger export of all CMS content to static files"
)
async def export_all_content(
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(get_current_admin)
):
    """
    Manually export all CMS content to static files.
    
    Useful for initial setup or fixing corrupted files.
    """
    logger.info(f"Admin {admin.id} triggering full content export")
    
    try:
        success = await CMSAdminService.export_all_static_content(db)
        
        if success:
            return MessageResponse(
                message="All CMS content exported successfully"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Export failed - check server logs"
            )
            
    except Exception as e:
        logger.error(f"Failed to export all content: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export content: {str(e)}"
        )
