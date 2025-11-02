"""
Admin Company Routes

Admin-only endpoints for company management
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import get_current_admin, require_role
from backend.api.v1.schemas.admin import CompanyInviteRequest, CompanyListResponse, CompanyStatusUpdate
from backend.api.v1.schemas.common import MessageResponse
from backend.api.v1.schemas.company import CompanyAdminUpdate, CompanyResponse
from backend.core.config import settings
from backend.core.exceptions import ResourceAlreadyExistsError, ResourceNotFoundError, ValidationError
from backend.database.base import get_db
from backend.models.company import (
    AdminRole,
    AdminUser,
    Company,
    CompanyPricing,
    CompanyStatus,
)
from backend.services.admin_service import AdminService
from backend.services.email_service import EmailService
from backend.utils.serializers import orm_list_to_dict_list, orm_to_dict

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin - Companies"])


@router.get(
    "",
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
    
    # Convert ORM objects to dicts
    companies_data = orm_list_to_dict_list(companies)
    
    response_data = {
        "items": companies_data,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "pages": (total_count + page_size - 1) // page_size
    }
    
    return response_data


@router.get(
    "/{company_id}",
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
        # Fetch company
        result = await db.execute(
            select(Company).where(Company.id == company_id)
        )
        company = result.scalar_one_or_none()
        
        if not company:
            raise ResourceNotFoundError(resource_type="Company", resource_id=company_id)
        
        return orm_to_dict(company)
        
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch(
    "/{company_id}/status",
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
        return orm_to_dict(company)
        
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch(
    "/{company_id}",
    response_model=CompanyResponse,
    summary="Update company (Admin)",
    description="Update company with full admin access to all fields"
)
async def update_company(
    company_id: int,
    update_data: CompanyAdminUpdate,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """
    Update company with full admin access.
    
    **Admin only** - Requires admin role.
    """
    logger.info(f"Admin {admin.username} updating company {company_id}")
    
    try:
        from sqlalchemy import select
        
        # Fetch company
        result = await db.execute(
            select(Company).where(Company.id == company_id)
        )
        company = result.scalar_one_or_none()
        
        if not company:
            raise ResourceNotFoundError(resource_type="Company", resource_id=company_id)
        
        # Update fields from update_data
        update_dict = update_data.model_dump(exclude_unset=True)
        
        # Validate pricing_tier_id if provided
        if 'pricing_tier_id' in update_dict and update_dict['pricing_tier_id'] is not None:
            tier_id = update_dict['pricing_tier_id']
            tier_stmt = select(CompanyPricing).where(
                CompanyPricing.id == tier_id,
                CompanyPricing.company_id.is_(None)  # Only reusable tiers
            )
            tier_result = await db.execute(tier_stmt)
            pricing_tier = tier_result.scalar_one_or_none()
            
            if not pricing_tier:
                raise HTTPException(
                    status_code=404,
                    detail=f"Pricing tier {tier_id} not found or not reusable"
                )
        
        # Handle status conversion if needed
        if 'status' in update_dict and isinstance(update_dict['status'], str):
            try:
                update_dict['status'] = CompanyStatus(update_dict['status'])
            except ValueError:
                raise ValidationError(f"Invalid status: {update_dict['status']}")
        
        for field, value in update_dict.items():
            if hasattr(company, field):
                setattr(company, field, value)
        
        await db.commit()
        await db.refresh(company)
        
        return orm_to_dict(company)
        
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete(
    "/{company_id}",
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


# ============================================================================
# Company Pricing Tier Management (NEW)
# ============================================================================

@router.get(
    "/{company_id}/pricing-tier",
    summary="Get company pricing tier (Admin)",
    description="Get the currently assigned pricing tier for a company"
)
async def get_company_pricing_tier(
    company_id: int,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get company's active pricing tier. Admin only."""
    from sqlalchemy import select
    
    logger.info(f"Admin {admin.username} fetching pricing tier for company {company_id}")
    
    stmt = (
        select(Company, CompanyPricing)
        .outerjoin(CompanyPricing, Company.pricing_tier_id == CompanyPricing.id)
        .where(Company.id == company_id)
    )
    result = await db.execute(stmt)
    row = result.first()
    
    if not row or not row[0]:
        raise HTTPException(status_code=404, detail=f"Company {company_id} not found")
    
    company, pricing_tier = row
    
    if not pricing_tier:
        return {
            "company_id": company_id,
            "company_name": company.company_name,
            "pricing_tier": None,
            "message": "No pricing tier assigned (standard pricing)"
        }

    return {
        "company_id": company_id,
        "company_name": company.company_name,
        "pricing_tier": orm_to_dict(pricing_tier)
    }


