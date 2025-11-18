"""
Admin Subcategories Routes

CRUD operations for product subcategories
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.base import get_db
from backend.models.chair import ProductSubcategory

router = APIRouter()


@router.get("")
async def get_subcategories(
    category_id: Optional[int] = Query(None, description="Filter by category ID"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all subcategories, optionally filtered by category
    """
    query = select(ProductSubcategory).where(ProductSubcategory.is_active == True)
    
    if category_id is not None:
        query = query.where(ProductSubcategory.category_id == category_id)
    
    query = query.order_by(ProductSubcategory.display_order, ProductSubcategory.name)
    
    result = await db.execute(query)
    subcategories = result.scalars().all()
    
    return {
        "items": [
            {
                "id": sc.id,
                "name": sc.name,
                "slug": sc.slug,
                "category_id": sc.category_id,
                "description": sc.description,
                "display_order": sc.display_order,
            }
            for sc in subcategories
        ]
    }


@router.get("/{subcategory_id}")
async def get_subcategory(
    subcategory_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Get a specific subcategory by ID
    """
    result = await db.execute(
        select(ProductSubcategory).where(ProductSubcategory.id == subcategory_id)
    )
    subcategory = result.scalar_one_or_none()
    
    if not subcategory:
        raise HTTPException(status_code=404, detail="Subcategory not found")
    
    return {
        "id": subcategory.id,
        "name": subcategory.name,
        "slug": subcategory.slug,
        "category_id": subcategory.category_id,
        "description": subcategory.description,
        "display_order": subcategory.display_order,
        "is_active": subcategory.is_active,
    }
