"""
Quote Routes - API v1

Cart and quote management for authenticated companies
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import get_current_company
from backend.api.v1.schemas.common import MessageResponse
from backend.api.v1.schemas.quote import (
    CartItemCreate,
    CartItemResponse,
    CartItemUpdate,
    CartResponse,
    ConvertCartToQuoteRequest,
    QuoteResponse,
    QuoteWithItems,
)
from backend.database.base import get_db
from backend.models.company import Company
from backend.models.quote import QuoteStatus
from backend.services.quote_service import QuoteService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Quotes & Cart"])


# ============================================================================
# Dashboard Endpoints
# ============================================================================

@router.get(
    "/dashboard/overview",
    summary="Get dashboard overview",
    description="Get dashboard stats and recent activity for authenticated company"
)
async def get_dashboard_overview(
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db)
):
    """Get dashboard overview with stats and recent quotes."""
    from sqlalchemy import func, select

    from backend.models.quote import Quote
    
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
    
    # Get recent quotes
    recent_quotes_result = await db.execute(
        select(Quote)
        .where(Quote.company_id == company.id)
        .order_by(Quote.created_at.desc())
        .limit(5)
    )
    recent_quotes_data = recent_quotes_result.scalars().all()
    
    recent_quotes = [
        {
            "id": q.id,
            "quoteNumber": q.quote_number,
            "createdAt": q.created_at.isoformat() if q.created_at else None,
            "status": q.status.value,
            "itemCount": len(q.items) if q.items else 0,
            "totalAmount": q.total_amount or 0,
            "projectName": q.project_name,
        }
        for q in recent_quotes_data
    ]
    
    return {
        "stats": {
            "totalQuotes": total_quotes,
            "pendingQuotes": pending_quotes,
            "activeOrders": active_orders,
        },
        "recentQuotes": recent_quotes
    }


@router.get(
    "/dashboard/quotes",
    summary="Get filtered quotes",
    description="Get quotes filtered by status"
)
async def get_dashboard_quotes(
    status: Optional[str] = None,
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db)
):
    """Get quotes filtered by status."""
    from sqlalchemy import select

    from backend.models.quote import Quote
    
    query = select(Quote).where(Quote.company_id == company.id)
    
    if status and status != "all":
        try:
            quote_status = QuoteStatus(status)
            query = query.where(Quote.status == quote_status)
        except ValueError:
            pass
    
    query = query.order_by(Quote.created_at.desc()).limit(50)
    
    result = await db.execute(query)
    quotes_data = result.scalars().all()
    
    quotes = [
        {
            "id": q.id,
            "quoteNumber": q.quote_number,
            "createdAt": q.created_at.isoformat() if q.created_at else None,
            "updatedAt": q.updated_at.isoformat() if q.updated_at else None,
            "status": q.status.value,
            "itemCount": len(q.items) if q.items else 0,
            "totalAmount": q.total_amount or 0,
            "projectName": q.project_name,
            "projectType": q.project_type,
            "contactName": q.contact_name,
        }
        for q in quotes_data
    ]
    
    return {"quotes": quotes, "count": len(quotes)}


@router.get(
    "/dashboard/profile",
    summary="Get company profile",
    description="Get current company profile information"
)
async def get_company_profile(
    company: Company = Depends(get_current_company)
):
    """Get company profile information."""
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
        "shippingAddress": {
            "line1": company.shipping_address_line1,
            "line2": company.shipping_address_line2,
            "city": company.shipping_city,
            "state": company.shipping_state,
            "zip": company.shipping_zip,
            "country": company.shipping_country,
        } if company.shipping_address_line1 else None,
        "paymentTerms": company.payment_terms,
        "creditLimit": company.credit_limit,
    }


@router.put(
    "/dashboard/profile",
    summary="Update company profile",
    description="Update company profile information"
)
async def update_company_profile(
    update_data: dict,
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db)
):
    """Update company profile information."""
    # Allowed fields for update
    allowed_fields = {
        "website", "rep_title", "rep_phone",
        "shipping_address_line1", "shipping_address_line2",
        "shipping_city", "shipping_state", "shipping_zip", "shipping_country"
    }
    
    for key, value in update_data.items():
        if key in allowed_fields and hasattr(company, key):
            setattr(company, key, value)
    
    await db.commit()
    await db.refresh(company)
    
    return {"message": "Profile updated successfully"}


# ============================================================================
# Legacy Dashboard Endpoint (for compatibility)
# ============================================================================

@router.get(
    "/dashboard",
    summary="Get company dashboard data",
    description="Get dashboard stats and recent quotes for authenticated company"
)
async def get_company_dashboard(
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db)
):
    """Legacy dashboard endpoint - redirects to /dashboard/overview."""
    return await get_dashboard_overview(company, db)


# ============================================================================
# Cart Endpoints
# ============================================================================

@router.get(
    "/cart",
    response_model=CartResponse,
    summary="Get current cart",
    description="Get or create active cart for authenticated company"
)
async def get_cart(
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db)
):
    """
    Get current active cart with all items.
    
    **Requires company authentication.**
    
    If no active cart exists, a new one will be created automatically.
    """
    logger.info(f"Fetching cart for company {company.id}")
    
    cart = await QuoteService.get_or_create_cart(
        db=db,
        company_id=company.id
    )
    
    # Load items - Note: CartResponse schema includes items field
    cart_with_items = await QuoteService.get_cart_with_items(
        db=db,
        cart_id=cart.id,
        company_id=company.id
    )
    
    return cart_with_items


@router.post(
    "/cart/items",
    response_model=CartItemResponse,
    status_code=201,
    summary="Add item to cart",
    description="Add a product to the cart with optional customizations"
)
async def add_to_cart(
    item_data: CartItemCreate,
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db)
):
    """
    Add an item to cart.
    
    **Requires company authentication.**
    
    If the same product with same options already exists in cart,
    the quantity will be incremented instead of creating a duplicate item.
    """
    logger.info(
        f"Company {company.id} adding product {item_data.product_id} "
        f"to cart (qty: {item_data.quantity})"
    )
    
    cart_item = await QuoteService.add_to_cart(
        db=db,
        company_id=company.id,
        product_id=item_data.product_id,
        quantity=item_data.quantity,
        selected_finish_id=item_data.selected_finish_id,
        selected_upholstery_id=item_data.selected_upholstery_id,
        custom_notes=item_data.custom_notes,
        configuration=item_data.configuration
    )
    
    return cart_item


@router.patch(
    "/cart/items/{cart_item_id}",
    response_model=CartItemResponse,
    summary="Update cart item",
    description="Update quantity or options for a cart item"
)
async def update_cart_item(
    cart_item_id: int,
    update_data: CartItemUpdate,
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a cart item.
    
    **Requires company authentication.**
    
    You can update quantity, finish, upholstery, or custom notes.
    """
    logger.info(f"Company {company.id} updating cart item {cart_item_id}")
    
    cart_item = await QuoteService.update_cart_item(
        db=db,
        cart_item_id=cart_item_id,
        company_id=company.id,
        quantity=update_data.quantity,
        selected_finish_id=update_data.selected_finish_id,
        selected_upholstery_id=update_data.selected_upholstery_id,
        custom_notes=update_data.custom_notes
    )
    
    return cart_item