@router.post(
    "/{company_id}/pricing-tier",
    summary="Assign pricing tier to company (Admin)",
    description="Create and assign a new pricing tier to a company"
)
async def assign_pricing_tier(
    company_id: int,
    pricing_tier_name: Optional[str] = None,
    percentage_adjustment: int = 0,
    applies_to_all_products: bool = True,
    specific_categories: Optional[list[int]] = None,
    effective_from: Optional[str] = None,
    expires_at: Optional[str] = None,
    admin_notes: Optional[str] = None,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """
    Create and assign a pricing tier to a company.
    
    **Admin only** - Requires admin role.
    """
    from datetime import date

    from sqlalchemy import select
    
    logger.info(f"Admin {admin.username} creating pricing tier for company {company_id}")
    
    # Verify company exists
    stmt = select(Company).where(Company.id == company_id)
    result = await db.execute(stmt)
    company = result.scalar_one_or_none()
    
    if not company:
        raise HTTPException(status_code=404, detail=f"Company {company_id} not found")
    
    # Parse dates if provided
    effective_from_date = None
    expires_at_date = None
    
    if effective_from:
        try:
            effective_from_date = date.fromisoformat(effective_from)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid effective_from date format (use YYYY-MM-DD)")
    
    if expires_at:
        try:
            expires_at_date = date.fromisoformat(expires_at)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid expires_at date format (use YYYY-MM-DD)")
    
    # Create pricing tier
    pricing_tier = CompanyPricing(
        company_id=company_id,
        pricing_tier_name=pricing_tier_name,
        percentage_adjustment=percentage_adjustment,
        applies_to_all_products=applies_to_all_products,
        specific_categories=specific_categories,
        effective_from=effective_from_date,
        expires_at=expires_at_date,
        is_active=True,
        admin_notes=admin_notes
    )
    
    db.add(pricing_tier)
    await db.flush()  # Get the pricing tier ID
    
    # Assign to company
    company.pricing_tier_id = pricing_tier.id
    
    await db.commit()
    await db.refresh(pricing_tier)
    
    logger.info(
        f"Created pricing tier '{pricing_tier_name}' ({percentage_adjustment}%) "
        f"for company {company.company_name}"
    )
    
    return {
        "message": "Pricing tier assigned successfully",
        "pricing_tier": orm_to_dict(pricing_tier),
        "company_name": company.company_name
    }


@router.put(
    "/{company_id}/pricing-tier/{tier_id}",
    summary="Update pricing tier (Admin)",
    description="Update an existing pricing tier"
)
async def update_pricing_tier(
    company_id: int,
    tier_id: int,
    pricing_tier_name: Optional[str] = None,
    percentage_adjustment: Optional[int] = None,
    applies_to_all_products: Optional[bool] = None,
    specific_categories: Optional[list[int]] = None,
    effective_from: Optional[str] = None,
    expires_at: Optional[str] = None,
    is_active: Optional[bool] = None,
    admin_notes: Optional[str] = None,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """
    Update an existing pricing tier.
    
    **Admin only** - Requires admin role.
    """
    from datetime import date

    from sqlalchemy import select
    
    logger.info(f"Admin {admin.username} updating pricing tier {tier_id} for company {company_id}")
    
    stmt = select(CompanyPricing).where(
        CompanyPricing.id == tier_id,
        CompanyPricing.company_id == company_id
    )
    result = await db.execute(stmt)
    pricing_tier = result.scalar_one_or_none()
    
    if not pricing_tier:
        raise HTTPException(
            status_code=404, 
            detail=f"Pricing tier {tier_id} not found for company {company_id}"
        )
    
    # Update fields
    if pricing_tier_name is not None:
        pricing_tier.pricing_tier_name = pricing_tier_name
    if percentage_adjustment is not None:
        pricing_tier.percentage_adjustment = percentage_adjustment
    if applies_to_all_products is not None:
        pricing_tier.applies_to_all_products = applies_to_all_products
    if specific_categories is not None:
        pricing_tier.specific_categories = specific_categories
    if is_active is not None:
        pricing_tier.is_active = is_active
    if admin_notes is not None:
        pricing_tier.admin_notes = admin_notes
    
    # Parse and update dates
    if effective_from is not None:
        try:
            pricing_tier.effective_from = date.fromisoformat(effective_from)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid effective_from date format (use YYYY-MM-DD)")
    
    if expires_at is not None:
        try:
            pricing_tier.expires_at = date.fromisoformat(expires_at)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid expires_at date format (use YYYY-MM-DD)")
    
    await db.commit()
    await db.refresh(pricing_tier)
    
    return orm_to_dict(pricing_tier)


@router.delete(
    "/{company_id}/pricing-tier",
    response_model=MessageResponse,
    summary="Remove pricing tier from company (Admin)",
    description="Remove pricing tier assignment (revert to standard pricing)"
)
async def remove_pricing_tier(
    company_id: int,
    delete_tier: bool = Query(False, description="Also delete the pricing tier record"),
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """
    Remove pricing tier from company.
    
    **Admin only** - Requires admin role.
    """
    from sqlalchemy import select
    
    logger.info(f"Admin {admin.username} removing pricing tier from company {company_id}")
    
    stmt = select(Company).where(Company.id == company_id)
    result = await db.execute(stmt)
    company = result.scalar_one_or_none()
    
    if not company:
        raise HTTPException(status_code=404, detail=f"Company {company_id} not found")
    
    if not company.pricing_tier_id:
        return MessageResponse(message="Company has no pricing tier assigned")
    
    tier_id = company.pricing_tier_id
    company.pricing_tier_id = None
    
    if delete_tier:
        # Delete the pricing tier record
        tier_stmt = select(CompanyPricing).where(CompanyPricing.id == tier_id)
        tier_result = await db.execute(tier_stmt)
        tier = tier_result.scalar_one_or_none()
        if tier:
            await db.delete(tier)
    
    await db.commit()
    
    return MessageResponse(
        message=f"Pricing tier removed from company {company.company_name}. " +
                ("Tier record deleted." if delete_tier else "Tier record preserved.")
    )


@router.get(
    "/pricing-tiers",
    summary="List all pricing tiers (Admin)",
    description="Get all pricing tiers across all companies"
)
async def list_all_pricing_tiers(
    company_id: Optional[int] = Query(None, description="Filter by company ID"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get all pricing tiers. Admin only."""
    from sqlalchemy import select
    
    logger.info(f"Admin {admin.username} fetching all pricing tiers")
    
    query = select(CompanyPricing, Company).join(Company, CompanyPricing.company_id == Company.id)
    
    if company_id:
        query = query.where(CompanyPricing.company_id == company_id)
    
    if is_active is not None:
        query = query.where(CompanyPricing.is_active == is_active)
    
    query = query.order_by(Company.company_name, CompanyPricing.created_at.desc())
    
    result = await db.execute(query)
    rows = result.all()
    
    tiers = []
    for pricing_tier, company in rows:
        tiers.append({
            "id": pricing_tier.id,
            "company_id": company.id,
            "company_name": company.company_name,
            "pricing_tier_name": pricing_tier.pricing_tier_name,
            "percentage_adjustment": pricing_tier.percentage_adjustment,
            "applies_to_all_products": pricing_tier.applies_to_all_products,
            "specific_categories": pricing_tier.specific_categories,
            "effective_from": pricing_tier.effective_from.isoformat() if pricing_tier.effective_from else None,
            "expires_at": pricing_tier.expires_at.isoformat() if pricing_tier.expires_at else None,
            "is_active": pricing_tier.is_active,
            "admin_notes": pricing_tier.admin_notes
        })
    
    return tiers


@router.post(
    "/invite",
    response_model=MessageResponse,
    summary="Invite company (Admin)",
    description="Send invitation email to a company to create an account"
)
async def invite_company(
    invite_data: CompanyInviteRequest,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """
    Send invitation email to a company to create an account.
    
    **Admin only** - Requires admin role.
    
    The invitation email will contain a link to the registration page.
    """
    logger.info(f"Admin {admin.username} inviting company: {invite_data.company_name} ({invite_data.email})")
    
    try:
        # Check if company with this email already exists
        result = await db.execute(
            select(Company).where(Company.rep_email == invite_data.email)
        )
        existing_company = result.scalar_one_or_none()
        
        if existing_company:
            raise ResourceAlreadyExistsError(
                resource_type="Company",
                field="email"
            )
        
        # Generate registration URL
        registration_url = f"{settings.FRONTEND_URL}/register"
        
        # Send invitation email
        inviter_name = f"{admin.first_name} {admin.last_name}".strip() if (admin.first_name or admin.last_name) else admin.username
        
        email_sent = await EmailService.send_company_invite(
            db=db,
            to_email=invite_data.email,
            company_name=invite_data.company_name,
            registration_url=registration_url,
            inviter_name=inviter_name if inviter_name != admin.username else None
        )
        
        if not email_sent:
            raise HTTPException(
                status_code=500,
                detail="Failed to send invitation email. Please check email configuration and try again."
            )
        
        logger.info(f"Invitation email sent successfully to {invite_data.email}")
        
        return MessageResponse(
            message=f"Invitation email sent successfully to {invite_data.email}"
        )
        
    except (ResourceAlreadyExistsError, ValidationError) as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    except Exception as e:
        logger.error(f"Error sending company invitation: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send invitation: {str(e)}"
        )
