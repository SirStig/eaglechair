"""
CMS Admin Routes - API v1

ADMIN-ONLY endpoints for managing CMS content with automatic static file export.

This file handles CREATE, UPDATE, DELETE operations for:
- Site settings (company info, contact, social links)
- Hero slides (homepage carousel)
- Sales representatives
- Testimonials
- Installation gallery images
- Page content sections

⚡ AUTOMATIC STATIC EXPORT:
All write operations (create/update/delete) automatically export updated content
to contentData.json for instant client-side loading. Every write response
includes ``exported``: false means the change was saved but publishing it to
the live site failed.

🔒 AUTHENTICATION:
All endpoints require admin authentication via get_current_admin dependency.

For public READ operations, see cms_content.py.
For traditional content (FAQs, catalogs, team), see content.py.
"""

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Path, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import get_current_admin, require_role
from backend.api.v1.schemas.common import CMSUrlValidationMixin, CMSWriteResponse
from backend.api.v1.schemas.content import (
    CompanyInfoCreate,
    CompanyInfoUpdate,
    ContactLocationCreate,
    ContactLocationUpdate,
    PageContentUpdate,
    TeamMemberCreate,
    TeamMemberUpdate,
)
from backend.core.exceptions import EagleChairException
from backend.database.base import get_db
from backend.models.company import AdminRole, Company
from backend.models.legal import LegalDocumentType
from backend.services.cms_admin_service import CMSAdminService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["CMS Admin"], prefix="/cms-admin")

# Page slugs / section keys, e.g. "home", "installation_gallery"
SLUG_PATTERN = r"^[a-z0-9][a-z0-9_-]{0,99}$"


# ============================================================================
# Response helpers
# ============================================================================

def _write_response(action: str, exported: bool) -> CMSWriteResponse:
    """
    Build the response for a CMS write.

    Args:
        action: What was saved, e.g. "Hero slide created"
        exported: Whether contentData.json was updated
    """
    if exported:
        return CMSWriteResponse(message=f"{action} and exported successfully", exported=True)
    return CMSWriteResponse(
        message=(
            f"{action}, but publishing to the live site failed. "
            "The change is saved; try saving again or use Export All."
        ),
        exported=False,
    )


def _internal_error(action: str) -> HTTPException:
    """Log the active exception and return a generic 500 for the client."""
    logger.exception(f"Failed to {action}")
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"Failed to {action}. Please try again later.",
    )


def _no_updates() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="No updates provided"
    )


# ============================================================================
# Request/Response Schemas
# ============================================================================

# Features
class FeatureCreate(CMSUrlValidationMixin):
    """Feature creation request"""
    title: str = Field(..., max_length=255)
    description: str = ""
    icon: str | None = Field(None, max_length=100)
    icon_color: str | None = Field(None, max_length=50)
    image_url: str | None = Field(None, max_length=500)
    feature_type: str = Field(default="general", max_length=50)
    display_order: int = Field(default=0, ge=0)
    is_active: bool = True


class FeatureUpdate(CMSUrlValidationMixin):
    """Feature update request"""
    title: str | None = Field(None, max_length=255)
    description: str | None = None
    icon: str | None = Field(None, max_length=100)
    icon_color: str | None = Field(None, max_length=50)
    image_url: str | None = Field(None, max_length=500)
    feature_type: str | None = Field(None, max_length=50)
    display_order: int | None = Field(None, ge=0)
    is_active: bool | None = None


# Client Logos
class ClientLogoCreate(CMSUrlValidationMixin):
    """Client logo creation request"""
    name: str = Field(..., max_length=255)
    logo_url: str = Field(..., max_length=500)
    website_url: str | None = Field(None, max_length=500)
    display_order: int = Field(default=0, ge=0)
    is_active: bool = True


class ClientLogoUpdate(CMSUrlValidationMixin):
    """Client logo update request"""
    name: str | None = Field(None, max_length=255)
    logo_url: str | None = Field(None, max_length=500)
    website_url: str | None = Field(None, max_length=500)
    display_order: int | None = Field(None, ge=0)
    is_active: bool | None = None


# Testimonials
class TestimonialCreate(CMSUrlValidationMixin):
    """Testimonial creation request"""
    quote: str = Field(..., min_length=1)
    author_name: str = Field(..., min_length=1, max_length=255)
    author_title: str | None = Field(None, max_length=255)
    company_name: str | None = Field(None, max_length=255)
    location: str | None = Field(None, max_length=255)
    photo_url: str | None = Field(None, max_length=500)
    display_order: int = Field(default=0, ge=0)
    is_active: bool = True


class TestimonialUpdate(CMSUrlValidationMixin):
    """Testimonial update request"""
    quote: str | None = Field(None, min_length=1)
    author_name: str | None = Field(None, min_length=1, max_length=255)
    author_title: str | None = Field(None, max_length=255)
    company_name: str | None = Field(None, max_length=255)
    location: str | None = Field(None, max_length=255)
    photo_url: str | None = Field(None, max_length=500)
    display_order: int | None = Field(None, ge=0)
    is_active: bool | None = None


