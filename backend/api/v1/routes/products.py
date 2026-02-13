"""
Product Routes - API v1

Public routes for browsing product catalog (chairs, categories, finishes, upholstery)
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import attributes as sa_attributes

from backend.api.dependencies import get_optional_company
from backend.api.v1.schemas.common import MessageResponse
from backend.api.v1.schemas.product import (
    CategoryResponse,
    ChairDetailResponse,
    ChairResponse,
    ColorResponse,
    FinishResponse,
    ProductFamilyResponse,
    ProductSubcategoryResponse,
    UpholsteryResponse,
)
from backend.database.base import get_db
from backend.models.company import Company
from backend.services.pricing_service import PricingService
from backend.services.product_service import ProductService
from backend.utils.pagination import PaginatedResponse, PaginationParams

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Products"])


async def _populate_customizations(
    db: AsyncSession,
    products: List
) -> None:
    """
    Populate customizations object for products with finish, color, and upholstery names.
    Modifies products in-place by adding customizations dict.
    
    Note: This modifies SQLAlchemy model instances, which Pydantic will include when using from_attributes=True.
    """
    if not products:
        return
    
    from sqlalchemy import select

    from backend.models.chair import Color, Finish, Upholstery
    
    # Collect all IDs from all products
    all_finish_ids = set()
    all_color_ids = set()
    all_upholstery_ids = set()
    
    for product in products:
        if hasattr(product, 'available_finishes') and product.available_finishes:
            all_finish_ids.update(product.available_finishes)
        if hasattr(product, 'available_colors') and product.available_colors:
            all_color_ids.update(product.available_colors)
        if hasattr(product, 'available_upholsteries') and product.available_upholsteries:
            all_upholstery_ids.update(product.available_upholsteries)
    
    # Fetch all finishes, colors, and upholsteries in one query each
    finish_map = {}
    if all_finish_ids:
        finish_result = await db.execute(
            select(Finish).where(Finish.id.in_(list(all_finish_ids)), Finish.is_active == True)
        )
        for finish in finish_result.scalars().all():
            finish_map[finish.id] = {
                "id": finish.id,
                "name": finish.name,
                "image_url": finish.image_url,
                "color_hex": getattr(finish, "color_hex", None),
            }

    color_map = {}
    if all_color_ids:
        color_result = await db.execute(
            select(Color).where(Color.id.in_(list(all_color_ids)), Color.is_active == True)
        )
        for color in color_result.scalars().all():
            color_map[color.id] = {
                "id": color.id,
                "name": color.name,
                "image_url": color.image_url,
                "color_hex": getattr(color, "hex_value", None) or getattr(color, "color_hex", None),
            }

    upholstery_map = {}
    if all_upholstery_ids:
        upholstery_result = await db.execute(
            select(Upholstery).where(Upholstery.id.in_(list(all_upholstery_ids)), Upholstery.is_active == True)
        )
        for upholstery in upholstery_result.scalars().all():
            upholstery_map[upholstery.id] = {
                "id": upholstery.id,
                "name": upholstery.name,
                "image_url": upholstery.image_url,
                "swatch_image_url": getattr(upholstery, "swatch_image_url", None),
                "color_hex": getattr(upholstery, "color_hex", None),
            }
    
    # Populate customizations for each product
    for product in products:
        customizations = {}
        
        if hasattr(product, 'available_finishes') and product.available_finishes:
            finishes = [finish_map[fid] for fid in product.available_finishes if fid in finish_map]
            if finishes:
                customizations['finishes'] = finishes
        
        if hasattr(product, 'available_colors') and product.available_colors:
            colors = [color_map[cid] for cid in product.available_colors if cid in color_map]
            if colors:
                customizations['colors'] = colors
        
        if hasattr(product, 'available_upholsteries') and product.available_upholsteries:
            upholsteries = [upholstery_map[uid] for uid in product.available_upholsteries if uid in upholstery_map]
            if upholsteries:
                customizations['fabrics'] = upholsteries  # Frontend uses 'fabrics' for upholstery
                customizations['upholstery'] = upholsteries  # Also include 'upholstery' for compatibility
        
        if customizations:
            product.customizations = customizations


async def _apply_pricing_tiers_to_products(
    db: AsyncSession,
    company: Company,
    products: List
) -> None:
    """
    Apply company pricing tiers to a list of products.
    Modifies products in-place by adding adjusted_price, pricing_tier_name, and pricing_tier_adjustment.
    
    Note: This modifies SQLAlchemy model instances, which Pydantic will include when using from_attributes=True.
    """
    if not company or not products:
        return
    
    # Load company's pricing tier once
    pricing_tier_name = None
    tier_id = getattr(company, 'pricing_tier_id', None)
    if tier_id:
        from sqlalchemy import select

        from backend.models.company import CompanyPricing
        tier_result = await db.execute(
            select(CompanyPricing).where(CompanyPricing.id == tier_id)
        )
        tier = tier_result.scalar_one_or_none()
        if tier:
            pricing_tier_name = getattr(tier, 'pricing_tier_name', None)
    
    # Apply pricing to each product
    company_id = getattr(company, 'id', None)
    if not company_id:
        return
        
    for product in products:
        base_price = getattr(product, 'base_price', None)
        category_id = getattr(product, 'category_id', None)
        
        if base_price and category_id:
            tier_adjustment, tier_percentage = await PricingService._get_company_tier_adjustment(
                db, company_id, category_id, base_price
            )
            if tier_adjustment != 0:
                # Set attributes on the SQLAlchemy model instance
                # Pydantic will pick these up via from_attributes=True
                product.adjusted_price = base_price + tier_adjustment
                product.pricing_tier_adjustment = tier_percentage
                if pricing_tier_name:
                    product.pricing_tier_name = pricing_tier_name


# ============================================================================
# Category Endpoints
# ============================================================================

@router.get(
    "/categories",
    response_model=list[CategoryResponse],
    summary="Get all categories",
    description="Retrieve all product categories (chairs, booths, tables, etc.)"
)
async def get_categories(
    parent_id: Optional[int] = Query(None, description="Filter by parent category ID"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all product categories.
    
    **Public endpoint** - No authentication required.
    """
    logger.info(f"Fetching categories (parent_id={parent_id})")
    
    categories = await ProductService.get_categories(
        db=db,
        include_inactive=False,
        parent_id=parent_id
    )
    
    return categories


