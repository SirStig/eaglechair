"""
Unit Tests for Admin Service

Tests all admin service functionality
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.services.admin_service import AdminService
from backend.models.company import Company, CompanyStatus, AdminUser, AdminRole
from backend.models.quote import Quote, QuoteStatus
from backend.models.chair import Chair, Category
from tests.factories import (
    create_company,
    create_category,
    create_chair,
    create_quote,
)


@pytest.mark.unit
@pytest.mark.asyncio
class TestAdminService:
    """Test cases for AdminService"""
    
    async def test_get_dashboard_stats(self, db_session: AsyncSession):
        """Test retrieving dashboard statistics."""
        # Create test data using factories
        company = await create_company(
            db_session,
            company_name="Test Company",
            rep_first_name="John",
            rep_last_name="Doe",
            rep_email="john@test.com",
            rep_phone="+1234567890",
            billing_address_line1="123 Main St",
            billing_city="Test City",
            billing_state="TS",
            billing_zip="12345",
            billing_country="USA",
            status=CompanyStatus.ACTIVE
        )
        # Create category and product using factories
        category = await create_category(db_session, name="Test Category", slug="test-category")
        product = await create_chair(db_session, category_id=category.id, name="Test Chair", model_number="TC-001", base_price=10000)
        
        # Create quote
        quote = await create_quote(
            db_session,
            company_id=company.id,
            contact_name="John Doe",
            contact_email="john@test.com",
            contact_phone="+1234567890",
            shipping_address_line1="123 Main St",
            shipping_city="Test City",
            shipping_state="TS",
            shipping_zip="12345",
            shipping_country="USA",
            status=QuoteStatus.UNDER_REVIEW,
            subtotal=10000,
            total_amount=11000
        )
        await db_session.commit()
        
        # Get dashboard stats (AdminService methods are static)
        stats = await AdminService.get_dashboard_stats(db_session)
        
        assert stats is not None
        assert "companies" in stats
        assert "products" in stats
        assert "quotes" in stats
        assert stats["companies"]["total"] >= 1
        assert stats["products"]["total"] >= 1
        assert stats["quotes"]["total"] >= 1
    
    async def test_get_all_companies(self, db_session: AsyncSession):
        """Test retrieving all companies."""
        # Create test companies using factories
        for i in range(5):
            await create_company(
                db_session,
                company_name=f"Company {i+1}",
                rep_first_name="Contact",
                rep_last_name=f"{i+1}",
                rep_email=f"contact{i+1}@test.com",
                rep_phone="+1234567890",
                billing_address_line1="123 Main St",
                billing_city="Test City",
                billing_state="TS",
                billing_zip="12345",
                billing_country="USA",
                status=CompanyStatus.ACTIVE if i % 2 == 0 else CompanyStatus.PENDING
            )
        
        # Get all companies (AdminService methods are static)
        # AdminService.get_all_companies returns a tuple (companies, total_count)
        companies, total = await AdminService.get_all_companies(db_session, page=1, page_size=10)
        
        assert companies is not None
        assert total == 5
        assert len(companies) == 5
    
    async def test_get_all_companies_with_filter(self, db_session: AsyncSession):
        """Test retrieving companies with status filter."""
        # Create test companies using factories
        for i in range(5):
            await create_company(
                db_session,
                company_name=f"Company {i+1}",
                rep_first_name="Contact",
                rep_last_name=f"{i+1}",
                rep_email=f"contact{i+1}@test.com",
                rep_phone="+1234567890",
                billing_address_line1="123 Main St",
                billing_city="Test City",
                billing_state="TS",
                billing_zip="12345",
                billing_country="USA",
                status=CompanyStatus.ACTIVE if i < 3 else CompanyStatus.PENDING
            )
        
        # Get active companies only (AdminService methods are static)
        # AdminService.get_all_companies returns a tuple (companies, total_count)
        companies, total = await AdminService.get_all_companies(
            db_session,
            page=1,
            page_size=10,
            status=CompanyStatus.ACTIVE
        )
        
        assert companies is not None
        assert total == 3
        assert len(companies) == 3
        assert all(c.status == CompanyStatus.ACTIVE for c in companies)
    
    async def test_update_company_status(self, db_session: AsyncSession):
        """Test updating company status."""
        # Create test company using factory
        company = await create_company(
            db_session,
            company_name="Test Company",
            rep_first_name="John",
            rep_last_name="Doe",
            rep_email="john@test.com",
            rep_phone="+1234567890",
            billing_address_line1="123 Main St",
            billing_city="Test City",
            billing_state="TS",
            billing_zip="12345",
            billing_country="USA",
            status=CompanyStatus.PENDING
        )
        
        # Update status (AdminService methods are static)
        updated_company = await AdminService.update_company_status(
            db_session,
            company.id,
            CompanyStatus.ACTIVE,
            admin_notes="Approved by admin"
        )
        
        assert updated_company is not None
        assert updated_company.status == CompanyStatus.ACTIVE
        assert updated_company.admin_notes == "Approved by admin"
    
    async def test_get_all_quotes(self, db_session: AsyncSession):
        """Test retrieving all quotes."""
        # Create test company using factory
        company = await create_company(
            db_session,
            company_name="Test Company",
            rep_first_name="John",
            rep_last_name="Doe",
            rep_email="john@test.com",
            rep_phone="+1234567890",
            billing_address_line1="123 Main St",
            billing_city="Test City",
            billing_state="TS",
            billing_zip="12345",
            billing_country="USA",
            status=CompanyStatus.ACTIVE
        )
        
        # Create test quotes using factories
        for i in range(5):
            await create_quote(
                db_session,
                company_id=company.id,
                contact_name="John Doe",
                contact_email="john@test.com",
                contact_phone="+1234567890",
                shipping_address_line1="123 Main St",
                shipping_city="Test City",
                shipping_state="TS",
                shipping_zip="12345",
                shipping_country="USA",
                status=QuoteStatus.UNDER_REVIEW,
                subtotal=10000 * (i + 1),
                total_amount=11000 * (i + 1)
            )
        
        # Get all quotes (AdminService methods are static)
        # AdminService.get_all_quotes returns a tuple (quotes, total_count)
        quotes, total = await AdminService.get_all_quotes(db_session, page=1, page_size=10)
        
        assert quotes is not None
        assert total == 5
        assert len(quotes) == 5
    
    async def test_update_quote_admin(self, db_session: AsyncSession):
        """Test updating quote as admin."""
        # Create test company using factory
        company = await create_company(
            db_session,
            company_name="Test Company",
            rep_first_name="John",
            rep_last_name="Doe",
            rep_email="john@test.com",
            rep_phone="+1234567890",
            billing_address_line1="123 Main St",
            billing_city="Test City",
            billing_state="TS",
            billing_zip="12345",
            billing_country="USA",
            status=CompanyStatus.ACTIVE
        )
        
        # Create quote using factory
        quote = await create_quote(
            db_session,
            company_id=company.id,
            contact_name="John Doe",
            contact_email="john@test.com",
            contact_phone="+1234567890",
            shipping_address_line1="123 Main St",
            shipping_city="Test City",
            shipping_state="TS",
            shipping_zip="12345",
            shipping_country="USA",
            status=QuoteStatus.UNDER_REVIEW,
            subtotal=10000,
            total_amount=11000
        )
        
        # Update quote (AdminService methods are static)
        updated_quote = await AdminService.update_quote_status(
            db_session,
            quote.id,
            status=QuoteStatus.QUOTED,
            quoted_price=9500,
            quoted_lead_time="4-6 weeks",
            admin_notes="Special pricing applied"
        )
        
        assert updated_quote is not None
        assert updated_quote.status == QuoteStatus.QUOTED
        assert updated_quote.quoted_price == 9500
        assert updated_quote.quoted_lead_time == "4-6 weeks"
    
    async def test_create_admin_user(self, db_session: AsyncSession):
        """Test creating a new admin user."""
        # Note: AdminService doesn't have create_admin_user method
        # Admin users are created via AuthService or directly
        # This test is skipped as the method doesn't exist
        from backend.models.company import AdminUser
        from backend.core.security import SecurityManager
        
        security_manager = SecurityManager()
        admin = AdminUser(
            username="newadmin",
            email="newadmin@test.com",
            hashed_password=security_manager.hash_password("AdminPassword123!"),
            first_name="New",
            last_name="Admin",
            role=AdminRole.ADMIN,
            is_active=True
        )
        
        db_session.add(admin)
        await db_session.commit()
        await db_session.refresh(admin)
        
        assert admin is not None
        assert admin.username == "newadmin"
        assert admin.email == "newadmin@test.com"
        assert admin.role == AdminRole.MANAGER
        assert admin.is_active is True

