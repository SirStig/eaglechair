"""
End-to-End Integration Tests for Admin Workflow

Tests complete admin management workflow
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.company import CompanyStatus
from backend.models.quote import QuoteStatus
from tests.factories import (
    create_company,
    create_category,
    create_chair,
    create_quote,
)


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
        
        # Create test data using factories
        await create_company(
            db_session,
            status=CompanyStatus.PENDING
        )
        
        # Get dashboard stats
        stats_response = await async_client.get(
            "/api/v1/admin/dashboard/stats",
            headers=headers
        )
        assert stats_response.status_code == 200
        stats = stats_response.json()
        assert isinstance(stats, dict)
    
    async def test_admin_company_management_workflow(
        self,
        async_client: AsyncClient,
        admin_token: str,
        db_session: AsyncSession
    ):
        """Test admin company management workflow."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create pending company using factory
        company = await create_company(
            db_session,
            company_name="Pending Company",
            rep_first_name="Jane",
            rep_last_name="Smith",
            rep_email="jane@pending.com",
            status=CompanyStatus.PENDING
        )
        
        # List companies
        list_response = await async_client.get(
            "/api/v1/admin/companies",
            headers=headers
        )
        assert list_response.status_code == 200
        list_data = list_response.json()
        if isinstance(list_data, dict):
            assert list_data.get("total", len(list_data.get("items", []))) >= 1
        else:
            assert len(list_data) >= 1
        
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
        approve_data_resp = approve_response.json()
        assert approve_data_resp.get("status") in ["active", "ACTIVE"]
    
    async def test_admin_quote_management_workflow(
        self,
        async_client: AsyncClient,
        admin_token: str,
        db_session: AsyncSession
    ):
        """Test admin quote management workflow."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create company and quote using factories
        company = await create_company(
            db_session,
            status=CompanyStatus.ACTIVE
        )
        
        quote = await create_quote(
            db_session,
            company_id=company.id,
            status=QuoteStatus.UNDER_REVIEW,
            subtotal=100000,
            total_amount=110000
        )
        
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
        quote_data_resp = quote_response.json()
        assert quote_data_resp.get("status") in ["quoted", "QUOTED"]
    
    async def test_admin_product_management_workflow(
        self,
        async_client: AsyncClient,
        admin_token: str,
        db_session: AsyncSession
    ):
        """Test admin product management workflow."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create category using factory
        category = await create_category(
            db_session,
            name="Test Category",
            slug="test-category"
        )
        
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
