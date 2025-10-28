"""
Admin Upholstery Routes

Admin-only endpoints for upholstery management
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import get_current_admin
from backend.database.base import get_db
from backend.models.chair import Upholstery
from backend.models.company import AdminUser
from backend.utils.serializers import orm_list_to_dict_list, orm_to_dict

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin - Upholsteries"])


@router.get(
    "",
    summary="Get all upholsteries (Admin)",
    description="Retrieve all upholstery materials with pagination"
)
async def get_all_upholsteries(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    material_type: Optional[str] = Query(None, description="Filter by material type"),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all upholsteries with admin filtering options.
    
    **Admin only** - Requires admin authentication.
    """
    logger.info(f"Admin {admin.username} fetching upholsteries (page {page})")
    
    # Build query
    stmt = select(Upholstery).order_by(Upholstery.name)
    
    if material_type:
        stmt = stmt.where(Upholstery.material_type == material_type)
    
    # Get total count
    count_stmt = select(Upholstery)
    if material_type:
        count_stmt = count_stmt.where(Upholstery.material_type == material_type)
    
    result = await db.execute(count_stmt)
    total_count = len(result.scalars().all())
    
    # Apply pagination
    offset = (page - 1) * page_size
    stmt = stmt.offset(offset).limit(page_size)
    
    result = await db.execute(stmt)
    upholsteries = result.scalars().all()
    
    # Convert ORM objects to dicts
    upholsteries_data = orm_list_to_dict_list(upholsteries)
    
    response_data = {
        "items": upholsteries_data,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "pages": (total_count + page_size - 1) // page_size
    }
    
    return response_data


@router.get(
    "/{upholstery_id}",
    summary="Get upholstery by ID (Admin)",
    description="Retrieve a specific upholstery"
)
async def get_upholstery(
    upholstery_id: int,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Get upholstery by ID.
    
    **Admin only** - Requires admin authentication.
    """
    logger.info(f"Admin {admin.username} fetching upholstery {upholstery_id}")
    
    stmt = select(Upholstery).where(Upholstery.id == upholstery_id)
    result = await db.execute(stmt)
    upholstery = result.scalar_one_or_none()
    
    if not upholstery:
        raise HTTPException(status_code=404, detail=f"Upholstery {upholstery_id} not found")
    
    return orm_to_dict(upholstery)


@router.post(
    "",
    summary="Create upholstery (Admin)",
    description="Create a new upholstery material"
)
async def create_upholstery(
    name: str,
    material_type: str,
    material_code: Optional[str] = None,
    description: Optional[str] = None,
    grade: Optional[str] = None,
    color: Optional[str] = None,
    color_hex: Optional[str] = None,
    pattern: Optional[str] = None,
    durability_rating: Optional[str] = None,
    is_com: bool = False,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new upholstery material.
    
    **Admin only** - Requires admin authentication.
    """
    logger.info(f"Admin {admin.username} creating upholstery: {name}")
    
    upholstery = Upholstery(
        name=name,
        material_type=material_type,
        material_code=material_code,
        description=description,
        grade=grade,
        color=color,
        color_hex=color_hex,
        pattern=pattern,
        durability_rating=durability_rating,
        is_com=is_com
    )
    
    db.add(upholstery)
    await db.commit()
    await db.refresh(upholstery)
    
    logger.info(f"Created upholstery: {upholstery.name} (ID: {upholstery.id})")
    
    return {
        "message": "Upholstery created successfully",
        "upholstery": orm_to_dict(upholstery)
    }


@router.put(
    "/{upholstery_id}",
    summary="Update upholstery (Admin)",
    description="Update an existing upholstery material"
)
async def update_upholstery(
    upholstery_id: int,
    name: Optional[str] = None,
    material_type: Optional[str] = None,
    material_code: Optional[str] = None,
    description: Optional[str] = None,
    grade: Optional[str] = None,
    color: Optional[str] = None,
    color_hex: Optional[str] = None,
    pattern: Optional[str] = None,
    durability_rating: Optional[str] = None,
    is_com: Optional[bool] = None,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Update an existing upholstery material.
    
    **Admin only** - Requires admin authentication.
    """
    logger.info(f"Admin {admin.username} updating upholstery {upholstery_id}")
    
    stmt = select(Upholstery).where(Upholstery.id == upholstery_id)
    result = await db.execute(stmt)
    upholstery = result.scalar_one_or_none()
    
    if not upholstery:
        raise HTTPException(status_code=404, detail=f"Upholstery {upholstery_id} not found")
    
    # Update fields if provided
    if name is not None:
        upholstery.name = name
    if material_type is not None:
        upholstery.material_type = material_type
    if material_code is not None:
        upholstery.material_code = material_code
    if description is not None:
        upholstery.description = description
    if grade is not None:
        upholstery.grade = grade
    if color is not None:
        upholstery.color = color
    if color_hex is not None:
        upholstery.color_hex = color_hex
    if pattern is not None:
        upholstery.pattern = pattern
    if durability_rating is not None:
        upholstery.durability_rating = durability_rating
    if is_com is not None:
        upholstery.is_com = is_com
    
    await db.commit()
    await db.refresh(upholstery)
    
    logger.info(f"Updated upholstery: {upholstery.name} (ID: {upholstery.id})")
    
    return {
        "message": "Upholstery updated successfully",
        "upholstery": orm_to_dict(upholstery)
    }


@router.delete(
    "/{upholstery_id}",
    summary="Delete upholstery (Admin)",
    description="Delete an upholstery material"
)
async def delete_upholstery(
    upholstery_id: int,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete an upholstery material.
    
    **Admin only** - Requires admin authentication.
    """
    logger.info(f"Admin {admin.username} deleting upholstery {upholstery_id}")
    
    stmt = select(Upholstery).where(Upholstery.id == upholstery_id)
    result = await db.execute(stmt)
    upholstery = result.scalar_one_or_none()
    
    if not upholstery:
        raise HTTPException(status_code=404, detail=f"Upholstery {upholstery_id} not found")
    
    await db.delete(upholstery)
    await db.commit()
    
    logger.info(f"Deleted upholstery: {upholstery.name} (ID: {upholstery_id})")
    
    return {
        "message": "Upholstery deleted successfully"
    }
