"""
End-to-End Integration Tests for Quote Workflow

Tests complete quote creation and management workflow
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
class TestQuoteWorkflow:
    """Test cases for complete quote workflow"""
    
    async def test_complete_quote_workflow(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession
    ):
        """Test complete quote workflow from creation to acceptance."""
        
        # Step 1: Register a company
        company_data = {
            "company_name": "Test Company Inc",
            "rep_first_name": "John",
            "rep_last_name": "Doe",
            "rep_email": "john@testcompany.com",
            "rep_phone": "+1234567890",
            "billing_address_line1": "123 Test Street",
            "billing_city": "Test City",
            "billing_state": "TS",
            "billing_zip": "12345",
            "billing_country": "USA",
            "password": "TestPassword123!"
        }
        
        register_response = await async_client.post(
            "/api/v1/auth/register",
            json=company_data
        )
        assert register_response.status_code == 201
        register_data = register_response.json()
        company_id = register_data.get("user", {}).get("id") or register_data.get("id")
        
        # Activate company for testing
        from sqlalchemy import select
        from backend.models.company import Company
        result = await db_session.execute(
            select(Company).where(Company.id == company_id)
        )
        company = result.scalar_one()
        company.status = CompanyStatus.ACTIVE
        company.is_active = True
        await db_session.commit()
        
        # Step 2: Login
        login_response = await async_client.post(
            "/api/v1/auth/login",
            json={
                "email": company_data["rep_email"],
                "password": company_data["password"]
            }
        )
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Step 3: Browse products - create using factories
        category = await create_category(
            db_session,
            name="Executive Chairs",
            slug="executive-chairs"
        )
        
        chair = await create_chair(
            db_session,
            category_id=category.id,
            name="Premium Executive Chair",
            model_number="PEC-001",
            base_price=50000
        )
        
        products_response = await async_client.get(
            "/api/v1/products/products",
            headers=headers
        )
        assert products_response.status_code == 200
        
        # Step 4: Create a quote
        quote_data = {
            "contact_name": "John Doe",
            "contact_email": "john@testcompany.com",
            "contact_phone": "+1234567890",
            "shipping_address_line1": "123 Test Street",
            "shipping_city": "Test City",
            "shipping_state": "TS",
            "shipping_zip": "12345",
            "shipping_country": "USA"
        }
        
        quote_response = await async_client.post(
            "/api/v1/quotes",
            json=quote_data,
            headers=headers
        )
        assert quote_response.status_code == 201
        quote_id = quote_response.json()["id"]
        
        # Step 5: Submit quote for review
        submit_response = await async_client.post(
            f"/api/v1/quotes/{quote_id}/submit",
            headers=headers
        )
        assert submit_response.status_code == 200
        submit_data = submit_response.json()
        assert submit_data.get("status") in ["submitted", "pending"]
        
        # Step 6: Company views quote
        get_quote_response = await async_client.get(
            f"/api/v1/quotes/{quote_id}",
            headers=headers
        )
        assert get_quote_response.status_code == 200
        
        # Step 7: Get all company quotes
        all_quotes_response = await async_client.get(
            "/api/v1/quotes",
            headers=headers
        )
        assert all_quotes_response.status_code == 200
        quotes_data = all_quotes_response.json()
        if isinstance(quotes_data, dict) and "items" in quotes_data:
            assert len(quotes_data["items"]) >= 1
        else:
            assert len(quotes_data) >= 1
    
    async def test_quote_modification_workflow(
        self,
        async_client: AsyncClient,
        test_company,
        company_token: str,
        db_session: AsyncSession
    ):
        """Test quote modification workflow."""
        headers = {"Authorization": f"Bearer {company_token}"}
        
        # Create initial quote using factory
        quote = await create_quote(
            db_session,
            company_id=test_company.id,
            contact_name="John Doe",
            contact_email="john@test.com"
        )
        
        # Update quote
        update_data = {
            "contact_name": "Jane Smith",
            "shipping_city": "New City"
        }
        
        update_response = await async_client.put(
            f"/api/v1/quotes/{quote.id}",
            json=update_data,
            headers=headers
        )
        assert update_response.status_code == 200
        update_data_resp = update_response.json()
        assert update_data_resp["contact_name"] == "Jane Smith"
        assert update_data_resp.get("shipping_city") == "New City"
        
        # Verify changes
        get_response = await async_client.get(
            f"/api/v1/quotes/{quote.id}",
            headers=headers
        )
        assert get_response.status_code == 200
        assert get_response.json()["contact_name"] == "Jane Smith"
