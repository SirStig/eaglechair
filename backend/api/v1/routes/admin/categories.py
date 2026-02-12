"""
Admin Category Management Routes

Admin-only endpoints for managing categories and subcategories
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import get_current_admin, require_role
from backend.api.v1.schemas.common import MessageResponse
from backend.api.v1.schemas.product import (
    CategoryCreate,
    CategoryUpdate,
    CategoryWithSubcategories,
)
from backend.database.base import get_db
from backend.models.chair import Category, ProductSubcategory
from backend.models.company import AdminRole, AdminUser
from backend.utils.slug import slugify
from backend.utils.static_content_exporter import export_content_after_update

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin - Categories"])


# ============================================================================
# Category Management
# ============================================================================

@router.get(
    "",
    summary="List all categories (Admin)",
    description="Get all categories with subcategories",
    response_model=List[CategoryWithSubcategories]
)
async def get_categories_admin(
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get all categories. Admin only."""
    logger.info(f"Admin {admin.username} fetching categories")
    
    query = select(Category).where(Category.parent_id.is_(None))
    
    if is_active is not None:
        query = query.where(Category.is_active == is_active)
    
    query = query.order_by(Category.display_order, Category.name)
    
    result = await db.execute(query)
    categories = result.scalars().all()
    
    # Build response with subcategories
    response_data = []
    for category in categories:
        # Load subcategories from ProductSubcategory table (not Category.parent_id)
        subcat_query = (
            select(ProductSubcategory)
            .where(ProductSubcategory.category_id == category.id)
            .order_by(ProductSubcategory.display_order, ProductSubcategory.name)
        )
        subcat_result = await db.execute(subcat_query)
        subcategories = subcat_result.scalars().all()
        
        # Build dict manually to avoid lazy loading issues
        cat_dict = {
            "id": category.id,
            "name": category.name,
            "slug": category.slug,
            "description": category.description,
            "parent_id": category.parent_id,
            "display_order": category.display_order,
            "is_active": category.is_active,
            "icon_url": category.icon_url,
            "banner_image_url": category.banner_image_url,
            "meta_title": category.meta_title,
            "meta_description": category.meta_description,
            "created_at": category.created_at,
            "updated_at": category.updated_at,
            "subcategories": [
                {
                    "id": sub.id,
                    "name": sub.name,
                    "slug": sub.slug,
                    "description": sub.description,
                    "parent_id": None,  # ProductSubcategory uses category_id, not parent_id
                    "display_order": sub.display_order,
                    "is_active": sub.is_active,
                    "icon_url": None,  # ProductSubcategory doesn't have icon_url
                    "banner_image_url": None,  # ProductSubcategory doesn't have banner_image_url
                    "meta_title": None,  # ProductSubcategory doesn't have meta fields
                    "meta_description": None,
                    "created_at": sub.created_at if hasattr(sub, 'created_at') else None,
                    "updated_at": sub.updated_at if hasattr(sub, 'updated_at') else None,
                    "subcategories": []
                }
                for sub in subcategories
            ]
        }
        response_data.append(cat_dict)
    
    return response_data


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Create category (Admin)",
    description="Create a new product category",
    response_model=CategoryWithSubcategories
)
async def create_category(
    category_data: CategoryCreate,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Create a new category. Admin only."""
    logger.info(f"Admin {admin.username} creating category: {category_data.name}")
    
    # Generate slug if not provided
    slug = category_data.slug
    if not slug:
        slug = slugify(category_data.name)
    
    # Check if slug is unique
    existing = await db.execute(
        select(Category).where(Category.slug == slug)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail=f"Category with slug '{slug}' already exists"
        )
    
    # Validate parent_id if provided
    if category_data.parent_id:
        parent = await db.execute(
            select(Category).where(Category.id == category_data.parent_id)
        )
        if not parent.scalar_one_or_none():
            raise HTTPException(status_code=404, detail=f"Parent category {category_data.parent_id} not found")
    
    category = Category(
        name=category_data.name,
        slug=slug,
        description=category_data.description,
        parent_id=category_data.parent_id,
        icon_url=category_data.icon_url,
        banner_image_url=category_data.banner_image_url,
        meta_title=category_data.meta_title,
        meta_description=category_data.meta_description,
        display_order=category_data.display_order,
        is_active=category_data.is_active
    )
    
    db.add(category)
    await db.commit()
    await db.refresh(category)

    await export_content_after_update('categories', db)

    logger.info(f"Created category: {category.name} (ID: {category.id})")
    
    return {
        "id": category.id,
        "name": category.name,
        "slug": category.slug,
        "description": category.description,
        "parent_id": category.parent_id,
        "display_order": category.display_order,
        "is_active": category.is_active,
        "icon_url": category.icon_url,
        "banner_image_url": category.banner_image_url,
        "meta_title": category.meta_title,
        "meta_description": category.meta_description,
        "created_at": category.created_at,
        "updated_at": category.updated_at,
        "subcategories": []
    }


@router.put(
    "/{category_id}",
    summary="Update category (Admin)",
    description="Update an existing category",
    response_model=CategoryWithSubcategories
)
async def update_category(
    category_id: int,
    category_data: CategoryUpdate,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Update a category. Admin only."""
    logger.info(f"Admin {admin.username} updating category {category_id}")
    
    stmt = select(Category).where(Category.id == category_id)
    result = await db.execute(stmt)
    category = result.scalar_one_or_none()
    
    if not category:
        raise HTTPException(status_code=404, detail=f"Category {category_id} not found")
    
    # Update fields using Pydantic model (exclude_unset to only update provided fields)
    update_data = category_data.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        if field == 'slug' and value is not None:
            # Check uniqueness for slug
            existing = await db.execute(
                select(Category).where(
                    Category.slug == value,
                    Category.id != category_id
                )
            )
            if existing.scalar_one_or_none():
                raise HTTPException(
                    status_code=400,
                    detail=f"Category with slug '{value}' already exists"
                )
        
        if field == 'parent_id' and value is not None:
            # Validate parent exists and prevent circular reference
            if value == category_id:
                raise HTTPException(status_code=400, detail="Category cannot be its own parent")
            parent = await db.execute(select(Category).where(Category.id == value))
            if not parent.scalar_one_or_none():
                raise HTTPException(status_code=404, detail=f"Parent category {value} not found")
        
        setattr(category, field, value)
    
    await db.commit()
    await db.refresh(category)

    await export_content_after_update('categories', db)
    
    # Load subcategories from ProductSubcategory table (not Category.parent_id)
    subcat_query = (
        select(ProductSubcategory)
        .where(ProductSubcategory.category_id == category.id)
        .order_by(ProductSubcategory.display_order, ProductSubcategory.name)
    )
    subcat_result = await db.execute(subcat_query)
    subcategories = subcat_result.scalars().all()
    
    return {
        "id": category.id,
        "name": category.name,
        "slug": category.slug,
        "description": category.description,
        "parent_id": category.parent_id,
        "display_order": category.display_order,
        "is_active": category.is_active,
        "icon_url": category.icon_url,
        "banner_image_url": category.banner_image_url,
        "meta_title": category.meta_title,
        "meta_description": category.meta_description,
        "created_at": category.created_at,
        "updated_at": category.updated_at,
        "subcategories": [
            {
                "id": sub.id,
                "name": sub.name,
                "slug": sub.slug,
                "description": sub.description,
                "parent_id": None,  # ProductSubcategory uses category_id, not parent_id
                "display_order": sub.display_order,
                "is_active": sub.is_active,
                "icon_url": None,  # ProductSubcategory doesn't have these fields
                "banner_image_url": None,
                "meta_title": None,
                "meta_description": None,
                "created_at": sub.created_at if hasattr(sub, 'created_at') else None,
                "updated_at": sub.updated_at if hasattr(sub, 'updated_at') else None,
                "subcategories": []
            }
            for sub in subcategories
        ]
    }


@router.delete(
    "/{category_id}",
    response_model=MessageResponse,
    summary="Delete category (Admin)",
    description="Delete a category (soft delete by default)"
)
async def delete_category(
    category_id: int,
    hard_delete: bool = Query(False, description="Permanently delete (use with caution)"),
    admin: AdminUser = Depends(require_role(AdminRole.SUPER_ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Delete a category. Super admin only."""
    logger.info(f"Admin {admin.username} deleting category {category_id} (hard={hard_delete})")
    
    stmt = select(Category).where(Category.id == category_id)
    result = await db.execute(stmt)
    category = result.scalar_one_or_none()
    
    if not category:
        raise HTTPException(status_code=404, detail=f"Category {category_id} not found")
    
    # Check if category has products
    if not hard_delete:
        # Check for subcategories in ProductSubcategory table
        subcat_check = await db.execute(
            select(ProductSubcategory).where(ProductSubcategory.category_id == category_id)
        )
        if subcat_check.first():
            raise HTTPException(
                status_code=400,
                detail="Cannot delete category with subcategories. Delete subcategories first."
            )
    
    if hard_delete:
        await db.delete(category)
    else:
        category.is_active = False
    
    await db.commit()

    await export_content_after_update('categories', db)
    
    return MessageResponse(
        message=f"Category '{category.name}' {'deleted' if hard_delete else 'deactivated'} successfully"
    )


@router.post(
    "/{category_id}/reorder",
    summary="Reorder categories (Admin)",
    description="Update display order for categories"
)
async def reorder_categories(
    category_id: int,
    new_order: int,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Update category display order. Admin only."""
    logger.info(f"Admin {admin.username} reordering category {category_id} to position {new_order}")
    
    stmt = select(Category).where(Category.id == category_id)
    result = await db.execute(stmt)
    category = result.scalar_one_or_none()
    
    if not category:
        raise HTTPException(status_code=404, detail=f"Category {category_id} not found")
    
    category.display_order = new_order
    await db.commit()
    await db.refresh(category)

    category_dict = {
        "id": category.id,
        "name": category.name,
        "slug": category.slug,
        "description": category.description,
        "parent_id": category.parent_id,
        "display_order": category.display_order,
        "is_active": category.is_active,
        "icon_url": category.icon_url,
        "banner_image_url": category.banner_image_url,
        "meta_title": category.meta_title,
        "meta_description": category.meta_description,
    }

    return category_dict
