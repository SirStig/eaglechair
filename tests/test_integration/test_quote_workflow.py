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
        """
        Test the complete company quote workflow: register, verify email,
        get approved, log in, browse, fill the cart and request a quote.
        """
        from sqlalchemy import select
        from backend.models.company import Company
        
        # Step 1: Register a company (no auto-login; email must be verified)
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
        assert register_response.json()["verified"] is False
        
        result = await db_session.execute(
            select(Company).where(Company.rep_email == company_data["rep_email"])
        )
        company = result.scalar_one()
        
        # Step 2: Verify the email with the token from the verification email
        verify_response = await async_client.post(
            "/api/v1/auth/verify-email",
            json={"token": company.email_verification_token}
        )
        assert verify_response.status_code == 200
        
        # Step 3: Admin approval (activate the company)
        company.status = CompanyStatus.ACTIVE
        company.is_active = True
        await db_session.commit()
        
        # Step 4: Login (API client, so tokens come back in the body)
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
        
        # Step 5: Browse products - create using factories
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
            "/api/v1/products",
            headers=headers
        )
        assert products_response.status_code == 200
        assert chair.id in [p["id"] for p in products_response.json()["items"]]
        
        # Step 6: Add the product to the quote cart
        cart_response = await async_client.post(
            "/api/v1/quotes/cart/items",
            json={"product_id": chair.id, "quantity": 5},
            headers=headers
        )
        assert cart_response.status_code == 201
        
        # Step 7: Request a quote from the cart
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
            "/api/v1/quotes/request",
            json=quote_data,
            headers=headers
        )
        assert quote_response.status_code == 201
        quote = quote_response.json()
        assert quote["status"] == "submitted"
        quote_id = quote["id"]
        
        # Step 8: Company views quote
        get_quote_response = await async_client.get(
            f"/api/v1/quotes/{quote_id}",
            headers=headers
        )
        assert get_quote_response.status_code == 200
        assert get_quote_response.json()["quote_number"] == quote["quote_number"]
        
        # Step 9: Get all company quotes
        all_quotes_response = await async_client.get(
            "/api/v1/quotes/",
            headers=headers
        )
        assert all_quotes_response.status_code == 200
        quotes_data = all_quotes_response.json()
        items = quotes_data["items"] if isinstance(quotes_data, dict) else quotes_data
        assert quote_id in [q["id"] for q in items]
    
    async def test_quote_modification_workflow(
        self,
        async_client: AsyncClient,
        test_company,
        company_token: str,
        admin_headers: dict,
        db_session: AsyncSession
    ):
        """
        Test quote modification workflow. Companies can't edit a submitted
        quote; staff edit it through the admin API and the company sees it.
        """
        headers = {"Authorization": f"Bearer {company_token}"}
        
        # Create initial quote using factory
        quote = await create_quote(
            db_session,
            company_id=test_company.id,
            project_name="Original Project",
            shipping_city="Old City"
        )
        
        update_data = {
            "project_name": "Lobby Refresh",
            "shipping_city": "New City"
        }
        
        # The company API has no quote update endpoint
        company_update = await async_client.put(
            f"/api/v1/quotes/{quote.id}",
            json=update_data,
            headers=headers
        )
        assert company_update.status_code == 405
        
        # Staff update the quote
        update_response = await async_client.patch(
            f"/api/v1/admin/quotes/{quote.id}",
            json=update_data,
            headers=admin_headers
        )
        assert update_response.status_code == 200
        update_data_resp = update_response.json()
        assert update_data_resp["project_name"] == "Lobby Refresh"
        assert update_data_resp["shipping_city"] == "New City"
        
        # The company sees the changes
        get_response = await async_client.get(
            f"/api/v1/quotes/{quote.id}",
            headers=headers
        )
        assert get_response.status_code == 200
        assert get_response.json()["project_name"] == "Lobby Refresh"
        assert get_response.json()["shipping_city"] == "New City"
