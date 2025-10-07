"""
Unit Tests for Chair Models

Tests all chair-related model functionality
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.models.chair import Chair, Category, Finish, Upholstery


@pytest.mark.unit
@pytest.mark.asyncio
class TestCategoryModel:
    """Test cases for Category model"""
    
    async def test_create_category(self, db_session: AsyncSession):
        """Test creating a new category."""
        category = Category(
            name="Executive Chairs",
            description="Premium executive seating",
            slug="executive-chairs",
            is_active=True,
            display_order=1
        )
        
        db_session.add(category)
        await db_session.commit()
        await db_session.refresh(category)
        
        assert category.id is not None
        assert category.name == "Executive Chairs"
        assert category.slug == "executive-chairs"
        assert category.is_active is True
        assert category.created_at is not None
    
    async def test_category_unique_slug(self, db_session: AsyncSession):
        """Test that category slug must be unique."""
        category1 = Category(
            name="Category 1",
            slug="test-category",
            is_active=True
        )
        
        db_session.add(category1)
        await db_session.commit()
        
        # Try to create another category with same slug
        category2 = Category(
            name="Category 2",
            slug="test-category",  # Same slug
            is_active=True
        )
        
        db_session.add(category2)
        
        with pytest.raises(Exception):  # Should raise IntegrityError
            await db_session.commit()
    
    async def test_category_sorting(self, db_session: AsyncSession):
        """Test category sorting by display_order."""
        categories = [
            Category(name="Cat 3", slug="cat-3", display_order=3),
            Category(name="Cat 1", slug="cat-1", display_order=1),
            Category(name="Cat 2", slug="cat-2", display_order=2),
        ]
        
        for cat in categories:
            db_session.add(cat)
        
        await db_session.commit()
        
        # Query with order by
        result = await db_session.execute(
            select(Category).order_by(Category.display_order)
        )
        sorted_cats = result.scalars().all()
        
        assert sorted_cats[0].name == "Cat 1"
        assert sorted_cats[1].name == "Cat 2"
        assert sorted_cats[2].name == "Cat 3"


@pytest.mark.unit
@pytest.mark.asyncio
class TestChairModel:
    """Test cases for Chair model"""
    
    async def test_create_chair(self, db_session: AsyncSession):
        """Test creating a new chair."""
        # Create category first
        category = Category(
            name="Test Category",
            slug="test-category",
            is_active=True
        )
        db_session.add(category)
        await db_session.commit()
        await db_session.refresh(category)
        
        # Create chair
        chair = Chair(
            name="Executive Chair",
            description="Premium executive seating",
            model_number="EC-001",
            category_id=category.id,
            base_price=49999,
            minimum_order_quantity=1,
            is_active=True,
            specifications={"seat_height": "18-22 inches"},
            features=["Lumbar support", "Adjustable height"],
            dimensions={"width": 24, "depth": 26, "height": 42},
            weight=45.5,
            materials=["Leather", "Steel"],
            colors=["Black", "Brown"]
        )
        
        db_session.add(chair)
        await db_session.commit()
        await db_session.refresh(chair)
        
        assert chair.id is not None
        assert chair.name == "Executive Chair"
        assert chair.model_number == "EC-001"
        assert chair.base_price == 49999
        assert chair.category_id == category.id
        assert len(chair.features) == 2
        assert chair.created_at is not None
    
    async def test_chair_unique_model_number(self, db_session: AsyncSession):
        """Test that chair model number must be unique."""
        # Create category
        category = Category(
            name="Test Category",
            slug="test-category",
            is_active=True
        )
        db_session.add(category)
        await db_session.commit()
        await db_session.refresh(category)
        
        # Create first chair
        chair1 = Chair(
            name="Chair 1",
            model_number="CH-001",
            category_id=category.id,
            base_price=10000,
            is_active=True
        )
        
        db_session.add(chair1)
        await db_session.commit()
        
        # Try to create another chair with same model number
        chair2 = Chair(
            name="Chair 2",
            model_number="CH-001",  # Same model number
            category_id=category.id,
            base_price=20000,
            is_active=True
        )
        
        db_session.add(chair2)
        
        with pytest.raises(Exception):  # Should raise IntegrityError
            await db_session.commit()
    
    async def test_chair_relationship_with_category(self, db_session: AsyncSession):
        """Test chair relationship with category."""
        # Create category
        category = Category(
            name="Executive Chairs",
            slug="executive-chairs",
            is_active=True
        )
        db_session.add(category)
        await db_session.commit()
        await db_session.refresh(category)
        
        # Create chairs
        chair1 = Chair(
            name="Chair 1",
            model_number="CH-001",
            category_id=category.id,
            base_price=10000,
            is_active=True
        )
        chair2 = Chair(
            name="Chair 2",
            model_number="CH-002",
            category_id=category.id,
            base_price=20000,
            is_active=True
        )
        
        db_session.add_all([chair1, chair2])
        await db_session.commit()
        
        # Query chairs through category relationship
        await db_session.refresh(category)
        assert len(category.chairs) == 2
    
    async def test_chair_json_fields(self, db_session: AsyncSession):
        """Test JSON fields storage and retrieval."""
        # Create category
        category = Category(
            name="Test Category",
            slug="test-category",
            is_active=True
        )
        db_session.add(category)
        await db_session.commit()
        await db_session.refresh(category)
        
        # Create chair with JSON fields
        specs = {"seat_height": "20 inches", "weight_capacity": "300 lbs"}
        features = ["Ergonomic", "Adjustable", "Swivel"]
        dimensions = {"width": 24, "depth": 26, "height": 42}
        
        chair = Chair(
            name="Test Chair",
            model_number="TC-001",
            category_id=category.id,
            base_price=10000,
            is_active=True,
            specifications=specs,
            features=features,
            dimensions=dimensions
        )
        
        db_session.add(chair)
        await db_session.commit()
        await db_session.refresh(chair)
        
        # Verify JSON fields
        assert chair.specifications == specs
        assert chair.features == features
        assert chair.dimensions == dimensions


@pytest.mark.unit
@pytest.mark.asyncio
class TestFinishModel:
    """Test cases for Finish model"""
    
    async def test_create_finish(self, db_session: AsyncSession):
        """Test creating a new finish."""
        finish = Finish(
            name="Oak",
            description="Natural oak finish",
            color_hex="#8B4513",
            is_active=True,
            display_order=1
        )
        
        db_session.add(finish)
        await db_session.commit()
        await db_session.refresh(finish)
        
        assert finish.id is not None
        assert finish.name == "Oak"
        assert finish.color_hex == "#8B4513"
        assert finish.is_active is True


@pytest.mark.unit
@pytest.mark.asyncio
class TestUpholsteryModel:
    """Test cases for Upholstery model"""
    
    async def test_create_upholstery(self, db_session: AsyncSession):
        """Test creating a new upholstery."""
        upholstery = Upholstery(
            name="Leather",
            material_type="Leather",
            description="Premium leather upholstery",
            color_hex="#000000",
            is_active=True,
            display_order=1
        )
        
        db_session.add(upholstery)
        await db_session.commit()
        await db_session.refresh(upholstery)
        
        assert upholstery.id is not None
        assert upholstery.name == "Leather"
        assert upholstery.color_hex == "#000000"
        assert upholstery.is_active is True

