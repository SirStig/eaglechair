"""
Admin Product Routes

Admin-only endpoints for product management
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.base import get_db
from backend.api.dependencies import get_current_admin, require_role
from backend.services.admin_service import AdminService
from backend.models.company import AdminRole, AdminUser
from backend.api.v1.schemas.product import ChairResponse
from backend.api.v1.schemas.admin import (
    ProductCreate,
    ProductUpdate,
    ProductListResponse
)
from backend.api.v1.schemas.common import MessageResponse
from backend.core.exceptions import ResourceNotFoundError, ValidationError


logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin - Products"])


@router.get(
    "/products",
    response_model=ProductListResponse,
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
    
    return ProductListResponse(
        items=products,
        total=total_count,
        page=page,
        page_size=page_size,
        pages=(total_count + page_size - 1) // page_size
    )


@router.post(
    "/products",
    response_model=ChairResponse,
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
        
        return product
        
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/products/{product_id}",
    response_model=ChairResponse,
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
        return product
        
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch(
    "/products/{product_id}",
    response_model=ChairResponse,
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
        
        return product
        
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete(
    "/products/{product_id}",
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
