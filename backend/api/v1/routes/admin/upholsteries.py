"""
Admin Upholstery Routes

Admin-only endpoints for upholstery management
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import get_current_admin
from backend.api.v1.schemas.admin import UpholsteryCreate, UpholsteryUpdate
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
    status_code=status.HTTP_201_CREATED,
    summary="Create upholstery (Admin)",
    description="Create a new upholstery material"
)
async def create_upholstery(
    upholstery_data: UpholsteryCreate,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new upholstery material.
    
    **Admin only** - Requires admin authentication.
    """
    logger.info(f"Admin {admin.username} creating upholstery: {upholstery_data.name}")
    
    upholstery = Upholstery(**upholstery_data.dict())
    
    db.add(upholstery)
    await db.commit()
    await db.refresh(upholstery)
    
    logger.info(f"Created upholstery: {upholstery.name} (ID: {upholstery.id})")
    
    return orm_to_dict(upholstery)


@router.put(
    "/{upholstery_id}",
    summary="Update upholstery (Admin)",
    description="Update an existing upholstery material"
)
async def update_upholstery(
    upholstery_id: int,
    upholstery_data: UpholsteryUpdate,
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
    
    # Update only provided fields
    update_data = upholstery_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(upholstery, field, value)
    
    await db.commit()
    await db.refresh(upholstery)
    
    logger.info(f"Updated upholstery: {upholstery.name} (ID: {upholstery.id})")
    
    return orm_to_dict(upholstery)


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
