"""
Test Product Routes

Integration tests for product routes
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.chair import Chair, Category


@pytest.mark.integration
@pytest.mark.products
class TestProductRoutes:
    """Test cases for product routes"""
    
    @pytest.mark.asyncio
    async def test_get_categories_success(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test successful retrieval of categories."""
        # Create test categories
        category1 = Category(
            name="Executive Chairs",
            description="Premium executive seating",
            slug="executive-chairs",
            is_active=True,
            sort_order=1
        )
        category2 = Category(
            name="Office Chairs",
            description="Standard office seating",
            slug="office-chairs",
            is_active=True,
            sort_order=2
        )
        
        db_session.add(category1)
        db_session.add(category2)
        await db_session.commit()
        
        response = await async_client.get("/api/v1/categories")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["name"] == "Executive Chairs"
        assert data[1]["name"] == "Office Chairs"
    
    @pytest.mark.asyncio
    async def test_get_category_by_id_success(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test successful category retrieval by ID."""
        # Create test category
        category = Category(
            name="Test Category",
            description="Test category description",
            slug="test-category",
            is_active=True,
            sort_order=1
        )
        
        db_session.add(category)
        await db_session.commit()
        await db_session.refresh(category)
        
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
        data = response.json()
        assert "error" in data or "detail" in data
    
    @pytest.mark.asyncio
    async def test_get_category_by_slug_success(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test successful category retrieval by slug."""
        # Create test category
        category = Category(
            name="Test Category",
            description="Test category description",
            slug="test-category",
            is_active=True,
            sort_order=1
        )
        
        db_session.add(category)
        await db_session.commit()
        
        response = await async_client.get("/api/v1/categories/slug/test-category")
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == category.id
        assert data["name"] == category.name
        assert data["slug"] == "test-category"
    
    @pytest.mark.asyncio
    async def test_get_products_success(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test successful retrieval of products."""
        # Create test category
        category = Category(
            name="Test Category",
            description="Test category",
            slug="test-category",
            is_active=True,
            sort_order=1
        )
        db_session.add(category)
        await db_session.commit()
        await db_session.refresh(category)
        
        # Create test products
        product1 = Chair(
            name="Product 1",
            description="Test product 1",
            model_number="P1-001",
            category_id=category.id,
            base_price=10000,
            minimum_order_quantity=1,
            is_active=True
        )
        product2 = Chair(
            name="Product 2",
            description="Test product 2",
            model_number="P2-001",
            category_id=category.id,
            base_price=20000,
            minimum_order_quantity=1,
            is_active=True
        )
        
        db_session.add(product1)
        db_session.add(product2)
        await db_session.commit()
        
        response = await async_client.get("/api/v1/products")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2
        assert data["total"] == 2
        assert data["page"] == 1
        assert data["page_size"] == 20
        assert data["pages"] == 1
    
    @pytest.mark.asyncio
    async def test_get_products_with_pagination(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test product retrieval with pagination."""
        # Create test category
        category = Category(
            name="Test Category",
            description="Test category",
            slug="test-category",
            is_active=True,
            sort_order=1
        )
        db_session.add(category)
        await db_session.commit()
        await db_session.refresh(category)
        
        # Create test products
        for i in range(25):
            product = Chair(
                name=f"Product {i+1}",
                description=f"Test product {i+1}",
                model_number=f"P{i+1:03d}",
                category_id=category.id,
                base_price=10000 + i * 1000,
                minimum_order_quantity=1,
                is_active=True
            )
            db_session.add(product)
        
        await db_session.commit()
        
        # Test first page
        response = await async_client.get("/api/v1/products?page=1&page_size=10")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 10
        assert data["total"] == 25
        assert data["page"] == 1
        assert data["page_size"] == 10
        assert data["pages"] == 3
        
        # Test second page
        response = await async_client.get("/api/v1/products?page=2&page_size=10")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 10
        assert data["page"] == 2
    
    @pytest.mark.asyncio
    async def test_get_products_with_search(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test product retrieval with search."""
        # Create test category
        category = Category(
            name="Test Category",
            description="Test category",
            slug="test-category",
            is_active=True,
            sort_order=1
        )
        db_session.add(category)
        await db_session.commit()
        await db_session.refresh(category)
        
        # Create test products
        product1 = Chair(
            name="Executive Chair",
            description="Premium executive seating",
            model_number="EC-001",
            category_id=category.id,
            base_price=10000,
            minimum_order_quantity=1,
            is_active=True
        )
        product2 = Chair(
            name="Office Chair",
            description="Standard office seating",
            model_number="OC-001",
            category_id=category.id,
            base_price=20000,
            minimum_order_quantity=1,
            is_active=True
        )
        
        db_session.add(product1)
        db_session.add(product2)
        await db_session.commit()
        
        # Test search by name
        response = await async_client.get("/api/v1/products?search=Executive")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["total"] == 1
        assert data["items"][0]["name"] == "Executive Chair"
        
        # Test search by description
        response = await async_client.get("/api/v1/products?search=office")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["total"] == 1
        assert data["items"][0]["name"] == "Office Chair"
    
    @pytest.mark.asyncio
    async def test_get_products_with_filters(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test product retrieval with filters."""
        # Create test categories
        category1 = Category(
            name="Category 1",
            description="Test category 1",
            slug="category-1",
            is_active=True,
            sort_order=1
        )
        category2 = Category(
            name="Category 2",
            description="Test category 2",
            slug="category-2",
            is_active=True,
            sort_order=2
        )
        
        db_session.add(category1)
        db_session.add(category2)
        await db_session.commit()
        await db_session.refresh(category1)
        await db_session.refresh(category2)
        
        # Create test products
        product1 = Chair(
            name="Active Product",
            description="Active test product",
            model_number="AP-001",
            category_id=category1.id,
            base_price=10000,
            minimum_order_quantity=1,
            is_active=True
        )
        product2 = Chair(
            name="Inactive Product",
            description="Inactive test product",
            model_number="IP-001",
            category_id=category2.id,
            base_price=20000,
            minimum_order_quantity=1,
            is_active=False
        )
        
        db_session.add(product1)
        db_session.add(product2)
        await db_session.commit()
        
        # Test filter by active status
        response = await async_client.get("/api/v1/products?is_active=true")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["total"] == 1
        assert data["items"][0]["name"] == "Active Product"
        
        # Test filter by category
        response = await async_client.get(f"/api/v1/products?category_id={category1.id}")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["total"] == 1
        assert data["items"][0]["name"] == "Active Product"
    
    @pytest.mark.asyncio
    async def test_get_product_by_id_success(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test successful product retrieval by ID."""
        # Create test category
        category = Category(
            name="Test Category",
            description="Test category",
            slug="test-category",
            is_active=True,
            sort_order=1
        )
        db_session.add(category)
        await db_session.commit()
        await db_session.refresh(category)
        
        # Create test product
        product = Chair(
            name="Test Product",
            description="Test product description",
            model_number="TP-001",
            category_id=category.id,
            base_price=10000,
            minimum_order_quantity=1,
            is_active=True
        )
        
        db_session.add(product)
        await db_session.commit()
        await db_session.refresh(product)
        
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
        data = response.json()
        assert "error" in data or "detail" in data
    
    @pytest.mark.asyncio
    async def test_get_product_by_slug_success(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test successful product retrieval by slug."""
        # Create test category
        category = Category(
            name="Test Category",
            description="Test category",
            slug="test-category",
            is_active=True,
            sort_order=1
        )
        db_session.add(category)
        await db_session.commit()
        await db_session.refresh(category)
        
        # Create test product
        product = Chair(
            name="Test Product",
            description="Test product description",
            model_number="TP-001",
            slug="test-product",
            category_id=category.id,
            base_price=10000,
            minimum_order_quantity=1,
            is_active=True
        )
        
        db_session.add(product)
        await db_session.commit()
        
        response = await async_client.get("/api/v1/products/slug/test-product")
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == product.id
        assert data["name"] == product.name
        assert data["slug"] == "test-product"
    
    @pytest.mark.asyncio
    async def test_get_product_by_model_number_success(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test successful product retrieval by model number."""
        # Create test category
        category = Category(
            name="Test Category",
            description="Test category",
            slug="test-category",
            is_active=True,
            sort_order=1
        )
        db_session.add(category)
        await db_session.commit()
        await db_session.refresh(category)
        
        # Create test product
        product = Chair(
            name="Test Product",
            description="Test product description",
            model_number="TP-001",
            category_id=category.id,
            base_price=10000,
            minimum_order_quantity=1,
            is_active=True
        )
        
        db_session.add(product)
        await db_session.commit()
        
        response = await async_client.get("/api/v1/products/model/TP-001")
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == product.id
        assert data["name"] == product.name
        assert data["model_number"] == "TP-001"
    
    @pytest.mark.asyncio
    async def test_search_products_success(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test successful product search."""
        # Create test category
        category = Category(
            name="Test Category",
            description="Test category",
            slug="test-category",
            is_active=True,
            sort_order=1
        )
        db_session.add(category)
        await db_session.commit()
        await db_session.refresh(category)
        
        # Create test products
        product1 = Chair(
            name="Executive Chair",
            description="Premium executive seating",
            model_number="EC-001",
            category_id=category.id,
            base_price=10000,
            minimum_order_quantity=1,
            is_active=True
        )
        product2 = Chair(
            name="Office Chair",
            description="Standard office seating",
            model_number="OC-001",
            category_id=category.id,
            base_price=20000,
            minimum_order_quantity=1,
            is_active=True
        )
        
        db_session.add(product1)
        db_session.add(product2)
        await db_session.commit()
        
        response = await async_client.get("/api/v1/products/search?q=executive")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Executive Chair"
    
    @pytest.mark.asyncio
    async def test_get_finishes_success(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test successful retrieval of finishes."""
        from backend.models.chair import Finish
        
        # Create test finishes
        finish1 = Finish(
            name="Oak",
            description="Natural oak finish",
            color_code="#8B4513",
            is_active=True,
            sort_order=1
        )
        finish2 = Finish(
            name="Walnut",
            description="Rich walnut finish",
            color_code="#722F37",
            is_active=True,
            sort_order=2
        )
        
        db_session.add(finish1)
        db_session.add(finish2)
        await db_session.commit()
        
        response = await async_client.get("/api/v1/finishes")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["name"] == "Oak"
        assert data[1]["name"] == "Walnut"
    
    @pytest.mark.asyncio
    async def test_get_upholsteries_success(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test successful retrieval of upholsteries."""
        from backend.models.chair import Upholstery
        
        # Create test upholsteries
        upholstery1 = Upholstery(
            name="Leather",
            description="Premium leather upholstery",
            color_code="#000000",
            is_active=True,
            sort_order=1
        )
        upholstery2 = Upholstery(
            name="Fabric",
            description="Comfortable fabric upholstery",
            color_code="#FFFFFF",
            is_active=True,
            sort_order=2
        )
        
        db_session.add(upholstery1)
        db_session.add(upholstery2)
        await db_session.commit()
        
        response = await async_client.get("/api/v1/upholsteries")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["name"] == "Leather"
        assert data[1]["name"] == "Fabric"
