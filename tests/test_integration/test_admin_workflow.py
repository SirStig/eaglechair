"""
End-to-End Integration Tests for Admin Workflow

Tests complete admin management workflow
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.company import Company, CompanyStatus
from backend.models.quote import Quote, QuoteStatus
from backend.models.chair import Chair, Category
from backend.core.security import SecurityManager

security_manager = SecurityManager()


@pytest.mark.integration
@pytest.mark.asyncio
class TestAdminWorkflow:
    """Test cases for complete admin workflow"""
    
    async def test_admin_dashboard_workflow(
        self,
        async_client: AsyncClient,
        admin_token: str,
        db_session: AsyncSession
    ):
        """Test admin dashboard and statistics workflow."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
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
            status=CompanyStatus.PENDING
        )
        db_session.add(company)
        await db_session.commit()
        await db_session.refresh(company)
        
        # Get dashboard stats
        stats_response = await async_client.get(
            "/api/v1/admin/dashboard/stats",
            headers=headers
        )
        assert stats_response.status_code == 200
        stats = stats_response.json()
        assert "companies" in stats
        assert "products" in stats
        assert "quotes" in stats
    
    async def test_admin_company_management_workflow(
        self,
        async_client: AsyncClient,
        admin_token: str,
        db_session: AsyncSession
    ):
        """Test admin company management workflow."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create pending company
        company = Company(
            company_name="Pending Company",
            contact_name="Jane Smith",
            contact_email="jane@pending.com",
            contact_phone="+1234567890",
            address_line1="456 Oak Ave",
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
        
        # List companies
        list_response = await async_client.get(
            "/api/v1/admin/companies",
            headers=headers
        )
        assert list_response.status_code == 200
        assert list_response.json()["total"] >= 1
        
        # Filter pending companies
        pending_response = await async_client.get(
            "/api/v1/admin/companies?status=pending",
            headers=headers
        )
        assert pending_response.status_code == 200
        
        # Approve company
        approve_data = {
            "status": "active",
            "admin_notes": "Approved after verification"
        }
        
        approve_response = await async_client.patch(
            f"/api/v1/admin/companies/{company.id}/status",
            json=approve_data,
            headers=headers
        )
        assert approve_response.status_code == 200
        assert approve_response.json()["status"] == "active"
    
    async def test_admin_quote_management_workflow(
        self,
        async_client: AsyncClient,
        admin_token: str,
        db_session: AsyncSession
    ):
        """Test admin quote management workflow."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create company and quote
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
            subtotal=100000,
            total_amount=110000
        )
        db_session.add(quote)
        await db_session.commit()
        await db_session.refresh(quote)
        
        # List quotes
        list_response = await async_client.get(
            "/api/v1/admin/quotes",
            headers=headers
        )
        assert list_response.status_code == 200
        
        # Update quote with pricing
        quote_data = {
            "status": "quoted",
            "quoted_price": 95000,
            "quoted_lead_time": "4-6 weeks",
            "quote_notes": "Special pricing applied",
            "admin_notes": "Reviewed and approved"
        }
        
        quote_response = await async_client.patch(
            f"/api/v1/admin/quotes/{quote.id}/status",
            json=quote_data,
            headers=headers
        )
        assert quote_response.status_code == 200
        assert quote_response.json()["status"] == "quoted"
        assert quote_response.json()["quoted_price"] == 95000
    
    async def test_admin_product_management_workflow(
        self,
        async_client: AsyncClient,
        admin_token: str,
        db_session: AsyncSession
    ):
        """Test admin product management workflow."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create category
        category = Category(
            name="Test Category",
            slug="test-category",
            is_active=True
        )
        db_session.add(category)
        await db_session.commit()
        await db_session.refresh(category)
        
        # Create product
        product_data = {
            "name": "New Executive Chair",
            "description": "Premium executive seating",
            "model_number": "NEC-001",
            "category_id": category.id,
            "base_price": 60000,
            "minimum_order_quantity": 1,
            "is_active": True
        }
        
        create_response = await async_client.post(
            "/api/v1/admin/products",
            json=product_data,
            headers=headers
        )
        assert create_response.status_code == 201
        product_id = create_response.json()["id"]
        
        # Update product
        update_data = {
            "base_price": 55000,
            "description": "Updated description"
        }
        
        update_response = await async_client.patch(
            f"/api/v1/admin/products/{product_id}",
            json=update_data,
            headers=headers
        )
        assert update_response.status_code == 200
        assert update_response.json()["base_price"] == 55000
        
        # List all products (including inactive)
        list_response = await async_client.get(
            "/api/v1/admin/products",
            headers=headers
        )
        assert list_response.status_code == 200