# Company Values
class CompanyValueCreate(CMSUrlValidationMixin):
    """Company value creation request"""
    title: str = Field(..., max_length=255)
    subtitle: str | None = Field(None, max_length=500)
    description: str = ""
    icon: str | None = Field(None, max_length=100)
    image_url: str | None = Field(None, max_length=500)
    display_order: int = Field(default=0, ge=0)
    is_active: bool = True


class CompanyValueUpdate(CMSUrlValidationMixin):
    """Company value update request"""
    title: str | None = Field(None, max_length=255)
    subtitle: str | None = Field(None, max_length=500)
    description: str | None = None
    icon: str | None = Field(None, max_length=100)
    image_url: str | None = Field(None, max_length=500)
    display_order: int | None = Field(None, ge=0)
    is_active: bool | None = None


# Company Milestones
class CompanyMilestoneCreate(CMSUrlValidationMixin):
    """Company milestone creation request"""
    year: str = Field(..., max_length=10)  # e.g. "1984", "1990s"
    title: str = Field(..., max_length=255)
    description: str = ""
    image_url: str | None = Field(None, max_length=500)
    display_order: int = Field(default=0, ge=0)
    is_active: bool = True


class CompanyMilestoneUpdate(CMSUrlValidationMixin):
    """Company milestone update request"""
    year: str | None = Field(None, max_length=10)
    title: str | None = Field(None, max_length=255)
    description: str | None = None
    image_url: str | None = Field(None, max_length=500)
    display_order: int | None = Field(None, ge=0)
    is_active: bool | None = None


# Site Settings (max lengths match the SiteSettings columns)
class SiteSettingsUpdate(CMSUrlValidationMixin):
    """Site settings update request. Send null (or "" for emails) to clear a field."""
    company_name: str | None = Field(None, max_length=255)
    company_tagline: str | None = Field(None, max_length=500)
    logo_url: str | None = Field(None, max_length=500)
    logo_dark_url: str | None = Field(None, max_length=500)
    favicon_url: str | None = Field(None, max_length=500)
    primary_email: EmailStr | None = Field(None, max_length=255)
    primary_phone: str | None = Field(None, max_length=20)
    sales_email: EmailStr | None = Field(None, max_length=255)
    sales_phone: str | None = Field(None, max_length=20)
    support_email: EmailStr | None = Field(None, max_length=255)
    support_phone: str | None = Field(None, max_length=20)
    address_line1: str | None = Field(None, max_length=255)
    address_line2: str | None = Field(None, max_length=255)
    city: str | None = Field(None, max_length=100)
    state: str | None = Field(None, max_length=50)
    zip_code: str | None = Field(None, max_length=20)
    country: str | None = Field(None, max_length=100)
    business_hours_weekdays: str | None = Field(None, max_length=255)
    business_hours_saturday: str | None = Field(None, max_length=255)
    business_hours_sunday: str | None = Field(None, max_length=255)
    facebook_url: str | None = Field(None, max_length=500)
    instagram_url: str | None = Field(None, max_length=500)
    linkedin_url: str | None = Field(None, max_length=500)
    twitter_url: str | None = Field(None, max_length=500)
    youtube_url: str | None = Field(None, max_length=500)
    meta_title: str | None = Field(None, max_length=255)
    meta_description: str | None = None
    meta_keywords: str | None = None

    @field_validator("primary_email", "sales_email", "support_email", mode="before")
    @classmethod
    def _blank_email_to_none(cls, v):
        # An emptied form field clears the email instead of failing validation
        if isinstance(v, str) and not v.strip():
            return None
        return v


class HeroSlideCreate(CMSUrlValidationMixin):
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


class HeroSlideUpdate(CMSUrlValidationMixin):
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


class SalesRepCreate(CMSUrlValidationMixin):
    """Sales representative creation request"""
    name: str = Field(..., max_length=255)
    email: str = Field(..., max_length=255)
    phone: str = Field(..., max_length=20)
    territory_name: str = Field(..., max_length=255, alias='territoryName')
    states_covered: List[str] = Field(..., min_length=1, alias='statesCovered')
    title: str | None = Field(None, max_length=100)
    photo_url: str | None = Field(None, max_length=500, alias='photoUrl')
    bio: str | None = None
    mobile_phone: str | None = Field(None, max_length=20, alias='mobilePhone')
    fax: str | None = Field(None, max_length=20)
    linkedin_url: str | None = Field(None, max_length=500, alias='linkedinUrl')
    display_order: int = Field(default=0, ge=0, alias='displayOrder')
    is_active: bool = Field(default=True, alias='isActive')

    class Config:
        populate_by_name = True  # Accept both snake_case and camelCase


class SalesRepUpdate(CMSUrlValidationMixin):
    """Sales representative update request"""
    name: str | None = Field(None, max_length=255)
    email: str | None = Field(None, max_length=255)
    phone: str | None = Field(None, max_length=20)
    territory_name: str | None = Field(None, max_length=255, alias='territoryName')
    states_covered: List[str] | None = Field(None, alias='statesCovered')
    title: str | None = Field(None, max_length=100)
    photo_url: str | None = Field(None, max_length=500, alias='photoUrl')
    bio: str | None = None
    mobile_phone: str | None = Field(None, max_length=20, alias='mobilePhone')
    fax: str | None = Field(None, max_length=20)
    linkedin_url: str | None = Field(None, max_length=500, alias='linkedinUrl')
    display_order: int | None = Field(None, ge=0, alias='displayOrder')
    is_active: bool | None = Field(None, alias='isActive')

    class Config:
        populate_by_name = True  # Accept both snake_case and camelCase


