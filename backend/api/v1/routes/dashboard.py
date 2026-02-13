"""
Dashboard Routes - API v1

Dashboard endpoints for authenticated companies (separate from quotes/cart routes)
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.api.dependencies import get_current_company
from backend.api.v1.schemas.company import (
    CompanyShippingAddressCreate,
    CompanyShippingAddressResponse,
    CompanyShippingAddressUpdate,
)
from backend.database.base import get_db
from backend.models.company import Company, CompanyShippingAddress
from backend.models.quote import Quote, QuoteStatus

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Dashboard"])


@router.get(
    "/overview",
    summary="Get dashboard overview",
    description="Get dashboard stats and recent activity for authenticated company"
)
async def get_dashboard_overview(
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db)
):
    """Get dashboard overview with stats and recent quotes."""
    # Get quote counts by status
    total_quotes_result = await db.execute(
        select(func.count(Quote.id)).where(Quote.company_id == company.id)
    )
    total_quotes = total_quotes_result.scalar() or 0
    
    pending_quotes_result = await db.execute(
        select(func.count(Quote.id)).where(
            Quote.company_id == company.id,
            Quote.status.in_([QuoteStatus.SUBMITTED, QuoteStatus.UNDER_REVIEW])
        )
    )
    pending_quotes = pending_quotes_result.scalar() or 0
    
    active_orders_result = await db.execute(
        select(func.count(Quote.id)).where(
            Quote.company_id == company.id,
            Quote.status.in_([QuoteStatus.QUOTED, QuoteStatus.ACCEPTED])
        )
    )
    active_orders = active_orders_result.scalar() or 0
    
    # Get recent quotes with items eagerly loaded
    recent_quotes_result = await db.execute(
        select(Quote)
        .options(selectinload(Quote.items))
        .where(Quote.company_id == company.id)
        .order_by(Quote.created_at.desc())
        .limit(5)
    )
    recent_quotes_data = recent_quotes_result.scalars().all()
    
    # Build response dict
    response_data = {
        "stats": {
            "totalQuotes": total_quotes,
            "pendingQuotes": pending_quotes,
            "activeOrders": active_orders,
        },
        "recentQuotes": [
            {
                "id": q.id,
                "quoteNumber": q.quote_number or "",
                "createdAt": q.created_at.isoformat() if q.created_at is not None else None,
                "status": q.status.value,
                "itemCount": len(q.items) if q.items else 0,
                "totalAmount": q.total_amount or 0,
                "projectName": q.project_name,
            }
            for q in recent_quotes_data
        ]
    }
    
    # Explicitly return JSONResponse to avoid FastAPI serialization issues
    return JSONResponse(content=response_data)


@router.get(
    "/quotes",
    summary="Get filtered quotes",
    description="Get quotes filtered by status"
)
async def get_dashboard_quotes(
    status: Optional[str] = None,
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db)
):
    """Get quotes filtered by status."""
    query = (
        select(Quote)
        .options(selectinload(Quote.items))
        .where(Quote.company_id == company.id)
    )
    
    if status and status != "all":
        try:
            quote_status = QuoteStatus(status)
            query = query.where(Quote.status == quote_status)
        except ValueError:
            pass
    
    query = query.order_by(Quote.created_at.desc()).limit(50)
    
    result = await db.execute(query)
    quotes_data = result.scalars().all()
    
    # Build response dict
    response_data = {
        "quotes": [
            {
                "id": q.id,
                "quoteNumber": q.quote_number or "",
                "createdAt": q.created_at.isoformat() if q.created_at is not None else None,
                "updatedAt": q.updated_at.isoformat() if q.updated_at is not None else None,
                "status": q.status.value,
                "itemCount": len(q.items) if q.items else 0,
                "totalAmount": q.total_amount or 0,
                "projectName": q.project_name,
                "projectType": q.project_type,
                "contactName": q.contact_name,
            }
            for q in quotes_data
        ],
        "count": len(quotes_data)
    }
    
    # Explicitly return JSONResponse to avoid FastAPI serialization issues
    return JSONResponse(content=response_data)


@router.get(
    "/profile",
    summary="Get company profile",
    description="Get current company profile information"
)
async def get_dashboard_profile(
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db),
):
    """Get company profile information."""
    result = await db.execute(
        select(Company).where(Company.id == company.id).options(selectinload(Company.shipping_addresses))
    )
    company = result.scalar_one()
    return {
        "id": company.id,
        "companyName": company.company_name,
        "legalName": company.legal_name,
        "taxId": company.tax_id,
        "industry": company.industry,
        "website": company.website,
        "status": company.status.value,
        "isVerified": company.is_verified,
        "representative": {
            "firstName": company.rep_first_name,
            "lastName": company.rep_last_name,
            "title": company.rep_title,
            "email": company.rep_email,
            "phone": company.rep_phone,
        },
        "billingAddress": {
            "line1": company.billing_address_line1,
            "line2": company.billing_address_line2,
            "city": company.billing_city,
            "state": company.billing_state,
            "zip": company.billing_zip,
            "country": company.billing_country,
        },
        "shippingAddresses": [
            {
                "id": a.id,
                "label": a.label,
                "line1": a.line1,
                "line2": a.line2,
                "city": a.city,
                "state": a.state,
                "zip": a.zip,
                "country": a.country,
                "sortOrder": a.sort_order,
            }
            for a in (company.shipping_addresses or [])
        ],
        "paymentTerms": company.payment_terms,
        "creditLimit": company.credit_limit,
    }


@router.put(
    "/profile",
    summary="Update company profile",
    description="Update company profile information (tax_id can only be changed via support)"
)
async def update_dashboard_profile(
    update_data: dict,
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db)
):
    """Update company profile information."""
    allowed_fields = {
        "company_name", "legal_name", "industry", "website",
        "rep_first_name", "rep_last_name", "rep_title", "rep_phone",
        "billing_address_line1", "billing_address_line2",
        "billing_city", "billing_state", "billing_zip", "billing_country",
    }
    
    # Prevent tax_id from being updated
    if "tax_id" in update_data:
        update_data = {k: v for k, v in update_data.items() if k != "tax_id"}
        logger.warning(f"Company {company.id} attempted to update tax_id - blocked")
    
    # Prevent rep_email from being updated (should use separate endpoint)
    if "rep_email" in update_data:
        update_data = {k: v for k, v in update_data.items() if k != "rep_email"}
        logger.warning(f"Company {company.id} attempted to update rep_email - blocked")
    
    # Update allowed fields
    updated_count = 0
    for key, value in update_data.items():
        if key in allowed_fields and hasattr(company, key):
            setattr(company, key, value)
            updated_count += 1
    
    if updated_count > 0:
        await db.commit()
        await db.refresh(company)
        logger.info(f"Profile updated for company {company.id}: {updated_count} fields changed")
    
    return {"message": "Profile updated successfully"}


@router.post(
    "/shipping-addresses",
    response_model=CompanyShippingAddressResponse,
    summary="Add shipping address",
)
async def create_dashboard_shipping_address(
    data: CompanyShippingAddressCreate,
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db),
):
    addr = CompanyShippingAddress(
        company_id=company.id,
        label=data.label,
        line1=data.line1,
        line2=data.line2,
        city=data.city,
        state=data.state,
        zip=data.zip,
        country=data.country,
        sort_order=data.sort_order,
    )
    db.add(addr)
    await db.commit()
    await db.refresh(addr)
    return addr


@router.put(
    "/shipping-addresses/{address_id}",
    response_model=CompanyShippingAddressResponse,
    summary="Update shipping address",
)
async def update_dashboard_shipping_address(
    address_id: int,
    data: CompanyShippingAddressUpdate,
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CompanyShippingAddress).where(
            CompanyShippingAddress.id == address_id,
            CompanyShippingAddress.company_id == company.id,
        )
    )
    addr = result.scalar_one_or_none()
    if not addr:
        raise HTTPException(status_code=404, detail="Shipping address not found")
    update = data.model_dump(exclude_unset=True)
    for k, v in update.items():
        setattr(addr, k, v)
    await db.commit()
    await db.refresh(addr)
    return addr


@router.delete(
    "/shipping-addresses/{address_id}",
    status_code=204,
    summary="Delete shipping address",
)
async def delete_dashboard_shipping_address(
    address_id: int,
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CompanyShippingAddress).where(
            CompanyShippingAddress.id == address_id,
            CompanyShippingAddress.company_id == company.id,
        )
    )
    addr = result.scalar_one_or_none()
    if not addr:
        raise HTTPException(status_code=404, detail="Shipping address not found")
    await db.delete(addr)
    await db.commit()


@router.get(
    "",
    summary="Get company dashboard data",
    description="Get dashboard stats and recent quotes for authenticated company (legacy endpoint)"
)
async def get_company_dashboard(
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db)
):
    """Legacy dashboard endpoint - redirects to /dashboard/overview."""
    # Call overview endpoint which returns JSONResponse
    response = await get_dashboard_overview(company, db)
    return response

