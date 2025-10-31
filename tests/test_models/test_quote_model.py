"""
Unit Tests for Quote Models

Tests all quote-related model functionality
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.models.quote import Quote, QuoteItem, QuoteStatus, Cart, CartItem
from backend.models.chair import Chair, Category
from backend.models.company import Company, CompanyStatus
from backend.core.security import SecurityManager

security_manager = SecurityManager()


@pytest.mark.unit
@pytest.mark.asyncio
class TestQuoteModel:
    """Test cases for Quote model"""
    
    async def test_create_quote(self, db_session: AsyncSession):
        """Test creating a new quote."""
        # Create company
        company = Company(
            company_name="Test Company",
            rep_first_name="John",
            rep_last_name="Doe",
            rep_email="john@test.com",
            rep_phone="+1234567890",
            shipping_address_line1="123 Main St",
            shipping_city="Test City",
            shipping_state="TS",
            shipping_zip="12345",
            shipping_country="USA",
            hashed_password=security_manager.hash_password("TestPassword123!"),
            status=CompanyStatus.ACTIVE
        )
        db_session.add(company)
        await db_session.commit()
        await db_session.refresh(company)
        
        # Create quote
        quote = Quote(
            quote_number="Q-001",
            company_id=company.id,
            contact_name="John Doe",
            contact_email="john@test.com",
            contact_phone="+1234567890",
            shipping_address_line1="123 Main St",
            shipping_city="Test City",
            shipping_state="TS",
            shipping_zip="12345",
            shipping_country="USA",
            status=QuoteStatus.DRAFT,
            subtotal=10000,
            total_amount=11000
        )
        
        db_session.add(quote)
        await db_session.commit()
        await db_session.refresh(quote)
        
        assert quote.id is not None
        assert quote.quote_number == "Q-001"
        assert quote.status == QuoteStatus.DRAFT
        assert quote.company_id == company.id
        assert quote.created_at is not None
    
    async def test_quote_status_flow(self, db_session: AsyncSession):
        """Test quote status transitions."""
        # Create company
        company = Company(
            company_name="Test Company",
            rep_first_name="John",
            rep_last_name="Doe",
            rep_email="john@test.com",
            rep_phone="+1234567890",
            shipping_address_line1="123 Main St",
            shipping_city="Test City",
            shipping_state="TS",
            shipping_zip="12345",
            shipping_country="USA",
            hashed_password=security_manager.hash_password("TestPassword123!"),
            status=CompanyStatus.ACTIVE
        )
        db_session.add(company)
        await db_session.commit()
        await db_session.refresh(company)
        
        # Create quote
        quote = Quote(
            quote_number="Q-001",
            company_id=company.id,
            contact_name="John Doe",
            contact_email="john@test.com",
            contact_phone="+1234567890",
            shipping_address_line1="123 Main St",
            shipping_city="Test City",
            shipping_state="TS",
            shipping_zip="12345",
            shipping_country="USA",
            status=QuoteStatus.DRAFT,
            subtotal=10000,
            total_amount=11000
        )
        
        db_session.add(quote)
        await db_session.commit()
        
        # Test status transitions
        quote.status = QuoteStatus.UNDER_REVIEW
        await db_session.commit()
        await db_session.refresh(quote)
        assert quote.status == QuoteStatus.UNDER_REVIEW
        
        quote.status = QuoteStatus.QUOTED
        await db_session.commit()
        await db_session.refresh(quote)
        assert quote.status == QuoteStatus.QUOTED
        
        quote.status = QuoteStatus.ACCEPTED
        await db_session.commit()
        await db_session.refresh(quote)
        assert quote.status == QuoteStatus.ACCEPTED
    
    async def test_quote_relationship_with_company(self, db_session: AsyncSession):
        """Test quote relationship with company."""
        # Create company
        company = Company(
            company_name="Test Company",
            rep_first_name="John",
            rep_last_name="Doe",
            rep_email="john@test.com",
            rep_phone="+1234567890",
            shipping_address_line1="123 Main St",
            shipping_city="Test City",
            shipping_state="TS",
            shipping_zip="12345",
            shipping_country="USA",
            hashed_password=security_manager.hash_password("TestPassword123!"),
            status=CompanyStatus.ACTIVE
        )
        db_session.add(company)
        await db_session.commit()
        await db_session.refresh(company)
        
        # Create quotes
        for i in range(3):
            quote = Quote(
                quote_number=f"Q-{i+1:03d}",
                company_id=company.id,
                contact_name="John Doe",
                contact_email="john@test.com",
                contact_phone="+1234567890",
                shipping_address_line1="123 Main St",
                shipping_city="Test City",
                shipping_state="TS",
                shipping_zip="12345",
                shipping_country="USA",
                status=QuoteStatus.DRAFT,
                subtotal=10000 * (i + 1),
                total_amount=11000 * (i + 1)
            )
            db_session.add(quote)
        
        await db_session.commit()
        
        # Query quotes through company relationship
        await db_session.refresh(company)
        assert len(company.quotes) == 3


@pytest.mark.unit
@pytest.mark.asyncio
class TestQuoteItemModel:
    """Test cases for QuoteItem model"""
    
    async def test_create_quote_item(self, db_session: AsyncSession):
        """Test creating a quote item."""
        # Create company
        company = Company(
            company_name="Test Company",
            rep_first_name="John",
            rep_last_name="Doe",
            rep_email="john@test.com",
            rep_phone="+1234567890",
            shipping_address_line1="123 Main St",
            shipping_city="Test City",
            shipping_state="TS",
            shipping_zip="12345",
            shipping_country="USA",
            hashed_password=security_manager.hash_password("TestPassword123!"),
            status=CompanyStatus.ACTIVE
        )
        db_session.add(company)
        await db_session.commit()
        await db_session.refresh(company)
        
        # Create category and chair
        category = Category(
            name="Test Category",
            slug="test-category",
            is_active=True
        )
        db_session.add(category)
        await db_session.commit()
        await db_session.refresh(category)
        
        chair = Chair(
            name="Test Chair",
            model_number="TC-001",
            slug="test-chair-tc001",
            category_id=category.id,
            base_price=10000,
            is_active=True
        )
        db_session.add(chair)
        await db_session.commit()
        await db_session.refresh(chair)
        
        # Create quote
        quote = Quote(
            quote_number="Q-001",
            company_id=company.id,
            contact_name="John Doe",
            contact_email="john@test.com",
            contact_phone="+1234567890",
            shipping_address_line1="123 Main St",
            shipping_city="Test City",
            shipping_state="TS",
            shipping_zip="12345",
            shipping_country="USA",
            status=QuoteStatus.DRAFT,
            subtotal=0,
            total_amount=0
        )
        db_session.add(quote)
        await db_session.commit()
        await db_session.refresh(quote)
        
        # Create quote item
        quote_item = QuoteItem(
            quote_id=quote.id,
            chair_id=chair.id,
            quantity=10,
            unit_price=10000,
            custom_notes="Custom finish required"
        )
        
        db_session.add(quote_item)
        await db_session.commit()
        await db_session.refresh(quote_item)
        
        assert quote_item.id is not None
        assert quote_item.quote_id == quote.id
        assert quote_item.chair_id == chair.id
        assert quote_item.quantity == 10
        assert quote_item.unit_price == 10000


@pytest.mark.unit
@pytest.mark.asyncio
class TestCartModel:
    """Test cases for Cart model"""
    
    async def test_create_cart(self, db_session: AsyncSession):
        """Test creating a cart."""
        # Create company
        company = Company(
            company_name="Test Company",
            rep_first_name="John",
            rep_last_name="Doe",
            rep_email="john@test.com",
            rep_phone="+1234567890",
            shipping_address_line1="123 Main St",
            shipping_city="Test City",
            shipping_state="TS",
            shipping_zip="12345",
            shipping_country="USA",
            hashed_password=security_manager.hash_password("TestPassword123!"),
            status=CompanyStatus.ACTIVE
        )
        db_session.add(company)
        await db_session.commit()
        await db_session.refresh(company)
        
        # Create cart
        cart = Cart(
            company_id=company.id,
            is_active=True
        )
        
        db_session.add(cart)
        await db_session.commit()
        await db_session.refresh(cart)
        
        assert cart.id is not None
        assert cart.company_id == company.id
        assert cart.is_active is True
        assert cart.created_at is not None


@pytest.mark.unit
@pytest.mark.asyncio
class TestCartItemModel:
    """Test cases for CartItem model"""
    
    async def test_create_cart_item(self, db_session: AsyncSession):
        """Test creating a cart item."""
        # Create company
        company = Company(
            company_name="Test Company",
            rep_first_name="John",
            rep_last_name="Doe",
            rep_email="john@test.com",
            rep_phone="+1234567890",
            shipping_address_line1="123 Main St",
            shipping_city="Test City",
            shipping_state="TS",
            shipping_zip="12345",
            shipping_country="USA",
            hashed_password=security_manager.hash_password("TestPassword123!"),
            status=CompanyStatus.ACTIVE
        )
        db_session.add(company)
        await db_session.commit()
        await db_session.refresh(company)
        
        # Create cart
        cart = Cart(
            company_id=company.id,
            is_active=True
        )
        db_session.add(cart)
        await db_session.commit()
        await db_session.refresh(cart)
        
        # Create category and chair
        category = Category(
            name="Test Category",
            slug="test-category",
            is_active=True
        )
        db_session.add(category)
        await db_session.commit()
        await db_session.refresh(category)
        
        chair = Chair(
            name="Test Chair",
            model_number="TC-001",
            slug="test-chair-tc001",
            category_id=category.id,
            base_price=10000,
            is_active=True
        )
        db_session.add(chair)
        await db_session.commit()
        await db_session.refresh(chair)
        
        # Create cart item
        cart_item = CartItem(
            cart_id=cart.id,
            chair_id=chair.id,
            quantity=5,
            unit_price=10000,
            custom_notes="Special requirements"
        )
        
        db_session.add(cart_item)
        await db_session.commit()
        await db_session.refresh(cart_item)
        
        assert cart_item.id is not None
        assert cart_item.cart_id == cart.id
        assert cart_item.chair_id == chair.id
        assert cart_item.quantity == 5

