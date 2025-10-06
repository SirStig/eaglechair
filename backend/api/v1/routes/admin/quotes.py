"""
Admin Quote Routes

Admin-only endpoints for quote management
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.base import get_db
from backend.api.dependencies import get_current_admin, require_role
from backend.services.admin_service import AdminService
from backend.models.company import AdminRole, AdminUser
from backend.models.quote import QuoteStatus
from backend.api.v1.schemas.quote import QuoteResponse
from backend.api.v1.schemas.admin import (
    QuoteListResponse,
    QuoteStatusUpdate
)
from backend.api.v1.schemas.common import MessageResponse
from backend.core.exceptions import ResourceNotFoundError, ValidationError


logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin - Quotes"])


@router.get(
    "/quotes",
    response_model=QuoteListResponse,
    summary="Get all quotes (Admin)",
    description="Retrieve all quotes with pagination and filtering"
)
async def get_all_quotes(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    status: Optional[QuoteStatus] = Query(None, description="Filter by status"),
    company_id: Optional[int] = Query(None, description="Filter by company"),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all quotes with admin filtering options.
    
    **Admin only** - Requires admin authentication.
    """
    logger.info(f"Admin {admin.username} fetching quotes (page {page})")
    
    quotes, total_count = await AdminService.get_all_quotes(
        db=db,
        page=page,
        page_size=page_size,
        status=status,
        company_id=company_id
    )
    
    return QuoteListResponse(
        items=quotes,
        total=total_count,
        page=page,
        page_size=page_size,
        pages=(total_count + page_size - 1) // page_size
    )


@router.get(
    "/quotes/{quote_id}",
    response_model=QuoteResponse,
    summary="Get quote by ID (Admin)",
    description="Retrieve a specific quote"
)
async def get_quote(
    quote_id: int,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Get quote by ID.
    
    **Admin only** - Requires admin authentication.
    """
    logger.info(f"Admin {admin.username} fetching quote {quote_id}")
    
    try:
        # Use existing quote service for single quote retrieval
        from backend.services.quote_service import QuoteService
        quote = await QuoteService.get_quote_by_id(db, quote_id, admin_id=admin.id)
        return quote
        
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch(
    "/quotes/{quote_id}/status",
    response_model=QuoteResponse,
    summary="Update quote status (Admin)",
    description="Update quote status, pricing, and notes"
)
async def update_quote_status(
    quote_id: int,
    status_data: QuoteStatusUpdate,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """
    Update quote status and pricing.
    
    **Admin only** - Requires admin role.
    """
    logger.info(f"Admin {admin.username} updating quote {quote_id} status to {status_data.status}")
    
    try:
        quote = await AdminService.update_quote_status(
            db=db,
            quote_id=quote_id,
            status=status_data.status,
            quoted_price=status_data.quoted_price,
            quoted_lead_time=status_data.quoted_lead_time,
            quote_notes=status_data.quote_notes,
            admin_notes=status_data.admin_notes
        )
        
        return quote
        
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/quotes/{quote_id}/assign",
    response_model=QuoteResponse,
    summary="Assign quote to admin (Admin)",
    description="Assign a quote to a specific admin for handling"
)
async def assign_quote(
    quote_id: int,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """
    Assign a quote to the current admin.
    
    **Admin only** - Requires admin role.
    """
    logger.info(f"Admin {admin.username} assigning quote {quote_id} to themselves")
    
    try:
        quote = await AdminService.update_quote_status(
            db=db,
            quote_id=quote_id,
            status=QuoteStatus.PENDING,  # Keep current status
            admin_notes=f"Assigned to admin {admin.username}"
        )
        
        # Update assigned admin
        quote.assigned_to_admin_id = admin.id
        await db.commit()
        await db.refresh(quote)
        
        return quote
        
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