@router.delete(
    "/cart/items/{cart_item_id}",
    response_model=MessageResponse,
    summary="Remove item from cart",
    description="Remove a specific item from the cart"
)
async def remove_from_cart(
    cart_item_id: int,
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db)
):
    """
    Remove an item from cart.
    
    **Requires company authentication.**
    """
    logger.info(f"Company {company.id} removing cart item {cart_item_id}")
    
    await QuoteService.remove_from_cart(
        db=db,
        cart_item_id=cart_item_id,
        company_id=company.id
    )
    
    return MessageResponse(
        message="Item removed from cart successfully"
    )


@router.delete(
    "/cart/clear",
    response_model=MessageResponse,
    summary="Clear cart",
    description="Remove all items from the cart"
)
async def clear_cart(
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db)
):
    """
    Clear all items from cart.
    
    **Requires company authentication.**
    """
    logger.info(f"Company {company.id} clearing cart")
    
    # Get active cart
    cart = await QuoteService.get_or_create_cart(db, company.id)
    
    await QuoteService.clear_cart(
        db=db,
        cart_id=cart.id,
        company_id=company.id
    )
    
    return MessageResponse(
        message="Cart cleared successfully"
    )


@router.post(
    "/cart/merge",
    response_model=CartResponse,
    summary="Merge guest cart items",
    description="Merge guest cart items into authenticated cart (used on login/register)"
)
async def merge_guest_cart(
    guest_items: list[CartItemCreate],
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db)
):
    """
    Merge guest cart items into authenticated cart.
    
    **Requires company authentication.**
    
    This endpoint is called after login/registration to merge any items
    that were added to the cart while not authenticated.
    """
    logger.info(f"Merging {len(guest_items)} guest items for company {company.id}")
    
    cart = await QuoteService.merge_guest_cart(
        db=db,
        company_id=company.id,
        guest_items=guest_items
    )
    
    return cart


