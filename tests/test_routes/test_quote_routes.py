"""
Test Quote Routes

Integration tests for quote routes
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.quote import QuoteStatus
from backend.models.company import CompanyStatus
from tests.factories import create_quote, create_chair, create_category, create_quote_item


@pytest.mark.integration
@pytest.mark.asyncio
class TestQuoteRoutes:
    """Test cases for quote routes"""
    
    async def test_create_quote_from_cart_success(
        self,
        async_client: AsyncClient,
        company_token: str,
        test_company,
        db_session: AsyncSession
    ):
        """Test successful quote creation from cart."""
        # First, create a cart with items
        category = await create_category(db_session)
        product = await create_chair(db_session, category_id=category.id)
        
        # Add item to cart
        headers = {"Authorization": f"Bearer {company_token}"}
        cart_item = {
            "product_id": product.id,
            "quantity": 5
        }
        
        # Add to cart first
        await async_client.post(
            "/api/v1/quotes/cart/items",
            json=cart_item,
            headers=headers
        )
        
        # Now convert cart to quote
        quote_data = {
            "shipping_address_line1": "123 Main St",
            "shipping_city": "Test City",
            "shipping_state": "TS",
            "shipping_zip": "12345",
            "shipping_country": "USA",
            "project_name": "Test Project",
            "project_description": "Test description"
        }
        
        response = await async_client.post(
            "/api/v1/quotes/request",
            json=quote_data,
            headers=headers
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "submitted"
        assert "quote_number" in data
    
    async def test_create_quote_unauthorized(self, async_client: AsyncClient):
        """Test quote creation without authentication."""
        quote_data = {
            "shipping_address_line1": "123 Main St",
            "shipping_city": "Test City",
            "shipping_state": "TS",
            "shipping_zip": "12345",
            "shipping_country": "USA"
        }
        
        response = await async_client.post("/api/v1/quotes/request", json=quote_data)
        
        assert response.status_code == 401
    
    async def test_get_company_quotes_success(
        self,
        async_client: AsyncClient,
        test_company,
        company_token: str,
        db_session: AsyncSession
    ):
        """Test retrieving company's quotes."""
        # Create quotes using factories
        for i in range(3):
            await create_quote(
                db_session,
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
        
        headers = {"Authorization": f"Bearer {company_token}"}
        
        response = await async_client.get("/api/v1/quotes/", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        # Quotes endpoint returns a list directly
        assert isinstance(data, list)
        assert len(data) >= 3
    
    async def test_get_quote_by_id_success(
        self,
        async_client: AsyncClient,
        test_company,
        company_token: str,
        db_session: AsyncSession
    ):
        """Test retrieving a specific quote."""
        quote = await create_quote(
            db_session,
            company_id=test_company.id
        )
        
        headers = {"Authorization": f"Bearer {company_token}"}
        
        response = await async_client.get(
            f"/api/v1/quotes/{quote.id}",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == quote.id
        assert data["quote_number"] == quote.quote_number
    
    async def test_get_quote_by_id_not_found(
        self,
        async_client: AsyncClient,
        company_token: str
    ):
        """Test retrieving non-existent quote."""
        headers = {"Authorization": f"Bearer {company_token}"}
        
        response = await async_client.get(
            "/api/v1/quotes/99999",
            headers=headers
        )
        
        assert response.status_code == 404
    
    async def test_update_cart_item_success(
        self,
        async_client: AsyncClient,
        test_company,
        company_token: str,
        db_session: AsyncSession
    ):
        """Test updating a cart item."""
        # Create cart with item
        category = await create_category(db_session)
        product = await create_chair(db_session, category_id=category.id)
        
        headers = {"Authorization": f"Bearer {company_token}"}
        
        # Add item to cart
        cart_item_data = {
            "product_id": product.id,
            "quantity": 5
        }
        add_response = await async_client.post(
            "/api/v1/quotes/cart/items",
            json=cart_item_data,
            headers=headers
        )
        assert add_response.status_code == 201
        cart_item = add_response.json()
        cart_item_id = cart_item["id"]
        
        # Update cart item (only quantity, unit_price is calculated by service)
        update_data = {
            "quantity": 10
        }
        
        response = await async_client.patch(
            f"/api/v1/quotes/cart/items/{cart_item_id}",
            json=update_data,
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["quantity"] == 10
        # unit_price is calculated by service (may include pricing tier adjustments)
        assert data["unit_price"] > 0
    
    async def test_add_item_to_cart_success(
        self,
        async_client: AsyncClient,
        test_company,
        company_token: str,
        db_session: AsyncSession
    ):
        """Test adding an item to cart."""
        category = await create_category(db_session)
        product = await create_chair(db_session, category_id=category.id, minimum_order_quantity=1)
        
        item_data = {
            "product_id": product.id,
            "quantity": 5
        }
        
        headers = {"Authorization": f"Bearer {company_token}"}
        
        response = await async_client.post(
            "/api/v1/quotes/cart/items",
            json=item_data,
            headers=headers
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["product_id"] == product.id
        assert data["quantity"] == 5
    
    async def test_submit_quote_from_cart_success(
        self,
        async_client: AsyncClient,
        test_company,
        company_token: str,
        db_session: AsyncSession
    ):
        """Test submitting a quote by converting cart."""
        # First, add items to cart
        category = await create_category(db_session)
        product = await create_chair(db_session, category_id=category.id)
        
        headers = {"Authorization": f"Bearer {company_token}"}
        
        # Add item to cart
        cart_item_data = {
            "product_id": product.id,
            "quantity": 5
        }
        await async_client.post(
            "/api/v1/quotes/cart/items",
            json=cart_item_data,
            headers=headers
        )
        
        # Submit quote (convert cart to quote)
        quote_data = {
            "shipping_address_line1": "123 Main St",
            "shipping_city": "Test City",
            "shipping_state": "TS",
            "shipping_zip": "12345",
            "shipping_country": "USA"
        }
        
        response = await async_client.post(
            "/api/v1/quotes/request",
            json=quote_data,
            headers=headers
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "submitted"
