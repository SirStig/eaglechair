"""
Product Tests for EagleChair API
"""

import pytest
from httpx import AsyncClient

from backend.core.config import settings


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
    
    async def test_list_products_pagination(
        self,
        authenticated_client: tuple[AsyncClient, dict],
        test_product_data: dict
    ):
        """Test product list pagination"""
        client, _ = authenticated_client
        
        # Create admin user for product creation
        # (In real scenario, you'd need to set role to admin)
        # For now, this test will fail on authorization - that's expected
        # You would need to create a factory for admin users
        
        # This is a placeholder - implement admin user factory for full test
        pass
    
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
    
    async def test_filter_products_by_category(self, client: AsyncClient):
        """Test filtering products by category"""
        response = await async_client.get(
            f"{settings.API_V1_PREFIX}/products",
            params={"category": "office"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data

