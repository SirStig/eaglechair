"""
Product Service

Handles product catalog operations (chairs, categories, finishes, upholstery)
"""

import logging
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.core.exceptions import ResourceNotFoundError, ValidationError
from backend.models.chair import (
    Category,
    Chair,
    Color,
    CustomOption,
    Finish,
    ProductFamily,
    ProductSubcategory,
    ProductTag,
    ProductVariation,
    Upholstery,
)
from backend.utils.pagination import PaginationParams, paginate
from backend.utils.slug import slugify

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
        query = select(Chair).options(
            selectinload(Chair.category).selectinload(Category.parent)
        )
        
        # Apply filters
        if not include_inactive:
            query = query.where(Chair.is_active)
        
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
        
        # Populate parent_slug for all products with categories
        for product in result['items']:
            if product.category and product.category.parent:
                product.category.parent_slug = product.category.parent.slug
        
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
            .options(selectinload(Chair.category).selectinload(Category.parent))
            .where(Chair.id == product_id)
        )
        product = result.scalar_one_or_none()
        
        if not product:
            raise ResourceNotFoundError(resource_type="Product", resource_id=product_id)
        
        # Populate parent_slug for frontend routing
        if product.category and product.category.parent:
            product.category.parent_slug = product.category.parent.slug
        
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
            .options(selectinload(Chair.category).selectinload(Category.parent))
            .where(Chair.slug == slug)
        )
        product = result.scalar_one_or_none()
        
        if not product:
            raise ResourceNotFoundError(resource_type="Product", resource_id=slug)
        
        # Populate parent_slug for frontend routing
        if product.category and product.category.parent:
            product.category.parent_slug = product.category.parent.slug
        
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
    
    # ========================================================================
    # Enhanced Product Methods (NEW - Product System Overhaul)
    # ========================================================================
    
    @staticmethod
    async def get_product_with_variations(
        db: AsyncSession,
        product_id: int,
        include_inactive_variations: bool = False
    ) -> Dict[str, Any]:
        """
        Get product with all variations and related data
        
        Args:
            db: Database session
            product_id: Product ID
            include_inactive_variations: Include inactive variations
            
        Returns:
            dict with product, variations, family, subcategory info
        """
        # Get product with relationships
        stmt = (
            select(Chair)
            .options(
                selectinload(Chair.category),
                selectinload(Chair.subcategory),
                selectinload(Chair.family),
                selectinload(Chair.variations)
            )
            .where(Chair.id == product_id)
        )
        result = await db.execute(stmt)
        product = result.scalar_one_or_none()
        
        if not product:
            raise ResourceNotFoundError(resource_type="Product", resource_id=product_id)
        
        # Filter variations
        variations = product.variations
        if not include_inactive_variations:
            variations = [v for v in variations if v.is_available]
        
        # Sort variations by display order
        variations.sort(key=lambda v: v.display_order)
        
        return {
            "product": product,
            "variations": variations,
            "family": product.family,
            "subcategory": product.subcategory,
            "category": product.category
        }
    
    @staticmethod
    async def get_available_options(
        db: AsyncSession,
        product_id: int
    ) -> Dict[str, Any]:
        """
        Get all available options for a product (colors, finishes, upholsteries)
        
        Args:
            db: Database session
            product_id: Product ID
            
        Returns:
            dict with colors, finishes, upholsteries lists
        """
        # Get product to check available_colors field
        stmt = select(Chair).where(Chair.id == product_id)
        result = await db.execute(stmt)
        product = result.scalar_one_or_none()
        
        if not product:
            raise ResourceNotFoundError(resource_type="Product", resource_id=product_id)
        
        # Get colors (filter by product's available_colors if specified)
        colors_query = select(Color).where(Color.is_active == True)
        if product.available_colors:
            colors_query = colors_query.where(Color.id.in_(product.available_colors))
        colors_query = colors_query.order_by(Color.display_order, Color.name)
        colors_result = await db.execute(colors_query)
        colors = list(colors_result.scalars().all())
        
        # Get active finishes
        finishes_query = (
            select(Finish)
            .where(Finish.is_active == True)
            .order_by(Finish.display_order, Finish.name)
        )
        finishes_result = await db.execute(finishes_query)
        finishes = list(finishes_result.scalars().all())
        
        # Get active upholsteries
        upholsteries_query = (
            select(Upholstery)
            .where(Upholstery.is_active == True)
            .order_by(Upholstery.display_order, Upholstery.name)
        )
        upholsteries_result = await db.execute(upholsteries_query)
        upholsteries = list(upholsteries_result.scalars().all())
        
        # Get custom options applicable to this product's category
        options_query = (
            select(CustomOption)
            .where(CustomOption.is_active == True)
        )
        options_result = await db.execute(options_query)
        all_options = options_result.scalars().all()
        
        # Filter options by applicable categories
        applicable_options = []
        for option in all_options:
            if not option.applicable_categories or product.category_id in option.applicable_categories:
                applicable_options.append(option)
        
        applicable_options.sort(key=lambda o: o.display_order)
        
        return {
            "colors": colors,
            "finishes": finishes,
            "upholsteries": upholsteries,
            "custom_options": applicable_options
        }
    
    @staticmethod
    async def get_product_images(
        db: AsyncSession,
        product_id: int,
        variation_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Get product images organized by type (side, front, gallery)
        
        Args:
            db: Database session
            product_id: Product ID
            variation_id: Optional variation ID for variation-specific images
            
        Returns:
            dict with primary_image, hover_image, gallery images
        """
        # Get product
        stmt = select(Chair).where(Chair.id == product_id)
        result = await db.execute(stmt)
        product = result.scalar_one_or_none()
        
        if not product:
            raise ResourceNotFoundError(resource_type="Product", resource_id=product_id)
        
        images = {
            "primary_image_url": product.primary_image_url,
            "hover_image_url": product.hover_image_url,
            "gallery": product.images or []
        }
        
        # If variation specified, overlay variation images
        if variation_id:
            var_stmt = select(ProductVariation).where(ProductVariation.id == variation_id)
            var_result = await db.execute(var_stmt)
            variation = var_result.scalar_one_or_none()
            
            if variation:
                if variation.primary_image_url:
                    images["primary_image_url"] = variation.primary_image_url
                if variation.images:
                    images["gallery"] = variation.images + images["gallery"]
        
        return images
    
    @staticmethod
    async def filter_products(
        db: AsyncSession,
        category_id: Optional[int] = None,
        subcategory_id: Optional[int] = None,
        family_id: Optional[int] = None,
        tags: Optional[List[str]] = None,
        search: Optional[str] = None,
        is_active: bool = True,
        pagination: Optional[PaginationParams] = None
    ):
        """
        Advanced product filtering
        
        Args:
            db: Database session
            category_id: Filter by category
            subcategory_id: Filter by subcategory
            family_id: Filter by family
            tags: Filter by tag slugs
            search: Search in name, model_number, description
            is_active: Filter active products
            pagination: Pagination parameters
            
        Returns:
            Paginated product results
        """
        query = select(Chair).options(
            selectinload(Chair.category),
            selectinload(Chair.subcategory),
            selectinload(Chair.family)
        )
        
        # Apply filters
        if is_active:
            query = query.where(Chair.is_active == True)
        
        if category_id:
            query = query.where(Chair.category_id == category_id)
        
        if subcategory_id:
            query = query.where(Chair.subcategory_id == subcategory_id)
        
        if family_id:
            query = query.where(Chair.family_id == family_id)
        
        if search:
            search_term = f"%{search}%"
            query = query.where(
                or_(
                    Chair.name.ilike(search_term),
                    Chair.model_number.ilike(search_term),
                    Chair.description.ilike(search_term)
                )
            )
        
        # Tag filtering (requires join)
        if tags:
            from backend.models.chair import ProductTagAssociation
            query = (
                query
                .join(ProductTagAssociation, Chair.id == ProductTagAssociation.product_id)
                .join(ProductTag, ProductTagAssociation.tag_id == ProductTag.id)
                .where(ProductTag.slug.in_(tags))
                .distinct()
            )
        
        # Default ordering
        query = query.order_by(Chair.display_order, Chair.name)
        
        # Paginate if requested
        if pagination:
            return await paginate(db, query, pagination)
        
        result = await db.execute(query)
        products = result.scalars().all()
        return list(products)
    
    @staticmethod
    async def get_related_products(
        db: AsyncSession,
        product_id: int,
        limit: int = 6
    ) -> List[Chair]:
        """
        Get related products based on family and category
        
        Args:
            db: Database session
            product_id: Product ID
            limit: Max number of related products
            
        Returns:
            List of related products
        """
        # Get source product
        stmt = select(Chair).where(Chair.id == product_id)
        result = await db.execute(stmt)
        product = result.scalar_one_or_none()
        
        if not product:
            raise ResourceNotFoundError(resource_type="Product", resource_id=product_id)
        
        # Find related products
        # Priority: Same family > Same subcategory > Same category
        query = (
            select(Chair)
            .where(Chair.id != product_id)
            .where(Chair.is_active == True)
        )
        
        if product.family_id:
            # Same family products first
            query = query.where(Chair.family_id == product.family_id)
        elif product.subcategory_id:
            # Same subcategory
            query = query.where(Chair.subcategory_id == product.subcategory_id)
        else:
            # Same category
            query = query.where(Chair.category_id == product.category_id)
        
        query = query.order_by(Chair.display_order, Chair.name).limit(limit)
        
        result = await db.execute(query)
        related = result.scalars().all()
        
        return list(related)
    
    # ========================================================================
    # Family & Subcategory Methods (NEW)
    # ========================================================================
    
    @staticmethod
    async def get_families(
        db: AsyncSession,
        category_id: Optional[int] = None,
        featured_only: bool = False,
        include_inactive: bool = False
    ) -> List[ProductFamily]:
        """Get product families"""
        query = select(ProductFamily)
        
        if not include_inactive:
            query = query.where(ProductFamily.is_active == True)
        
        if featured_only:
            query = query.where(ProductFamily.is_featured == True)
        
        if category_id:
            query = query.where(ProductFamily.category_id == category_id)
        
        query = query.order_by(ProductFamily.display_order, ProductFamily.name)
        
        result = await db.execute(query)
        return list(result.scalars().all())
    
    @staticmethod
    async def get_subcategories(
        db: AsyncSession,
        category_id: Optional[int] = None,
        include_inactive: bool = False
    ) -> List[ProductSubcategory]:
        """Get product subcategories"""
        query = select(ProductSubcategory)
        
        if not include_inactive:
            query = query.where(ProductSubcategory.is_active == True)
        
        if category_id:
            query = query.where(ProductSubcategory.category_id == category_id)
        
        query = query.order_by(ProductSubcategory.display_order, ProductSubcategory.name)
        
        result = await db.execute(query)
        return list(result.scalars().all())

