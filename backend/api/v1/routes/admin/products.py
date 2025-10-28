"""
Admin Product Routes

Admin-only endpoints for product management
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import get_current_admin, require_role
from backend.api.v1.schemas.admin import (
    ProductCreate,
    ProductListResponse,
    ProductUpdate,
)
from backend.api.v1.schemas.common import MessageResponse
from backend.api.v1.schemas.product import ChairResponse
from backend.core.exceptions import ResourceNotFoundError, ValidationError
from backend.database.base import get_db
from backend.models.chair import Chair as Product
from backend.models.chair import ProductImage, ProductVariation
from backend.models.company import AdminRole, AdminUser
from backend.services.admin_service import AdminService
from backend.utils.serializers import orm_list_to_dict_list, orm_to_dict

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin - Products"])


@router.get(
    "",
    summary="Get all products (Admin)",
    description="Retrieve all products with pagination and filtering"
)
async def get_all_products(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search term"),
    category_id: Optional[int] = Query(None, description="Filter by category"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all products with admin filtering options.
    
    **Admin only** - Requires admin authentication.
    """
    logger.info(f"Admin {admin.username} fetching products (page {page})")
    
    products, total_count = await AdminService.get_all_products(
        db=db,
        page=page,
        page_size=page_size,
        search=search,
        category_id=category_id,
        is_active=is_active
    )
    
    # Convert ORM objects to dicts
    products_data = orm_list_to_dict_list(products)
    
    response_data = {
        "items": products_data,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "pages": (total_count + page_size - 1) // page_size
    }
    
    return response_data