class InstallationCreate(CMSUrlValidationMixin):
    """Installation/gallery entry creation request"""
    project_name: str = Field(..., max_length=255)
    images: List[str] = Field(..., min_length=1)
    client_name: str | None = Field(None, max_length=255)
    location: str | None = Field(None, max_length=255)
    project_type: str | None = Field(None, max_length=100)
    description: str | None = None
    primary_image: str | None = Field(None, max_length=500)
    products_used: str | None = Field(None, max_length=1000)  # JSON string
    completion_date: str | None = Field(None, max_length=50)
    display_order: int = Field(default=0, ge=0)
    is_active: bool = True
    is_featured: bool = False


class InstallationUpdate(CMSUrlValidationMixin):
    """Installation/gallery entry update request"""
    project_name: str | None = Field(None, max_length=255)
    images: List[str] | None = None
    client_name: str | None = Field(None, max_length=255)
    location: str | None = Field(None, max_length=255)
    project_type: str | None = Field(None, max_length=100)
    description: str | None = None
    primary_image: str | None = Field(None, max_length=500)
    products_used: str | None = Field(None, max_length=1000)
    completion_date: str | None = Field(None, max_length=50)
    display_order: int | None = Field(None, ge=0)
    is_active: bool | None = None
    is_featured: bool | None = None


# ============================================================================
# Site Settings Endpoints
# ============================================================================