@router.get(
    "/categories/{category_id}",
    response_model=CategoryResponse,
    summary="Get category by ID",
    description="Retrieve a specific category by its ID"
)
async def get_category(
    category_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific category by ID.
    
    **Public endpoint** - No authentication required.
    """
    logger.info(f"Fetching category {category_id}")
    
    category = await ProductService.get_category_by_id(
        db=db,
        category_id=category_id
    )
    
    return category


@router.get(
    "/categories/slug/{slug}",
    response_model=CategoryResponse,
    summary="Get category by slug",
    description="Retrieve a specific category by its slug"
)
async def get_category_by_slug(
    slug: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific category by slug.
    
    **Public endpoint** - No authentication required.
    """
    logger.info(f"Fetching category with slug '{slug}'")
    
    category = await ProductService.get_category_by_slug(
        db=db,
        slug=slug
    )
    
    return category


# ============================================================================
# Product Endpoints
# ============================================================================

@router.get(
    "/products",
    response_model=PaginatedResponse[ChairResponse],
    summary="Get products",
    description="Retrieve paginated list of products with comprehensive filters"
)
async def get_products(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    category_id: Optional[int] = Query(None, description="Filter by category ID"),
    subcategory_id: Optional[int] = Query(None, description="Filter by subcategory ID"),
    family_id: Optional[int] = Query(None, description="Filter by product family ID"),
    search: Optional[str] = Query(None, description="Search in name, model, description"),
    featured: Optional[bool] = Query(None, description="Filter featured products"),
    new: Optional[bool] = Query(None, description="Filter new products"),
    finish_ids: Optional[str] = Query(None, description="Comma-separated finish IDs"),
    upholstery_ids: Optional[str] = Query(None, description="Comma-separated upholstery IDs"),
    color_ids: Optional[str] = Query(None, description="Comma-separated color IDs"),
    min_seat_height: Optional[float] = Query(None, description="Minimum seat height"),
    max_seat_height: Optional[float] = Query(None, description="Maximum seat height"),
    min_width: Optional[float] = Query(None, description="Minimum width"),
    max_width: Optional[float] = Query(None, description="Maximum width"),
    stackable: Optional[bool] = Query(None, description="Filter stackable products"),
    outdoor: Optional[bool] = Query(None, description="Filter outdoor products"),
    ada_compliant: Optional[bool] = Query(None, description="Filter ADA compliant products"),
    max_lead_time: Optional[int] = Query(None, description="Maximum lead time in days"),
    in_stock_only: bool = Query(False, description="Show only in-stock products"),
    exclude_variations: bool = Query(False, description="Exclude variations, show only base products"),
    smart_sort: bool = Query(False, description="Use smart sorting (featured→new→popular)"),
    company: Optional[Company] = Depends(get_optional_company),
    db: AsyncSession = Depends(get_db)
):
    """
    Get paginated list of products with comprehensive filtering.
    
    **Public endpoint** - No authentication required.
    
    **Filtering Options:**
    - Category, Subcategory, Family
    - Search query (name, model number, description)
    - Featured/New products
    - Finishes, Upholstery, Colors (comma-separated IDs)
    - Dimensions (seat height, width)
    - Features (stackable, outdoor, ADA compliant)
    - Lead time and stock availability
    
    **Smart Sorting:**
    When smart_sort=true, products are ordered by:
    1. Featured products first
    2. New products second
    3. Popular products (by view count)
    4. Then by display order and name
    """
    logger.info(
        f"Fetching products (page={page}, per_page={per_page}, "
        f"category_id={category_id}, family_id={family_id}, search='{search}')"
    )
    
    # Parse comma-separated IDs
    finish_id_list = [int(id.strip()) for id in finish_ids.split(",")] if finish_ids else None
    upholstery_id_list = [int(id.strip()) for id in upholstery_ids.split(",")] if upholstery_ids else None
    color_id_list = [int(id.strip()) for id in color_ids.split(",")] if color_ids else None
    
    pagination = PaginationParams(page=page, per_page=per_page)
    
    result = await ProductService.get_products(
        db=db,
        pagination=pagination,
        category_id=category_id,
        subcategory_id=subcategory_id,
        family_id=family_id,
        search_query=search,
        is_featured=featured,
        is_new=new,
        finish_ids=finish_id_list,
        upholstery_ids=upholstery_id_list,
        color_ids=color_id_list,
        min_seat_height=min_seat_height,
        max_seat_height=max_seat_height,
        min_width=min_width,
        max_width=max_width,
        is_stackable=stackable,
        is_outdoor=outdoor,
        is_ada_compliant=ada_compliant,
        max_lead_time_days=max_lead_time,
        in_stock_only=in_stock_only,
        exclude_variations=exclude_variations,
        smart_sort=smart_sort,
        include_inactive=False
    )
    
    # Populate customizations for all products
    if result and 'items' in result:
        items_list = result['items'] if isinstance(result, dict) else getattr(result, 'items', [])
        if items_list:
            await _populate_customizations(db, items_list)
    
    # Apply pricing tiers if company is authenticated
    if company and result and 'items' in result:
        items_list = result['items'] if isinstance(result, dict) else getattr(result, 'items', [])
        if items_list:
            await _apply_pricing_tiers_to_products(db, company, items_list)
    
    return result


@router.get(
    "/products/search",
    response_model=list[ChairResponse],
    summary="Fuzzy search products",
    description="Fuzzy search for products using YokedCache (autocomplete/typeahead)"
)
async def search_products(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(10, ge=1, le=50, description="Maximum results"),
    threshold: int = Query(75, ge=0, le=100, description="Fuzzy match threshold (0-100)"),
    company: Optional[Company] = Depends(get_optional_company),
    db: AsyncSession = Depends(get_db)
):
    """
    Fuzzy search for products with cache-powered relevance scoring.
    
    **Public endpoint** - No authentication required.
    
    Uses YokedCache fuzzy search for intelligent matching and ranking.
    Useful for autocomplete/typeahead functionality with typo tolerance.
    
    **Parameters:**
    - q: Search query (minimum 2 characters)
    - limit: Maximum number of results (1-50)
    - threshold: Similarity threshold 0-100 (higher = stricter matching)
    """
    logger.info(f"Fuzzy searching products with query '{q}' (threshold={threshold})")
    
    products = await ProductService.search_products_fuzzy(
        db=db,
        search_query=q,
        limit=limit,
        threshold=threshold
    )
    
    # Populate customizations for search results
    if products:
        await _populate_customizations(db, products)
    
    return products


@router.get(
    "/products/{product_id}",
    response_model=ChairDetailResponse,
    summary="Get product by ID",
    description="Retrieve detailed information about a specific product"
)
async def get_product(
    product_id: int,
    company: Optional[Company] = Depends(get_optional_company),
    db: AsyncSession = Depends(get_db)
):
    """
    Get detailed product information by ID.
    
    **Public endpoint** - No authentication required.
    
    This endpoint increments the product's view count.
    """
    logger.info(f"Fetching product {product_id}")
    
    product = await ProductService.get_product_by_id(
        db=db,
        product_id=product_id,
        increment_view=True  # Track popularity
    )
    
    await _populate_customizations(db, [product])

    if company:
        await _apply_pricing_tiers_to_products(db, company, [product])

    related = await ProductService.get_related_products(db, product.id, limit=6)
    sa_attributes.set_committed_value(product, "related_products", related)

    return product


@router.get(
    "/products/slug/{slug}",
    response_model=ChairDetailResponse,
    summary="Get product by slug",
    description="Retrieve detailed information about a specific product by slug"
)
async def get_product_by_slug(
    slug: str,
    company: Optional[Company] = Depends(get_optional_company),
    db: AsyncSession = Depends(get_db)
):
    """
    Get detailed product information by slug.
    
    **Public endpoint** - No authentication required.
    
    This endpoint increments the product's view count.
    """
    logger.info(f"Fetching product with slug '{slug}'")
    
    product = await ProductService.get_product_by_slug(
        db=db,
        slug=slug,
        increment_view=True  # Track popularity
    )
    
    await _populate_customizations(db, [product])

    if company:
        await _apply_pricing_tiers_to_products(db, company, [product])

    related = await ProductService.get_related_products(db, product.id, limit=6)
    sa_attributes.set_committed_value(product, "related_products", related)

    return product


@router.get(
    "/products/model/{model_number}",
    response_model=ChairDetailResponse,
    summary="Get product by model number",
    description="Retrieve product by model number"
)
async def get_product_by_model(
    model_number: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get product by model number.
    
    **Public endpoint** - No authentication required.
    
    This endpoint increments the product's view count.
    """
    logger.info(f"Fetching product with model number '{model_number}'")
    
    product = await ProductService.get_product_by_model_number(
        db=db,
        model_number=model_number,
        increment_view=True  # Track popularity
    )

    await _populate_customizations(db, [product])

    related = await ProductService.get_related_products(db, product.id, limit=6)
    sa_attributes.set_committed_value(product, "related_products", related)

    return product


# ============================================================================
# Finish Endpoints
# ============================================================================

@router.get(
    "/finishes",
    response_model=list[FinishResponse],
    summary="Get finishes",
    description="Retrieve all available finishes (wood stains, paints, etc.)"
)
async def get_finishes(
    finish_type: Optional[str] = Query(None, description="Filter by finish type"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all available finishes.
    
    **Public endpoint** - No authentication required.
    """
    logger.info(f"Fetching finishes (type={finish_type})")
    
    finishes = await ProductService.get_finishes(
        db=db,
        finish_type=finish_type,
        include_inactive=False
    )
    
    return finishes


@router.get(
    "/finishes/{finish_id}",
    response_model=FinishResponse,
    summary="Get finish by ID",
    description="Retrieve a specific finish by its ID"
)
async def get_finish(
    finish_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific finish by ID.
    
    **Public endpoint** - No authentication required.
    """
    logger.info(f"Fetching finish {finish_id}")
    
    finish = await ProductService.get_finish_by_id(
        db=db,
        finish_id=finish_id
    )
    
    return finish


# ============================================================================
# Upholstery Endpoints
# ============================================================================

@router.get(
    "/upholsteries",
    response_model=list[UpholsteryResponse],
    summary="Get upholsteries",
    description="Retrieve all available upholstery materials"
)
async def get_upholsteries(
    material_type: Optional[str] = Query(None, description="Filter by material type (Vinyl, Fabric, Leather)"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all available upholsteries.
    
    **Public endpoint** - No authentication required.
    """
    logger.info(f"Fetching upholsteries (material_type={material_type})")
    
    upholsteries = await ProductService.get_upholsteries(
        db=db,
        material_type=material_type,
        include_inactive=False
    )
    
    return upholsteries


@router.get(
    "/upholsteries/{upholstery_id}",
    response_model=UpholsteryResponse,
    summary="Get upholstery by ID",
    description="Retrieve a specific upholstery by its ID"
)
async def get_upholstery(
    upholstery_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific upholstery by ID.
    
    **Public endpoint** - No authentication required.
    """
    logger.info(f"Fetching upholstery {upholstery_id}")
    
    upholstery = await ProductService.get_upholstery_by_id(
        db=db,
        upholstery_id=upholstery_id
    )
    
    return upholstery


# ============================================================================
# Product Families & Subcategories
# ============================================================================

@router.get(
    "/families",
    response_model=list[ProductFamilyResponse],
    summary="Get product families",
    description="Retrieve product families with optional filters and product counts"
)
async def get_families(
    category_id: Optional[int] = Query(None, description="Filter by category ID"),
    featured_only: bool = Query(False, description="Only show featured families"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get product families.
    
    **Public endpoint** - No authentication required.
    
    Returns families with product counts for catalog browsing.
    """
    logger.info(f"Fetching families (category_id={category_id}, featured_only={featured_only})")
    
    from sqlalchemy import func, or_, select

    from backend.models.chair import Chair, ProductFamily, chair_secondary_families

    families = await ProductService.get_families(
        db=db,
        category_id=category_id,
        featured_only=featured_only,
        include_inactive=False
    )

    for family in families:
        subq = select(chair_secondary_families.c.chair_id).where(
            chair_secondary_families.c.family_id == family.id
        )
        count_stmt = select(func.count(Chair.id)).where(
            Chair.is_active == True,
            or_(Chair.family_id == family.id, Chair.id.in_(subq)),
        )
        count_result = await db.execute(count_stmt)
        family.product_count = count_result.scalar() or 0

    return families


@router.get(
    "/families/{family_id}",
    response_model=ProductFamilyResponse,
    summary="Get family by ID",
    description="Retrieve a specific product family by ID with product count"
)
async def get_family_by_id(
    family_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific product family by ID.
    
    **Public endpoint** - No authentication required.
    """
    logger.info(f"Fetching family {family_id}")
    
    from sqlalchemy import func, or_, select

    from backend.core.exceptions import ResourceNotFoundError
    from backend.models.chair import Chair, ProductFamily, chair_secondary_families

    stmt = select(ProductFamily).where(ProductFamily.id == family_id)
    result = await db.execute(stmt)
    family = result.scalar_one_or_none()

    if not family:
        raise ResourceNotFoundError(resource_type="ProductFamily", resource_id=family_id)

    subq = select(chair_secondary_families.c.chair_id).where(
        chair_secondary_families.c.family_id == family.id
    )
    count_stmt = select(func.count(Chair.id)).where(
        Chair.is_active == True,
        or_(Chair.family_id == family.id, Chair.id.in_(subq)),
    )
    count_result = await db.execute(count_stmt)
    family.product_count = count_result.scalar() or 0

    return family


@router.get(
    "/families/slug/{slug}",
    response_model=ProductFamilyResponse,
    summary="Get family by slug",
    description="Retrieve a specific product family by slug with product count"
)
async def get_family_by_slug(
    slug: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific product family by slug.
    
    **Public endpoint** - No authentication required.
    """
    logger.info(f"Fetching family with slug '{slug}'")
    
    from sqlalchemy import func, or_, select

    from backend.core.exceptions import ResourceNotFoundError
    from backend.models.chair import Chair, ProductFamily, chair_secondary_families

    stmt = select(ProductFamily).where(ProductFamily.slug == slug)
    result = await db.execute(stmt)
    family = result.scalar_one_or_none()

    if not family:
        raise ResourceNotFoundError(resource_type="ProductFamily", resource_id=slug)

    subq = select(chair_secondary_families.c.chair_id).where(
        chair_secondary_families.c.family_id == family.id
    )
    count_stmt = select(func.count(Chair.id)).where(
        Chair.is_active == True,
        or_(Chair.family_id == family.id, Chair.id.in_(subq)),
    )
    count_result = await db.execute(count_stmt)
    family.product_count = count_result.scalar() or 0

    return family


@router.get(
    "/subcategories",
    response_model=list[ProductSubcategoryResponse],
    summary="Get product subcategories",
    description="Retrieve product subcategories with optional filters and product counts"
)
async def get_subcategories(
    category_id: Optional[int] = Query(None, description="Filter by category ID"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get product subcategories.
    
    **Public endpoint** - No authentication required.
    
    Returns subcategories with product counts for catalog browsing.
    """
    logger.info(f"Fetching subcategories (category_id={category_id})")
    
    from sqlalchemy import func, select

    from backend.models.chair import Chair, ProductSubcategory
    
    # Get subcategories with product counts
    subcategories = await ProductService.get_subcategories(
        db=db,
        category_id=category_id,
        include_inactive=False
    )
    
    # Add product counts
    for subcategory in subcategories:
        count_stmt = select(func.count(Chair.id)).where(
            Chair.subcategory_id == subcategory.id,
            Chair.is_active == True
        )
        count_result = await db.execute(count_stmt)
        subcategory.product_count = count_result.scalar() or 0
    
    return subcategories


# ============================================================================
# Colors
# ============================================================================

@router.get(
    "/colors",
    response_model=list[ColorResponse],
    summary="Get colors",
    description="Retrieve all available colors for filtering"
)
async def get_colors(
    category: Optional[str] = Query(None, description="Filter by category (wood/metal/fabric/paint)"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all available colors.
    
    **Public endpoint** - No authentication required.
    
    Returns colors organized by category (wood, metal, fabric, paint).
    """
    logger.info(f"Fetching colors (category={category})")
    
    from sqlalchemy import select

    from backend.models.chair import Color
    
    query = select(Color).where(Color.is_active == True)
    
    if category:
        query = query.where(Color.category == category)
    
    query = query.order_by(Color.display_order, Color.name)
    
    result = await db.execute(query)
    colors = result.scalars().all()
    
    logger.info(f"Retrieved {len(colors)} colors")
    return list(colors)


# ============================================================================
# Product Families & Subcategories (NEW)
# ============================================================================

@router.get(
    "/products/{product_id}/variations",
    summary="Get product variations",
    description="Get all available variations for a product"
)
async def get_product_variations(
    product_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all variations for a product.
    
    **Public endpoint** - No authentication required.
    
    Returns variations with finish, upholstery, color combinations.
    """
    logger.info(f"Fetching variations for product {product_id}")
    
    result = await ProductService.get_product_with_variations(
        db=db,
        product_id=product_id,
        include_inactive_variations=False
    )
    
    # Serialize variations with relationships
    from backend.utils.serializers import orm_to_dict
    serialized_variations = []
    for variation in result["variations"]:
        var_dict = orm_to_dict(variation)
        # Include relationship data
        if variation.finish:
            var_dict["finish"] = {
                "id": variation.finish.id,
                "name": variation.finish.name,
                "type": variation.finish.finish_type.value if variation.finish.finish_type else None
            }
        if variation.upholstery:
            var_dict["upholstery"] = {
                "id": variation.upholstery.id,
                "name": variation.upholstery.name,
                "material_type": variation.upholstery.material_type.value if variation.upholstery.material_type else None
            }
        if variation.color:
            var_dict["color"] = {
                "id": variation.color.id,
                "name": variation.color.name,
                "hex_code": variation.color.hex_value,  # Color model uses hex_value, not hex_code
                "category": variation.color.category.value if variation.color.category else None
            }
        serialized_variations.append(var_dict)
    
    return {
        "product_id": product_id,
        "variations": serialized_variations
    }


@router.get(
    "/products/{product_id}/available-options",
    summary="Get available product options",
    description="Get all available options for a product (colors, finishes, upholsteries, custom options)"
)
async def get_product_available_options(
    product_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all available options for a product.
    
    **Public endpoint** - No authentication required.
    
    Returns:
    - Colors available for this product
    - Finishes (wood stains, paints, etc.)
    - Upholsteries (vinyl, fabric, leather)
    - Custom options (back handles, glides, etc.)
    """
    logger.info(f"Fetching available options for product {product_id}")
    
    options = await ProductService.get_available_options(
        db=db,
        product_id=product_id
    )
    
    return options


@router.get(
    "/products/{product_id}/images",
    summary="Get product images",
    description="Get product images organized by type"
)
async def get_product_images(
    product_id: int,
    variation_id: Optional[int] = Query(None, description="Get images for specific variation"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get product images organized by type.
    
    **Public endpoint** - No authentication required.
    
    Returns primary image, hover image, and gallery images.
    If variation_id is provided, includes variation-specific images.
    """
    logger.info(f"Fetching images for product {product_id} (variation={variation_id})")
    
    images = await ProductService.get_product_images(
        db=db,
        product_id=product_id,
        variation_id=variation_id
    )
    
    return images


@router.get(
    "/products/{product_id}/related",
    response_model=list[ChairResponse],
    summary="Get related products",
    description="Get related products based on family and category"
)
async def get_related_products(
    product_id: int,
    limit: int = Query(6, ge=1, le=20, description="Max number of related products"),
    company: Optional[Company] = Depends(get_optional_company),
    db: AsyncSession = Depends(get_db)
):
    """
    Get related products.
    
    **Public endpoint** - No authentication required.
    
    Returns products from the same family or category.
    """
    logger.info(f"Fetching related products for product {product_id}")
    
    related = await ProductService.get_related_products(
        db=db,
        product_id=product_id,
        limit=limit
    )
    
    # Populate customizations for related products
    if related:
        await _populate_customizations(db, related)
    
    # Apply pricing tiers if company is authenticated
    if company and related:
        await _apply_pricing_tiers_to_products(db, company, related)
    
    return related


# ============================================================================
# Pricing (NEW - Company-Specific Pricing)
# ============================================================================

@router.get(
    "/products/{product_id}/price",
    summary="Calculate product price",
    description="Calculate final product price with company-specific pricing, variations, and custom options"
)
async def calculate_product_price(
    product_id: int,
    company_id: Optional[int] = Query(None, description="Company ID for tier pricing"),
    variation_id: Optional[int] = Query(None, description="Variation ID"),
    custom_option_ids: Optional[str] = Query(None, description="Comma-separated custom option IDs"),
    db: AsyncSession = Depends(get_db)
):
    """
    Calculate product price with all adjustments.
    
    **Public endpoint** - No authentication required.
    
    Calculates price including:
    - Base product price
    - Company pricing tier adjustment (if company_id provided)
    - Variation price adjustment (if variation_id provided)
    - Custom options cost (if custom_option_ids provided)
    
    Returns breakdown showing how final price is calculated.
    """
    logger.info(
        f"Calculating price for product {product_id} "
        f"(company={company_id}, variation={variation_id}, options={custom_option_ids})"
    )
    
    # Parse custom option IDs
    option_ids = None
    if custom_option_ids:
        try:
            option_ids = [int(id.strip()) for id in custom_option_ids.split(",")]
        except ValueError:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="Invalid custom_option_ids format")
    
    pricing = await PricingService.calculate_product_price(
        db=db,
        product_id=product_id,
        company_id=company_id,
        variation_id=variation_id,
        custom_option_ids=option_ids
    )
    
    return pricing


@router.get(
    "/products/{product_id}/price-range",
    summary="Get product price range",
    description="Get min/max price range for product based on variations"
)
async def get_product_price_range(
    product_id: int,
    company_id: Optional[int] = Query(None, description="Company ID for tier pricing"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get product price range.

    **Public endpoint** - No authentication required.

    Shows min and max prices based on available variations.
    Useful for product listings to display price ranges.
    """
    logger.info(f"Fetching price range for product {product_id} (company={company_id})")

    price_range = await PricingService.get_product_price_range(
        db=db,
        product_id=product_id,
        company_id=company_id
    )

    return price_range


# ============================================================================
# Cache Management
# ============================================================================

@router.get(
    "/cache/timestamps",
    summary="Get cache timestamps",
    description="Get last update timestamps for all product data types to enable mobile app cache invalidation"
)
async def get_cache_timestamps(
    db: AsyncSession = Depends(get_db)
):
    """
    Get last update timestamps for product-related data.

    **Public endpoint** - No authentication required.

    This endpoint helps mobile apps determine if their cached data is stale
    by checking the last modification time for each data type.

    Returns timestamps for:
    - products: Last product update
    - categories: Last category update
    - variations: Last product variation update
    - colors: Last color update
    - finishes: Last finish update
    - upholsteries: Last upholstery update
    - families: Last product family update
    - subcategories: Last product subcategory update

    Mobile apps should call this endpoint periodically and compare returned
    timestamps with their cached data timestamps. If a timestamp is newer,
    they should update that specific data type from the API.
    """
    logger.info("Fetching cache timestamps for mobile app cache invalidation")

    timestamps = await ProductService.get_cache_timestamps(db=db)

    return {
        "timestamps": timestamps,
        "message": "Use these timestamps to determine if cached data needs updating"
    }

