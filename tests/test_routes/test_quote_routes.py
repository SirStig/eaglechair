"""
Test Quote Routes

Integration tests for quote routes
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.quote import Quote, QuoteStatus
from backend.models.company import Company, CompanyStatus
from backend.models.chair import Chair, Category
from backend.core.security import SecurityManager

security_manager = SecurityManager()


@pytest.mark.integration
@pytest.mark.asyncio
class TestQuoteRoutes:
    """Test cases for quote routes"""
    
    async def test_create_quote_success(
        self,
        async_client: AsyncClient,
        company_token: str,
        db_session: AsyncSession
    ):
        """Test successful quote creation."""
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
        
        headers = {"Authorization": f"Bearer {company_token}"}
        
        response = await async_client.post(
            "/api/v1/quotes",
            json=quote_data,
            headers=headers
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["contact_name"] == "John Doe"
        assert data["status"] == "draft"
        assert "quote_number" in data
    
    async def test_create_quote_unauthorized(self, async_client: AsyncClient):
        """Test quote creation without authentication."""
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
        
        response = await async_client.post("/api/v1/quotes", json=quote_data)
        
        assert response.status_code == 401
    
    async def test_get_company_quotes_success(
        self,
        async_client: AsyncClient,
        test_company,
        company_token: str,
        db_session: AsyncSession
    ):
        """Test retrieving company's quotes."""
        # Create quotes
        for i in range(3):
            quote = Quote(
                quote_number=f"Q-{i+1:03d}",
                company_id=test_company.id,
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
        
        headers = {"Authorization": f"Bearer {company_token}"}
        
        response = await async_client.get("/api/v1/quotes", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 3
        assert data["total"] == 3
    
    async def test_get_quote_by_id_success(
        self,
        async_client: AsyncClient,
        test_company,
        company_token: str,
        db_session: AsyncSession
    ):
        """Test retrieving a specific quote."""
        # Create quote
        quote = Quote(
            quote_number="Q-001",
            company_id=test_company.id,
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
        
        headers = {"Authorization": f"Bearer {company_token}"}
        
        response = await async_client.get(f"/api/v1/quotes/{quote.id}", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == quote.id
        assert data["quote_number"] == "Q-001"
    
    async def test_get_quote_by_id_not_found(
        self,
        async_client: AsyncClient,
        company_token: str
    ):
        """Test retrieving non-existent quote."""
        headers = {"Authorization": f"Bearer {company_token}"}
        
        response = await async_client.get("/api/v1/quotes/99999", headers=headers)
        
        assert response.status_code == 404
    
    async def test_update_quote_success(
        self,
        async_client: AsyncClient,
        test_company,
        company_token: str,
        db_session: AsyncSession
    ):
        """Test updating a quote."""
        # Create quote
        quote = Quote(
            quote_number="Q-001",
            company_id=test_company.id,
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
        
        update_data = {
            "contact_name": "Jane Smith",
            "contact_email": "jane@test.com"
        }
        
        headers = {"Authorization": f"Bearer {company_token}"}
        
        response = await async_client.patch(
            f"/api/v1/quotes/{quote.id}",
            json=update_data,
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["contact_name"] == "Jane Smith"
        assert data["contact_email"] == "jane@test.com"
    
    async def test_delete_quote_success(
        self,
        async_client: AsyncClient,
        test_company,
        company_token: str,
        db_session: AsyncSession
    ):
        """Test deleting a quote."""
        # Create quote
        quote = Quote(
            quote_number="Q-001",
            company_id=test_company.id,
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
        
        headers = {"Authorization": f"Bearer {company_token}"}
        
        response = await async_client.delete(f"/api/v1/quotes/{quote.id}", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
    
    async def test_submit_quote_success(
        self,
        async_client: AsyncClient,
        test_company,
        company_token: str,
        db_session: AsyncSession
    ):
        """Test submitting a quote for review."""
        # Create quote
        quote = Quote(
            quote_number="Q-001",
            company_id=test_company.id,
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
        
        headers = {"Authorization": f"Bearer {company_token}"}
        
        response = await async_client.post(
            f"/api/v1/quotes/{quote.id}/submit",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pending"

