"""
Admin Finishes Routes

CRUD operations for product finishes
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.base import get_db
from backend.models.chair import Finish

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
