"""
Quote Routes - API v1

Cart and quote management for authenticated companies
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.base import get_db
from backend.services.quote_service import QuoteService
from backend.api.dependencies import get_current_company
from backend.models.company import Company
from backend.models.quote import QuoteStatus
from backend.api.v1.schemas.quote import (
    CartResponse,
    CartItemCreate,
    CartItemUpdate,
    CartItemResponse,
    ConvertCartToQuoteRequest,
    QuoteResponse,
    QuoteWithItems,
)
from backend.api.v1.schemas.common import MessageResponse


logger = logging.getLogger(__name__)

router = APIRouter(tags=["Quotes & Cart"])


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
    
    # Load items
    cart = await QuoteService.get_cart_with_items(
        db=db,
        cart_id=cart.id,
        company_id=company.id
    )
    
    return cart


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
        delivery_address=quote_data.delivery_address,
        delivery_city=quote_data.delivery_city,
        delivery_state=quote_data.delivery_state,
        delivery_zip=quote_data.delivery_zip,
        requested_delivery_date=quote_data.requested_delivery_date,
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

