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
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import FileResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from backend.api.v1.routes.admin.upload import UPLOAD_BASE_DIR

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
from backend.services import pdf_cover_service
from backend.services.content_service import ContentService
from backend.services.email_service import EmailService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Content"])


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


def _cover_response(cover: Path, if_none_match: str | None, versioned: bool) -> Response:
    """Serve a cached PDF cover; versioned URLs (?v=mtime) never change, others revalidate hourly."""
    etag = f'"{cover.stem}"'
    headers = {
        "Cache-Control": "public, max-age=31536000, immutable" if versioned else "public, max-age=3600",
        "ETag": etag,
    }
    if if_none_match and etag in if_none_match:
        return Response(status_code=304, headers=headers)
    return FileResponse(cover, media_type="image/webp", headers=headers)


@router.get(
    "/document-cover",
    summary="Get a PDF's first page as a cover image",
    description="Renders (and caches) the first page of an uploaded PDF under /uploads/documents as WebP"
)
async def get_document_cover(
    url: str = Query(..., max_length=1000, description="Document URL (/uploads/documents/...)"),
    v: Optional[int] = Query(None, description="Cache-busting version (PDF modification time)"),
    if_none_match: str | None = Header(None, alias="If-None-Match"),
):
    cover = await run_in_threadpool(pdf_cover_service.get_cover, url, Path(UPLOAD_BASE_DIR))
    if cover is None:
        raise HTTPException(status_code=404, detail="No cover available for this document")
    return _cover_response(cover, if_none_match, versioned=v is not None)


@router.get(
    "/catalogs/{catalog_id}/pdf-thumbnail",
    summary="Get PDF first page as thumbnail",
    description="Renders the first page of a catalog PDF as an image when no cover image exists"
)
async def get_catalog_pdf_thumbnail(
    catalog_id: int,
    if_none_match: str | None = Header(None, alias="If-None-Match"),
    db: AsyncSession = Depends(get_db)
):
    catalog = await ContentService.get_catalog_by_id(db=db, catalog_id=catalog_id)
    file_url = (catalog.file_url or "").strip()
    cover = await run_in_threadpool(pdf_cover_service.get_cover, file_url, Path(UPLOAD_BASE_DIR))
    if cover is None and file_url and "/uploads/" not in file_url:
        # Legacy rows store a bare filename for files in the catalogs folder
        legacy = f"/uploads/documents/catalogs/{Path(file_url).name}"
        cover = await run_in_threadpool(pdf_cover_service.get_cover, legacy, Path(UPLOAD_BASE_DIR))
    if cover is None:
        raise HTTPException(status_code=404, detail="No cover available for this catalog")
    return _cover_response(cover, if_none_match, versioned=False)


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


# The installation list (GET /installations, with project_type filter) lives in
# cms_content.py and returns the same shape as galleryImages in contentData.json.

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


@router.post(
    "/feedback",
    response_model=MessageResponse,
    status_code=201,
    summary="Submit feedback",
    description="Submit feedback or contact form"
)
async def submit_feedback(
    feedback_data: FeedbackCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    company: Optional[Company] = Depends(get_optional_company)
):
    """
    Submit feedback or contact form.
    
    **Public endpoint** - Authentication optional.
    
    Admins are notified by email (ADMIN_EMAIL).
    """
    logger.info(f"Feedback submission from {feedback_data.email}")
    
    company_name = feedback_data.company_name or (company.company_name if company else None)
    await ContentService.create_feedback(
        db=db,
        name=feedback_data.name,
        email=feedback_data.email,
        subject=feedback_data.subject,
        message=feedback_data.message,
        phone=feedback_data.phone,
        company_name=company_name,
        feedback_type=feedback_data.feedback_type,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    EmailService.send_in_background(
        EmailService.send_admin_contact_notification,
        name=feedback_data.name,
        email=feedback_data.email,
        message=feedback_data.message,
        subject=feedback_data.subject,
        phone=feedback_data.phone,
        company_name=company_name,
    )
    
    return MessageResponse(
        message="Thank you for your feedback!",
        detail="We've received your message and will get back to you as soon as possible."
    )

