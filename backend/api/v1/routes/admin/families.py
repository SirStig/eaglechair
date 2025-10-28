"""
Admin Product Families Routes

CRUD operations for product families
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.base import get_db
from backend.models.chair import ProductFamily

router = APIRouter()


@router.get("")
async def get_families(
    category_id: Optional[int] = Query(None, description="Filter by category ID"),
    subcategory_id: Optional[int] = Query(None, description="Filter by subcategory ID"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all product families, optionally filtered by category or subcategory
    """
    query = select(ProductFamily).where(ProductFamily.is_active)
    
    if category_id is not None:
        query = query.where(ProductFamily.category_id == category_id)
    
    if subcategory_id is not None:
        query = query.where(ProductFamily.subcategory_id == subcategory_id)
    
    query = query.order_by(ProductFamily.display_order, ProductFamily.name)
    
    result = await db.execute(query)
    families = result.scalars().all()
    
    return {
        "items": [
            {
                "id": fam.id,
                "name": fam.name,
                "slug": fam.slug,
                "category_id": fam.category_id,
                "subcategory_id": fam.subcategory_id,
                "description": fam.description,
                "is_featured": fam.is_featured,
                "display_order": fam.display_order,
            }
            for fam in families
        ]
    }


@router.get("/{family_id}")
async def get_family(
    family_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Get a specific product family by ID
    """
    result = await db.execute(
        select(ProductFamily).where(ProductFamily.id == family_id)
    )
    family = result.scalar_one_or_none()
    
    if not family:
        raise HTTPException(status_code=404, detail="Product family not found")
    
    return {
        "id": family.id,
        "name": family.name,
        "slug": family.slug,
        "category_id": family.category_id,
        "subcategory_id": family.subcategory_id,
        "description": family.description,
        "family_image": family.family_image,
        "banner_image_url": family.banner_image_url,
        "overview_text": family.overview_text,
        "is_featured": family.is_featured,
        "is_active": family.is_active,
        "display_order": family.display_order,
    }
