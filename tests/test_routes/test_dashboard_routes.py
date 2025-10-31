"""
Test Dashboard Routes

Integration tests for dashboard routes (company authenticated)
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.quote import QuoteStatus
from tests.factories import create_quote, create_quote_item


@pytest.mark.integration
@pytest.mark.dashboard
class TestDashboardRoutes:
    """Test cases for dashboard routes"""
    
    @pytest.mark.asyncio
    async def test_get_dashboard_overview_success(
        self,
        async_client: AsyncClient,
        test_company,
        company_token: str,
        db_session: AsyncSession
    ):
        """Test successful retrieval of dashboard overview."""
        # Create quotes with different statuses
        await create_quote(
            db_session,
            company_id=test_company.id,
            status=QuoteStatus.DRAFT
        )
        await create_quote(
            db_session,
            company_id=test_company.id,
            status=QuoteStatus.SUBMITTED
        )
        await create_quote(
            db_session,
            company_id=test_company.id,
            status=QuoteStatus.QUOTED
        )
        
        headers = {"Authorization": f"Bearer {company_token}"}
        
        response = await async_client.get("/api/v1/dashboard/overview", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "stats" in data
        assert "recentQuotes" in data
        assert data["stats"]["totalQuotes"] >= 3
    
    @pytest.mark.asyncio
    async def test_get_dashboard_overview_unauthorized(
        self,
        async_client: AsyncClient
    ):
        """Test dashboard overview without authentication."""
        response = await async_client.get("/api/v1/dashboard/overview")
        
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_get_dashboard_quotes_success(
        self,
        async_client: AsyncClient,
        test_company,
        company_token: str,
        db_session: AsyncSession
    ):
        """Test successful retrieval of dashboard quotes."""
        # Create quotes with different statuses
        await create_quote(
            db_session,
            company_id=test_company.id,
            status=QuoteStatus.DRAFT
        )
        await create_quote(
            db_session,
            company_id=test_company.id,
            status=QuoteStatus.SUBMITTED
        )
        
        headers = {"Authorization": f"Bearer {company_token}"}
        
        response = await async_client.get("/api/v1/dashboard/quotes", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "quotes" in data
        assert "count" in data
        assert len(data["quotes"]) >= 2
    
    @pytest.mark.asyncio
    async def test_get_dashboard_quotes_filtered(
        self,
        async_client: AsyncClient,
        test_company,
        company_token: str,
        db_session: AsyncSession
    ):
        """Test dashboard quotes with status filter."""
        await create_quote(
            db_session,
            company_id=test_company.id,
            status=QuoteStatus.DRAFT
        )
        await create_quote(
            db_session,
            company_id=test_company.id,
            status=QuoteStatus.SUBMITTED
        )
        
        headers = {"Authorization": f"Bearer {company_token}"}
        
        response = await async_client.get(
            "/api/v1/dashboard/quotes?status=draft",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert all(q["status"] == "draft" for q in data["quotes"])
    
    @pytest.mark.asyncio
    async def test_get_dashboard_profile_success(
        self,
        async_client: AsyncClient,
        test_company,
        company_token: str
    ):
        """Test successful retrieval of company profile."""
        headers = {"Authorization": f"Bearer {company_token}"}
        
        response = await async_client.get("/api/v1/dashboard/profile", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_company.id
        assert data["companyName"] == test_company.company_name
        assert "representative" in data
        assert "billingAddress" in data
    
    @pytest.mark.asyncio
    async def test_update_dashboard_profile_success(
        self,
        async_client: AsyncClient,
        test_company,
        company_token: str,
        db_session: AsyncSession
    ):
        """Test successful profile update."""
        update_data = {
            "company_name": "Updated Company Name",
            "rep_first_name": "Updated",
            "rep_last_name": "Name"
        }
        
        headers = {"Authorization": f"Bearer {company_token}"}
        
        response = await async_client.put(
            "/api/v1/dashboard/profile",
            json=update_data,
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        
        # Verify update
        await db_session.refresh(test_company)
        assert test_company.company_name == "Updated Company Name"
    
    @pytest.mark.asyncio
    async def test_update_dashboard_profile_blocks_tax_id(
        self,
        async_client: AsyncClient,
        test_company,
        company_token: str,
        db_session: AsyncSession
    ):
        """Test that tax_id cannot be updated."""
        original_tax_id = test_company.tax_id
        update_data = {
            "tax_id": "99-9999999"
        }
        
        headers = {"Authorization": f"Bearer {company_token}"}
        
        response = await async_client.put(
            "/api/v1/dashboard/profile",
            json=update_data,
            headers=headers
        )
        
        assert response.status_code == 200
        
        # Verify tax_id was not updated
        await db_session.refresh(test_company)
        assert test_company.tax_id == original_tax_id

