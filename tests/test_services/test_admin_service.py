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
from backend.core.security import SecurityManager

security_manager = SecurityManager()


@pytest.mark.unit
@pytest.mark.asyncio
class TestAdminService:
    """Test cases for AdminService"""
    
    async def test_get_dashboard_stats(self, db_session: AsyncSession):
        """Test retrieving dashboard statistics."""
        # Create test data
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
        
        # Create category and product
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
            status=QuoteStatus.PENDING,
            subtotal=10000,
            total_amount=11000
        )
        db_session.add(quote)
        await db_session.commit()
        
        # Get dashboard stats
        service = AdminService(db_session)
        stats = await service.get_dashboard_stats()
        
        assert stats is not None
        assert "companies" in stats
        assert "products" in stats
        assert "quotes" in stats
        assert stats["companies"]["total"] >= 1
        assert stats["products"]["total"] >= 1
        assert stats["quotes"]["total"] >= 1
    
    async def test_get_all_companies(self, db_session: AsyncSession):
        """Test retrieving all companies."""
        # Create test companies
        for i in range(5):
            company = Company(
                company_name=f"Company {i+1}",
                contact_name=f"Contact {i+1}",
                contact_email=f"contact{i+1}@test.com",
                contact_phone="+1234567890",
                address_line1="123 Main St",
                city="Test City",
                state="TS",
                zip_code="12345",
                country="USA",
                password_hash=security_manager.hash_password("TestPassword123!"),
                status=CompanyStatus.ACTIVE if i % 2 == 0 else CompanyStatus.PENDING
            )
            db_session.add(company)
        
        await db_session.commit()
        
        # Get all companies
        service = AdminService(db_session)
        result = await service.get_all_companies(page=1, page_size=10)
        
        assert result is not None
        assert result["total"] == 5
        assert len(result["items"]) == 5
    
    async def test_get_all_companies_with_filter(self, db_session: AsyncSession):
        """Test retrieving companies with status filter."""
        # Create test companies
        for i in range(5):
            company = Company(
                company_name=f"Company {i+1}",
                contact_name=f"Contact {i+1}",
                contact_email=f"contact{i+1}@test.com",
                contact_phone="+1234567890",
                address_line1="123 Main St",
                city="Test City",
                state="TS",
                zip_code="12345",
                country="USA",
                password_hash=security_manager.hash_password("TestPassword123!"),
                status=CompanyStatus.ACTIVE if i < 3 else CompanyStatus.PENDING
            )
            db_session.add(company)
        
        await db_session.commit()
        
        # Get active companies only
        service = AdminService(db_session)
        result = await service.get_all_companies(
            page=1,
            page_size=10,
            status=CompanyStatus.ACTIVE
        )
        
        assert result is not None
        assert result["total"] == 3
        assert all(item["status"] == "active" for item in result["items"])
    
    async def test_update_company_status(self, db_session: AsyncSession):
        """Test updating company status."""
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
            status=CompanyStatus.PENDING
        )
        db_session.add(company)
        await db_session.commit()
        await db_session.refresh(company)
        
        # Update status
        service = AdminService(db_session)
        updated_company = await service.update_company_status(
            company.id,
            CompanyStatus.ACTIVE,
            admin_notes="Approved by admin"
        )
        
        assert updated_company is not None
        assert updated_company.status == CompanyStatus.ACTIVE
        assert updated_company.admin_notes == "Approved by admin"
    
    async def test_get_all_quotes(self, db_session: AsyncSession):
        """Test retrieving all quotes."""
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
        
        # Create test quotes
        for i in range(5):
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
                status=QuoteStatus.PENDING,
                subtotal=10000 * (i + 1),
                total_amount=11000 * (i + 1)
            )
            db_session.add(quote)
        
        await db_session.commit()
        
        # Get all quotes
        service = AdminService(db_session)
        result = await service.get_all_quotes(page=1, page_size=10)
        
        assert result is not None
        assert result["total"] == 5
        assert len(result["items"]) == 5
    
    async def test_update_quote_admin(self, db_session: AsyncSession):
        """Test updating quote as admin."""
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
            status=QuoteStatus.PENDING,
            subtotal=10000,
            total_amount=11000
        )
        db_session.add(quote)
        await db_session.commit()
        await db_session.refresh(quote)
        
        # Update quote
        service = AdminService(db_session)
        update_data = {
            "status": QuoteStatus.QUOTED,
            "quoted_price": 9500,
            "quoted_lead_time": "4-6 weeks",
            "admin_notes": "Special pricing applied"
        }
        
        updated_quote = await service.update_quote_admin(quote.id, update_data)
        
        assert updated_quote is not None
        assert updated_quote.status == QuoteStatus.QUOTED
        assert updated_quote.quoted_price == 9500
        assert updated_quote.quoted_lead_time == "4-6 weeks"
    
    async def test_create_admin_user(self, db_session: AsyncSession):
        """Test creating a new admin user."""
        service = AdminService(db_session)
        admin_data = {
            "username": "newadmin",
            "email": "newadmin@test.com",
            "password": "AdminPassword123!",
            "first_name": "New",
            "last_name": "Admin",
            "role": AdminRole.MANAGER
        }
        
        admin = await service.create_admin_user(admin_data)
        
        assert admin is not None
        assert admin.username == "newadmin"
        assert admin.email == "newadmin@test.com"
        assert admin.role == AdminRole.MANAGER
        assert admin.is_active is True