@router.post(
    "",
    summary="Create product (Admin)",
    description="Create a new product"
)
async def create_product(
    product_data: ProductCreate,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new product.
    
    **Admin only** - Requires admin role.
    """
    logger.info(f"Admin {admin.username} creating product: {product_data.name}")
    
    try:
        product = await AdminService.create_product(
            db=db,
            product_data=product_data.dict()
        )

        return orm_to_dict(product)
        
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/{product_id}",
    summary="Get product by ID (Admin)",
    description="Retrieve a specific product"
)
async def get_product(
    product_id: int,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Get product by ID.
    
    **Admin only** - Requires admin authentication.
    """
    logger.info(f"Admin {admin.username} fetching product {product_id}")
    
    try:
        # Use existing product service for single product retrieval
        from backend.services.product_service import ProductService
        product = await ProductService.get_product_by_id(db, product_id)
        return orm_to_dict(product)
        
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch(
    "/{product_id}",
    summary="Update product (Admin)",
    description="Update a product"
)
async def update_product(
    product_id: int,
    update_data: ProductUpdate,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a product.
    
    **Admin only** - Requires admin role.
    """
    logger.info(f"Admin {admin.username} updating product {product_id}")
    
    try:
        product = await AdminService.update_product(
            db=db,
            product_id=product_id,
            update_data=update_data.dict(exclude_unset=True)
        )
        return orm_to_dict(product)
        
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete(
    "/{product_id}",
    response_model=MessageResponse,
    summary="Delete product (Admin)",
    description="Delete a product (soft delete)"
)
async def delete_product(
    product_id: int,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a product (soft delete by setting is_active=False).
    
    **Admin only** - Requires admin role.
    """
    logger.info(f"Admin {admin.username} deleting product {product_id}")
    
    try:
        await AdminService.delete_product(db=db, product_id=product_id)
        
        return MessageResponse(
            message=f"Product {product_id} has been deleted successfully"
        )
        
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ============================================================================
# Product Variation Management (NEW)
# ============================================================================

@router.get(
    "/{product_id}/variations",
    summary="Get product variations (Admin)",
    description="Get all variations for a specific product"
)
async def get_product_variations(
    product_id: int,
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get all variations for a product. Admin only."""
    from sqlalchemy import select
    
    logger.info(f"Admin {admin.username} fetching variations for product {product_id}")
    
    query = select(ProductVariation).where(ProductVariation.product_id == product_id)
    
    if is_active is not None:
        query = query.where(ProductVariation.is_active == is_active)
    
    query = query.order_by(ProductVariation.display_order, ProductVariation.id)
    
    result = await db.execute(query)
    variations = result.scalars().all()
    
    return orm_list_to_dict_list(variations)


@router.post(
    "/{product_id}/variations",
    summary="Create product variation (Admin)",
    description="Add a new variation to a product"
)
async def create_product_variation(
    product_id: int,
    model_suffix: str,
    color_id: Optional[int] = None,
    finish_id: Optional[int] = None,
    upholstery_id: Optional[int] = None,
    price_adjustment: float = 0.0,
    display_order: int = 0,
    is_active: bool = True,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new product variation.
    
    **Admin only** - Requires admin role.
    """
    from sqlalchemy import select

    # Product model already imported as `Product`
    
    logger.info(f"Admin {admin.username} creating variation for product {product_id}")
    
    # Verify product exists
    stmt = select(Product).where(Product.id == product_id)
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=404, detail=f"Product {product_id} not found")
    
    # Create variation
    variation = ProductVariation(
        product_id=product_id,
        model_suffix=model_suffix,
        color_id=color_id,
        finish_id=finish_id,
        upholstery_id=upholstery_id,
        price_adjustment=price_adjustment,
        display_order=display_order,
        is_active=is_active
    )
    
    db.add(variation)
    await db.commit()
    await db.refresh(variation)
    
    logger.info(f"Created variation {variation.id} ({model_suffix}) for product {product.name}")
    
    return orm_to_dict(variation)


@router.put(
    "/{product_id}/variations/{variation_id}",
    summary="Update product variation (Admin)",
    description="Update an existing product variation"
)
async def update_product_variation(
    product_id: int,
    variation_id: int,
    model_suffix: Optional[str] = None,
    color_id: Optional[int] = None,
    finish_id: Optional[int] = None,
    upholstery_id: Optional[int] = None,
    price_adjustment: Optional[float] = None,
    display_order: Optional[int] = None,
    is_active: Optional[bool] = None,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a product variation.
    
    **Admin only** - Requires admin role.
    """
    from sqlalchemy import select
    
    logger.info(f"Admin {admin.username} updating variation {variation_id} for product {product_id}")
    
    stmt = select(ProductVariation).where(
        ProductVariation.id == variation_id,
        ProductVariation.product_id == product_id
    )
    result = await db.execute(stmt)
    variation = result.scalar_one_or_none()
    
    if not variation:
        raise HTTPException(
            status_code=404,
            detail=f"Variation {variation_id} not found for product {product_id}"
        )
    
    # Update fields
    if model_suffix is not None:
        variation.model_suffix = model_suffix
    if color_id is not None:
        variation.color_id = color_id
    if finish_id is not None:
        variation.finish_id = finish_id
    if upholstery_id is not None:
        variation.upholstery_id = upholstery_id
    if price_adjustment is not None:
        variation.price_adjustment = price_adjustment
    if display_order is not None:
        variation.display_order = display_order
    if is_active is not None:
        variation.is_active = is_active
    
    await db.commit()
    await db.refresh(variation)
    
    return orm_to_dict(variation)


@router.delete(
    "/{product_id}/variations/{variation_id}",
    response_model=MessageResponse,
    summary="Delete product variation (Admin)",
    description="Delete a product variation (soft delete)"
)
async def delete_product_variation(
    product_id: int,
    variation_id: int,
    hard_delete: bool = Query(False, description="Permanently delete (super admin only)"),
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a product variation.
    
    **Admin only** - Soft delete by default, hard delete requires super admin.
    """
    from sqlalchemy import select
    
    if hard_delete and admin.role != AdminRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Hard delete requires SUPER_ADMIN role"
        )
    
    logger.info(
        f"Admin {admin.username} {'hard' if hard_delete else 'soft'} deleting "
        f"variation {variation_id} for product {product_id}"
    )
    
    stmt = select(ProductVariation).where(
        ProductVariation.id == variation_id,
        ProductVariation.product_id == product_id
    )
    result = await db.execute(stmt)
    variation = result.scalar_one_or_none()
    
    if not variation:
        raise HTTPException(
            status_code=404,
            detail=f"Variation {variation_id} not found for product {product_id}"
        )
    
    if hard_delete:
        await db.delete(variation)
    else:
        variation.is_active = False
    
    await db.commit()
    
    return MessageResponse(
        message=f"Variation {variation_id} has been {'permanently deleted' if hard_delete else 'deactivated'}"
    )


# ============================================================================
# Product Image Management (NEW)
# ============================================================================

@router.get(
    "/{product_id}/images",
    summary="Get product images (Admin)",
    description="Get all images for a specific product"
)
async def get_product_images_admin(
    product_id: int,
    image_type: Optional[str] = Query(None, description="Filter by image type (primary, gallery, hover, etc.)"),
    variation_id: Optional[int] = Query(None, description="Filter by variation ID"),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get all images for a product. Admin only."""
    from sqlalchemy import select
    
    logger.info(f"Admin {admin.username} fetching images for product {product_id}")
    
    query = select(ProductImage).where(ProductImage.product_id == product_id)
    
    if image_type:
        query = query.where(ProductImage.image_type == image_type)
    
    if variation_id is not None:
        query = query.where(ProductImage.variation_id == variation_id)
    
    query = query.order_by(ProductImage.display_order, ProductImage.id)
    
    result = await db.execute(query)
    images = result.scalars().all()
    
    return orm_list_to_dict_list(images)


@router.post(
    "/{product_id}/images",
    summary="Add product image (Admin)",
    description="Upload a new image for a product"
)
async def add_product_image(
    product_id: int,
    image_url: str,
    image_type: str = "gallery",
    variation_id: Optional[int] = None,
    display_order: int = 0,
    alt_text: Optional[str] = None,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """
    Add a new image to a product.
    
    **Admin only** - Requires admin role.
    
    **Image Types**:
    - primary: Main product image
    - hover: Image shown on hover
    - gallery: Additional gallery images
    - side: Side view
    - front: Front view
    - back: Back view
    - detail: Detail/close-up images
    """
    from sqlalchemy import select

    # Product model already imported as `Product`
    
    logger.info(f"Admin {admin.username} adding image to product {product_id}")
    
    # Verify product exists
    stmt = select(Product).where(Product.id == product_id)
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=404, detail=f"Product {product_id} not found")
    
    # If variation_id provided, verify it exists and belongs to this product
    if variation_id:
        var_stmt = select(ProductVariation).where(
            ProductVariation.id == variation_id,
            ProductVariation.product_id == product_id
        )
        var_result = await db.execute(var_stmt)
        variation = var_result.scalar_one_or_none()
        
        if not variation:
            raise HTTPException(
                status_code=404,
                detail=f"Variation {variation_id} not found for product {product_id}"
            )
    
    # Create image
    image = ProductImage(
        product_id=product_id,
        image_url=image_url,
        image_type=image_type,
        variation_id=variation_id,
        display_order=display_order,
        alt_text=alt_text or f"{product.name} - {image_type}"
    )
    
    db.add(image)
    await db.commit()
    await db.refresh(image)
    
    logger.info(f"Added {image_type} image {image.id} to product {product.name}")
    
    return orm_to_dict(image)


@router.put(
    "/{product_id}/images/{image_id}",
    summary="Update product image (Admin)",
    description="Update an existing product image"
)
async def update_product_image(
    product_id: int,
    image_id: int,
    image_url: Optional[str] = None,
    image_type: Optional[str] = None,
    variation_id: Optional[int] = None,
    display_order: Optional[int] = None,
    alt_text: Optional[str] = None,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a product image.
    
    **Admin only** - Requires admin role.
    """
    from sqlalchemy import select
    
    logger.info(f"Admin {admin.username} updating image {image_id} for product {product_id}")
    
    stmt = select(ProductImage).where(
        ProductImage.id == image_id,
        ProductImage.product_id == product_id
    )
    result = await db.execute(stmt)
    image = result.scalar_one_or_none()
    
    if not image:
        raise HTTPException(
            status_code=404,
            detail=f"Image {image_id} not found for product {product_id}"
        )
    
    # Update fields
    if image_url is not None:
        image.image_url = image_url
    if image_type is not None:
        image.image_type = image_type
    if variation_id is not None:
        image.variation_id = variation_id
    if display_order is not None:
        image.display_order = display_order
    if alt_text is not None:
        image.alt_text = alt_text
    
    await db.commit()
    await db.refresh(image)
    
    return orm_to_dict(image)


@router.delete(
    "/{product_id}/images/{image_id}",
    response_model=MessageResponse,
    summary="Delete product image (Admin)",
    description="Delete a product image"
)
async def delete_product_image(
    product_id: int,
    image_id: int,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a product image.
    
    **Admin only** - Requires admin role.
    """
    from sqlalchemy import select
    
    logger.info(f"Admin {admin.username} deleting image {image_id} for product {product_id}")
    
    stmt = select(ProductImage).where(
        ProductImage.id == image_id,
        ProductImage.product_id == product_id
    )
    result = await db.execute(stmt)
    image = result.scalar_one_or_none()
    
    if not image:
        raise HTTPException(
            status_code=404,
            detail=f"Image {image_id} not found for product {product_id}"
        )
    
    await db.delete(image)
    await db.commit()
    
    return MessageResponse(
        message=f"Image {image_id} has been deleted successfully"
    )

