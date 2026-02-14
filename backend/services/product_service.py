"""
Product Service

Handles product catalog operations (chairs, categories, finishes, upholstery)
"""

import logging
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.types import String

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
    chair_secondary_families,
)
from backend.utils.pagination import PaginationParams, paginate
from backend.utils.slug import slugify

logger = logging.getLogger(__name__)


def _is_model_like_query(query: str) -> bool:
    q = (query or "").strip()
    if not q or len(q) > 10:
        return False
    return all(c.isalnum() or c in ".- " for c in q)


def _rank_by_model_match(product: Chair, query: str) -> int:
    q = (query or "").strip().lower()
    if not q or not product.model_number:
        return 0
    mn = product.model_number.lower()
    if mn == q:
        return 2
    if mn.startswith(q):
        return 1
    return 0


class ProductService:
    """Service for product catalog operations"""

    # ========================================================================
    # Category Operations
    # ========================================================================

    @staticmethod
    async def get_categories(
        db: AsyncSession,
        include_inactive: bool = False,
        parent_id: Optional[int] = None,
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
    async def get_category_by_id(db: AsyncSession, category_id: int) -> Category:
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
        result = await db.execute(select(Category).where(Category.id == category_id))
        category = result.scalar_one_or_none()

        if not category:
            raise ResourceNotFoundError(
                resource_type="Category", resource_id=category_id
            )

        return category

    @staticmethod
    async def get_category_by_slug(db: AsyncSession, slug: str) -> Category:
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
        result = await db.execute(select(Category).where(Category.slug == slug))
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
        subcategory_id: Optional[int] = None,
        family_id: Optional[int] = None,
        search_query: Optional[str] = None,
        is_featured: Optional[bool] = None,
        is_new: Optional[bool] = None,
        finish_ids: Optional[List[int]] = None,
        upholstery_ids: Optional[List[int]] = None,
        color_ids: Optional[List[int]] = None,
        min_seat_height: Optional[float] = None,
        max_seat_height: Optional[float] = None,
        min_width: Optional[float] = None,
        max_width: Optional[float] = None,
        is_stackable: Optional[bool] = None,
        is_outdoor: Optional[bool] = None,
        is_ada_compliant: Optional[bool] = None,
        max_lead_time_days: Optional[int] = None,
        in_stock_only: bool = False,
        exclude_variations: bool = False,
        smart_sort: bool = False,
        include_inactive: bool = False,
    ) -> Dict[str, Any]:
        """
        Get paginated products with comprehensive filters and smart sorting

        Args:
            db: Database session
            pagination: Pagination parameters
            category_id: Filter by category
            subcategory_id: Filter by subcategory
            family_id: Filter by product family
            search_query: Search in name, description, model number (uses fuzzy search)
            is_featured: Filter featured products
            is_new: Filter new products
            finish_ids: Filter by finish IDs
            upholstery_ids: Filter by upholstery IDs
            color_ids: Filter by color IDs
            min_seat_height: Minimum seat height filter
            max_seat_height: Maximum seat height filter
            min_width: Minimum width filter
            max_width: Maximum width filter
            is_stackable: Filter stackable products
            is_outdoor: Filter outdoor products
            is_ada_compliant: Filter ADA compliant products
            max_lead_time_days: Maximum lead time in days
            in_stock_only: Show only in-stock products
            exclude_variations: Exclude product variations, show only base products
            smart_sort: Use smart sorting (featured → new → popular → rest)
            include_inactive: Include inactive products

        Returns:
            Paginated response dictionary
        """
        query = select(Chair).options(
            selectinload(Chair.category).selectinload(Category.parent),
            selectinload(Chair.family),
            selectinload(Chair.subcategory),
        )

        # Apply filters
        if not include_inactive:
            query = query.where(Chair.is_active)

        if category_id:
            query = query.where(Chair.category_id == category_id)

        if subcategory_id:
            query = query.where(Chair.subcategory_id == subcategory_id)

        if family_id:
            subq = select(chair_secondary_families.c.chair_id).where(
                chair_secondary_families.c.family_id == family_id
            )
            query = query.where(
                or_(Chair.family_id == family_id, Chair.id.in_(subq))
            )

        if is_featured is not None:
            query = query.where(Chair.is_featured == is_featured)

        if is_new is not None:
            query = query.where(Chair.is_new == is_new)

        # Exclude variations (show only base products)
        if exclude_variations:
            query = query.where(
                or_(Chair.model_suffix.is_(None), Chair.model_suffix == "")
            )

        # Finish filters
        if finish_ids:
            query = query.where(Chair.finish_id.in_(finish_ids))

        # Upholstery filters
        if upholstery_ids:
            query = query.where(Chair.upholstery_id.in_(upholstery_ids))

        # Color filters
        if color_ids:
            query = query.where(Chair.primary_color_id.in_(color_ids))

        # Dimension filters
        if min_seat_height is not None:
            query = query.where(Chair.seat_height >= min_seat_height)

        if max_seat_height is not None:
            query = query.where(Chair.seat_height <= max_seat_height)

        if min_width is not None:
            query = query.where(Chair.width >= min_width)

        if max_width is not None:
            query = query.where(Chair.width <= max_width)

        # Feature filters
        if is_stackable is not None:
            query = query.where(Chair.is_stackable == is_stackable)

        if is_outdoor is not None:
            query = query.where(Chair.is_outdoor == is_outdoor)

        if is_ada_compliant is not None:
            query = query.where(Chair.is_ada_compliant == is_ada_compliant)

        # Lead time filter
        if max_lead_time_days is not None:
            query = query.where(Chair.lead_time_days <= max_lead_time_days)

        # Stock filter
        if in_stock_only:
            query = query.where(Chair.stock_quantity > 0)

        if search_query:
            search_term = f"%{search_query}%"
            keyword_match = cast(Chair.keywords, String).ilike(search_term)
            query = query.where(
                or_(
                    Chair.name.ilike(search_term),
                    Chair.model_number.ilike(search_term),
                    Chair.short_description.ilike(search_term),
                    Chair.full_description.ilike(search_term),
                    keyword_match,
                )
            )

        # Smart sorting algorithm: featured → new → popular (view_count) → display_order → name
        if smart_sort:
            query = query.order_by(
                Chair.is_featured.desc(),
                Chair.is_new.desc(),
                Chair.view_count.desc(),
                Chair.display_order,
                Chair.name,
            )
        else:
            # Default ordering
            query = query.order_by(Chair.display_order, Chair.name)

        # Paginate
        result = await paginate(db, query, pagination)

        # Populate parent_slug for all products with categories
        for product in result["items"]:
            if product.category and product.category.parent:
                product.category.parent_slug = product.category.parent.slug

        logger.info(
            f"Retrieved {len(result['items'])} products (page {pagination.page}, "
            f"total {result['total']}, filters applied: {len([f for f in [category_id, subcategory_id, family_id, search_query] if f])})"
        )

        return result

    @staticmethod
    async def get_product_by_id(
        db: AsyncSession, product_id: int, increment_view: bool = False
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
            .options(
                selectinload(Chair.category).selectinload(Category.parent),
                selectinload(Chair.subcategory),
                selectinload(Chair.family),
                selectinload(Chair.secondary_families),
                selectinload(Chair.variations).selectinload(ProductVariation.finish),
                selectinload(Chair.variations).selectinload(
                    ProductVariation.upholstery
                ),
                selectinload(Chair.variations).selectinload(ProductVariation.color),
            )
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
        db: AsyncSession, model_number: str, increment_view: bool = False
    ) -> Chair:
        """
        Get product by model number

        Args:
            db: Database session
            model_number: Product model number
            increment_view: Whether to increment view count

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
            raise ResourceNotFoundError(
                resource_type="Product", resource_id=model_number
            )

        # Increment view count
        if increment_view:
            product.view_count += 1
            await db.commit()
            await db.refresh(product)

        return product

    @staticmethod
    async def get_product_by_slug(
        db: AsyncSession, slug: str, increment_view: bool = False
    ) -> Chair:
        """
        Get product by slug

        Args:
            db: Database session
            slug: Product slug
            increment_view: Whether to increment view count

        Returns:
            Chair instance

        Raises:
            ResourceNotFoundError: If product not found
        """
        result = await db.execute(
            select(Chair)
            .options(
                selectinload(Chair.category).selectinload(Category.parent),
                selectinload(Chair.subcategory),
                selectinload(Chair.family),
                selectinload(Chair.variations).selectinload(ProductVariation.finish),
                selectinload(Chair.variations).selectinload(
                    ProductVariation.upholstery
                ),
                selectinload(Chair.variations).selectinload(ProductVariation.color),
            )
            .where(Chair.slug == slug)
        )
        product = result.scalar_one_or_none()

        if not product:
            raise ResourceNotFoundError(resource_type="Product", resource_id=slug)

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
    async def search_products_fuzzy(
        db: AsyncSession, search_query: str, limit: int = 50, threshold: int = 75
    ) -> List[Chair]:
        """
        Fuzzy search for products using YokedCache

        Args:
            db: Database session
            search_query: Search query
            limit: Maximum results
            threshold: Minimum similarity score (0-100)

        Returns:
            List of matching products sorted by relevance
        """
        from backend.services.cache_service import cache_service

        # Try fuzzy search from cache first
        cache_results = await cache_service.fuzzy_search(
            query=search_query,
            threshold=threshold,
            max_results=limit,
            tags=["products"],
        )

        # If we have cached results, fetch the full products
        if cache_results:
            product_ids = []
            for result in cache_results:
                # Extract product ID from cache key (format: "eaglechair:product_search:123")
                try:
                    key_parts = result["key"].split(":")
                    if len(key_parts) >= 3 and key_parts[1] == "product_search":
                        product_ids.append(int(key_parts[2]))
                except (ValueError, IndexError):
                    continue

            if product_ids:
                query = (
                    select(Chair)
                    .options(selectinload(Chair.category))
                    .where(and_(Chair.id.in_(product_ids), Chair.is_active))
                )
                result = await db.execute(query)
                products = list(result.scalars().all())

                product_score_map = {
                    pid: score
                    for pid, score in zip(
                        product_ids,
                        [r["score"] for r in cache_results[: len(product_ids)]],
                    )
                }
                if _is_model_like_query(search_query):
                    products.sort(
                        key=lambda p: (
                            -_rank_by_model_match(p, search_query),
                            product_score_map.get(p.id, 0),
                        ),
                        reverse=True,
                    )
                else:
                    products.sort(
                        key=lambda p: product_score_map.get(p.id, 0), reverse=True
                    )

                logger.info(
                    f"Fuzzy search (cached) for '{search_query}' returned {len(products)} results"
                )
                return products

        # Fallback to database ILIKE search
        search_term = f"%{search_query}%"

        keyword_match = cast(Chair.keywords, String).ilike(search_term)
        query = (
            select(Chair)
            .options(selectinload(Chair.category))
            .where(
                and_(
                    Chair.is_active,
                    or_(
                        Chair.name.ilike(search_term),
                        Chair.model_number.ilike(search_term),
                        Chair.short_description.ilike(search_term),
                        Chair.full_description.ilike(search_term),
                        keyword_match,
                    ),
                )
            )
            .limit(limit)
        )

        result = await db.execute(query)
        products = list(result.scalars().all())

        if _is_model_like_query(search_query):
            products.sort(
                key=lambda p: -_rank_by_model_match(p, search_query),
            )

        for product in products:
            searchable_parts = [
                product.name or "",
                product.model_number or "",
                product.short_description or "",
                product.full_description or "",
            ]
            if product.category:
                searchable_parts.append(product.category.name or "")
            kw = product.keywords
            if isinstance(kw, list):
                searchable_parts.append(" ".join(str(k) for k in kw if k))
            searchable_text = " ".join(filter(None, searchable_parts))

            # Index asynchronously (don't await to avoid slowing down the response)
            try:
                await cache_service.index_product_for_search(
                    product_id=product.id, searchable_text=searchable_text, ttl=3600
                )
            except Exception as e:
                # Don't let cache errors affect search results
                logger.debug(f"Failed to cache product {product.id} for search: {e}")

        logger.info(
            f"Fuzzy search (database fallback) for '{search_query}' returned {len(products)} results"
        )

        return products

    # ========================================================================
    # Finish Operations
    # ========================================================================

    @staticmethod
    async def get_finishes(
        db: AsyncSession,
        finish_type: Optional[str] = None,
        grade: Optional[str] = None,
        include_inactive: bool = False,
    ) -> List[Finish]:
        """
        Get all finishes

        Args:
            db: Database session
            finish_type: Filter by finish type
            grade: Filter by grade (Standard, Premium, Premium Plus, Artisan)
            include_inactive: Include inactive finishes

        Returns:
            List of finishes
        """
        query = select(Finish)

        if not include_inactive:
            query = query.where(Finish.is_active == True)

        if finish_type:
            query = query.where(Finish.finish_type == finish_type)

        if grade:
            query = query.where(Finish.grade == grade)

        query = query.order_by(Finish.display_order, Finish.name)

        result = await db.execute(query)
        finishes = result.scalars().all()

        logger.info(f"Retrieved {len(finishes)} finishes")
        return list(finishes)

    @staticmethod
    async def get_finish_by_id(db: AsyncSession, finish_id: int) -> Finish:
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
        result = await db.execute(select(Finish).where(Finish.id == finish_id))
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
        include_inactive: bool = False,
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
    async def get_upholstery_by_id(db: AsyncSession, upholstery_id: int) -> Upholstery:
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
            raise ResourceNotFoundError(
                resource_type="Upholstery", resource_id=upholstery_id
            )

        return upholstery

    # ========================================================================
    # Enhanced Product Methods (NEW - Product System Overhaul)
    # ========================================================================

    @staticmethod
    async def get_product_with_variations(
        db: AsyncSession, product_id: int, include_inactive_variations: bool = False
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
        # Load variations with their finish, upholstery, and color relationships
        stmt = (
            select(Chair)
            .options(
                selectinload(Chair.category),
                selectinload(Chair.subcategory),
                selectinload(Chair.family),
                selectinload(Chair.variations).selectinload(ProductVariation.finish),
                selectinload(Chair.variations).selectinload(
                    ProductVariation.upholstery
                ),
                selectinload(Chair.variations).selectinload(ProductVariation.color),
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
            "category": product.category,
        }

    @staticmethod
    async def get_available_options(
        db: AsyncSession, product_id: int
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
        options_query = select(CustomOption).where(CustomOption.is_active == True)
        options_result = await db.execute(options_query)
        all_options = options_result.scalars().all()

        # Filter options by applicable categories
        applicable_options = []
        for option in all_options:
            if (
                not option.applicable_categories
                or product.category_id in option.applicable_categories
            ):
                applicable_options.append(option)

        applicable_options.sort(key=lambda o: o.display_order)

        return {
            "colors": colors,
            "finishes": finishes,
            "upholsteries": upholsteries,
            "custom_options": applicable_options,
        }

    @staticmethod
    async def get_product_images(
        db: AsyncSession, product_id: int, variation_id: Optional[int] = None
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

        hover = product.hover_images or []
        images = {
            "primary_image_url": product.primary_image_url,
            "hover_image_url": hover[0] if len(hover) > 0 else None,
            "hover_images": hover,
            "gallery": product.images or [],
        }

        # If variation specified, overlay variation images
        if variation_id:
            var_stmt = select(ProductVariation).where(
                ProductVariation.id == variation_id
            )
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
        pagination: Optional[PaginationParams] = None,
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
            selectinload(Chair.family),
        )

        # Apply filters
        if is_active:
            query = query.where(Chair.is_active == True)

        if category_id:
            query = query.where(Chair.category_id == category_id)

        if subcategory_id:
            query = query.where(Chair.subcategory_id == subcategory_id)

        if family_id:
            subq = select(chair_secondary_families.c.chair_id).where(
                chair_secondary_families.c.family_id == family_id
            )
            query = query.where(
                or_(Chair.family_id == family_id, Chair.id.in_(subq))
            )

        if search:
            search_term = f"%{search}%"
            query = query.where(
                or_(
                    Chair.name.ilike(search_term),
                    Chair.model_number.ilike(search_term),
                    Chair.short_description.ilike(search_term),
                    Chair.full_description.ilike(search_term),
                )
            )

        # Tag filtering (requires join)
        if tags:
            from backend.models.chair import ProductTagAssociation

            query = (
                query.join(
                    ProductTagAssociation, Chair.id == ProductTagAssociation.product_id
                )
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
        db: AsyncSession, product_id: int, limit: int = 6
    ) -> List[Chair]:
        stmt = select(Chair).where(Chair.id == product_id)
        result = await db.execute(stmt)
        product = result.scalar_one_or_none()

        if not product:
            raise ResourceNotFoundError(resource_type="Product", resource_id=product_id)

        source_keywords = (
            [str(k).strip().lower() for k in product.keywords if k]
            if isinstance(product.keywords, list)
            else []
        )
        if not source_keywords:
            return []

        query = (
            select(Chair)
            .options(selectinload(Chair.category))
            .where(Chair.id != product_id, Chair.is_active == True)
        )
        result = await db.execute(query)
        candidates = list(result.scalars().all())

        scored = []
        for c in candidates:
            c_keywords = (
                [str(k).strip().lower() for k in c.keywords if k]
                if isinstance(c.keywords, list)
                else []
            )
            match_count = len(set(source_keywords) & set(c_keywords))
            if match_count > 0:
                scored.append((c, match_count))

        scored.sort(key=lambda x: (-x[1], x[0].display_order or 0, x[0].name or ""))
        return [c for c, _ in scored[:limit]]

    # ========================================================================
    # Family & Subcategory Methods (NEW)
    # ========================================================================

    @staticmethod
    async def get_families(
        db: AsyncSession,
        category_id: Optional[int] = None,
        featured_only: bool = False,
        include_inactive: bool = False,
    ) -> List[ProductFamily]:
        """Get product families with category and subcategory loaded."""
        query = (
            select(ProductFamily)
            .options(
                selectinload(ProductFamily.category),
                selectinload(ProductFamily.subcategory),
            )
        )

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
        include_inactive: bool = False,
    ) -> List[ProductSubcategory]:
        """Get product subcategories"""
        query = select(ProductSubcategory)

        if not include_inactive:
            query = query.where(ProductSubcategory.is_active == True)

        if category_id:
            query = query.where(ProductSubcategory.category_id == category_id)

        query = query.order_by(
            ProductSubcategory.display_order, ProductSubcategory.name
        )

        result = await db.execute(query)
        return list(result.scalars().all())

    # ========================================================================
    # Cache Management
    # ========================================================================

    @staticmethod
    async def get_cache_timestamps(db: AsyncSession) -> Dict[str, str]:
        """
        Get latest update timestamps for all product-related data

        This endpoint helps mobile apps determine if their cached data is stale
        by checking the last modification time for each data type.

        Args:
            db: Database session

        Returns:
            Dict with timestamps for each data type:
            {
                "products": "2024-12-27T10:30:00Z",
                "categories": "2024-12-27T10:30:00Z",
                "variations": "2024-12-27T10:30:00Z",
                "colors": "2024-12-27T10:30:00Z",
                "finishes": "2024-12-27T10:30:00Z",
                "upholsteries": "2024-12-27T10:30:00Z",
                "families": "2024-12-27T10:30:00Z",
                "subcategories": "2024-12-27T10:30:00Z"
            }
        """
        timestamps = {}

        # Products (chairs)
        result = await db.execute(
            select(func.max(Chair.updated_at)).where(Chair.is_active == True)
        )
        timestamps["products"] = result.scalar() or None

        # Categories
        result = await db.execute(
            select(func.max(Category.updated_at)).where(Category.is_active == True)
        )
        timestamps["categories"] = result.scalar() or None

        # Product Variations
        result = await db.execute(
            select(func.max(ProductVariation.updated_at)).where(
                ProductVariation.is_available == True
            )
        )
        timestamps["variations"] = result.scalar() or None

        # Colors
        result = await db.execute(
            select(func.max(Color.updated_at)).where(Color.is_active == True)
        )
        timestamps["colors"] = result.scalar() or None

        # Finishes
        result = await db.execute(
            select(func.max(Finish.updated_at)).where(Finish.is_active == True)
        )
        timestamps["finishes"] = result.scalar() or None

        # Upholsteries
        result = await db.execute(
            select(func.max(Upholstery.updated_at)).where(Upholstery.is_active == True)
        )
        timestamps["upholsteries"] = result.scalar() or None

        # Product Families
        result = await db.execute(
            select(func.max(ProductFamily.updated_at)).where(
                ProductFamily.is_active == True
            )
        )
        timestamps["families"] = result.scalar() or None

        # Product Subcategories
        result = await db.execute(
            select(func.max(ProductSubcategory.updated_at)).where(
                ProductSubcategory.is_active == True
            )
        )
        timestamps["subcategories"] = result.scalar() or None

        # Convert datetime objects to ISO format strings
        for key, timestamp in timestamps.items():
            if timestamp:
                # Convert to UTC and format as ISO string
                timestamps[key] = (
                    timestamp.isoformat() + "Z"
                    if timestamp.tzinfo
                    else timestamp.isoformat() + "Z"
                )
            else:
                timestamps[key] = None

        logger.info("Retrieved cache timestamps")
        return timestamps

    # ========================================================================
    # Search Index Management
    # ========================================================================

    @staticmethod
    async def warm_search_cache(db: AsyncSession) -> int:
        """
        Populate the search cache with all active products

        This should be called during application startup to enable
        fast fuzzy search. Products are indexed with searchable text
        (name, model number, descriptions) for YokedCache fuzzy matching.

        Args:
            db: Database session

        Returns:
            int: Number of products indexed
        """
        from backend.services.cache_service import cache_service

        logger.info("Starting product search cache warm-up...")

        try:
            # Fetch all active products
            query = (
                select(Chair)
                .where(Chair.is_active == True)
                .options(selectinload(Chair.category))
            )

            result = await db.execute(query)
            products = list(result.scalars().all())

            indexed_count = 0

            for product in products:
                searchable_parts = [
                    product.name or "",
                    product.model_number or "",
                    product.short_description or "",
                    product.full_description or "",
                ]
                if product.category:
                    searchable_parts.append(product.category.name or "")
                kw = product.keywords
                if isinstance(kw, list):
                    searchable_parts.append(" ".join(str(k) for k in kw if k))
                searchable_text = " ".join(filter(None, searchable_parts))

                # Index for fuzzy search
                success = await cache_service.index_product_for_search(
                    product_id=product.id,
                    searchable_text=searchable_text,
                    ttl=3600,  # 1 hour
                )

                if success:
                    indexed_count += 1

            logger.info(
                f"Product search cache warm-up complete: {indexed_count} products indexed"
            )
            return indexed_count

        except Exception as e:
            logger.error(f"Error warming search cache: {e}")
            return 0
