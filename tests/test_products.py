"""
Product Tests for EagleChair API
"""

import pytest
from httpx import AsyncClient

from backend.core.config import settings
from tests.factories import create_category, create_chair


@pytest.mark.asyncio
class TestProducts:
    """Test product endpoints"""
    
    async def test_list_products_empty(self, async_client: AsyncClient):
        """Test listing products when none exist"""
        response = await async_client.get(f"{settings.API_V1_PREFIX}/products")
        
        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0
        assert data["page"] == 1
    
    async def test_get_product_not_found(self, async_client: AsyncClient):
        """Test getting non-existent product"""
        response = await async_client.get(f"{settings.API_V1_PREFIX}/products/99999")
        
        assert response.status_code == 404
    
    async def test_search_products(self, async_client: AsyncClient):
        """Test product search functionality"""
        response = await async_client.get(
            f"{settings.API_V1_PREFIX}/products",
            params={"search": "chair"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
    
    async def test_filter_products_by_category(self, async_client: AsyncClient, db_session):
        """Test filtering products by category"""
        office = await create_category(db_session, name="Office", slug="office")
        lounge = await create_category(db_session, name="Lounge", slug="lounge")
        office_chair = await create_chair(db_session, category_id=office.id, is_active=True)
        await create_chair(db_session, category_id=lounge.id, is_active=True)

        response = await async_client.get(
            f"{settings.API_V1_PREFIX}/products",
            params={"category_id": office.id}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert [item["id"] for item in data["items"]] == [office_chair.id]
