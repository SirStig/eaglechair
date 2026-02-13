"""
Content Routes - API v1

Public routes for traditional content managed through ContentService:
- FAQs and FAQ categories
- Team members and company information  
- Contact locations
- Product catalogs
- Installation guides (how-to documents)
- Feedback/contact form submission

These are distinct from CMS-managed content (hero slides, features, etc.) which
are in cms_content.py and cms_admin.py.

All endpoints are public, no authentication required except feedback optionally
links to company account if authenticated.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import get_optional_company
from backend.api.v1.schemas.common import MessageResponse
from backend.api.v1.schemas.content import (
    CatalogResponse,
    CompanyInfoResponse,
    ContactLocationResponse,
    FAQCategoryResponse,
    FAQResponse,
    FeedbackCreate,
    InstallationResponse,
    TeamMemberResponse,
)
from backend.database.base import get_db
from backend.models.company import Company
from backend.services.content_service import ContentService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Content"])


# ============================================================================
# FAQ Endpoints
# ============================================================================

@router.get(
    "/faq/categories",
    response_model=list[FAQCategoryResponse],
    summary="Get FAQ categories",
    description="Retrieve all FAQ categories"
)
async def get_faq_categories(
    db: AsyncSession = Depends(get_db)
):
    """
    Get all FAQ categories.
    
    **Public endpoint** - No authentication required.
    """
    logger.info("Fetching FAQ categories")
    
    categories = await ContentService.get_faq_categories(
        db=db,
        include_inactive=False
    )
    
    return categories


@router.get(
    "/faq",
    response_model=list[FAQResponse],
    summary="Get FAQs",
    description="Retrieve FAQs with optional filtering"
)
async def get_faqs(
    category_id: Optional[int] = Query(None, description="Filter by category ID"),
    search: Optional[str] = Query(None, description="Search in questions and answers"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all FAQs.
    
    **Public endpoint** - No authentication required.
    
    Supports filtering by category and searching.
    """
    logger.info(f"Fetching FAQs (category={category_id}, search='{search}')")
    
    faqs = await ContentService.get_faqs(
        db=db,
        category_id=category_id,
        search_query=search,
        include_inactive=False
    )
    
    return faqs


