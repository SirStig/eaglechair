"""
Unit Tests for Quote Service

Tests all quote service functionality
"""

import pytest
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from backend.services.quote_service import QuoteService
from backend.models.quote import Quote, QuoteStatus, Cart, CartItem
from backend.models.chair import Chair, Category
from backend.models.company import Company, CompanyStatus
from backend.core.security import SecurityManager

security_manager = SecurityManager()


@pytest.mark.unit
@pytest.mark.asyncio
class TestQuoteService:
    """Test cases for QuoteService"""
    
    async def test_create_quote_success(self, db_session: AsyncSession):
        """Test successful quote creation."""
        # Create test company
        company = Company(
            company_name="Test Company",
            contact_name="John Doe",
            contact_email="john@test.com",
            contact_phone="+1234567890",
            address_line1="123 Main St",
            city="Test City",
            state="TS",
            zip_code="12345",
            country="USA",
            password_hash=security_manager.hash_password("TestPassword123!"),
            status=CompanyStatus.ACTIVE
        )
        db_session.add(company)
        await db_session.commit()
        await db_session.refresh(company)
        
        # Create test category and product
        category = Category(
            name="Test Category",
            slug="test-category",
            is_active=True
        )
        db_session.add(category)
        await db_session.commit()
        await db_session.refresh(category)
        
        product = Chair(
            name="Test Chair",
            model_number="TC-001",
            category_id=category.id,
            base_price=10000,
            is_active=True
        )
        db_session.add(product)
        await db_session.commit()
        await db_session.refresh(product)
        
        # Create quote
        service = QuoteService(db_session)
        quote_data = {
            "contact_name": "John Doe",
            "contact_email": "john@test.com",
            "contact_phone": "+1234567890",
            "shipping_address_line1": "123 Main St",
            "shipping_city": "Test City",
            "shipping_state": "TS",
            "shipping_zip": "12345",
            "shipping_country": "USA"
        }
        
        quote = await service.create_quote(company.id, quote_data)
        
        assert quote is not None
        assert quote.company_id == company.id
        assert quote.status == QuoteStatus.DRAFT
        assert quote.quote_number is not None
    
    async def test_get_quote_by_id(self, db_session: AsyncSession):
        """Test retrieving quote by ID."""
        # Create test company
        company = Company(
            company_name="Test Company",
            contact_name="John Doe",
            contact_email="john@test.com",
            contact_phone="+1234567890",
            address_line1="123 Main St",
            city="Test City",
            state="TS",
            zip_code="12345",
            country="USA",
            password_hash=security_manager.hash_password("TestPassword123!"),
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
            subtotal=0,
            total_amount=0
        )
        db_session.add(quote)
        await db_session.commit()
        await db_session.refresh(quote)
        
        # Get quote
        service = QuoteService(db_session)
        retrieved_quote = await service.get_quote_by_id(quote.id)
        
        assert retrieved_quote is not None
        assert retrieved_quote.id == quote.id
        assert retrieved_quote.quote_number == "Q-001"
    
    async def test_update_quote_status(self, db_session: AsyncSession):
        """Test updating quote status."""
        # Create test company
        company = Company(
            company_name="Test Company",
            contact_name="John Doe",
            contact_email="john@test.com",
            contact_phone="+1234567890",
            address_line1="123 Main St",
            city="Test City",
            state="TS",
            zip_code="12345",
            country="USA",
            password_hash=security_manager.hash_password("TestPassword123!"),
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
            subtotal=0,
            total_amount=0
        )
        db_session.add(quote)
        await db_session.commit()
        await db_session.refresh(quote)
        
        # Update status
        service = QuoteService(db_session)
        updated_quote = await service.update_quote_status(
            quote.id,
            QuoteStatus.PENDING,
            admin_notes="Moving to pending"
        )
        
        assert updated_quote is not None
        assert updated_quote.status == QuoteStatus.PENDING
        assert updated_quote.admin_notes == "Moving to pending"
    
    async def test_get_company_quotes(self, db_session: AsyncSession):
        """Test retrieving all quotes for a company."""
        # Create test company
        company = Company(
            company_name="Test Company",
            contact_name="John Doe",
            contact_email="john@test.com",
            contact_phone="+1234567890",
            address_line1="123 Main St",
            city="Test City",
            state="TS",
            zip_code="12345",
            country="USA",
            password_hash=security_manager.hash_password("TestPassword123!"),
            status=CompanyStatus.ACTIVE
        )
        db_session.add(company)
        await db_session.commit()
        await db_session.refresh(company)
        
        # Create quotes
        for i in range(3):
            quote = Quote(
                quote_number=f"Q-00{i+1}",
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
        
        # Get company quotes
        service = QuoteService(db_session)
        quotes = await service.get_company_quotes(company.id)
        
        assert len(quotes) == 3
    
    async def test_calculate_quote_totals(self, db_session: AsyncSession):
        """Test quote total calculation."""
        # Create test company
        company = Company(
            company_name="Test Company",
            contact_name="John Doe",
            contact_email="john@test.com",
            contact_phone="+1234567890",
            address_line1="123 Main St",
            city="Test City",
            state="TS",
            zip_code="12345",
            country="USA",
            password_hash=security_manager.hash_password("TestPassword123!"),
            status=CompanyStatus.ACTIVE
        )
        db_session.add(company)
        await db_session.commit()
        await db_session.refresh(company)
        
        # Create quote with items
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
            subtotal=10000,  # $100
            tax_amount=1000,  # $10
            shipping_cost=500,  # $5
            total_amount=11500  # $115
        )
        db_session.add(quote)
        await db_session.commit()
        await db_session.refresh(quote)
        
        service = QuoteService(db_session)
        totals = await service.calculate_quote_totals(quote.id)
        
        assert totals is not None
        assert totals["subtotal"] == 10000
        assert totals["tax_amount"] == 1000
        assert totals["shipping_cost"] == 500
        assert totals["total_amount"] == 11500

