"""
Product Routes - API v1

Public routes for browsing product catalog (chairs, categories, finishes, upholstery)
"""

import logging
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import attributes as sa_attributes

from backend.api.dependencies import get_optional_company
from backend.api.v1.schemas.common import MessageResponse
from backend.api.v1.schemas.product import (
    CategoryChildResponse,
    CategoryResponse,
    CategoryWithChildren,
    ChairDetailResponse,
    ChairResponse,
    ColorResponse,
    FinishResponse,
    ProductFamilyResponse,
    ProductSubcategoryResponse,
    UpholsteryResponse,
)
from backend.database.base import get_db
from backend.models.chair import Chair
from backend.models.company import Company
from backend.services.media_service import rendition_urls
from backend.services.catalog_cache import (
    get_cached_public_response,
    public_json_response,
)
from backend.services.pricing_service import PricingService
from backend.services.product_service import ProductService
from backend.utils.pagination import PaginatedResponse, PaginationParams

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Products"])


def _parse_id_list(raw: Optional[str], param: str) -> Optional[List[int]]:
    """Parse a comma-separated list of integer IDs, raising 422 on bad input."""
    if not raw:
        return None
    try:
        return [int(part.strip()) for part in raw.split(",") if part.strip()] or None
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{param} must be a comma-separated list of integers",
        )


