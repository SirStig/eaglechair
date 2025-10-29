"""
Admin Finishes Routes

CRUD operations for product finishes
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import require_role
from backend.api.v1.schemas.admin import FinishCreate, FinishUpdate
from backend.database.base import get_db
from backend.models.chair import Finish
from backend.models.company import AdminRole, AdminUser
from backend.utils.serializers import orm_to_dict

router = APIRouter()


@router.get("")
async def get_finishes(
    db: AsyncSession = Depends(get_db),
):
    """
    Get all active finishes
    """
    query = (
        select(Finish)
        .where(Finish.is_active)
        .order_by(Finish.display_order, Finish.name)
    )
    
    result = await db.execute(query)
    finishes = result.scalars().all()
    
    return {
        "items": [
            {
                "id": finish.id,
                "name": finish.name,
                "finish_code": finish.finish_code,
                "finish_type": finish.finish_type,
                "color_hex": finish.color_hex,
                "image_url": finish.image_url,
                "additional_cost": finish.additional_cost,
                "is_custom": finish.is_custom,
                "is_to_match": finish.is_to_match,
            }
            for finish in finishes
        ]
    }


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Create finish (Admin)",
    description="Create a new finish option"
)
async def create_finish(
    finish_data: FinishCreate,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Create a new finish. Admin only."""
    finish = Finish(**finish_data.dict())

    db.add(finish)
    await db.commit()
    await db.refresh(finish)

    return orm_to_dict(finish)


@router.put(
    "/{finish_id}",
    summary="Update finish (Admin)",
    description="Update an existing finish"
)
async def update_finish(
    finish_id: int,
    finish_data: FinishUpdate,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Finish).where(Finish.id == finish_id)
    result = await db.execute(stmt)
    finish = result.scalar_one_or_none()

    if not finish:
        raise HTTPException(status_code=404, detail=f"Finish {finish_id} not found")

    # Update only provided fields
    update_data = finish_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(finish, field, value)

    await db.commit()
    await db.refresh(finish)

    return orm_to_dict(finish)


@router.delete(
    "{finish_id}",
    response_model=None,
    summary="Delete finish (Admin)",
    description="Delete a finish (soft delete by marking inactive)",
)
async def delete_finish(
    finish_id: int,
    hard_delete: bool = Query(False, description="Permanently delete (use with caution)"),
    admin: AdminUser = Depends(require_role(AdminRole.SUPER_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Finish).where(Finish.id == finish_id)
    result = await db.execute(stmt)
    finish = result.scalar_one_or_none()

    if not finish:
        raise HTTPException(status_code=404, detail=f"Finish {finish_id} not found")

    if hard_delete:
        await db.delete(finish)
    else:
        finish.is_active = False

    await db.commit()

    return {"message": f"Finish '{finish.name}' {'deleted' if hard_delete else 'deactivated'} successfully"}