@router.put(
    "/site-settings",
    response_model=CMSWriteResponse,
    summary="Update site settings",
    description="Update site-wide settings (logo, contact info, etc.) and export to static file"
)
@router.patch(
    "/site-settings",
    response_model=CMSWriteResponse,
    summary="Update site settings (PATCH)",
    description="Partially update site-wide settings and export to static file"
)
async def update_site_settings(
    settings: SiteSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """
    Update site settings and export to frontend static file.

    **Admin only** - Requires admin authentication.

    Fields sent as null are cleared; fields left out are unchanged.
    """
    logger.info(f"Admin {admin.id} updating site settings")

    updates = settings.model_dump(exclude_unset=True)
    if not updates:
        raise _no_updates()

    try:
        _, exported = await CMSAdminService.update_site_settings(db, **updates)
        return _write_response("Site settings updated", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("update site settings")


# ============================================================================
# Hero Slides Endpoints
# ============================================================================

@router.post(
    "/hero-slides",
    response_model=CMSWriteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create hero slide",
    description="Create a new homepage hero carousel slide and export"
)
async def create_hero_slide(
    slide: HeroSlideCreate,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """Create hero slide and export to static file."""
    logger.info(f"Admin {admin.id} creating hero slide: {slide.title}")

    try:
        _, exported = await CMSAdminService.create_hero_slide(db, **slide.model_dump())
        return _write_response("Hero slide created", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("create hero slide")


@router.put(
    "/hero-slides/{slide_id}",
    response_model=CMSWriteResponse,
    summary="Update hero slide",
    description="Update a hero slide and export"
)
@router.patch(
    "/hero-slides/{slide_id}",
    response_model=CMSWriteResponse,
    summary="Update hero slide (PATCH)",
    description="Partially update a hero slide and export"
)
async def update_hero_slide(
    slide_id: int,
    slide: HeroSlideUpdate,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """Update hero slide and export to static file."""
    logger.info(f"Admin {admin.id} updating hero slide {slide_id}")

    updates = slide.model_dump(exclude_unset=True)
    if not updates:
        raise _no_updates()

    try:
        _, exported = await CMSAdminService.update_hero_slide(db, slide_id, **updates)
        return _write_response("Hero slide updated", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("update hero slide")


@router.delete(
    "/hero-slides/{slide_id}",
    response_model=CMSWriteResponse,
    summary="Delete hero slide",
    description="Delete a hero slide and export"
)
async def delete_hero_slide(
    slide_id: int,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """Delete hero slide and export to static file."""
    logger.info(f"Admin {admin.id} deleting hero slide {slide_id}")

    try:
        exported = await CMSAdminService.delete_hero_slide(db, slide_id)
        return _write_response("Hero slide deleted", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("delete hero slide")


# ============================================================================
# Sales Representatives Endpoints
# ============================================================================

@router.post(
    "/sales-reps",
    response_model=CMSWriteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create sales representative",
    description="Create a new sales rep and export"
)
async def create_sales_rep(
    rep: SalesRepCreate,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """Create sales rep and export to static file."""
    logger.info(f"Admin {admin.id} creating sales rep: {rep.name}")

    try:
        _, exported = await CMSAdminService.create_sales_rep(db, **rep.model_dump())
        return _write_response("Sales representative created", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("create sales rep")


@router.put(
    "/sales-reps/{rep_id}",
    response_model=CMSWriteResponse,
    summary="Update sales representative",
    description="Update a sales rep and export"
)
@router.patch(
    "/sales-reps/{rep_id}",
    response_model=CMSWriteResponse,
    summary="Update sales representative (PATCH)",
    description="Partially update a sales rep and export"
)
async def update_sales_rep(
    rep_id: int,
    rep: SalesRepUpdate,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """Update sales rep and export to static file."""
    logger.info(f"Admin {admin.id} updating sales rep {rep_id}")

    updates = rep.model_dump(exclude_unset=True)
    if not updates:
        raise _no_updates()

    try:
        _, exported = await CMSAdminService.update_sales_rep(db, rep_id, **updates)
        return _write_response("Sales representative updated", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("update sales rep")


@router.delete(
    "/sales-reps/{rep_id}",
    response_model=CMSWriteResponse,
    summary="Delete sales representative",
    description="Delete a sales rep and export"
)
async def delete_sales_rep(
    rep_id: int,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """Delete sales rep and export to static file."""
    logger.info(f"Admin {admin.id} deleting sales rep {rep_id}")

    try:
        exported = await CMSAdminService.delete_sales_rep(db, rep_id)
        return _write_response("Sales representative deleted", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("delete sales rep")


# ============================================================================
# Gallery/Installation Endpoints
# ============================================================================

@router.post(
    "/gallery",
    response_model=CMSWriteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create gallery/installation entry",
    description="Create a new installation showcase entry and export"
)
async def create_installation(
    installation: InstallationCreate,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """Create installation entry and export to static file."""
    logger.info(f"Admin {admin.id} creating installation: {installation.project_name}")

    try:
        _, exported = await CMSAdminService.create_installation(
            db, **installation.model_dump()
        )
        return _write_response("Installation entry created", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("create installation")


@router.put(
    "/gallery/{installation_id}",
    response_model=CMSWriteResponse,
    summary="Update gallery/installation entry",
    description="Update an installation entry and export"
)
async def update_installation(
    installation_id: int,
    installation: InstallationUpdate,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """Update installation entry and export to static file."""
    logger.info(f"Admin {admin.id} updating installation {installation_id}")

    updates = installation.model_dump(exclude_unset=True)
    if not updates:
        raise _no_updates()

    try:
        _, exported = await CMSAdminService.update_installation(
            db, installation_id, **updates
        )
        return _write_response("Installation entry updated", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("update installation")


@router.delete(
    "/gallery/{installation_id}",
    response_model=CMSWriteResponse,
    summary="Delete gallery/installation entry",
    description="Delete an installation entry and export"
)
async def delete_installation(
    installation_id: int,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """Delete installation entry and export to static file."""
    logger.info(f"Admin {admin.id} deleting installation {installation_id}")

    try:
        exported = await CMSAdminService.delete_installation(db, installation_id)
        return _write_response("Installation entry deleted", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("delete installation")


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
    updates: PageContentUpdate,
    page_slug: str = Path(..., pattern=SLUG_PATTERN),
    section_key: str = Path(..., pattern=SLUG_PATTERN),
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """
    Update page content section.

    Automatically exports to static files after update. Fields sent as null
    are cleared; fields left out are unchanged.
    """
    logger.info(f"Admin {admin.id} updating page content: {page_slug}/{section_key}")

    try:
        result, exported = await CMSAdminService.update_page_content(
            db=db,
            page_slug=page_slug,
            section_key=section_key,
            **updates.model_dump(exclude_unset=True)
        )
        response = _write_response("Page content updated", exported)
        return {
            "success": True,
            "message": response.message,
            "exported": response.exported,
            "data": result
        }
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("update page content")


# ============================================================================
# Utility Endpoints
# ============================================================================

@router.post(
    "/export-all",
    response_model=CMSWriteResponse,
    summary="Export all CMS content",
    description="Manually trigger export of all CMS content to static files"
)
async def export_all_content(
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """
    Manually export all CMS content to static files.

    Useful for initial setup or fixing corrupted files.
    """
    logger.info(f"Admin {admin.id} triggering full content export")

    try:
        exported = await CMSAdminService.export_all_static_content(db)
    except Exception:
        raise _internal_error("export content")

    if exported:
        return CMSWriteResponse(message="All CMS content exported successfully", exported=True)
    return CMSWriteResponse(
        message="Publishing to the live site failed. Check the server logs and try again.",
        exported=False,
    )


# ============================================================================
# Features Endpoints
# ============================================================================

@router.post(
    "/features",
    response_model=CMSWriteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create feature",
    description="Create a new feature (Why Choose Us) and export"
)
async def create_feature(
    feature: FeatureCreate,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """Create feature and export to static file."""
    logger.info(f"Admin {admin.id} creating feature: {feature.title}")

    try:
        _, exported = await CMSAdminService.create_feature(db, **feature.model_dump())
        return _write_response("Feature created", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("create feature")


@router.patch(
    "/features/{feature_id}",
    response_model=CMSWriteResponse,
    summary="Update feature",
    description="Update a feature and export"
)
async def update_feature(
    feature_id: int,
    feature: FeatureUpdate,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """Update feature and export to static file."""
    logger.info(f"Admin {admin.id} updating feature {feature_id}")

    updates = feature.model_dump(exclude_unset=True)
    if not updates:
        raise _no_updates()

    try:
        _, exported = await CMSAdminService.update_feature(db, feature_id, **updates)
        return _write_response("Feature updated", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("update feature")


@router.delete(
    "/features/{feature_id}",
    response_model=CMSWriteResponse,
    summary="Delete feature",
    description="Delete a feature and export"
)
async def delete_feature(
    feature_id: int,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """Delete feature and export to static file."""
    logger.info(f"Admin {admin.id} deleting feature {feature_id}")

    try:
        exported = await CMSAdminService.delete_feature(db, feature_id)
        return _write_response("Feature deleted", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("delete feature")


# ============================================================================
# Client Logos Endpoints
# ============================================================================

@router.post(
    "/client-logos",
    response_model=CMSWriteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create client logo",
    description="Create a new client logo and export"
)
async def create_client_logo(
    logo: ClientLogoCreate,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """Create client logo and export to static file."""
    logger.info(f"Admin {admin.id} creating client logo: {logo.name}")

    try:
        _, exported = await CMSAdminService.create_client_logo(db, **logo.model_dump())
        return _write_response("Client logo created", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("create client logo")


@router.patch(
    "/client-logos/{logo_id}",
    response_model=CMSWriteResponse,
    summary="Update client logo",
    description="Update a client logo and export"
)
async def update_client_logo(
    logo_id: int,
    logo: ClientLogoUpdate,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """Update client logo and export to static file."""
    logger.info(f"Admin {admin.id} updating client logo {logo_id}")

    updates = logo.model_dump(exclude_unset=True)
    if not updates:
        raise _no_updates()

    try:
        _, exported = await CMSAdminService.update_client_logo(db, logo_id, **updates)
        return _write_response("Client logo updated", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("update client logo")


@router.delete(
    "/client-logos/{logo_id}",
    response_model=CMSWriteResponse,
    summary="Delete client logo",
    description="Delete a client logo and export"
)
async def delete_client_logo(
    logo_id: int,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """Delete client logo and export to static file."""
    logger.info(f"Admin {admin.id} deleting client logo {logo_id}")

    try:
        exported = await CMSAdminService.delete_client_logo(db, logo_id)
        return _write_response("Client logo deleted", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("delete client logo")


# ============================================================================
# Testimonials Endpoints
# ============================================================================

@router.post(
    "/testimonials",
    response_model=CMSWriteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create testimonial",
    description="Create a new client testimonial and export"
)
async def create_testimonial(
    testimonial: TestimonialCreate,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """Create testimonial and export to static file."""
    logger.info(f"Admin {admin.id} creating testimonial from: {testimonial.author_name}")

    try:
        _, exported = await CMSAdminService.create_testimonial(db, **testimonial.model_dump())
        return _write_response("Testimonial created", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("create testimonial")


@router.patch(
    "/testimonials/{testimonial_id}",
    response_model=CMSWriteResponse,
    summary="Update testimonial",
    description="Update a client testimonial and export"
)
async def update_testimonial(
    testimonial_id: int,
    testimonial: TestimonialUpdate,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """Update testimonial and export to static file."""
    logger.info(f"Admin {admin.id} updating testimonial {testimonial_id}")

    updates = testimonial.model_dump(exclude_unset=True)
    if not updates:
        raise _no_updates()

    try:
        _, exported = await CMSAdminService.update_testimonial(db, testimonial_id, **updates)
        return _write_response("Testimonial updated", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("update testimonial")


@router.delete(
    "/testimonials/{testimonial_id}",
    response_model=CMSWriteResponse,
    summary="Delete testimonial",
    description="Delete a client testimonial and export"
)
async def delete_testimonial(
    testimonial_id: int,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """Delete testimonial and export to static file."""
    logger.info(f"Admin {admin.id} deleting testimonial {testimonial_id}")

    try:
        exported = await CMSAdminService.delete_testimonial(db, testimonial_id)
        return _write_response("Testimonial deleted", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("delete testimonial")


# ============================================================================
# Team Members Endpoints
# ============================================================================

@router.post(
    "/team-members",
    response_model=CMSWriteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create team member",
    description="Create a new team member and export"
)
async def create_team_member(
    member: TeamMemberCreate,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """Create team member and export to static file."""
    logger.info(f"Admin {admin.id} creating team member: {member.name}")

    try:
        _, exported = await CMSAdminService.create_team_member(db, **member.model_dump())
        return _write_response("Team member created", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("create team member")


@router.patch(
    "/team-members/{member_id}",
    response_model=CMSWriteResponse,
    summary="Update team member",
    description="Update a team member and export"
)
async def update_team_member(
    member_id: int,
    member: TeamMemberUpdate,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """Update team member and export to static file."""
    logger.info(f"Admin {admin.id} updating team member {member_id}")

    updates = member.model_dump(exclude_unset=True)
    if not updates:
        raise _no_updates()

    try:
        _, exported = await CMSAdminService.update_team_member(db, member_id, **updates)
        return _write_response("Team member updated", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("update team member")


@router.delete(
    "/team-members/{member_id}",
    response_model=CMSWriteResponse,
    summary="Delete team member",
    description="Delete a team member and export"
)
async def delete_team_member(
    member_id: int,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """Delete team member and export to static file."""
    logger.info(f"Admin {admin.id} deleting team member {member_id}")

    try:
        exported = await CMSAdminService.delete_team_member(db, member_id)
        return _write_response("Team member deleted", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("delete team member")


# ============================================================================
# Company Values Endpoints
# ============================================================================

@router.post(
    "/company-values",
    response_model=CMSWriteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create company value",
    description="Create a new company value and export"
)
async def create_company_value(
    value: CompanyValueCreate,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """Create company value and export to static file."""
    logger.info(f"Admin {admin.id} creating company value: {value.title}")

    try:
        _, exported = await CMSAdminService.create_company_value(db, **value.model_dump())
        return _write_response("Company value created", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("create company value")


@router.patch(
    "/company-values/{value_id}",
    response_model=CMSWriteResponse,
    summary="Update company value",
    description="Update a company value and export"
)
async def update_company_value(
    value_id: int,
    value: CompanyValueUpdate,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """Update company value and export to static file."""
    logger.info(f"Admin {admin.id} updating company value {value_id}")

    updates = value.model_dump(exclude_unset=True)
    if not updates:
        raise _no_updates()

    try:
        _, exported = await CMSAdminService.update_company_value(db, value_id, **updates)
        return _write_response("Company value updated", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("update company value")


@router.delete(
    "/company-values/{value_id}",
    response_model=CMSWriteResponse,
    summary="Delete company value",
    description="Delete a company value and export"
)
async def delete_company_value(
    value_id: int,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """Delete company value and export to static file."""
    logger.info(f"Admin {admin.id} deleting company value {value_id}")

    try:
        exported = await CMSAdminService.delete_company_value(db, value_id)
        return _write_response("Company value deleted", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("delete company value")


# ============================================================================
# Company Milestones Endpoints
# ============================================================================

@router.post(
    "/company-milestones",
    response_model=CMSWriteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create company milestone",
    description="Create a new company milestone and export"
)
async def create_company_milestone(
    milestone: CompanyMilestoneCreate,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """Create company milestone and export to static file."""
    logger.info(f"Admin {admin.id} creating company milestone: {milestone.title}")

    try:
        _, exported = await CMSAdminService.create_company_milestone(
            db, **milestone.model_dump()
        )
        return _write_response("Company milestone created", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("create company milestone")


@router.patch(
    "/company-milestones/{milestone_id}",
    response_model=CMSWriteResponse,
    summary="Update company milestone",
    description="Update a company milestone and export"
)
async def update_company_milestone(
    milestone_id: int,
    milestone: CompanyMilestoneUpdate,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """Update company milestone and export to static file."""
    logger.info(f"Admin {admin.id} updating company milestone {milestone_id}")

    updates = milestone.model_dump(exclude_unset=True)
    if not updates:
        raise _no_updates()

    try:
        _, exported = await CMSAdminService.update_company_milestone(
            db, milestone_id, **updates
        )
        return _write_response("Company milestone updated", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("update company milestone")


@router.delete(
    "/company-milestones/{milestone_id}",
    response_model=CMSWriteResponse,
    summary="Delete company milestone",
    description="Delete a company milestone and export"
)
async def delete_company_milestone(
    milestone_id: int,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """Delete company milestone and export to static file."""
    logger.info(f"Admin {admin.id} deleting company milestone {milestone_id}")

    try:
        exported = await CMSAdminService.delete_company_milestone(db, milestone_id)
        return _write_response("Company milestone deleted", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("delete company milestone")


# ============================================================================
# Contact Locations Endpoints
# ============================================================================

@router.post(
    "/contact-locations",
    response_model=CMSWriteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create contact location",
    description="Create a new contact location and export"
)
async def create_contact_location(
    location: ContactLocationCreate,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """Create contact location and export to static file."""
    logger.info(f"Admin {admin.id} creating contact location: {location.location_name}")

    try:
        _, exported = await CMSAdminService.create_contact_location(
            db, **location.model_dump()
        )
        return _write_response("Contact location created", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("create contact location")


@router.patch(
    "/contact-locations/{location_id}",
    response_model=CMSWriteResponse,
    summary="Update contact location",
    description="Update a contact location and export"
)
async def update_contact_location(
    location_id: int,
    location: ContactLocationUpdate,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """Update contact location and export to static file."""
    logger.info(f"Admin {admin.id} updating contact location {location_id}")

    updates = location.model_dump(exclude_unset=True)
    if not updates:
        raise _no_updates()

    try:
        _, exported = await CMSAdminService.update_contact_location(
            db, location_id, **updates
        )
        return _write_response("Contact location updated", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("update contact location")


@router.delete(
    "/contact-locations/{location_id}",
    response_model=CMSWriteResponse,
    summary="Delete contact location",
    description="Delete a contact location and export"
)
async def delete_contact_location(
    location_id: int,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """Delete contact location and export to static file."""
    logger.info(f"Admin {admin.id} deleting contact location {location_id}")

    try:
        exported = await CMSAdminService.delete_contact_location(db, location_id)
        return _write_response("Contact location deleted", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("delete contact location")


# ============================================================================
# Company Info Endpoints
# ============================================================================

@router.post(
    "/company-info",
    response_model=CMSWriteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create company info section",
    description="Create a new company info section and export"
)
async def create_company_info(
    info: CompanyInfoCreate,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """Create company info section and export to static file."""
    logger.info(f"Admin {admin.id} creating company info: {info.section_key}")

    try:
        _, exported = await CMSAdminService.create_company_info(db, **info.model_dump())
        return _write_response("Company info created", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("create company info")


@router.patch(
    "/company-info/{info_id}",
    response_model=CMSWriteResponse,
    summary="Update company info section",
    description="Update a company info section and export"
)
async def update_company_info(
    info_id: int,
    info: CompanyInfoUpdate,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """Update company info section and export to static file."""
    logger.info(f"Admin {admin.id} updating company info {info_id}")

    updates = info.model_dump(exclude_unset=True)
    if not updates:
        raise _no_updates()

    try:
        _, exported = await CMSAdminService.update_company_info(db, info_id, **updates)
        return _write_response("Company info updated", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("update company info")


@router.delete(
    "/company-info/{info_id}",
    response_model=CMSWriteResponse,
    summary="Delete company info section",
    description="Delete a company info section and export"
)
async def delete_company_info(
    info_id: int,
    db: AsyncSession = Depends(get_db),
    admin: Company = Depends(require_role(AdminRole.EDITOR))
):
    """Delete company info section and export to static file."""
    logger.info(f"Admin {admin.id} deleting company info {info_id}")

    try:
        exported = await CMSAdminService.delete_company_info(db, info_id)
        return _write_response("Company info deleted", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("delete company info")


# ============================================================================
# Legal Documents Management
# ============================================================================

class LegalDocumentCreate(BaseModel):
    """Legal document creation request"""
    document_type: str = Field(..., description="Type of legal document")
    title: str = Field(..., max_length=255)
    content: str = Field(..., description="Full document content (HTML/Markdown)")
    short_description: str | None = Field(None, description="Brief description")
    slug: str = Field(..., max_length=255, description="URL-friendly slug")
    version: str = Field(default="1.0", max_length=20)
    effective_date: str | None = Field(None, max_length=50)
    meta_title: str | None = Field(None, max_length=255)
    meta_description: str | None = None
    display_order: int = Field(default=0, ge=0)
    is_active: bool = True


class LegalDocumentUpdate(BaseModel):
    """Legal document update request"""
    title: str | None = Field(None, max_length=255)
    content: str | None = None
    short_description: str | None = None
    slug: str | None = Field(None, max_length=255)
    version: str | None = Field(None, max_length=20)
    effective_date: str | None = Field(None, max_length=50)
    meta_title: str | None = Field(None, max_length=255)
    meta_description: str | None = None
    display_order: int | None = Field(None, ge=0)
    is_active: bool | None = None


class WarrantyCreate(BaseModel):
    """Warranty information creation request"""
    warranty_type: str = Field(..., max_length=100)
    title: str = Field(..., max_length=255)
    description: str
    duration: str | None = Field(None, max_length=100)
    coverage: str | None = None
    exclusions: str | None = None
    claim_process: str | None = None
    display_order: int = Field(default=0, ge=0)
    is_active: bool = True


class WarrantyUpdate(BaseModel):
    """Warranty information update request"""
    warranty_type: str | None = Field(None, max_length=100)
    title: str | None = Field(None, max_length=255)
    description: str | None = None
    duration: str | None = Field(None, max_length=100)
    coverage: str | None = None
    exclusions: str | None = None
    claim_process: str | None = None
    display_order: int | None = Field(None, ge=0)
    is_active: bool | None = None


@router.get(
    "/legal-documents",
    summary="Get all legal documents (Admin)",
    description="Retrieve all legal documents for admin management"
)
async def admin_get_legal_documents(
    admin: Company = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get all legal documents. Admin only."""
    logger.info(f"Admin {admin.id} fetching all legal documents")

    result = await CMSAdminService.get_all_legal_documents(db)
    return result


@router.post(
    "/legal-documents",
    status_code=status.HTTP_201_CREATED,
    summary="Create legal document (Admin)",
    description="Create a new legal document and export to static file"
)
async def admin_create_legal_document(
    data: LegalDocumentCreate,
    admin: Company = Depends(require_role(AdminRole.EDITOR)),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new legal document.

    **Admin only** - Automatically exports to the static legal documents file.
    """
    logger.info(f"Admin {admin.id} creating legal document: {data.title}")

    # Validate document type
    try:
        doc_type = LegalDocumentType(data.document_type)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid document type. Must be one of: {', '.join([t.value for t in LegalDocumentType])}"
        )

    try:
        document, exported = await CMSAdminService.create_legal_document(
            db=db,
            document_type=doc_type,
            title=data.title,
            content=data.content,
            short_description=data.short_description,
            slug=data.slug,
            version=data.version,
            effective_date=data.effective_date,
            meta_title=data.meta_title,
            meta_description=data.meta_description,
            display_order=data.display_order,
            is_active=data.is_active
        )
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("create legal document")

    response = _write_response("Legal document created", exported)
    return {
        "id": document.id,
        "documentType": document.document_type.value,
        "title": document.title,
        "slug": document.slug,
        "message": response.message,
        "exported": response.exported,
    }


@router.put(
    "/legal-documents/{document_id}",
    summary="Update legal document (Admin)",
    description="Update an existing legal document and re-export"
)
async def admin_update_legal_document(
    document_id: int,
    data: LegalDocumentUpdate,
    admin: Company = Depends(require_role(AdminRole.EDITOR)),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a legal document.

    **Admin only** - Automatically re-exports to the static legal documents file.
    """
    logger.info(f"Admin {admin.id} updating legal document {document_id}")

    try:
        document, exported = await CMSAdminService.update_legal_document(
            db=db,
            document_id=document_id,
            **data.model_dump(exclude_unset=True)
        )
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("update legal document")

    response = _write_response("Legal document updated", exported)
    return {
        "id": document.id,
        "documentType": document.document_type.value,
        "title": document.title,
        "slug": document.slug,
        "message": response.message,
        "exported": response.exported,
    }


@router.delete(
    "/legal-documents/{document_id}",
    response_model=CMSWriteResponse,
    summary="Delete legal document (Admin)",
    description="Delete a legal document and re-export"
)
async def admin_delete_legal_document(
    document_id: int,
    admin: Company = Depends(require_role(AdminRole.EDITOR)),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a legal document.

    **Admin only** - Automatically re-exports to the static legal documents file.
    """
    logger.info(f"Admin {admin.id} deleting legal document {document_id}")

    try:
        exported = await CMSAdminService.delete_legal_document(db=db, document_id=document_id)
        return _write_response("Legal document deleted", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("delete legal document")


# ============================================================================
# Warranty Information Management
# ============================================================================

@router.get(
    "/warranties",
    summary="Get all warranties (Admin)",
    description="Retrieve all warranty information for admin management"
)
async def admin_get_warranties(
    admin: Company = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get all warranties. Admin only."""
    logger.info(f"Admin {admin.id} fetching all warranties")

    result = await CMSAdminService.get_all_warranties(db)
    return result


@router.post(
    "/warranties",
    status_code=status.HTTP_201_CREATED,
    summary="Create warranty (Admin)",
    description="Create new warranty information and export to static file"
)
async def admin_create_warranty(
    data: WarrantyCreate,
    admin: Company = Depends(require_role(AdminRole.EDITOR)),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new warranty.

    **Admin only** - Automatically exports to static file.
    """
    logger.info(f"Admin {admin.id} creating warranty: {data.title}")

    try:
        warranty, exported = await CMSAdminService.create_warranty(
            db=db,
            warranty_type=data.warranty_type,
            title=data.title,
            description=data.description,
            duration=data.duration,
            coverage=data.coverage,
            exclusions=data.exclusions,
            claim_process=data.claim_process,
            display_order=data.display_order,
            is_active=data.is_active
        )
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("create warranty")

    response = _write_response("Warranty created", exported)
    return {
        "id": warranty.id,
        "warrantyType": warranty.warranty_type,
        "title": warranty.title,
        "message": response.message,
        "exported": response.exported,
    }


@router.put(
    "/warranties/{warranty_id}",
    summary="Update warranty (Admin)",
    description="Update existing warranty and re-export"
)
async def admin_update_warranty(
    warranty_id: int,
    data: WarrantyUpdate,
    admin: Company = Depends(require_role(AdminRole.EDITOR)),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a warranty.

    **Admin only** - Automatically re-exports to static file.
    """
    logger.info(f"Admin {admin.id} updating warranty {warranty_id}")

    try:
        warranty, exported = await CMSAdminService.update_warranty(
            db=db,
            warranty_id=warranty_id,
            **data.model_dump(exclude_unset=True)
        )
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("update warranty")

    response = _write_response("Warranty updated", exported)
    return {
        "id": warranty.id,
        "warrantyType": warranty.warranty_type,
        "title": warranty.title,
        "message": response.message,
        "exported": response.exported,
    }


@router.delete(
    "/warranties/{warranty_id}",
    response_model=CMSWriteResponse,
    summary="Delete warranty (Admin)",
    description="Delete warranty and re-export"
)
async def admin_delete_warranty(
    warranty_id: int,
    admin: Company = Depends(require_role(AdminRole.EDITOR)),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a warranty.

    **Admin only** - Automatically re-exports to static file.
    """
    logger.info(f"Admin {admin.id} deleting warranty {warranty_id}")

    try:
        exported = await CMSAdminService.delete_warranty(db=db, warranty_id=warranty_id)
        return _write_response("Warranty deleted", exported)
    except (HTTPException, EagleChairException):
        raise
    except Exception:
        raise _internal_error("delete warranty")
