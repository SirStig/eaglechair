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
    
    try:
        cart_item = await QuoteService.add_to_cart(
            db=db,
            company_id=company.id,
            product_id=item_data.product_id,
            quantity=item_data.quantity,
            selected_finish_id=item_data.selected_finish_id,
            selected_upholstery_id=item_data.selected_upholstery_id,
            custom_notes=item_data.item_notes,
            configuration=item_data.custom_options
        )
        
        # Manually construct response dict to avoid serialization issues
        response_data = {
            "id": cart_item.id,
            "cart_id": cart_item.cart_id,
            "product_id": cart_item.product_id,
            "quantity": cart_item.quantity,
            "unit_price": cart_item.unit_price,
            "customization_cost": cart_item.customization_cost,
            "line_total": cart_item.line_total,
            "selected_finish_id": cart_item.selected_finish_id,
            "selected_upholstery_id": cart_item.selected_upholstery_id,
            "custom_options": cart_item.custom_options,
            "item_notes": cart_item.item_notes,
            "added_at": cart_item.added_at.isoformat() if cart_item.added_at else None,
            "updated_at": cart_item.updated_at.isoformat() if cart_item.updated_at else None,
        }
        
        # Add product info if loaded
        if cart_item.product:
            response_data["product"] = {
                "id": cart_item.product.id,
                "name": cart_item.product.name,
                "model_number": cart_item.product.model_number,
                "slug": cart_item.product.slug,
                "image_url": cart_item.product.primary_image_url,
                "category": cart_item.product.category,
                "subcategory": cart_item.product.subcategory,
                "base_price": cart_item.product.base_price,
            }
        else:
            response_data["product"] = None
        
        return response_data
    except Exception as e:
        logger.error(f"Error adding item to cart: {str(e)}", exc_info=False)
        raise


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
    
    try:
        cart_item = await QuoteService.update_cart_item(
            db=db,
            cart_item_id=cart_item_id,
            company_id=company.id,
            quantity=update_data.quantity,
            selected_finish_id=update_data.selected_finish_id,
            selected_upholstery_id=update_data.selected_upholstery_id,
            custom_notes=update_data.item_notes
        )
        
        # Manually construct response dict to avoid serialization issues
        response_data = {
            "id": cart_item.id,
            "cart_id": cart_item.cart_id,
            "product_id": cart_item.product_id,
            "quantity": cart_item.quantity,
            "unit_price": cart_item.unit_price,
            "customization_cost": cart_item.customization_cost,
            "line_total": cart_item.line_total,
            "selected_finish_id": cart_item.selected_finish_id,
            "selected_upholstery_id": cart_item.selected_upholstery_id,
            "custom_options": cart_item.custom_options,
            "item_notes": cart_item.item_notes,
            "added_at": cart_item.added_at.isoformat() if cart_item.added_at else None,
            "updated_at": cart_item.updated_at.isoformat() if cart_item.updated_at else None,
        }
        
        # Add product info if loaded
        if cart_item.product:
            response_data["product"] = {
                "id": cart_item.product.id,
                "name": cart_item.product.name,
                "model_number": cart_item.product.model_number,
                "slug": cart_item.product.slug,
                "image_url": cart_item.product.primary_image_url,
                "category": cart_item.product.category,
                "subcategory": cart_item.product.subcategory,
                "base_price": cart_item.product.base_price,
            }
        else:
            response_data["product"] = None
        
        return response_data
    except Exception as e:
        logger.error(f"Error updating cart item {cart_item_id}: {str(e)}", exc_info=False)
        raise


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
    
    If the guest_items list is empty, it will simply return the existing
    authenticated cart (or create one if it doesn't exist).
    """
    if not guest_items or len(guest_items) == 0:
        logger.info(f"No guest items to merge for company {company.id}, returning existing cart")
        cart = await QuoteService.get_or_create_cart(db=db, company_id=company.id)
        cart_with_items = await QuoteService.get_cart_with_items(
            db=db,
            cart_id=cart.id,
            company_id=company.id
        )
        return cart_with_items
    
    logger.info(f"Merging {len(guest_items)} guest items for company {company.id}")
    
    # Convert CartItemCreate objects to dicts for the service
    guest_items_dict = [
        {
            "product_id": item.product_id,
            "quantity": item.quantity,
            "selected_finish_id": item.selected_finish_id,
            "selected_upholstery_id": item.selected_upholstery_id,
            "custom_options": item.custom_options,
            "item_notes": item.item_notes,
        }
        for item in guest_items
    ]
    
    cart = await QuoteService.merge_guest_cart(
        db=db,
        company_id=company.id,
        guest_items=guest_items_dict
    )
    
    return cart


# ============================================================================
# Quote Request Endpoints
# ============================================================================

@router.post(
    "/request",
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
        shipping_address_line1=quote_data.shipping_address_line1,
        shipping_address_line2=quote_data.shipping_address_line2,
        shipping_city=quote_data.shipping_city,
        shipping_state=quote_data.shipping_state,
        shipping_zip=quote_data.shipping_zip,
        shipping_country=quote_data.shipping_country,
        project_name=quote_data.project_name,
        project_description=quote_data.project_description,
        desired_delivery_date=quote_data.desired_delivery_date,
        special_instructions=quote_data.special_instructions
    )
    
    logger.info(
        f"Quote request created: {quote_request.quote_number} "
        f"for company {company.id}"
    )
    
    return quote_request


@router.get(
    "/",
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
    "/{quote_id}",
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