@router.get(
    "/faq/{faq_id}",
    response_model=FAQResponse,
    summary="Get FAQ by ID",
    description="Retrieve a specific FAQ"
)
async def get_faq(
    faq_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific FAQ by ID.
    
    **Public endpoint** - No authentication required.
    
    This increments the FAQ's view count.
    """
    logger.info(f"Fetching FAQ {faq_id}")
    
    faq = await ContentService.get_faq_by_id(
        db=db,
        faq_id=faq_id
    )
    
    return faq


# ============================================================================
# Team Endpoints
# ============================================================================

@router.get(
    "/team",
    response_model=list[TeamMemberResponse],
    summary="Get team members",
    description="Retrieve all team members"
)
async def get_team_members(
    db: AsyncSession = Depends(get_db)
):
    """
    Get all team members.
    
    **Public endpoint** - No authentication required.
    """
    logger.info("Fetching team members")
    
    team_members = await ContentService.get_team_members(
        db=db,
        include_inactive=False
    )
    
    return team_members


@router.get(
    "/team/{member_id}",
    response_model=TeamMemberResponse,
    summary="Get team member by ID",
    description="Retrieve a specific team member"
)
async def get_team_member(
    member_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific team member by ID.
    
    **Public endpoint** - No authentication required.
    """
    logger.info(f"Fetching team member {member_id}")
    
    member = await ContentService.get_team_member_by_id(
        db=db,
        member_id=member_id
    )
    
    return member


# ============================================================================
# About/Company Info Endpoints
# ============================================================================

@router.get(
    "/about",
    response_model=CompanyInfoResponse,
    summary="Get company information",
    description="Retrieve company/about us information"
)
async def get_company_info(
    db: AsyncSession = Depends(get_db)
):
    """
    Get company information.
    
    **Public endpoint** - No authentication required.
    """
    logger.info("Fetching company info")
    
    company_info = await ContentService.get_company_info(db=db)
    
    if not company_info:
        # Return empty/default response if not configured
        return CompanyInfoResponse(
            id=0,
            company_name="EagleChair",
            tagline="",
            description="",
            history="",
            mission="",
            vision=""
        )
    
    return company_info


# ============================================================================
# Contact Endpoints
# ============================================================================

@router.get(
    "/contact/locations",
    response_model=list[ContactLocationResponse],
    summary="Get contact locations",
    description="Retrieve all contact locations"
)
async def get_contact_locations(
    db: AsyncSession = Depends(get_db)
):
    """
    Get all contact locations.
    
    **Public endpoint** - No authentication required.
    """
    logger.info("Fetching contact locations")
    
    locations = await ContentService.get_contact_locations(
        db=db,
        include_inactive=False
    )
    
    return locations


@router.get(
    "/contact/locations/{location_id}",
    response_model=ContactLocationResponse,
    summary="Get contact location by ID",
    description="Retrieve a specific contact location"
)
async def get_contact_location(
    location_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific contact location by ID.
    
    **Public endpoint** - No authentication required.
    """
    logger.info(f"Fetching contact location {location_id}")
    
    location = await ContentService.get_contact_location_by_id(
        db=db,
        location_id=location_id
    )
    
    return location


# ============================================================================
# Catalog Endpoints
# ============================================================================

@router.get(
    "/catalogs",
    response_model=list[CatalogResponse],
    summary="Get catalogs",
    description="Retrieve all available catalogs"
)
async def get_catalogs(
    db: AsyncSession = Depends(get_db)
):
    """
    Get all catalogs.
    
    **Public endpoint** - No authentication required.
    """
    logger.info("Fetching catalogs")
    
    catalogs = await ContentService.get_catalogs(
        db=db,
        include_inactive=False
    )
    
    return catalogs


@router.get(
    "/catalogs/{catalog_id}",
    response_model=CatalogResponse,
    summary="Get catalog by ID",
    description="Retrieve a specific catalog"
)
async def get_catalog(
    catalog_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific catalog by ID.
    
    **Public endpoint** - No authentication required.
    """
    logger.info(f"Fetching catalog {catalog_id}")
    
    catalog = await ContentService.get_catalog_by_id(
        db=db,
        catalog_id=catalog_id
    )
    
    return catalog


@router.get(
    "/laminates",
    summary="Get laminates",
    description="Retrieve all available laminate options"
)
async def get_laminates(db: AsyncSession = Depends(get_db)):
    laminates = await ContentService.get_laminates(db=db, include_inactive=False)
    return laminates


@router.get(
    "/hardware",
    summary="Get hardware",
    description="Retrieve all available hardware options"
)
async def get_hardware(db: AsyncSession = Depends(get_db)):
    hardware = await ContentService.get_hardware(db=db, include_inactive=False)
    return hardware


# ============================================================================
# Installation Guide Endpoints
# ============================================================================

@router.get(
    "/installations",
    response_model=list[InstallationResponse],
    summary="Get installation guides",
    description="Retrieve all installation guides"
)
async def get_installation_guides(
    db: AsyncSession = Depends(get_db)
):
    """
    Get all installation guides.
    
    **Public endpoint** - No authentication required.
    """
    logger.info("Fetching installation guides")
    
    guides = await ContentService.get_installation_guides(
        db=db,
        include_inactive=False
    )
    
    return guides


@router.get(
    "/installations/{guide_id}",
    response_model=InstallationResponse,
    summary="Get installation guide by ID",
    description="Retrieve a specific installation guide"
)
async def get_installation_guide(
    guide_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific installation guide by ID.
    
    **Public endpoint** - No authentication required.
    """
    logger.info(f"Fetching installation guide {guide_id}")
    
    guide = await ContentService.get_installation_guide_by_id(
        db=db,
        guide_id=guide_id
    )
    
    return guide


# ============================================================================
# Feedback Endpoints
# ============================================================================

@router.post(
    "/feedback",
    response_model=MessageResponse,
    status_code=201,
    summary="Submit feedback",
    description="Submit feedback or contact form"
)
async def submit_feedback(
    feedback_data: FeedbackCreate,
    db: AsyncSession = Depends(get_db),
    company: Optional[Company] = Depends(get_optional_company)
):
    """
    Submit feedback or contact form.
    
    **Public endpoint** - Authentication optional.
    
    If authenticated as a company, the feedback will be linked to your account.
    """
    logger.info(f"Feedback submission from {feedback_data.email}")
    
    await ContentService.create_feedback(
        db=db,
        name=feedback_data.name,
        email=feedback_data.email,
        subject=feedback_data.subject,
        message=feedback_data.message,
        company_id=company.id if company else None
    )
    
    return MessageResponse(
        message="Thank you for your feedback!",
        detail="We've received your message and will get back to you as soon as possible."
    )

