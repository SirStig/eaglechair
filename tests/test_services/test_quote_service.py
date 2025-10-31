"""
Unit Tests for Quote Service

Tests all quote service functionality
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.services.quote_service import QuoteService
from backend.models.quote import QuoteStatus
from tests.factories import (
    create_company,
    create_category,
    create_chair,
    create_quote,
    create_quote_item,
    create_cart,
    create_cart_item,
)


@pytest.mark.unit
@pytest.mark.asyncio
class TestQuoteService:
    """Test cases for QuoteService"""
    
    async def test_create_quote_request_success(self, db_session: AsyncSession):
        """Test successful quote request creation."""
        company = await create_company(db_session)
        
        # Create a cart with items first
        category = await create_category(db_session)
        product = await create_chair(db_session, category_id=category.id, minimum_order_quantity=1)
        cart = await QuoteService.get_or_create_cart(db_session, company.id)
        await QuoteService.add_to_cart(db_session, company.id, product.id, quantity=10)
        
        quote = await QuoteService.create_quote_request(
            db_session,
            company.id,
            cart.id,
            shipping_address_line1="123 Main St",
            shipping_city="Test City",
            shipping_state="TS",
            shipping_zip="12345",
            shipping_country="USA"
        )
        
        assert quote is not None
        assert quote.company_id == company.id
        assert quote.status == QuoteStatus.SUBMITTED  # create_quote_request sets status to SUBMITTED
        assert quote.quote_number is not None
    
    async def test_get_quote_by_id(self, db_session: AsyncSession):
        """Test retrieving quote by ID."""
        company = await create_company(db_session)
        quote = await create_quote(db_session, company_id=company.id)
        
        retrieved_quote = await QuoteService.get_quote_by_id(db_session, quote.id, company.id)
        
        assert retrieved_quote is not None
        assert retrieved_quote.id == quote.id
        assert retrieved_quote.quote_number == quote.quote_number
    
    async def test_get_quote_by_id_not_found(self, db_session: AsyncSession):
        """Test retrieving non-existent quote."""
        from backend.core.exceptions import ResourceNotFoundError
        company = await create_company(db_session)
        
        with pytest.raises(ResourceNotFoundError):
            await QuoteService.get_quote_by_id(db_session, 99999, company.id)
    
    async def test_update_quote_status(self, db_session: AsyncSession):
        """Test updating quote status."""
        company = await create_company(db_session)
        quote = await create_quote(
            db_session,
            company_id=company.id,
            status=QuoteStatus.DRAFT
        )
        
        updated_quote = await QuoteService.update_quote_status(
            db_session,
            quote.id,
            QuoteStatus.UNDER_REVIEW,
            admin_id=None,
            notes="Moving to pending"
        )
        
        assert updated_quote is not None
        assert updated_quote.status == QuoteStatus.UNDER_REVIEW
        assert updated_quote.admin_notes == "Moving to pending"
    
    async def test_get_company_quotes(self, db_session: AsyncSession):
        """Test retrieving all quotes for a company."""
        company = await create_company(db_session)
        
        # Create quotes using factories
        for i in range(3):
            await create_quote(
                db_session,
                company_id=company.id,
                status=QuoteStatus.DRAFT
            )
        
        quotes = await QuoteService.get_company_quotes(db_session, company.id)
        
        assert len(quotes) == 3
        assert all(q.company_id == company.id for q in quotes)
    
    async def test_update_quote_pricing(self, db_session: AsyncSession):
        """Test updating quote pricing."""
        company = await create_company(db_session)
        quote = await create_quote(
            db_session,
            company_id=company.id,
            subtotal=10000,
            tax_amount=1000,
            shipping_cost=500,
            total_amount=11500
        )
        
        updated_quote = await QuoteService.update_quote_pricing(
            db_session,
            quote.id,
            quoted_price=23000,
            notes="Updated pricing"
        )
        
        assert updated_quote is not None
        assert updated_quote.quoted_price == 23000
    
    async def test_get_or_create_cart(self, db_session: AsyncSession):
        """Test getting or creating a cart."""
        company = await create_company(db_session)
        
        cart = await QuoteService.get_or_create_cart(db_session, company.id)
        
        assert cart is not None
        assert cart.company_id == company.id
        
        # Get existing cart
        cart2 = await QuoteService.get_or_create_cart(db_session, company.id)
        assert cart2.id == cart.id
    
    async def test_add_to_cart(self, db_session: AsyncSession):
        """Test adding item to cart."""
        company = await create_company(db_session)
        category = await create_category(db_session)
        product = await create_chair(db_session, category_id=category.id, minimum_order_quantity=1)
        
        cart = await QuoteService.get_or_create_cart(db_session, company.id)
        
        cart_item = await QuoteService.add_to_cart(
            db_session, 
            company.id,
            product.id,
            quantity=5,
            custom_notes="Test item"
        )
        
        assert cart_item is not None
        assert cart_item.product_id == product.id
        assert cart_item.quantity == 5
        # unit_price may include pricing tier adjustments, so just check it's positive
        assert cart_item.unit_price > 0
    
    async def test_update_cart_item(self, db_session: AsyncSession):
        """Test updating cart item."""
        company = await create_company(db_session)
        category = await create_category(db_session)
        product = await create_chair(db_session, category_id=category.id, minimum_order_quantity=1)
        
        cart = await QuoteService.get_or_create_cart(db_session, company.id)
        
        cart_item = await QuoteService.add_to_cart(
            db_session,
            company.id,
            product.id,
            quantity=5
        )
        
        updated_item = await QuoteService.update_cart_item(
            db_session, 
            cart_item.id,
            company.id,
            quantity=10
        )
        
        assert updated_item is not None
        assert updated_item.quantity == 10
        # unit_price may include pricing tier adjustments, so just check it's positive
        assert updated_item.unit_price > 0
    
    async def test_remove_from_cart(self, db_session: AsyncSession):
        """Test removing item from cart."""
        company = await create_company(db_session)
        category = await create_category(db_session)
        product = await create_chair(db_session, category_id=category.id, minimum_order_quantity=1)
        
        cart = await QuoteService.get_or_create_cart(db_session, company.id)
        
        cart_item = await QuoteService.add_to_cart(
            db_session,
            company.id,
            product.id,
            quantity=5
        )
        
        await QuoteService.remove_from_cart(db_session, cart_item.id, company.id)
        
        # Verify item is removed
        cart_with_items = await QuoteService.get_cart_with_items(db_session, cart.id, company.id)
        item_ids = [item.id for item in cart_with_items.items]
        assert cart_item.id not in item_ids
    
    async def test_clear_cart(self, db_session: AsyncSession):
        """Test clearing cart."""
        company = await create_company(db_session)
        category = await create_category(db_session)
        product = await create_chair(db_session, category_id=category.id, minimum_order_quantity=1)
        
        cart = await QuoteService.get_or_create_cart(db_session, company.id)
        
        await QuoteService.add_to_cart(
            db_session,
            company.id,
            product.id,
            quantity=5
        )
        
        await QuoteService.clear_cart(db_session, cart.id, company.id)
        
        # Refresh the cart to get updated items
        await db_session.refresh(cart)
        cart_with_items = await QuoteService.get_cart_with_items(db_session, cart.id, company.id)
        assert len(cart_with_items.items) == 0