async def _populate_customizations(
    db: AsyncSession,
    products: List,
    respect_switches: bool = True,
) -> None:
    """
    Populate customizations object for products with finish, color, and upholstery names.
    Modifies products in-place by adding customizations dict.

    With respect_switches, option groups a product has switched off
    (upholstery_enabled / colors_enabled / laminates_enabled) are left out.
    Single-product responses pass False so the detail page can apply a
    variation's override, which may turn a group back on.
    
    Note: This modifies SQLAlchemy model instances, which Pydantic will include when using from_attributes=True.
    """
    if not products:
        return
    
    from sqlalchemy import select

    from backend.models.chair import Color, Finish, Upholstery
    from backend.models.content import Laminate
    
    # Collect all IDs from all products
    all_finish_ids = set()
    all_color_ids = set()
    all_upholstery_ids = set()
    all_laminate_ids = set()
    all_source_ids = set()

    for product in products:
        if hasattr(product, 'available_finishes') and product.available_finishes:
            all_finish_ids.update(product.available_finishes)
        if hasattr(product, 'available_colors') and product.available_colors:
            all_color_ids.update(product.available_colors)
        if hasattr(product, 'available_upholsteries') and product.available_upholsteries:
            all_upholstery_ids.update(product.available_upholsteries)
        if getattr(product, 'available_laminates', None):
            all_laminate_ids.update(product.available_laminates)
        if getattr(product, 'material_sources', None):
            all_source_ids.update(product.material_sources)
    
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
    
    laminate_map = {}
    if all_laminate_ids:
        laminate_result = await db.execute(
            select(Laminate).where(Laminate.id.in_(list(all_laminate_ids)), Laminate.is_active == True)
        )
        for laminate in laminate_result.scalars().all():
            laminate_map[laminate.id] = {
                "id": laminate.id,
                "name": laminate.pattern_name,
                "brand": laminate.brand,
                "image_url": laminate.full_image_url,
                "swatch_image_url": laminate.swatch_image_url,
            }

    # Supplier catalogs ("order any pattern from ...") by id
    source_map = {}
    if all_source_ids:
        from backend.models.content import MaterialSource

        source_result = await db.execute(
            select(MaterialSource)
            .where(MaterialSource.id.in_(list(all_source_ids)), MaterialSource.is_active == True)
            .order_by(MaterialSource.display_order, MaterialSource.name)
        )
        for source in source_result.scalars().all():
            source_map[source.id] = {
                "id": source.id,
                "name": source.name,
                "material_type": source.material_type,
                "url": source.url,
                "description": source.description,
                "logo_url": source.logo_url,
            }
    # Supplier types that belong to a switchable option group
    source_switch = {"upholstery": "upholstery_enabled", "laminate": "laminates_enabled"}

    # Populate customizations for each product
    for product in products:
        customizations = {}
        
        if hasattr(product, 'available_finishes') and product.available_finishes:
            finishes = [finish_map[fid] for fid in product.available_finishes if fid in finish_map]
            if finishes:
                customizations['finishes'] = finishes
        
        if (not respect_switches or getattr(product, 'colors_enabled', True)) and getattr(product, 'available_colors', None):
            colors = [color_map[cid] for cid in product.available_colors if cid in color_map]
            if colors:
                customizations['colors'] = colors
        
        if (not respect_switches or getattr(product, 'upholstery_enabled', True)) and getattr(product, 'available_upholsteries', None):
            upholsteries = [upholstery_map[uid] for uid in product.available_upholsteries if uid in upholstery_map]
            if upholsteries:
                customizations['fabrics'] = upholsteries  # Frontend uses 'fabrics' for upholstery
                customizations['upholstery'] = upholsteries  # Also include 'upholstery' for compatibility
        
        if (not respect_switches or getattr(product, 'laminates_enabled', True)) and getattr(product, 'available_laminates', None):
            laminates = [laminate_map[lid] for lid in product.available_laminates if lid in laminate_map]
            if laminates:
                customizations['laminates'] = laminates

        sources = {}
        for sid in getattr(product, 'material_sources', None) or []:
            source = source_map.get(sid)
            if not source:
                continue
            switch = source_switch.get(source["material_type"])
            if respect_switches and switch and not getattr(product, switch, True):
                continue
            sources.setdefault(source["material_type"], []).append(source)
        if sources:
            customizations['sources'] = sources

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
    
    company_id = getattr(company, 'id', None)
    if not company_id:
        return
        
    # Load the active tier once, then apply it to every product in memory
    active_tier = await PricingService._get_active_company_tier(db, company_id)
    if not active_tier:
        return
    pricing_tier_name = getattr(active_tier, 'pricing_tier_name', None)

    for product in products:
        base_price = getattr(product, 'base_price', None)
        category_id = getattr(product, 'category_id', None)
        
        if base_price and category_id:
            tier_adjustment, tier_percentage = PricingService._compute_tier_adjustment(
                active_tier, category_id, base_price, company_id
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
    response_model=list[CategoryWithChildren],
    summary="Get all categories",
    description="Retrieve primary product categories (chairs, booths, tables, etc.) with their children"
)
async def get_categories(
    request: Request,
    parent_id: Optional[int] = Query(None, description="Filter by parent category ID"),
    include_nested: bool = Query(
        False,
        description="Include nested (child) categories in the returned list instead of only primary categories",
    ),
    db: AsyncSession = Depends(get_db)
):
    """
    Get product categories.

    **Public endpoint** - No authentication required.

    By default only primary (top-level) categories are returned. Nested
    categories — categories that have a `parent_id` — are children and are
    returned inside their parent's `subcategories` list alongside the
    category's product subcategories, each tagged with a `type`.
    """
    cached = await get_cached_public_response(request)
    if cached is not None:
        return cached

    logger.info(
        f"Fetching categories (parent_id={parent_id}, include_nested={include_nested})"
    )

    categories = await ProductService.get_categories(
        db=db,
        include_inactive=False,
        parent_id=parent_id,
        top_level_only=not include_nested,
    )

    children = await ProductService.get_category_children(
        db=db, include_inactive=False, with_counts=True
    )
    category_counts = await ProductService.get_category_product_counts(db)

    data = [
        {
            "id": category.id,
            "name": category.name,
            "slug": category.slug,
            "description": category.description,
            "parent_id": category.parent_id,
            "display_order": category.display_order,
            "is_active": category.is_active,
            "icon_url": category.icon_url,
            "banner_image_url": category.banner_image_url,
            "spec_profile": category.spec_profile,
            "meta_title": category.meta_title,
            "meta_description": category.meta_description,
            "created_at": category.created_at,
            "updated_at": category.updated_at,
            "subcategories": children.get(category.id, []),
            # Lets the catalog filter panel hide empty categories
            "has_products": category_counts.get(category.id, 0) > 0
            or any(c["product_count"] > 0 for c in children.get(category.id, [])),
        }
        for category in categories
    ]
    return await public_json_response(request, data, list[CategoryWithChildren])


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


async def _increment_view_count(db: AsyncSession, *conditions) -> None:
    """Track a product view when the detail response came from cache."""
    try:
        await db.execute(
            update(Chair)
            .where(*conditions)
            .values(view_count=Chair.view_count + 1)
        )
        await db.commit()
    except Exception as e:
        await db.rollback()
        logger.debug(f"Could not increment view count: {e}")


