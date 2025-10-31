"""
Test Product Routes

Integration tests for product routes
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories import (
    create_category,
    create_chair,
    create_finish,
    create_upholstery,
)


@pytest.mark.integration
@pytest.mark.products
class TestProductRoutes:
    """Test cases for product routes"""
    
    @pytest.mark.asyncio
    async def test_get_categories_success(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test successful retrieval of categories."""
        # Create test categories using factories
        category1 = await create_category(
            db_session,
            name="Executive Chairs",
            description="Premium executive seating",
            slug="executive-chairs",
            display_order=1
        )
        category2 = await create_category(
            db_session,
            name="Office Chairs",
            slug="office-chairs",
            display_order=2
        )
        
        response = await async_client.get("/api/v1/categories")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        # Categories are sorted by sort_order
        category_names = [c["name"] for c in data]
        assert "Executive Chairs" in category_names
        assert "Office Chairs" in category_names
    
    @pytest.mark.asyncio
    async def test_get_category_by_id_success(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test successful category retrieval by ID."""
        category = await create_category(db_session)
        
        response = await async_client.get(f"/api/v1/categories/{category.id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == category.id
        assert data["name"] == category.name
        assert data["slug"] == category.slug
    
    @pytest.mark.asyncio
    async def test_get_category_by_id_not_found(self, async_client: AsyncClient):
        """Test category retrieval with non-existent ID."""
        response = await async_client.get("/api/v1/categories/99999")
        
        assert response.status_code == 404
    
    @pytest.mark.asyncio
    async def test_get_category_by_slug_success(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test successful category retrieval by slug."""
        category = await create_category(
            db_session,
            slug="test-category"
        )
        
        response = await async_client.get("/api/v1/categories/slug/test-category")
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == category.id
        assert data["name"] == category.name
        assert data["slug"] == "test-category"
    
    @pytest.mark.asyncio
    async def test_get_products_success(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test successful retrieval of products."""
        category = await create_category(db_session)
        
        # Create test products using factories
        product1 = await create_chair(db_session, category_id=category.id)
        product2 = await create_chair(db_session, category_id=category.id)
        
        response = await async_client.get("/api/v1/products")
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "per_page" in data or "page_size" in data
        assert len(data["items"]) >= 2
        assert data["total"] >= 2
    
    @pytest.mark.asyncio
    async def test_get_products_with_pagination(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test product retrieval with pagination."""
        category = await create_category(db_session)
        
        # Create test products using factories
        for i in range(25):
            await create_chair(
                db_session,
                category_id=category.id,
                name=f"Product {i+1}",
                model_number=f"P{i+1:03d}"
            )
        
        # Test first page
        response = await async_client.get("/api/v1/products?page=1&per_page=10")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 10
        assert data["total"] >= 25
        assert data["page"] == 1
        assert data["per_page"] == 10 or data.get("page_size") == 10
        
        # Test second page
        response = await async_client.get("/api/v1/products?page=2&per_page=10")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 10
        assert data["page"] == 2
    
    @pytest.mark.asyncio
    async def test_get_products_with_search(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test product retrieval with search."""
        category = await create_category(db_session)
        
        # Create test products using factories
        product1 = await create_chair(
            db_session,
            category_id=category.id,
            name="Executive Chair",
            short_description="Premium executive seating"
        )
        product2 = await create_chair(
            db_session,
            category_id=category.id,
            name="Office Chair",
            short_description="Standard office seating"
        )
        
        # Test search by name
        response = await async_client.get("/api/v1/products?search=Executive")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 1
        assert any("Executive" in item["name"] for item in data["items"])
        
        # Test search by description
        response = await async_client.get("/api/v1/products?search=office")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 1
        assert any("office" in item.get("description", "").lower() or "Office" in item.get("name", "") for item in data["items"])
    
    @pytest.mark.asyncio
    async def test_get_products_with_filters(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test product retrieval with filters."""
        category1 = await create_category(db_session, slug="category-1")
        category2 = await create_category(db_session, slug="category-2")
        
        # Create test products using factories
        product1 = await create_chair(
            db_session,
            category_id=category1.id,
            name="Active Product",
            is_active=True
        )
        product2 = await create_chair(
            db_session,
            category_id=category2.id,
            name="Inactive Product",
            is_active=False
        )
        
        # Test filter by active status
        response = await async_client.get("/api/v1/products?is_active=true")
        
        assert response.status_code == 200
        data = response.json()
        # Should only return active products
        active_items = [item for item in data["items"] if item.get("is_active", True)]
        assert len(active_items) >= 1
        
        # Test filter by category
        response = await async_client.get(f"/api/v1/products?category_id={category1.id}")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 1
        assert all(item.get("category_id") == category1.id for item in data["items"])
    
    @pytest.mark.asyncio
    async def test_get_product_by_id_success(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test successful product retrieval by ID."""
        category = await create_category(db_session)
        product = await create_chair(db_session, category_id=category.id)
        
        response = await async_client.get(f"/api/v1/products/{product.id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == product.id
        assert data["name"] == product.name
        assert data["model_number"] == product.model_number
    
    @pytest.mark.asyncio
    async def test_get_product_by_id_not_found(self, async_client: AsyncClient):
        """Test product retrieval with non-existent ID."""
        response = await async_client.get("/api/v1/products/99999")
        
        assert response.status_code == 404
    
    @pytest.mark.asyncio
    async def test_get_product_by_slug_success(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test successful product retrieval by slug."""
        category = await create_category(db_session)
        product = await create_chair(
            db_session,
            category_id=category.id,
            slug="test-product"
        )
        
        response = await async_client.get("/api/v1/products/slug/test-product")
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == product.id
        assert data["name"] == product.name
        assert data["slug"] == "test-product"
    
    @pytest.mark.asyncio
    async def test_get_product_by_model_number_success(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test successful product retrieval by model number."""
        category = await create_category(db_session)
        product = await create_chair(
            db_session,
            category_id=category.id,
            model_number="TP-001"
        )
        
        response = await async_client.get("/api/v1/products/model/TP-001")
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == product.id
        assert data["name"] == product.name
        assert data["model_number"] == "TP-001"
    
    @pytest.mark.asyncio
    async def test_search_products_success(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test successful product search."""
        category = await create_category(db_session)
        
        # Create test products using factories
        product1 = await create_chair(
            db_session,
            category_id=category.id,
            name="Executive Chair",
            short_description="Premium executive seating"
        )
        product2 = await create_chair(
            db_session,
            category_id=category.id,
            name="Office Chair",
            short_description="Standard office seating"
        )
        
        response = await async_client.get("/api/v1/products/search?q=executive")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert any("executive" in item.get("name", "").lower() or "executive" in item.get("description", "").lower() for item in data)
    
    @pytest.mark.asyncio
    async def test_get_finishes_success(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test successful retrieval of finishes."""
        # Create test finishes using factories
        finish1 = await create_finish(
            db_session,
            name="Oak",
            description="Natural oak finish",
            color_hex="#8B4513",
            display_order=1
        )
        finish2 = await create_finish(
            db_session,
            name="Walnut",
            description="Rich walnut finish",
            color_hex="#722F37",
            display_order=2
        )
        
        response = await async_client.get("/api/v1/finishes")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
        finish_names = [f["name"] for f in data]
        assert "Oak" in finish_names
        assert "Walnut" in finish_names
    
    @pytest.mark.asyncio
    async def test_get_upholsteries_success(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test successful retrieval of upholsteries."""
        # Create test upholsteries using factories
        upholstery1 = await create_upholstery(
            db_session,
            name="Leather",
            description="Premium leather upholstery",
            color_hex="#000000",
            display_order=1
        )
        upholstery2 = await create_upholstery(
            db_session,
            name="Fabric",
            description="Comfortable fabric upholstery",
            color_hex="#FFFFFF",
            display_order=2
        )
        
        response = await async_client.get("/api/v1/upholsteries")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
        upholstery_names = [u["name"] for u in data]
        assert "Leather" in upholstery_names
        assert "Fabric" in upholstery_names
