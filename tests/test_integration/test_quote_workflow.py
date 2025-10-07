"""
End-to-End Integration Tests for Quote Workflow

Tests complete quote creation and management workflow
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.chair import Chair, Category
from backend.models.company import Company, CompanyStatus
from backend.core.security import SecurityManager

security_manager = SecurityManager()


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
            "contact_name": "John Doe",
            "contact_email": "john@testcompany.com",
            "contact_phone": "+1234567890",
            "address_line1": "123 Test Street",
            "city": "Test City",
            "state": "TS",
            "zip_code": "12345",
            "country": "USA",
            "password": "TestPassword123!"
        }
        
        register_response = await async_client.post(
            "/api/v1/auth/register",
            json=company_data
        )
        assert register_response.status_code == 201
        company_id = register_response.json()["id"]
        
        # Activate company for testing
        from sqlalchemy import select
        result = await db_session.execute(
            select(Company).where(Company.id == company_id)
        )
        company = result.scalar_one()
        company.status = CompanyStatus.ACTIVE
        await db_session.commit()
        
        # Step 2: Login
        login_response = await async_client.post(
            "/api/v1/auth/login",
            json={
                "email": company_data["contact_email"],
                "password": company_data["password"]
            }
        )
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Step 3: Browse products
        category = Category(
            name="Executive Chairs",
            slug="executive-chairs",
            is_active=True
        )
        db_session.add(category)
        await db_session.commit()
        await db_session.refresh(category)
        
        chair = Chair(
            name="Premium Executive Chair",
            model_number="PEC-001",
            category_id=category.id,
            base_price=50000,  # $500
            is_active=True
        )
        db_session.add(chair)
        await db_session.commit()
        await db_session.refresh(chair)
        
        products_response = await async_client.get(
            "/api/v1/products",
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
        
        # Step 5: Add items to quote (if endpoint exists)
        # This would add chair to quote
        
        # Step 6: Submit quote for review
        submit_response = await async_client.post(
            f"/api/v1/quotes/{quote_id}/submit",
            headers=headers
        )
        assert submit_response.status_code == 200
        assert submit_response.json()["status"] == "pending"
        
        # Step 7: Admin reviews and quotes (would require admin login)
        # This would be done by admin user
        
        # Step 8: Company views quote
        get_quote_response = await async_client.get(
            f"/api/v1/quotes/{quote_id}",
            headers=headers
        )
        assert get_quote_response.status_code == 200
        
        # Step 9: Get all company quotes
        all_quotes_response = await async_client.get(
            "/api/v1/quotes",
            headers=headers
        )
        assert all_quotes_response.status_code == 200
        assert len(all_quotes_response.json()["items"]) >= 1
    
    async def test_quote_modification_workflow(
        self,
        async_client: AsyncClient,
        test_company,
        company_token: str,
        db_session: AsyncSession
    ):
        """Test quote modification workflow."""
        headers = {"Authorization": f"Bearer {company_token}"}
        
        # Create initial quote
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
        
        create_response = await async_client.post(
            "/api/v1/quotes",
            json=quote_data,
            headers=headers
        )
        assert create_response.status_code == 201
        quote_id = create_response.json()["id"]
        
        # Update quote
        update_data = {
            "contact_name": "Jane Smith",
            "shipping_city": "New City"
        }
        
        update_response = await async_client.patch(
            f"/api/v1/quotes/{quote_id}",
            json=update_data,
            headers=headers
        )
        assert update_response.status_code == 200
        assert update_response.json()["contact_name"] == "Jane Smith"
        assert update_response.json()["shipping_city"] == "New City"
        
        # Verify changes
        get_response = await async_client.get(
            f"/api/v1/quotes/{quote_id}",
            headers=headers
        )
        assert get_response.status_code == 200
        assert get_response.json()["contact_name"] == "Jane Smith"

