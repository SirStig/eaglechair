"""
Admin Pricing Tier Routes

Admin-only endpoints for managing reusable pricing tiers
"""

import logging
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.api.dependencies import get_current_admin, require_role
from backend.api.v1.schemas.common import MessageResponse
from backend.core.exceptions import ResourceNotFoundError
from backend.database.base import get_db
from backend.models.company import AdminRole, AdminUser, Company, CompanyPricing
from backend.utils.serializers import orm_list_to_dict_list, orm_to_dict

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin - Pricing Tiers"])


@router.get(
    "",
    summary="List all pricing tiers (Admin)",
    description="Get all reusable pricing tiers (where company_id is NULL)"
)
async def list_pricing_tiers(
    include_inactive: bool = Query(False, description="Include inactive tiers"),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    List all reusable pricing tiers.
    
    **Admin only** - Requires admin authentication.
    """
    logger.info(f"Admin {admin.username} listing pricing tiers")
    
    stmt = select(CompanyPricing).where(CompanyPricing.company_id.is_(None))
    
    if not include_inactive:
        stmt = stmt.where(CompanyPricing.is_active == True)
    
    stmt = stmt.order_by(CompanyPricing.pricing_tier_name)
    
    result = await db.execute(stmt)
    tiers = result.scalars().all()
    
    # Get count of companies using each tier
    tiers_data = []
    for tier in tiers:
        tier_dict = orm_to_dict(tier)
        
        # Count companies using this tier
        companies_count_stmt = select(func.count(Company.id)).where(
            Company.pricing_tier_id == tier.id
        )
        companies_count_result = await db.execute(companies_count_stmt)
        companies_count = companies_count_result.scalar() or 0
        
        tier_dict['companies_count'] = companies_count
        
        # Get list of company IDs using this tier (optional, for admin info)
        companies_stmt = select(Company.id, Company.company_name).where(
            Company.pricing_tier_id == tier.id
        ).limit(10)  # Limit to first 10 for preview
        companies_result = await db.execute(companies_stmt)
        companies_list = [
            {"id": row[0], "name": row[1]} 
            for row in companies_result
        ]
        tier_dict['assigned_companies'] = companies_list
        tier_dict['total_assigned_companies'] = companies_count
        
        tiers_data.append(tier_dict)
    
    return {
        "items": tiers_data,
        "total": len(tiers_data)
    }


@router.get(
    "/{tier_id}",
    summary="Get pricing tier details (Admin)",
    description="Get detailed information about a specific pricing tier"
)
async def get_pricing_tier(
    tier_id: int,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Get pricing tier details including all assigned companies.
    
    **Admin only** - Requires admin authentication.
    """
    logger.info(f"Admin {admin.username} fetching pricing tier {tier_id}")
    
    stmt = select(CompanyPricing).where(
        CompanyPricing.id == tier_id,
        CompanyPricing.company_id.is_(None)  # Only reusable tiers
    )
    result = await db.execute(stmt)
    tier = result.scalar_one_or_none()
    
    if not tier:
        raise HTTPException(
            status_code=404,
            detail=f"Pricing tier {tier_id} not found"
        )
    
    tier_dict = orm_to_dict(tier)
    
    # Get all companies using this tier
    companies_stmt = select(Company).where(
        Company.pricing_tier_id == tier_id
    )
    companies_result = await db.execute(companies_stmt)
    companies = companies_result.scalars().all()
    
    tier_dict['assigned_companies'] = orm_list_to_dict_list(companies)
    tier_dict['companies_count'] = len(companies)
    
    return tier_dict


@router.post(
    "",
    summary="Create pricing tier (Admin)",
    description="Create a new reusable pricing tier"
)
async def create_pricing_tier(
    pricing_tier_name: str,
    percentage_adjustment: int,
    applies_to_all_products: bool = True,
    specific_categories: Optional[List[int]] = None,
    effective_from: Optional[str] = None,
    expires_at: Optional[str] = None,
    is_active: bool = True,
    admin_notes: Optional[str] = None,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new reusable pricing tier.
    
    **Admin only** - Requires admin role.
    """
    logger.info(f"Admin {admin.username} creating pricing tier '{pricing_tier_name}'")
    
    # Validate percentage_adjustment range (reasonable limits: -50% to +100%)
    if percentage_adjustment < -50 or percentage_adjustment > 100:
        raise HTTPException(
            status_code=400,
            detail="Percentage adjustment must be between -50 and 100"
        )
    
    # Check if tier name already exists (for reusable tiers)
    existing_stmt = select(CompanyPricing).where(
        CompanyPricing.pricing_tier_name == pricing_tier_name,
        CompanyPricing.company_id.is_(None)
    )
    existing_result = await db.execute(existing_stmt)
    existing = existing_result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Pricing tier with name '{pricing_tier_name}' already exists"
        )
    
    # Parse dates if provided
    effective_from_date = None
    expires_at_date = None
    
    if effective_from:
        try:
            effective_from_date = date.fromisoformat(effective_from)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid effective_from date format (use YYYY-MM-DD)"
            )
    
    if expires_at:
        try:
            expires_at_date = date.fromisoformat(expires_at)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid expires_at date format (use YYYY-MM-DD)"
            )
    
    # Validate date range
    if effective_from_date and expires_at_date:
        if effective_from_date > expires_at_date:
            raise HTTPException(
                status_code=400,
                detail="effective_from date must be before expires_at date"
            )
    
    # Validate specific_categories if not applies_to_all_products
    if not applies_to_all_products and (not specific_categories or len(specific_categories) == 0):
        raise HTTPException(
            status_code=400,
            detail="specific_categories must be provided when applies_to_all_products is False"
        )
    
    # Create pricing tier (company_id is NULL for reusable tiers)
    pricing_tier = CompanyPricing(
        company_id=None,  # Reusable tier
        pricing_tier_name=pricing_tier_name,
        percentage_adjustment=percentage_adjustment,
        applies_to_all_products=applies_to_all_products,
        specific_categories=specific_categories,
        effective_from=effective_from_date,
        expires_at=expires_at_date,
        is_active=is_active,
        admin_notes=admin_notes
    )
    
    db.add(pricing_tier)
    await db.commit()
    await db.refresh(pricing_tier)
    
    logger.info(
        f"Created pricing tier '{pricing_tier_name}' (ID: {pricing_tier.id}, "
        f"adjustment: {percentage_adjustment}%)"
    )
    
    return orm_to_dict(pricing_tier)


@router.put(
    "/{tier_id}",
    summary="Update pricing tier (Admin)",
    description="Update an existing reusable pricing tier"
)
async def update_pricing_tier(
    tier_id: int,
    pricing_tier_name: Optional[str] = None,
    percentage_adjustment: Optional[int] = None,
    applies_to_all_products: Optional[bool] = None,
    specific_categories: Optional[List[int]] = None,
    effective_from: Optional[str] = None,
    expires_at: Optional[str] = None,
    is_active: Optional[bool] = None,
    admin_notes: Optional[str] = None,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """
    Update an existing reusable pricing tier.
    
    **Admin only** - Requires admin role.
    """
    logger.info(f"Admin {admin.username} updating pricing tier {tier_id}")
    
    stmt = select(CompanyPricing).where(
        CompanyPricing.id == tier_id,
        CompanyPricing.company_id.is_(None)  # Only reusable tiers
    )
    result = await db.execute(stmt)
    pricing_tier = result.scalar_one_or_none()
    
    if not pricing_tier:
        raise HTTPException(
            status_code=404,
            detail=f"Pricing tier {tier_id} not found"
        )
    
    # Validate percentage_adjustment if provided
    if percentage_adjustment is not None:
        if percentage_adjustment < -50 or percentage_adjustment > 100:
            raise HTTPException(
                status_code=400,
                detail="Percentage adjustment must be between -50 and 100"
            )
    
    # Check if new tier name conflicts with existing tier
    if pricing_tier_name and pricing_tier_name != pricing_tier.pricing_tier_name:
        existing_stmt = select(CompanyPricing).where(
            CompanyPricing.pricing_tier_name == pricing_tier_name,
            CompanyPricing.company_id.is_(None),
            CompanyPricing.id != tier_id
        )
        existing_result = await db.execute(existing_stmt)
        existing = existing_result.scalar_one_or_none()
        
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Pricing tier with name '{pricing_tier_name}' already exists"
            )
    
    # Update fields
    if pricing_tier_name is not None:
        pricing_tier.pricing_tier_name = pricing_tier_name
    if percentage_adjustment is not None:
        pricing_tier.percentage_adjustment = percentage_adjustment
    if applies_to_all_products is not None:
        pricing_tier.applies_to_all_products = applies_to_all_products
    if specific_categories is not None:
        pricing_tier.specific_categories = specific_categories if len(specific_categories) > 0 else None
    if is_active is not None:
        pricing_tier.is_active = is_active
    if admin_notes is not None:
        pricing_tier.admin_notes = admin_notes
    
    # Parse and update dates
    if effective_from is not None:
        try:
            pricing_tier.effective_from = date.fromisoformat(effective_from) if effective_from else None
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid effective_from date format (use YYYY-MM-DD)"
            )
    
    if expires_at is not None:
        try:
            pricing_tier.expires_at = date.fromisoformat(expires_at) if expires_at else None
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid expires_at date format (use YYYY-MM-DD)"
            )
    
    # Validate date range
    if pricing_tier.effective_from and pricing_tier.expires_at:
        if pricing_tier.effective_from > pricing_tier.expires_at:
            raise HTTPException(
                status_code=400,
                detail="effective_from date must be before expires_at date"
            )
    
    # Validate specific_categories if not applies_to_all_products
    if pricing_tier.applies_to_all_products == False:
        if not pricing_tier.specific_categories or len(pricing_tier.specific_categories) == 0:
            raise HTTPException(
                status_code=400,
                detail="specific_categories must be provided when applies_to_all_products is False"
            )
    
    await db.commit()
    await db.refresh(pricing_tier)
    
    logger.info(f"Updated pricing tier {tier_id}")
    
    return orm_to_dict(pricing_tier)


@router.delete(
    "/{tier_id}",
    response_model=MessageResponse,
    summary="Delete pricing tier (Admin)",
    description="Delete a reusable pricing tier (will unassign from all companies)"
)
async def delete_pricing_tier(
    tier_id: int,
    force: bool = Query(False, description="Force delete even if companies are using it"),
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a reusable pricing tier.
    
    If companies are using this tier, they will be unassigned (pricing_tier_id set to NULL)
    unless force=True, which will also delete company-specific records.
    
    **Admin only** - Requires admin role.
    """
    logger.info(f"Admin {admin.username} deleting pricing tier {tier_id}")
    
    stmt = select(CompanyPricing).where(
        CompanyPricing.id == tier_id,
        CompanyPricing.company_id.is_(None)  # Only reusable tiers
    )
    result = await db.execute(stmt)
    pricing_tier = result.scalar_one_or_none()
    
    if not pricing_tier:
        raise HTTPException(
            status_code=404,
            detail=f"Pricing tier {tier_id} not found"
        )
    
    # Check how many companies are using this tier
    companies_count_stmt = select(func.count(Company.id)).where(
        Company.pricing_tier_id == tier_id
    )
    companies_count_result = await db.execute(companies_count_stmt)
    companies_count = companies_count_result.scalar() or 0
    
    # Unassign tier from all companies
    if companies_count > 0:
        update_stmt = select(Company).where(Company.pricing_tier_id == tier_id)
        update_result = await db.execute(update_stmt)
        companies = update_result.scalars().all()
        
        for company in companies:
            company.pricing_tier_id = None
        
        logger.info(f"Unassigned pricing tier {tier_id} from {companies_count} companies")
    
    # Delete the tier
    await db.delete(pricing_tier)
    await db.commit()
    
    message = f"Pricing tier '{pricing_tier.pricing_tier_name}' deleted successfully"
    if companies_count > 0:
        message += f". Unassigned from {companies_count} companies."
    
    logger.info(f"Deleted pricing tier {tier_id}")
    
    return MessageResponse(message=message)

