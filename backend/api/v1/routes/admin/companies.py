"""
Admin Company Routes

Admin-only endpoints for company management
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.base import get_db
from backend.api.dependencies import get_current_admin, require_role
from backend.services.admin_service import AdminService
from backend.models.company import AdminRole, CompanyStatus, AdminUser
from backend.api.v1.schemas.company import CompanyResponse
from backend.api.v1.schemas.admin import (
    CompanyListResponse,
    CompanyStatusUpdate
)
from backend.api.v1.schemas.common import MessageResponse
from backend.core.exceptions import ResourceNotFoundError, ValidationError


logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin - Companies"])


@router.get(
    "/companies",
    response_model=CompanyListResponse,
    summary="Get all companies (Admin)",
    description="Retrieve all companies with pagination and filtering"
)
async def get_all_companies(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search term"),
    status: Optional[CompanyStatus] = Query(None, description="Filter by status"),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all companies with admin filtering options.
    
    **Admin only** - Requires admin authentication.
    """
    logger.info(f"Admin {admin.username} fetching companies (page {page})")
    
    companies, total_count = await AdminService.get_all_companies(
        db=db,
        page=page,
        page_size=page_size,
        search=search,
        status=status
    )
    
    return CompanyListResponse(
        items=companies,
        total=total_count,
        page=page,
        page_size=page_size,
        pages=(total_count + page_size - 1) // page_size
    )


@router.get(
    "/companies/{company_id}",
    response_model=CompanyResponse,
    summary="Get company by ID (Admin)",
    description="Retrieve a specific company"
)
async def get_company(
    company_id: int,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Get company by ID.
    
    **Admin only** - Requires admin authentication.
    """
    logger.info(f"Admin {admin.username} fetching company {company_id}")
    
    try:
        # Use existing auth service for company retrieval
        from backend.services.auth_service import AuthService
        company = await AuthService.get_company_by_id(db, company_id)
        return company
        
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch(
    "/companies/{company_id}/status",
    response_model=CompanyResponse,
    summary="Update company status (Admin)",
    description="Update company status and add admin notes"
)
async def update_company_status(
    company_id: int,
    status_data: CompanyStatusUpdate,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """
    Update company status.
    
    **Admin only** - Requires admin role.
    """
    logger.info(f"Admin {admin.username} updating company {company_id} status to {status_data.status}")
    
    try:
        company = await AdminService.update_company_status(
            db=db,
            company_id=company_id,
            status=status_data.status,
            admin_notes=status_data.admin_notes
        )
        
        return company
        
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete(
    "/companies/{company_id}",
    response_model=MessageResponse,
    summary="Suspend company (Admin)",
    description="Suspend a company account"
)
async def suspend_company(
    company_id: int,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """
    Suspend a company account.
    
    **Admin only** - Requires admin role.
    """
    logger.info(f"Admin {admin.username} suspending company {company_id}")
    
    try:
        company = await AdminService.update_company_status(
            db=db,
            company_id=company_id,
            status=CompanyStatus.SUSPENDED,
            admin_notes=f"Suspended by admin {admin.username}"
        )
        
        return MessageResponse(
            message=f"Company {company_id} has been suspended successfully"
        )
        
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