# ============================================================================
# Quote Request Endpoints
# ============================================================================

@router.post(
    "/quotes",
    response_model=QuoteResponse,
    status_code=201,
    summary="Request quote",
    description="Convert current cart to a quote request"
)
async def create_quote_request(
    quote_data: ConvertCartToQuoteRequest,
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a quote request from current cart.
    
    **Requires company authentication.**
    
    This will convert your active cart into a quote request that will be
    reviewed by our team. The cart will be cleared after creating the quote.
    """
    logger.info(f"Company {company.id} creating quote request")
    
    # Get active cart
    cart = await QuoteService.get_or_create_cart(db, company.id)
    
    quote_request = await QuoteService.create_quote_request(
        db=db,
        company_id=company.id,
        cart_id=cart.id,
        delivery_address=quote_data.shipping_address_line1,
        delivery_city=quote_data.shipping_city,
        delivery_state=quote_data.shipping_state,
        delivery_zip=quote_data.shipping_zip,
        requested_delivery_date=quote_data.desired_delivery_date,
        special_instructions=quote_data.special_instructions
    )
    
    logger.info(
        f"Quote request created: {quote_request.quote_number} "
        f"for company {company.id}"
    )
    
    return quote_request


@router.get(
    "/quotes",
    response_model=list[QuoteResponse],
    summary="Get my quotes",
    description="Get all quote requests for authenticated company"
)
async def get_my_quotes(
    status: Optional[QuoteStatus] = None,
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all quote requests for the authenticated company.
    
    **Requires company authentication.**
    
    Optionally filter by status (pending, approved, rejected).
    """
    logger.info(f"Company {company.id} fetching quotes (status={status})")
    
    quotes = await QuoteService.get_company_quotes(
        db=db,
        company_id=company.id,
        status=status
    )
    
    return quotes


@router.get(
    "/quotes/{quote_id}",
    response_model=QuoteWithItems,
    summary="Get quote details",
    description="Get detailed information about a specific quote"
)
async def get_quote(
    quote_id: int,
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db)
):
    """
    Get detailed quote information.
    
    **Requires company authentication.**
    
    You can only view your own company's quotes.
    """
    logger.info(f"Company {company.id} fetching quote {quote_id}")
    
    quote = await QuoteService.get_quote_by_id(
        db=db,
        quote_id=quote_id,
        company_id=company.id
    )
    
    return quote

