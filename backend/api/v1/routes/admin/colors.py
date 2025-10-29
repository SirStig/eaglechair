"""
Admin Colors Routes

CRUD operations for colors
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.base import get_db
from backend.models.chair import Color

router = APIRouter()


# Pydantic schemas
class ColorCreate(BaseModel):
    name: str
    color_code: Optional[str] = None
    hex_value: Optional[str] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    display_order: int = 0
    is_active: bool = True


class ColorUpdate(BaseModel):
    name: Optional[str] = None
    color_code: Optional[str] = None
    hex_value: Optional[str] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None


@router.get("")
async def get_colors(
    is_active: Optional[bool] = None,
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Get all colors with optional filtering
    """
    query = select(Color)
    
    if is_active is not None:
        query = query.where(Color.is_active == is_active)
    
    if category:
        query = query.where(Color.category == category)
    
    query = query.order_by(Color.display_order, Color.name)
    
    result = await db.execute(query)
    colors = result.scalars().all()
    
    return [
        {
            "id": color.id,
            "name": color.name,
            "color_code": color.color_code,
            "hex_value": color.hex_value,
            "category": color.category,
            "image_url": color.image_url,
            "display_order": color.display_order,
            "is_active": color.is_active,
        }
        for color in colors
    ]


@router.get("/{color_id}")
async def get_color(
    color_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Get a specific color by ID
    """
    query = select(Color).where(Color.id == color_id)
    result = await db.execute(query)
    color = result.scalar_one_or_none()
    
    if not color:
        raise HTTPException(status_code=404, detail="Color not found")
    
    return {
        "id": color.id,
        "name": color.name,
        "color_code": color.color_code,
        "hex_value": color.hex_value,
        "category": color.category,
        "image_url": color.image_url,
        "display_order": color.display_order,
        "is_active": color.is_active,
    }


@router.post("")
async def create_color(
    color_data: ColorCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new color
    """
    # Check for duplicate color_code if provided
    if color_data.color_code:
        query = select(Color).where(Color.color_code == color_data.color_code)
        result = await db.execute(query)
        existing = result.scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=400, detail="Color code already exists")
    
    color = Color(
        name=color_data.name,
        color_code=color_data.color_code,
        hex_value=color_data.hex_value,
        category=color_data.category,
        image_url=color_data.image_url,
        display_order=color_data.display_order,
        is_active=color_data.is_active,
    )
    
    db.add(color)
    await db.commit()
    await db.refresh(color)
    
    return {
        "id": color.id,
        "name": color.name,
        "color_code": color.color_code,
        "hex_value": color.hex_value,
        "category": color.category,
        "image_url": color.image_url,
        "display_order": color.display_order,
        "is_active": color.is_active,
    }


@router.put("/{color_id}")
async def update_color(
    color_id: int,
    color_data: ColorUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Update an existing color
    """
    query = select(Color).where(Color.id == color_id)
    result = await db.execute(query)
    color = result.scalar_one_or_none()
    
    if not color:
        raise HTTPException(status_code=404, detail="Color not found")
    
    # Check for duplicate color_code if being updated
    if color_data.color_code and color_data.color_code != color.color_code:
        query = select(Color).where(Color.color_code == color_data.color_code)
        result = await db.execute(query)
        existing = result.scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=400, detail="Color code already exists")
    
    # Update fields
    if color_data.name is not None:
        color.name = color_data.name
    if color_data.color_code is not None:
        color.color_code = color_data.color_code
    if color_data.hex_value is not None:
        color.hex_value = color_data.hex_value
    if color_data.category is not None:
        color.category = color_data.category
    if color_data.image_url is not None:
        color.image_url = color_data.image_url
    if color_data.display_order is not None:
        color.display_order = color_data.display_order
    if color_data.is_active is not None:
        color.is_active = color_data.is_active
    
    await db.commit()
    await db.refresh(color)
    
    return {
        "id": color.id,
        "name": color.name,
        "color_code": color.color_code,
        "hex_value": color.hex_value,
        "category": color.category,
        "image_url": color.image_url,
        "display_order": color.display_order,
        "is_active": color.is_active,
    }


@router.delete("/{color_id}")
async def delete_color(
    color_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a color
    """
    query = select(Color).where(Color.id == color_id)
    result = await db.execute(query)
    color = result.scalar_one_or_none()
    
    if not color:
        raise HTTPException(status_code=404, detail="Color not found")
    
    await db.delete(color)
    await db.commit()
    
    return {"message": "Color deleted successfully"}