@router.get(
    "/products",
    response_model=PaginatedResponse[ChairResponse],
    summary="Get products",
    description="Retrieve paginated list of products with comprehensive filters"
)
async def get_products(
    request: Request,
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    category_id: Optional[int] = Query(None, description="Filter by category ID"),
    subcategory_id: Optional[int] = Query(None, description="Filter by subcategory ID"),
    category_ids: Optional[str] = Query(None, description="Comma-separated category IDs (match any)"),
    subcategory_ids: Optional[str] = Query(None, description="Comma-separated subcategory IDs (match any)"),
    family_id: Optional[int] = Query(None, description="Filter by product family ID"),
    search: Optional[str] = Query(None, description="Search in name, model, description"),
    featured: Optional[bool] = Query(None, description="Filter featured products"),
    new: Optional[bool] = Query(None, description="Filter new products"),
    finish_ids: Optional[str] = Query(None, description="Comma-separated finish IDs"),
    upholstery_ids: Optional[str] = Query(None, description="Comma-separated upholstery IDs"),
    color_ids: Optional[str] = Query(None, description="Comma-separated color IDs"),
    min_seat_height: Optional[float] = Query(None, description="Minimum seat height"),
    max_seat_height: Optional[float] = Query(None, description="Maximum seat height"),
    min_height: Optional[float] = Query(None, description="Minimum overall height"),
    max_height: Optional[float] = Query(None, description="Maximum overall height"),
    min_width: Optional[float] = Query(None, description="Minimum width"),
    max_width: Optional[float] = Query(None, description="Maximum width"),
    stackable: Optional[bool] = Query(None, description="Filter stackable products"),
    outdoor: Optional[bool] = Query(None, description="Filter outdoor products"),
    ada_compliant: Optional[bool] = Query(None, description="Filter ADA compliant products"),
    max_lead_time: Optional[int] = Query(None, description="Maximum lead time in days"),
    in_stock_only: bool = Query(False, description="Show only in-stock products"),
    exclude_variations: bool = Query(False, description="Exclude variations, show only base products"),
    smart_sort: bool = Query(False, description="Use smart sorting (new→with image→popular)"),
    sort: Optional[str] = Query(None, description="Sort order: name-asc, name-desc, featured (ignored when smart_sort=true)"),
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
    1. New products first
    2. Products with catalog images (primary, gallery, or hover)
    3. Popular products (by view count)
    4. Then by display order and name

    Default ordering (smart_sort=false) also deprioritizes products without images.
    """
    # Company pricing tiers change prices, so only anonymous responses are cached
    cacheable = company is None
    cached = await get_cached_public_response(request, cacheable=cacheable)
    if cached is not None:
        return cached

    logger.info(
        f"Fetching products (page={page}, per_page={per_page}, "
        f"category_id={category_id}, family_id={family_id}, search='{search}')"
    )
    
    # Parse comma-separated IDs
    finish_id_list = _parse_id_list(finish_ids, "finish_ids")
    category_id_list = _parse_id_list(category_ids, "category_ids")
    subcategory_id_list = _parse_id_list(subcategory_ids, "subcategory_ids")
    upholstery_id_list = _parse_id_list(upholstery_ids, "upholstery_ids")
    color_id_list = _parse_id_list(color_ids, "color_ids")
    
    pagination = PaginationParams(page=page, per_page=per_page)
    
    result = await ProductService.get_products(
        db=db,
        pagination=pagination,
        category_id=category_id,
        subcategory_id=subcategory_id,
        category_ids=category_id_list,
        subcategory_ids=subcategory_id_list,
        family_id=family_id,
        search_query=search,
        is_featured=featured,
        is_new=new,
        finish_ids=finish_id_list,
        upholstery_ids=upholstery_id_list,
        color_ids=color_id_list,
        min_seat_height=min_seat_height,
        max_seat_height=max_seat_height,
        min_height=min_height,
        max_height=max_height,
        min_width=min_width,
        max_width=max_width,
        is_stackable=stackable,
        is_outdoor=outdoor,
        is_ada_compliant=ada_compliant,
        max_lead_time_days=max_lead_time,
        in_stock_only=in_stock_only,
        exclude_variations=exclude_variations,
        smart_sort=smart_sort,
        sort=sort,
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

    return await public_json_response(
        request, result, PaginatedResponse[ChairResponse], cacheable=cacheable
    )


@router.get(
    "/products/search",
    response_model=list[ChairResponse],
    summary="Fuzzy search products",
    description="Fuzzy search for products (autocomplete/typeahead): exact model number, model prefix, name, text, then typo-tolerant matches"
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
    
    Uses the in-process product search index for matching and ranking.
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
    request: Request,
    product_id: int,
    company: Optional[Company] = Depends(get_optional_company),
    db: AsyncSession = Depends(get_db)
):
    """
    Get detailed product information by ID.
    
    **Public endpoint** - No authentication required.
    
    This endpoint increments the product's view count.
    """
    cacheable = company is None
    cached = await get_cached_public_response(request, cacheable=cacheable)
    if cached is not None:
        await _increment_view_count(db, Chair.id == product_id)
        return cached

    logger.info(f"Fetching product {product_id}")

    product = await ProductService.get_product_by_id(
        db=db,
        product_id=product_id,
        increment_view=True  # Track popularity
    )
    
    await _populate_customizations(db, [product], respect_switches=False)

    if company:
        await _apply_pricing_tiers_to_products(db, company, [product])

    related = await ProductService.get_related_products(db, product.id, limit=100)
    sa_attributes.set_committed_value(product, "related_products", related)

    return await public_json_response(
        request, product, ChairDetailResponse, cacheable=cacheable
    )


@router.get(
    "/products/slug/{slug}",
    response_model=ChairDetailResponse,
    summary="Get product by slug",
    description="Retrieve detailed information about a specific product by slug"
)
async def get_product_by_slug(
    request: Request,
    slug: str,
    company: Optional[Company] = Depends(get_optional_company),
    db: AsyncSession = Depends(get_db)
):
    """
    Get detailed product information by slug.
    
    **Public endpoint** - No authentication required.
    
    This endpoint increments the product's view count.
    """
    cacheable = company is None
    cached = await get_cached_public_response(request, cacheable=cacheable)
    if cached is not None:
        await _increment_view_count(db, Chair.slug == slug)
        return cached

    logger.info(f"Fetching product with slug '{slug}'")

    product = await ProductService.get_product_by_slug(
        db=db,
        slug=slug,
        increment_view=True  # Track popularity
    )
    
    await _populate_customizations(db, [product], respect_switches=False)

    if company:
        await _apply_pricing_tiers_to_products(db, company, [product])

    related = await ProductService.get_related_products(db, product.id, limit=100)
    sa_attributes.set_committed_value(product, "related_products", related)

    return await public_json_response(
        request, product, ChairDetailResponse, cacheable=cacheable
    )


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

    await _populate_customizations(db, [product], respect_switches=False)

    related = await ProductService.get_related_products(db, product.id, limit=100)
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
    grade: Optional[str] = Query(None, description="Filter by grade (Standard, Premium, Premium Plus, Artisan)"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all available finishes.
    
    **Public endpoint** - No authentication required.
    """
    logger.info(f"Fetching finishes (type={finish_type}, grade={grade})")
    
    finishes = await ProductService.get_finishes(
        db=db,
        finish_type=finish_type,
        grade=grade,
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
    request: Request,
    category_id: Optional[int] = Query(None, description="Filter by category ID"),
    category_ids: Optional[str] = Query(None, description="Comma-separated category IDs (match any)"),
    featured_only: bool = Query(False, description="Only show featured families"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get product families.
    
    **Public endpoint** - No authentication required.
    
    Returns families with product counts for catalog browsing.
    """
    cached = await get_cached_public_response(request)
    if cached is not None:
        return cached

    logger.info(f"Fetching families (category_id={category_id}, featured_only={featured_only})")

    from sqlalchemy import func, select, union

    from backend.models.chair import Chair, chair_secondary_families

    families = await ProductService.get_families(
        db=db,
        category_id=category_id,
        category_ids=_parse_id_list(category_ids, "category_ids"),
        featured_only=featured_only,
        include_inactive=False
    )

    # Count active products per family (primary or secondary membership) in a
    # single grouped query instead of one COUNT per family.
    counts: dict = {}
    family_ids = [family.id for family in families]
    if family_ids:
        membership = union(
            select(
                Chair.id.label("chair_id"), Chair.family_id.label("family_id")
            ).where(Chair.is_active == True, Chair.family_id.in_(family_ids)),
            select(
                chair_secondary_families.c.chair_id.label("chair_id"),
                chair_secondary_families.c.family_id.label("family_id"),
            )
            .join(Chair, Chair.id == chair_secondary_families.c.chair_id)
            .where(
                Chair.is_active == True,
                chair_secondary_families.c.family_id.in_(family_ids),
            ),
        ).subquery()
        count_rows = await db.execute(
            select(
                membership.c.family_id,
                func.count(func.distinct(membership.c.chair_id)),
            ).group_by(membership.c.family_id)
        )
        counts = {row[0]: row[1] for row in count_rows.all()}

    for family in families:
        family.product_count = counts.get(family.id, 0)
        family.category_name = family.category.name if family.category else None
        family.subcategory_name = family.subcategory.name if family.subcategory else None

    from backend.services.family_categories import attach_category_ids

    await attach_category_ids(db, families)

    return await public_json_response(request, families, list[ProductFamilyResponse])


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
    from sqlalchemy.orm import selectinload

    from backend.core.exceptions import ResourceNotFoundError
    from backend.models.chair import Chair, ProductFamily, chair_secondary_families

    stmt = (
        select(ProductFamily)
        .where(ProductFamily.id == family_id)
        .options(
            selectinload(ProductFamily.category),
            selectinload(ProductFamily.subcategory),
        )
    )
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
    family.category_name = family.category.name if family.category else None
    family.subcategory_name = family.subcategory.name if family.subcategory else None

    from backend.services.family_categories import attach_category_ids

    await attach_category_ids(db, [family])
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
    from sqlalchemy.orm import selectinload

    from backend.core.exceptions import ResourceNotFoundError
    from backend.models.chair import Chair, ProductFamily, chair_secondary_families

    stmt = (
        select(ProductFamily)
        .where(ProductFamily.slug == slug)
        .options(
            selectinload(ProductFamily.category),
            selectinload(ProductFamily.subcategory),
        )
    )
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
    family.category_name = family.category.name if family.category else None
    family.subcategory_name = family.subcategory.name if family.subcategory else None

    from backend.services.family_categories import attach_category_ids

    await attach_category_ids(db, [family])
    return family


@router.get(
    "/families/{family_id}/members",
    summary="Get family members",
    description="Get unified list of products and variations belonging to a family"
)
async def get_family_members(
    request: Request,
    family_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all members of a product family — both product-level and variation-level.

    **Public endpoint** - No authentication required.

    Returns a unified list sorted by display_order then name. Each item has:
    - `type`: "product" or "variation"
    - `id`: the product or variation id
    - `product_id`: parent product id
    - `product_slug`: parent product slug
    - `name`: variation.name if set, else product.name
    - `sku`: variation sku or product model_number
    - `primary_image_url`: variation image with fallback to product image
    - `variation_id`: null for products, variation id for variations
    - `short_description`, `base_price`, `category` (name): for ProductCard display
    - `hover_images`: product images; for variations, parsed from variation.images when present
    - `lead_time_days`: product or variation override
    """
    cached = await get_cached_public_response(request)
    if cached is not None:
        return cached

    logger.info(f"Fetching family members for family {family_id}")

    from sqlalchemy import or_, select
    from sqlalchemy.orm import selectinload

    from backend.models.chair import (
        Chair,
        ProductFamily,
        ProductVariation,
        chair_secondary_families,
        variation_families,
    )

    # Verify family exists
    family_result = await db.execute(select(ProductFamily).where(ProductFamily.id == family_id))
    family = family_result.scalar_one_or_none()
    if not family:
        from backend.core.exceptions import ResourceNotFoundError
        raise ResourceNotFoundError(resource_type="ProductFamily", resource_id=family_id)

    # 1. Fetch product-level members (primary + secondary family)
    subq = select(chair_secondary_families.c.chair_id).where(
        chair_secondary_families.c.family_id == family_id
    )
    products_stmt = (
        select(Chair)
        .where(
            Chair.is_active == True,
            or_(Chair.family_id == family_id, Chair.id.in_(subq)),
        )
        .options(selectinload(Chair.category))
    )
    products_result = await db.execute(products_stmt)
    product_members = products_result.scalars().all()

    # 2. Fetch variation-level members
    variations_stmt = (
        select(ProductVariation)
        .join(variation_families, variation_families.c.variation_id == ProductVariation.id)
        .join(Chair, Chair.id == ProductVariation.product_id)
        .where(
            variation_families.c.family_id == family_id,
            ProductVariation.is_available == True,
            Chair.is_active == True,
        )
        .options(selectinload(ProductVariation.product).selectinload(Chair.category))
    )
    variations_result = await db.execute(variations_stmt)
    variation_members = variations_result.scalars().all()

    # Build unified list
    # Products that appear as variation members: show only the variation(s), not the base product
    product_ids_via_variations = {v.product_id for v in variation_members}

    items = []

    for p in product_members:
        if p.id in product_ids_via_variations:
            continue
        items.append({
            "type": "product",
            "id": p.id,
            "product_id": p.id,
            "product_slug": p.slug,
            "name": p.name,
            "sku": p.model_number or "",
            "primary_image_url": p.primary_image_url,
            "variation_id": None,
            "display_order": p.display_order,
            "short_description": p.short_description,
            "base_price": p.base_price,
            "category": p.category.name if p.category else None,
            "hover_images": p.hover_images,
            "lead_time_days": p.lead_time_days,
        })

    def _variation_images(v):
        if not v.images:
            return None
        if isinstance(v.images, list):
            urls = []
            for img in v.images:
                if isinstance(img, str):
                    urls.append(img)
                elif isinstance(img, dict) and img.get("url"):
                    urls.append(img["url"])
            return urls if urls else None
        return None

    for v in variation_members:
        p = v.product
        base_price = (p.base_price or 0) + (v.price_adjustment or 0)
        primary_image = v.primary_image_url or p.primary_image_url
        var_images = _variation_images(v)
        hover_images = var_images if var_images else ([primary_image] if primary_image else None)
        items.append({
            "type": "variation",
            "id": v.id,
            "product_id": p.id,
            "product_slug": p.slug,
            "name": v.name if v.name else p.name,
            "sku": v.sku,
            "primary_image_url": primary_image,
            "variation_id": v.id,
            "variation_has_own_image": bool(v.primary_image_url or var_images),
            "display_order": v.display_order,
            "short_description": p.short_description,
            "base_price": base_price,
            "category": p.category.name if p.category else None,
            "hover_images": hover_images,
            "lead_time_days": v.lead_time_days if v.lead_time_days is not None else p.lead_time_days,
        })

    # Sort by display_order then name
    items.sort(key=lambda x: (x["display_order"] or 0, x["name"] or ""))

    # Strip internal sort key; add progressive image renditions (schemas/media.py)
    for item in items:
        del item["display_order"]
        item["primary_image_renditions"] = rendition_urls(item["primary_image_url"])
        item["hover_images_renditions"] = [
            rendition_urls(img.get("url") if isinstance(img, dict) else img)
            for img in item["hover_images"] or []
        ]

    return await public_json_response(request, items, Any)


@router.get(
    "/subcategories",
    response_model=list[CategoryChildResponse],
    summary="Get product subcategories",
    description="Retrieve the children of a category (subcategories and nested categories) with product counts"
)
async def get_subcategories(
    category_id: Optional[int] = Query(None, description="Filter by category ID"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get the children of a category.

    **Public endpoint** - No authentication required.

    Returns both product subcategories (`type: "subcategory"`) and nested
    categories (`type: "category"`) with product counts for catalog browsing.
    """
    logger.info(f"Fetching subcategories (category_id={category_id})")

    children = await ProductService.get_category_children(
        db=db,
        category_id=category_id,
        include_inactive=False,
        with_counts=True,
    )

    if category_id is not None:
        return children.get(category_id, [])

    return [child for items in children.values() for child in items]


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
        if hasattr(variation, 'families') and variation.families:
            var_dict["families"] = [{"id": f.id, "name": f.name, "slug": f.slug} for f in variation.families]
        else:
            var_dict["families"] = []
        var_dict["primary_image_renditions"] = rendition_urls(var_dict.get("primary_image_url"))
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
    limit: int = Query(100, ge=1, le=100, description="Max number of related products"),
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

