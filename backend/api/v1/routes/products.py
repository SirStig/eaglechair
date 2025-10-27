"""
Product Routes - API v1

Public routes for browsing product catalog (chairs, categories, finishes, upholstery)
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.v1.schemas.common import MessageResponse
from backend.api.v1.schemas.product import (
    CategoryResponse,
    ChairDetailResponse,
    ChairResponse,
    FinishResponse,
    UpholsteryResponse,
)
from backend.database.base import get_db
from backend.services.pricing_service import PricingService
from backend.services.product_service import ProductService
from backend.utils.pagination import PaginatedResponse, PaginationParams

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Products"])


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
    description="Retrieve paginated list of products with optional filters"
)
async def get_products(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    category_id: Optional[int] = Query(None, description="Filter by category ID"),
    search: Optional[str] = Query(None, description="Search in name, model, description"),
    featured: Optional[bool] = Query(None, description="Filter featured products"),
    new: Optional[bool] = Query(None, description="Filter new products"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get paginated list of products.
    
    **Public endpoint** - No authentication required.
    
    Supports filtering by:
    - Category
    - Search query (name, model number, description)
    - Featured products
    - New products
    """
    logger.info(
        f"Fetching products (page={page}, per_page={per_page}, "
        f"category_id={category_id}, search='{search}')"
    )
    
    pagination = PaginationParams(page=page, per_page=per_page)
    
    result = await ProductService.get_products(
        db=db,
        pagination=pagination,
        category_id=category_id,
        search_query=search,
        is_featured=featured,
        is_new=new,
        include_inactive=False
    )
    
    return result


@router.get(
    "/products/{product_id}",
    response_model=ChairDetailResponse,
    summary="Get product by ID",
    description="Retrieve detailed information about a specific product"
)
async def get_product(
    product_id: int,
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
    
    return product


@router.get(
    "/products/slug/{slug}",
    response_model=ChairDetailResponse,
    summary="Get product by slug",
    description="Retrieve detailed information about a specific product by slug"
)
async def get_product_by_slug(
    slug: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get detailed product information by slug.
    
    **Public endpoint** - No authentication required.
    """
    logger.info(f"Fetching product with slug '{slug}'")
    
    product = await ProductService.get_product_by_slug(
        db=db,
        slug=slug
    )
    
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
    """
    logger.info(f"Fetching product with model number '{model_number}'")
    
    product = await ProductService.get_product_by_model_number(
        db=db,
        model_number=model_number
    )
    
    return product


@router.get(
    "/products/search",
    response_model=list[ChairResponse],
    summary="Fuzzy search products",
    description="Fuzzy search for products (autocomplete/typeahead)"
)
async def search_products(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(10, ge=1, le=50, description="Maximum results"),
    db: AsyncSession = Depends(get_db)
):
    """
    Fuzzy search for products.
    
    **Public endpoint** - No authentication required.
    
    Useful for autocomplete/typeahead functionality.
    """
    logger.info(f"Searching products with query '{q}'")
    
    products = await ProductService.search_products_fuzzy(
        db=db,
        search_query=q,
        limit=limit
    )
    
    return products


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
# Product Families & Subcategories (NEW)
# ============================================================================

@router.get(
    "/families",
    summary="Get product families",
    description="Retrieve product families with optional filters"
)
async def get_families(
    category_id: Optional[int] = Query(None, description="Filter by category ID"),
    featured_only: bool = Query(False, description="Only show featured families"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get product families.
    
    **Public endpoint** - No authentication required.
    """
    logger.info(f"Fetching families (category_id={category_id}, featured_only={featured_only})")
    
    families = await ProductService.get_families(
        db=db,
        category_id=category_id,
        featured_only=featured_only,
        include_inactive=False
    )
    
    return families


@router.get(
    "/subcategories",
    summary="Get product subcategories",
    description="Retrieve product subcategories with optional filters"
)
async def get_subcategories(
    category_id: Optional[int] = Query(None, description="Filter by category ID"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get product subcategories.
    
    **Public endpoint** - No authentication required.
    """
    logger.info(f"Fetching subcategories (category_id={category_id})")
    
    subcategories = await ProductService.get_subcategories(
        db=db,
        category_id=category_id,
        include_inactive=False
    )
    
    return subcategories


# ============================================================================
# Product Variations & Options (NEW)
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
    
    return {
        "product_id": product_id,
        "variations": result["variations"]
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

