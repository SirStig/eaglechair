"""
Test Product Service

Unit tests for product service
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import AsyncMock, patch

from backend.services.product_service import ProductService
from backend.models.chair import Chair, Category, Finish, Upholstery
from backend.core.exceptions import (
    ResourceNotFoundError,
    ValidationError,
    BusinessLogicError
)


@pytest.mark.unit
@pytest.mark.products
class TestProductService:
    """Test cases for ProductService"""
    
    @pytest.mark.asyncio
    async def test_get_all_categories_success(self, db_session: AsyncSession):
        """Test successful retrieval of all categories."""
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
        
        # Test retrieval
        categories = await ProductService.get_all_categories(db_session)
        
        assert len(categories) == 2
        assert categories[0].name == "Executive Chairs"
        assert categories[1].name == "Office Chairs"
    
    @pytest.mark.asyncio
    async def test_get_all_categories_include_inactive(self, db_session: AsyncSession):
        """Test retrieval of categories including inactive ones."""
        # Create test categories
        category1 = Category(
            name="Active Category",
            description="Active category",
            slug="active-category",
            is_active=True,
            sort_order=1
        )
        category2 = Category(
            name="Inactive Category",
            description="Inactive category",
            slug="inactive-category",
            is_active=False,
            sort_order=2
        )
        
        db_session.add(category1)
        db_session.add(category2)
        await db_session.commit()
        
        # Test retrieval including inactive
        categories = await ProductService.get_all_categories(db_session, include_inactive=True)
        
        assert len(categories) == 2
        
        # Test retrieval excluding inactive
        categories = await ProductService.get_all_categories(db_session, include_inactive=False)
        
        assert len(categories) == 1
        assert categories[0].name == "Active Category"
    
    @pytest.mark.asyncio
    async def test_get_category_by_id_success(self, db_session: AsyncSession):
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
        
        # Test retrieval
        retrieved_category = await ProductService.get_category_by_id(db_session, category.id)
        
        assert retrieved_category.id == category.id
        assert retrieved_category.name == category.name
        assert retrieved_category.slug == category.slug
    
    @pytest.mark.asyncio
    async def test_get_category_by_id_not_found(self, db_session: AsyncSession):
        """Test category retrieval with non-existent ID."""
        with pytest.raises(ResourceNotFoundError) as exc_info:
            await ProductService.get_category_by_id(db_session, 99999)
        
        assert "category" in str(exc_info.value).lower()
    
    @pytest.mark.asyncio
    async def test_get_category_by_slug_success(self, db_session: AsyncSession):
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
        
        # Test retrieval
        retrieved_category = await ProductService.get_category_by_slug(db_session, "test-category")
        
        assert retrieved_category.id == category.id
        assert retrieved_category.name == category.name
        assert retrieved_category.slug == "test-category"
    
    @pytest.mark.asyncio
    async def test_get_category_by_slug_not_found(self, db_session: AsyncSession):
        """Test category retrieval with non-existent slug."""
        with pytest.raises(ResourceNotFoundError) as exc_info:
            await ProductService.get_category_by_slug(db_session, "non-existent-slug")
        
        assert "category" in str(exc_info.value).lower()
    
    @pytest.mark.asyncio
    async def test_get_all_products_success(self, db_session: AsyncSession):
        """Test successful retrieval of all products."""
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
        
        # Test retrieval
        products, total_count = await ProductService.get_all_products(
            db_session, page=1, page_size=10
        )
        
        assert len(products) == 2
        assert total_count == 2
        assert products[0].name == "Product 1"
        assert products[1].name == "Product 2"
    
    @pytest.mark.asyncio
    async def test_get_all_products_with_filters(self, db_session: AsyncSession):
        """Test product retrieval with filters."""
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
            name="Active Product",
            description="Active test product",
            model_number="AP-001",
            category_id=category.id,
            base_price=10000,
            minimum_order_quantity=1,
            is_active=True
        )
        product2 = Chair(
            name="Inactive Product",
            description="Inactive test product",
            model_number="IP-001",
            category_id=category.id,
            base_price=20000,
            minimum_order_quantity=1,
            is_active=False
        )
        
        db_session.add(product1)
        db_session.add(product2)
        await db_session.commit()
        
        # Test retrieval with active filter
        products, total_count = await ProductService.get_all_products(
            db_session, page=1, page_size=10, is_active=True
        )
        
        assert len(products) == 1
        assert total_count == 1
        assert products[0].name == "Active Product"
        
        # Test retrieval with category filter
        products, total_count = await ProductService.get_all_products(
            db_session, page=1, page_size=10, category_id=category.id
        )
        
        assert len(products) == 2
        assert total_count == 2
    
    @pytest.mark.asyncio
    async def test_get_all_products_with_search(self, db_session: AsyncSession):
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
        products, total_count = await ProductService.get_all_products(
            db_session, page=1, page_size=10, search="Executive"
        )
        
        assert len(products) == 1
        assert total_count == 1
        assert products[0].name == "Executive Chair"
        
        # Test search by description
        products, total_count = await ProductService.get_all_products(
            db_session, page=1, page_size=10, search="office"
        )
        
        assert len(products) == 1
        assert total_count == 1
        assert products[0].name == "Office Chair"
    
    @pytest.mark.asyncio
    async def test_get_product_by_id_success(self, db_session: AsyncSession):
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
        
        # Test retrieval
        retrieved_product = await ProductService.get_product_by_id(db_session, product.id)
        
        assert retrieved_product.id == product.id
        assert retrieved_product.name == product.name
        assert retrieved_product.model_number == product.model_number
    
    @pytest.mark.asyncio
    async def test_get_product_by_id_not_found(self, db_session: AsyncSession):
        """Test product retrieval with non-existent ID."""
        with pytest.raises(ResourceNotFoundError) as exc_info:
            await ProductService.get_product_by_id(db_session, 99999)
        
        assert "product" in str(exc_info.value).lower()
    
    @pytest.mark.asyncio
    async def test_get_product_by_slug_success(self, db_session: AsyncSession):
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
        
        # Test retrieval
        retrieved_product = await ProductService.get_product_by_slug(db_session, "test-product")
        
        assert retrieved_product.id == product.id
        assert retrieved_product.name == product.name
        assert retrieved_product.slug == "test-product"
    
    @pytest.mark.asyncio
    async def test_get_product_by_model_number_success(self, db_session: AsyncSession):
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
        
        # Test retrieval
        retrieved_product = await ProductService.get_product_by_model_number(db_session, "TP-001")
        
        assert retrieved_product.id == product.id
        assert retrieved_product.name == product.name
        assert retrieved_product.model_number == "TP-001"
    
    @pytest.mark.asyncio
    async def test_search_products_success(self, db_session: AsyncSession):
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
        
        # Test search
        products = await ProductService.search_products(db_session, "executive")
        
        assert len(products) == 1
        assert products[0].name == "Executive Chair"
    
    @pytest.mark.asyncio
    async def test_increment_product_views(self, db_session: AsyncSession):
        """Test product view count increment."""
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
            is_active=True,
            view_count=0
        )
        
        db_session.add(product)
        await db_session.commit()
        await db_session.refresh(product)
        
        initial_views = product.view_count
        
        # Test increment
        await ProductService.increment_product_views(db_session, product.id)
        
        await db_session.refresh(product)
        assert product.view_count == initial_views + 1
    
    @pytest.mark.asyncio
    async def test_get_all_finishes_success(self, db_session: AsyncSession):
        """Test successful retrieval of all finishes."""
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
        
        # Test retrieval
        finishes = await ProductService.get_all_finishes(db_session)
        
        assert len(finishes) == 2
        assert finishes[0].name == "Oak"
        assert finishes[1].name == "Walnut"
    
    @pytest.mark.asyncio
    async def test_get_all_upholsteries_success(self, db_session: AsyncSession):
        """Test successful retrieval of all upholsteries."""
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
        
        # Test retrieval
        upholsteries = await ProductService.get_all_upholsteries(db_session)
        
        assert len(upholsteries) == 2
        assert upholsteries[0].name == "Leather"
        assert upholsteries[1].name == "Fabric"
