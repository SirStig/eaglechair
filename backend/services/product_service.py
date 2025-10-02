"""
Product Service

Handles product catalog operations (chairs, categories, finishes, upholstery)
"""

import logging
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func
from sqlalchemy.orm import selectinload

from backend.models.chair import Chair, Category, Finish, Upholstery
from backend.core.exceptions import ResourceNotFoundError, ValidationError
from backend.utils.slug import slugify
from backend.utils.pagination import PaginationParams, paginate


logger = logging.getLogger(__name__)


class ProductService:
    """Service for product catalog operations"""
    
    # ========================================================================
    # Category Operations
    # ========================================================================
    
    @staticmethod
    async def get_categories(
        db: AsyncSession,
        include_inactive: bool = False,
        parent_id: Optional[int] = None
    ) -> List[Category]:
        """
        Get all categories
        
        Args:
            db: Database session
            include_inactive: Include inactive categories
            parent_id: Filter by parent category ID
            
        Returns:
            List of categories
        """
        query = select(Category)
        
        if not include_inactive:
            query = query.where(Category.is_active == True)
        
        if parent_id is not None:
            query = query.where(Category.parent_id == parent_id)
        
        query = query.order_by(Category.display_order, Category.name)
        
        result = await db.execute(query)
        categories = result.scalars().all()
        
        logger.info(f"Retrieved {len(categories)} categories")
        return list(categories)
    
    @staticmethod
    async def get_category_by_id(
        db: AsyncSession,
        category_id: int
    ) -> Category:
        """
        Get category by ID
        
        Args:
            db: Database session
            category_id: Category ID
            
        Returns:
            Category instance
            
        Raises:
            ResourceNotFoundError: If category not found
        """
        result = await db.execute(
            select(Category).where(Category.id == category_id)
        )
        category = result.scalar_one_or_none()
        
        if not category:
            raise ResourceNotFoundError(resource_type="Category", resource_id=category_id)
        
        return category
    
    @staticmethod
    async def get_category_by_slug(
        db: AsyncSession,
        slug: str
    ) -> Category:
        """
        Get category by slug
        
        Args:
            db: Database session
            slug: Category slug
            
        Returns:
            Category instance
            
        Raises:
            ResourceNotFoundError: If category not found
        """
        result = await db.execute(
            select(Category).where(Category.slug == slug)
        )
        category = result.scalar_one_or_none()
        
        if not category:
            raise ResourceNotFoundError(resource_type="Category", resource_id=slug)
        
        return category
    
    # ========================================================================
    # Product Operations
    # ========================================================================
    
    @staticmethod
    async def get_products(
        db: AsyncSession,
        pagination: PaginationParams,
        category_id: Optional[int] = None,
        search_query: Optional[str] = None,
        is_featured: Optional[bool] = None,
        is_new: Optional[bool] = None,
        include_inactive: bool = False
    ) -> Dict[str, Any]:
        """
        Get paginated products with filters
        
        Args:
            db: Database session
            pagination: Pagination parameters
            category_id: Filter by category
            search_query: Search in name, description, model number
            is_featured: Filter featured products
            is_new: Filter new products
            include_inactive: Include inactive products
            
        Returns:
            Paginated response dictionary
        """
        query = select(Chair).options(selectinload(Chair.category))
        
        # Apply filters
        if not include_inactive:
            query = query.where(Chair.is_active == True)
        
        if category_id:
            query = query.where(Chair.category_id == category_id)
        
        if is_featured is not None:
            query = query.where(Chair.is_featured == is_featured)
        
        if is_new is not None:
            query = query.where(Chair.is_new == is_new)
        
        if search_query:
            search_term = f"%{search_query}%"
            query = query.where(
                or_(
                    Chair.name.ilike(search_term),
                    Chair.model_number.ilike(search_term),
                    Chair.short_description.ilike(search_term),
                    Chair.full_description.ilike(search_term)
                )
            )
        
        # Default ordering
        query = query.order_by(Chair.display_order, Chair.name)
        
        # Paginate
        result = await paginate(db, query, pagination)
        
        logger.info(
            f"Retrieved {len(result['items'])} products (page {pagination.page}, "
            f"total {result['total']})"
        )
        
        return result
    
    @staticmethod
    async def get_product_by_id(
        db: AsyncSession,
        product_id: int,
        increment_view: bool = False
    ) -> Chair:
        """
        Get product by ID
        
        Args:
            db: Database session
            product_id: Product ID
            increment_view: Whether to increment view count
            
        Returns:
            Chair instance
            
        Raises:
            ResourceNotFoundError: If product not found
        """
        result = await db.execute(
            select(Chair)
            .options(selectinload(Chair.category))
            .where(Chair.id == product_id)
        )
        product = result.scalar_one_or_none()
        
        if not product:
            raise ResourceNotFoundError(resource_type="Product", resource_id=product_id)
        
        # Increment view count
        if increment_view:
            product.view_count += 1
            await db.commit()
            await db.refresh(product)
        
        return product
    
    @staticmethod
    async def get_product_by_model_number(
        db: AsyncSession,
        model_number: str
    ) -> Chair:
        """
        Get product by model number
        
        Args:
            db: Database session
            model_number: Product model number
            
        Returns:
            Chair instance
            
        Raises:
            ResourceNotFoundError: If product not found
        """
        result = await db.execute(
            select(Chair)
            .options(selectinload(Chair.category))
            .where(Chair.model_number == model_number)
        )
        product = result.scalar_one_or_none()
        
        if not product:
            raise ResourceNotFoundError(resource_type="Product", resource_id=model_number)
        
        return product
    
    @staticmethod
    async def get_product_by_slug(
        db: AsyncSession,
        slug: str
    ) -> Chair:
        """
        Get product by slug
        
        Args:
            db: Database session
            slug: Product slug
            
        Returns:
            Chair instance
            
        Raises:
            ResourceNotFoundError: If product not found
        """
        result = await db.execute(
            select(Chair)
            .options(selectinload(Chair.category))
            .where(Chair.slug == slug)
        )
        product = result.scalar_one_or_none()
        
        if not product:
            raise ResourceNotFoundError(resource_type="Product", resource_id=slug)
        
        return product
    
    @staticmethod
    async def search_products_fuzzy(
        db: AsyncSession,
        search_query: str,
        limit: int = 10
    ) -> List[Chair]:
        """
        Fuzzy search for products (simple implementation)
        
        Args:
            db: Database session
            search_query: Search query
            limit: Maximum results
            
        Returns:
            List of matching products
        """
        search_term = f"%{search_query}%"
        
        query = (
            select(Chair)
            .options(selectinload(Chair.category))
            .where(
                and_(
                    Chair.is_active == True,
                    or_(
                        Chair.name.ilike(search_term),
                        Chair.model_number.ilike(search_term),
                        Chair.short_description.ilike(search_term)
                    )
                )
            )
            .limit(limit)
        )
        
        result = await db.execute(query)
        products = result.scalars().all()
        
        logger.info(f"Fuzzy search for '{search_query}' returned {len(products)} results")
        
        return list(products)
    
    # ========================================================================
    # Finish Operations
    # ========================================================================
    
    @staticmethod
    async def get_finishes(
        db: AsyncSession,
        finish_type: Optional[str] = None,
        include_inactive: bool = False
    ) -> List[Finish]:
        """
        Get all finishes
        
        Args:
            db: Database session
            finish_type: Filter by finish type
            include_inactive: Include inactive finishes
            
        Returns:
            List of finishes
        """
        query = select(Finish)
        
        if not include_inactive:
            query = query.where(Finish.is_active == True)
        
        if finish_type:
            query = query.where(Finish.finish_type == finish_type)
        
        query = query.order_by(Finish.display_order, Finish.name)
        
        result = await db.execute(query)
        finishes = result.scalars().all()
        
        logger.info(f"Retrieved {len(finishes)} finishes")
        return list(finishes)
    
    @staticmethod
    async def get_finish_by_id(
        db: AsyncSession,
        finish_id: int
    ) -> Finish:
        """
        Get finish by ID
        
        Args:
            db: Database session
            finish_id: Finish ID
            
        Returns:
            Finish instance
            
        Raises:
            ResourceNotFoundError: If finish not found
        """
        result = await db.execute(
            select(Finish).where(Finish.id == finish_id)
        )
        finish = result.scalar_one_or_none()
        
        if not finish:
            raise ResourceNotFoundError(resource_type="Finish", resource_id=finish_id)
        
        return finish
    
    # ========================================================================
    # Upholstery Operations
    # ========================================================================
    
    @staticmethod
    async def get_upholsteries(
        db: AsyncSession,
        material_type: Optional[str] = None,
        include_inactive: bool = False
    ) -> List[Upholstery]:
        """
        Get all upholsteries
        
        Args:
            db: Database session
            material_type: Filter by material type
            include_inactive: Include inactive upholsteries
            
        Returns:
            List of upholsteries
        """
        query = select(Upholstery)
        
        if not include_inactive:
            query = query.where(Upholstery.is_active == True)
        
        if material_type:
            query = query.where(Upholstery.material_type == material_type)
        
        query = query.order_by(Upholstery.display_order, Upholstery.name)
        
        result = await db.execute(query)
        upholsteries = result.scalars().all()
        
        logger.info(f"Retrieved {len(upholsteries)} upholsteries")
        return list(upholsteries)
    
    @staticmethod
    async def get_upholstery_by_id(
        db: AsyncSession,
        upholstery_id: int
    ) -> Upholstery:
        """
        Get upholstery by ID
        
        Args:
            db: Database session
            upholstery_id: Upholstery ID
            
        Returns:
            Upholstery instance
            
        Raises:
            ResourceNotFoundError: If upholstery not found
        """
        result = await db.execute(
            select(Upholstery).where(Upholstery.id == upholstery_id)
        )
        upholstery = result.scalar_one_or_none()
        
        if not upholstery:
            raise ResourceNotFoundError(resource_type="Upholstery", resource_id=upholstery_id)
        
        return upholstery

