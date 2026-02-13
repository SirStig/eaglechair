"""
Admin Catalog Management Routes

Admin-only endpoints for managing product catalog options:
- Colors
- Finishes
- Upholsteries
- Custom Options
- Product Families
- Subcategories
"""

import logging
import os
import time
from pathlib import Path
from typing import List, Optional

from pydantic import BaseModel
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import JSONResponse
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import get_current_admin, require_role
from backend.api.v1.schemas.admin import (
    FamilyCreate,
    FamilyUpdate,
    HardwareCreate,
    HardwareUpdate,
    LaminateCreate,
    LaminateUpdate,
    SubcategoryCreate,
    SubcategoryUpdate,
)
from backend.api.v1.schemas.common import MessageResponse
from backend.core.exceptions import ResourceNotFoundError
from backend.database.base import get_db
from backend.models.chair import (
    Color,
    CustomOption,
    Finish,
    ProductFamily,
    ProductSubcategory,
    Upholstery,
)
from backend.models.company import AdminRole, AdminUser
from backend.models.content import Catalog, CatalogType, Hardware, Laminate
from backend.utils.serializers import orm_list_to_dict_list, orm_to_dict
from backend.utils.static_content_exporter import export_content_after_update

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin - Catalog"])


class ReorderItem(BaseModel):
    id: int
    display_order: int


class ReorderBody(BaseModel):
    order: List[ReorderItem]


# ============================================================================
# Color Management
# ============================================================================

@router.get(
    "/colors",
    summary="List all colors (Admin)",
    description="Get all colors with optional filtering"
)
async def get_colors(
    category: Optional[str] = Query(None, description="Filter by category (wood/metal/fabric/paint). Supports partial matching (e.g., 'wood' matches 'wood chairs')"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get all colors. Admin only."""
    logger.info(f"Admin {admin.username} fetching colors (category={category})")
    
    from sqlalchemy import func
    
    query = select(Color)
    
    if category:
        # Support case-insensitive partial matching
        # e.g., "wood" will match "wood", "wood chairs", "Wood Finish", etc.
        query = query.where(func.lower(Color.category).contains(func.lower(category)))
    
    if is_active is not None:
        query = query.where(Color.is_active == is_active)
    
    query = query.order_by(Color.display_order, Color.name)
    
    result = await db.execute(query)
    colors = result.scalars().all()
    
    return orm_list_to_dict_list(colors)


@router.post(
    "/colors",
    status_code=status.HTTP_201_CREATED,
    summary="Create color (Admin)",
    description="Create a new color option"
)
async def create_color(
    name: str,
    color_code: Optional[str] = None,
    hex_value: Optional[str] = None,
    category: Optional[str] = None,
    image_url: Optional[str] = None,
    display_order: int = 0,
    is_active: bool = True,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Create a new color. Admin only."""
    logger.info(f"Admin {admin.username} creating color: {name}")
    
    color = Color(
        name=name,
        color_code=color_code,
        hex_value=hex_value,
        category=category,
        image_url=image_url,
        display_order=display_order,
        is_active=is_active
    )
    
    db.add(color)
    await db.commit()
    await db.refresh(color)
    
    return orm_to_dict(color)


@router.put(
    "/colors/{color_id}",
    summary="Update color (Admin)",
    description="Update an existing color"
)
async def update_color(
    color_id: int,
    name: Optional[str] = None,
    color_code: Optional[str] = None,
    hex_value: Optional[str] = None,
    category: Optional[str] = None,
    image_url: Optional[str] = None,
    display_order: Optional[int] = None,
    is_active: Optional[bool] = None,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Update a color. Admin only."""
    logger.info(f"Admin {admin.username} updating color {color_id}")
    
    stmt = select(Color).where(Color.id == color_id)
    result = await db.execute(stmt)
    color = result.scalar_one_or_none()
    
    if not color:
        raise HTTPException(status_code=404, detail=f"Color {color_id} not found")
    
    if name is not None:
        color.name = name
    if color_code is not None:
        color.color_code = color_code
    if hex_value is not None:
        color.hex_value = hex_value
    if category is not None:
        color.category = category
    if image_url is not None:
        color.image_url = image_url
    if display_order is not None:
        color.display_order = display_order
    if is_active is not None:
        color.is_active = is_active
    
    await db.commit()
    await db.refresh(color)
    
    return orm_to_dict(color)


@router.delete(
    "/colors/{color_id}",
    response_model=MessageResponse,
    summary="Delete color (Admin)",
    description="Delete a color (soft delete by marking inactive)"
)
async def delete_color(
    color_id: int,
    hard_delete: bool = Query(False, description="Permanently delete (use with caution)"),
    admin: AdminUser = Depends(require_role(AdminRole.SUPER_ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Delete a color. Super admin only."""
    logger.info(f"Admin {admin.username} deleting color {color_id} (hard={hard_delete})")
    
    stmt = select(Color).where(Color.id == color_id)
    result = await db.execute(stmt)
    color = result.scalar_one_or_none()
    
    if not color:
        raise HTTPException(status_code=404, detail=f"Color {color_id} not found")
    
    if hard_delete:
        await db.delete(color)
    else:
        color.is_active = False
    
    await db.commit()
    
    return MessageResponse(
        message=f"Color '{color.name}' {'deleted' if hard_delete else 'deactivated'} successfully"
    )


# ============================================================================
# Finish Management
# ============================================================================

@router.get(
    "/finishes",
    summary="List all finishes (Admin)",
    description="Get all finishes with optional filtering"
)
async def get_finishes(
    finish_type: Optional[str] = Query(None, description="Filter by finish type"),
    grade: Optional[str] = Query(None, description="Filter by grade (Standard, Premium, Premium Plus, Artisan)"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get all finishes. Admin only."""
    logger.info(f"Admin {admin.username} fetching finishes")
    
    query = select(Finish)
    
    if finish_type:
        query = query.where(Finish.finish_type == finish_type)
    
    if grade:
        query = query.where(Finish.grade == grade)
    
    if is_active is not None:
        query = query.where(Finish.is_active == is_active)
    
    query = query.order_by(Finish.display_order, Finish.name)
    
    result = await db.execute(query)
    finishes = result.scalars().all()
    
    return orm_list_to_dict_list(finishes)


@router.post(
    "/finishes",
    status_code=status.HTTP_201_CREATED,
    summary="Create finish (Admin)",
    description="Create a new finish option"
)
async def create_finish(
    name: str,
    finish_code: Optional[str] = None,
    description: Optional[str] = None,
    finish_type: Optional[str] = None,
    grade: str = "Standard",
    color_id: Optional[int] = None,
    color_hex: Optional[str] = None,
    image_url: Optional[str] = None,
    additional_cost: int = 0,
    display_order: int = 0,
    is_active: bool = True,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Create a new finish. Admin only."""
    logger.info(f"Admin {admin.username} creating finish: {name}")
    
    finish = Finish(
        name=name,
        finish_code=finish_code,
        description=description,
        finish_type=finish_type,
        grade=grade,
        color_id=color_id,
        color_hex=color_hex,
        image_url=image_url,
        additional_cost=additional_cost,
        display_order=display_order,
        is_active=is_active
    )
    
    db.add(finish)
    await db.commit()
    await db.refresh(finish)
    
    # Export to CMS
    await export_content_after_update('finishes', db)
    
    return orm_to_dict(finish)


@router.post(
    "/finishes/reorder",
    summary="Batch reorder finishes (Admin)",
)
async def reorder_finishes(
    body: ReorderBody,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    for item in body.order:
        stmt = select(Finish).where(Finish.id == item.id)
        result = await db.execute(stmt)
        finish = result.scalar_one_or_none()
        if finish:
            finish.display_order = item.display_order
    await db.commit()
    await export_content_after_update('finishes', db)
    return {"message": "Order updated", "count": len(body.order)}


@router.put(
    "/finishes/{finish_id}",
    summary="Update finish (Admin)",
    description="Update an existing finish"
)
async def update_finish(
    finish_id: int,
    name: Optional[str] = None,
    finish_code: Optional[str] = None,
    description: Optional[str] = None,
    finish_type: Optional[str] = None,
    grade: Optional[str] = None,
    color_id: Optional[int] = None,
    color_hex: Optional[str] = None,
    image_url: Optional[str] = None,
    additional_cost: Optional[int] = None,
    display_order: Optional[int] = None,
    is_active: Optional[bool] = None,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Update a finish. Admin only."""
    logger.info(f"Admin {admin.username} updating finish {finish_id}")
    
    stmt = select(Finish).where(Finish.id == finish_id)
    result = await db.execute(stmt)
    finish = result.scalar_one_or_none()
    
    if not finish:
        raise HTTPException(status_code=404, detail=f"Finish {finish_id} not found")
    
    if name is not None:
        finish.name = name
    if finish_code is not None:
        finish.finish_code = finish_code
    if description is not None:
        finish.description = description
    if finish_type is not None:
        finish.finish_type = finish_type
    if grade is not None:
        finish.grade = grade
    if color_id is not None:
        finish.color_id = color_id
    if color_hex is not None:
        finish.color_hex = color_hex
    if image_url is not None:
        finish.image_url = image_url
    if additional_cost is not None:
        finish.additional_cost = additional_cost
    if display_order is not None:
        finish.display_order = display_order
    if is_active is not None:
        finish.is_active = is_active
    
    await db.commit()
    await db.refresh(finish)
    
    # Export to CMS
    await export_content_after_update('finishes', db)
    
    return orm_to_dict(finish)


@router.delete(
    "/finishes/{finish_id}",
    response_model=MessageResponse,
    summary="Delete finish (Admin)",
    description="Delete a finish (soft delete by marking inactive)"
)
async def delete_finish(
    finish_id: int,
    hard_delete: bool = Query(False, description="Permanently delete (use with caution)"),
    admin: AdminUser = Depends(require_role(AdminRole.SUPER_ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Delete a finish. Super admin only."""
    logger.info(f"Admin {admin.username} deleting finish {finish_id} (hard={hard_delete})")
    
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
    
    # Export to CMS
    await export_content_after_update('finishes', db)
    
    return MessageResponse(
        message=f"Finish '{finish.name}' {'deleted' if hard_delete else 'deactivated'} successfully"
    )


# ============================================================================
# Upholstery Management
# ============================================================================

@router.get(
    "/upholsteries",
    summary="List all upholsteries (Admin)",
    description="Get all upholsteries with optional filtering"
)
async def get_upholsteries(
    material_type: Optional[str] = Query(None, description="Filter by material type"),
    grade: Optional[str] = Query(None, description="Filter by grade"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get all upholsteries. Admin only."""
    logger.info(f"Admin {admin.username} fetching upholsteries")
    
    query = select(Upholstery)
    
    if material_type:
        query = query.where(Upholstery.material_type == material_type)
    
    if grade:
        query = query.where(Upholstery.grade == grade)
    
    if is_active is not None:
        query = query.where(Upholstery.is_active == is_active)
    
    query = query.order_by(Upholstery.display_order, Upholstery.name)
    
    result = await db.execute(query)
    upholsteries = result.scalars().all()
    
    return orm_list_to_dict_list(upholsteries)


@router.post(
    "/upholsteries",
    status_code=status.HTTP_201_CREATED,
    summary="Create upholstery (Admin)",
    description="Create a new upholstery option"
)
async def create_upholstery(
    name: str,
    material_code: Optional[str] = None,
    material_type: str = "Vinyl",
    description: Optional[str] = None,
    grade: Optional[str] = None,
    color_id: Optional[int] = None,
    color: Optional[str] = None,
    color_hex: Optional[str] = None,
    pattern: Optional[str] = None,
    texture_description: Optional[str] = None,
    is_seat_option_only: bool = False,
    image_url: Optional[str] = None,
    swatch_image_url: Optional[str] = None,
    is_com: bool = False,
    com_requirements: Optional[str] = None,
    durability_rating: Optional[str] = None,
    flame_rating: Optional[str] = None,
    cleanability: Optional[str] = None,
    additional_cost: int = 0,
    grade_a_cost: int = 0,
    grade_b_cost: int = 0,
    grade_c_cost: int = 0,
    premium_cost: int = 0,
    display_order: int = 0,
    is_active: bool = True,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Create a new upholstery. Admin only."""
    logger.info(f"Admin {admin.username} creating upholstery: {name}")
    
    upholstery = Upholstery(
        name=name,
        material_code=material_code,
        material_type=material_type,
        description=description,
        grade=grade,
        color_id=color_id,
        color=color,
        color_hex=color_hex,
        pattern=pattern,
        texture_description=texture_description,
        is_seat_option_only=is_seat_option_only,
        image_url=image_url,
        swatch_image_url=swatch_image_url,
        is_com=is_com,
        com_requirements=com_requirements,
        durability_rating=durability_rating,
        flame_rating=flame_rating,
        cleanability=cleanability,
        additional_cost=additional_cost,
        grade_a_cost=grade_a_cost,
        grade_b_cost=grade_b_cost,
        grade_c_cost=grade_c_cost,
        premium_cost=premium_cost,
        display_order=display_order,
        is_active=is_active
    )
    
    db.add(upholstery)
    await db.commit()
    await db.refresh(upholstery)
    
    # Export to CMS
    await export_content_after_update('upholsteries', db)
    
    return orm_to_dict(upholstery)


@router.post(
    "/upholsteries/reorder",
    summary="Batch reorder upholsteries (Admin)",
)
async def reorder_upholsteries(
    body: ReorderBody,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    for item in body.order:
        stmt = select(Upholstery).where(Upholstery.id == item.id)
        result = await db.execute(stmt)
        upholstery = result.scalar_one_or_none()
        if upholstery:
            upholstery.display_order = item.display_order
    await db.commit()
    await export_content_after_update('upholsteries', db)
    return {"message": "Order updated", "count": len(body.order)}


@router.put(
    "/upholsteries/{upholstery_id}",
    summary="Update upholstery (Admin)",
    description="Update an existing upholstery"
)
async def update_upholstery(
    upholstery_id: int,
    name: Optional[str] = None,
    material_code: Optional[str] = None,
    material_type: Optional[str] = None,
    description: Optional[str] = None,
    grade: Optional[str] = None,
    color_id: Optional[int] = None,
    is_seat_option_only: Optional[bool] = None,
    additional_cost: Optional[int] = None,
    grade_a_cost: Optional[int] = None,
    grade_b_cost: Optional[int] = None,
    grade_c_cost: Optional[int] = None,
    premium_cost: Optional[int] = None,
    display_order: Optional[int] = None,
    is_active: Optional[bool] = None,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Update an upholstery. Admin only."""
    logger.info(f"Admin {admin.username} updating upholstery {upholstery_id}")
    
    stmt = select(Upholstery).where(Upholstery.id == upholstery_id)
    result = await db.execute(stmt)
    upholstery = result.scalar_one_or_none()
    
    if not upholstery:
        raise HTTPException(status_code=404, detail=f"Upholstery {upholstery_id} not found")
    
    if name is not None:
        upholstery.name = name
    if material_code is not None:
        upholstery.material_code = material_code
    if material_type is not None:
        upholstery.material_type = material_type
    if description is not None:
        upholstery.description = description
    if grade is not None:
        upholstery.grade = grade
    if color_id is not None:
        upholstery.color_id = color_id
    if is_seat_option_only is not None:
        upholstery.is_seat_option_only = is_seat_option_only
    if additional_cost is not None:
        upholstery.additional_cost = additional_cost
    if grade_a_cost is not None:
        upholstery.grade_a_cost = grade_a_cost
    if grade_b_cost is not None:
        upholstery.grade_b_cost = grade_b_cost
    if grade_c_cost is not None:
        upholstery.grade_c_cost = grade_c_cost
    if premium_cost is not None:
        upholstery.premium_cost = premium_cost
    if display_order is not None:
        upholstery.display_order = display_order
    if is_active is not None:
        upholstery.is_active = is_active
    
    await db.commit()
    await db.refresh(upholstery)
    
    # Export to CMS
    await export_content_after_update('upholsteries', db)
    
    return orm_to_dict(upholstery)


@router.delete(
    "/upholsteries/{upholstery_id}",
    response_model=MessageResponse,
    summary="Delete upholstery (Admin)",
    description="Delete an upholstery (soft delete by marking inactive)"
)
async def delete_upholstery(
    upholstery_id: int,
    hard_delete: bool = Query(False, description="Permanently delete (use with caution)"),
    admin: AdminUser = Depends(require_role(AdminRole.SUPER_ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Delete an upholstery. Super admin only."""
    logger.info(f"Admin {admin.username} deleting upholstery {upholstery_id} (hard={hard_delete})")
    
    stmt = select(Upholstery).where(Upholstery.id == upholstery_id)
    result = await db.execute(stmt)
    upholstery = result.scalar_one_or_none()
    
    if not upholstery:
        raise HTTPException(status_code=404, detail=f"Upholstery {upholstery_id} not found")
    
    if hard_delete:
        await db.delete(upholstery)
    else:
        upholstery.is_active = False
    
    await db.commit()
    
    # Export to CMS
    await export_content_after_update('upholsteries', db)
    
    return MessageResponse(
        message=f"Upholstery '{upholstery.name}' {'deleted' if hard_delete else 'deactivated'} successfully"
    )


# ============================================================================
# Custom Options Management
# ============================================================================

@router.get(
    "/custom-options",
    summary="List all custom options (Admin)",
    description="Get all custom options with optional filtering"
)
async def get_custom_options(
    option_type: Optional[str] = Query(None, description="Filter by option type"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get all custom options. Admin only."""
    logger.info(f"Admin {admin.username} fetching custom options")
    
    query = select(CustomOption)
    
    if option_type:
        query = query.where(CustomOption.option_type == option_type)
    
    if is_active is not None:
        query = query.where(CustomOption.is_active == is_active)
    
    query = query.order_by(CustomOption.display_order, CustomOption.name)
    
    result = await db.execute(query)
    options = result.scalars().all()
    
    return orm_list_to_dict_list(options)


@router.post(
    "/custom-options",
    status_code=status.HTTP_201_CREATED,
    summary="Create custom option (Admin)",
    description="Create a new custom option"
)
async def create_custom_option(
    name: str,
    option_code: Optional[str] = None,
    description: Optional[str] = None,
    option_type: str = "custom",
    applicable_categories: Optional[List[int]] = None,
    price_adjustment: int = 0,
    requires_quote: bool = False,
    admin_notes: Optional[str] = None,
    display_order: int = 0,
    is_active: bool = True,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Create a new custom option. Admin only."""
    logger.info(f"Admin {admin.username} creating custom option: {name}")
    
    custom_option = CustomOption(
        name=name,
        option_code=option_code,
        description=description,
        option_type=option_type,
        applicable_categories=applicable_categories,
        price_adjustment=price_adjustment,
        requires_quote=requires_quote,
        admin_notes=admin_notes,
        display_order=display_order,
        is_active=is_active
    )
    
    db.add(custom_option)
    await db.commit()
    await db.refresh(custom_option)
    
    return orm_to_dict(custom_option)


@router.put(
    "/custom-options/{option_id}",
    summary="Update custom option (Admin)",
    description="Update an existing custom option"
)
async def update_custom_option(
    option_id: int,
    name: Optional[str] = None,
    option_code: Optional[str] = None,
    description: Optional[str] = None,
    option_type: Optional[str] = None,
    applicable_categories: Optional[List[int]] = None,
    price_adjustment: Optional[int] = None,
    requires_quote: Optional[bool] = None,
    admin_notes: Optional[str] = None,
    display_order: Optional[int] = None,
    is_active: Optional[bool] = None,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Update a custom option. Admin only."""
    logger.info(f"Admin {admin.username} updating custom option {option_id}")
    
    stmt = select(CustomOption).where(CustomOption.id == option_id)
    result = await db.execute(stmt)
    custom_option = result.scalar_one_or_none()
    
    if not custom_option:
        raise HTTPException(status_code=404, detail=f"Custom option {option_id} not found")
    
    if name is not None:
        custom_option.name = name
    if option_code is not None:
        custom_option.option_code = option_code
    if description is not None:
        custom_option.description = description
    if option_type is not None:
        custom_option.option_type = option_type
    if applicable_categories is not None:
        custom_option.applicable_categories = applicable_categories
    if price_adjustment is not None:
        custom_option.price_adjustment = price_adjustment
    if requires_quote is not None:
        custom_option.requires_quote = requires_quote
    if admin_notes is not None:
        custom_option.admin_notes = admin_notes
    if display_order is not None:
        custom_option.display_order = display_order
    if is_active is not None:
        custom_option.is_active = is_active
    
    await db.commit()
    await db.refresh(custom_option)
    
    return orm_to_dict(custom_option)


@router.delete(
    "/custom-options/{option_id}",
    response_model=MessageResponse,
    summary="Delete custom option (Admin)",
    description="Delete a custom option (soft delete by marking inactive)"
)
async def delete_custom_option(
    option_id: int,
    hard_delete: bool = Query(False, description="Permanently delete (use with caution)"),
    admin: AdminUser = Depends(require_role(AdminRole.SUPER_ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Delete a custom option. Super admin only."""
    logger.info(f"Admin {admin.username} deleting custom option {option_id} (hard={hard_delete})")
    
    stmt = select(CustomOption).where(CustomOption.id == option_id)
    result = await db.execute(stmt)
    custom_option = result.scalar_one_or_none()
    
    if not custom_option:
        raise HTTPException(status_code=404, detail=f"Custom option {option_id} not found")
    
    if hard_delete:
        await db.delete(custom_option)
    else:
        custom_option.is_active = False
    
    await db.commit()
    
    return MessageResponse(
        message=f"Custom option '{custom_option.name}' {'deleted' if hard_delete else 'deactivated'} successfully"
    )


# ============================================================================
# Product Families Management
# ============================================================================

@router.get(
    "/families",
    summary="List all families (Admin)",
    description="Get all product families with optional filtering"
)
async def get_families(
    category_id: Optional[int] = Query(None, description="Filter by category ID"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get all product families. Admin only."""
    logger.info(f"Admin {admin.username} fetching families")
    
    query = select(ProductFamily)
    
    if category_id:
        query = query.where(ProductFamily.category_id == category_id)
    
    if is_active is not None:
        query = query.where(ProductFamily.is_active == is_active)
    
    query = query.order_by(ProductFamily.display_order, ProductFamily.name)
    
    result = await db.execute(query)
    families = result.scalars().all()
    
    return orm_list_to_dict_list(families)


@router.post(
    "/families",
    status_code=status.HTTP_201_CREATED,
    summary="Create family (Admin)",
    description="Create a new product family"
)
async def create_family(
    family_data: FamilyCreate,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Create a new product family. Admin only."""
    logger.info(f"Admin {admin.username} creating family: {family_data.name}")
    
    family = ProductFamily(**family_data.dict())
    
    db.add(family)
    await db.commit()
    await db.refresh(family)
    
    return orm_to_dict(family)


@router.post(
    "/families/reorder",
    summary="Batch reorder families (Admin)",
)
async def reorder_families(
    body: ReorderBody,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    for item in body.order:
        stmt = select(ProductFamily).where(ProductFamily.id == item.id)
        result = await db.execute(stmt)
        family = result.scalar_one_or_none()
        if family:
            family.display_order = item.display_order
    await db.commit()
    return {"message": "Order updated", "count": len(body.order)}


@router.put(
    "/families/{family_id}",
    summary="Update family (Admin)",
    description="Update an existing product family"
)
async def update_family(
    family_id: int,
    family_data: FamilyUpdate,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Update a product family. Admin only."""
    logger.info(f"Admin {admin.username} updating family {family_id}")
    
    stmt = select(ProductFamily).where(ProductFamily.id == family_id)
    result = await db.execute(stmt)
    family = result.scalar_one_or_none()
    
    if not family:
        raise HTTPException(status_code=404, detail=f"Family {family_id} not found")
    
    # Update only provided fields
    update_dict = family_data.dict(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(family, key, value)
    
    await db.commit()
    await db.refresh(family)
    
    return orm_to_dict(family)


@router.delete(
    "/families/{family_id}",
    response_model=MessageResponse,
    summary="Delete family (Admin)",
    description="Delete a product family"
)
async def delete_family(
    family_id: int,
    hard_delete: bool = Query(False, description="Permanently delete (use with caution)"),
    admin: AdminUser = Depends(require_role(AdminRole.SUPER_ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Delete a product family. Super admin only."""
    logger.info(f"Admin {admin.username} deleting family {family_id} (hard={hard_delete})")
    
    stmt = select(ProductFamily).where(ProductFamily.id == family_id)
    result = await db.execute(stmt)
    family = result.scalar_one_or_none()
    
    if not family:
        raise HTTPException(status_code=404, detail=f"Family {family_id} not found")
    
    if hard_delete:
        await db.delete(family)
    else:
        family.is_active = False
    
    await db.commit()
    
    return MessageResponse(
        message=f"Family '{family.name}' {'deleted' if hard_delete else 'deactivated'} successfully"
    )


# ============================================================================
# Subcategories Management
# ============================================================================

@router.get(
    "/subcategories",
    summary="List all subcategories (Admin)",
    description="Get all subcategories with optional filtering"
)
async def get_subcategories(
    category_id: Optional[int] = Query(None, description="Filter by category ID"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get all subcategories. Admin only."""
    logger.info(f"Admin {admin.username} fetching subcategories")
    
    query = select(ProductSubcategory)
    
    if category_id:
        query = query.where(ProductSubcategory.category_id == category_id)
    
    if is_active is not None:
        query = query.where(ProductSubcategory.is_active == is_active)
    
    query = query.order_by(ProductSubcategory.display_order, ProductSubcategory.name)
    
    result = await db.execute(query)
    subcategories = result.scalars().all()
    
    return orm_list_to_dict_list(subcategories)


@router.post(
    "/subcategories",
    status_code=status.HTTP_201_CREATED,
    summary="Create subcategory (Admin)",
    description="Create a new subcategory"
)
async def create_subcategory(
    subcategory_data: SubcategoryCreate,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Create a new subcategory. Admin only."""
    logger.info(f"Admin {admin.username} creating subcategory: {subcategory_data.name}")
    
    subcategory = ProductSubcategory(**subcategory_data.dict())
    
    db.add(subcategory)
    await db.commit()
    await db.refresh(subcategory)

    await export_content_after_update('categories', db)
    
    return orm_to_dict(subcategory)


@router.put(
    "/subcategories/{subcategory_id}",
    summary="Update subcategory (Admin)",
    description="Update an existing subcategory"
)
async def update_subcategory(
    subcategory_id: int,
    subcategory_data: SubcategoryUpdate,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Update a subcategory. Admin only."""
    logger.info(f"Admin {admin.username} updating subcategory {subcategory_id}")
    
    stmt = select(ProductSubcategory).where(ProductSubcategory.id == subcategory_id)
    result = await db.execute(stmt)
    subcategory = result.scalar_one_or_none()
    
    if not subcategory:
        raise HTTPException(status_code=404, detail=f"Subcategory {subcategory_id} not found")
    
    # Update only provided fields
    update_dict = subcategory_data.dict(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(subcategory, key, value)
    
    await db.commit()
    await db.refresh(subcategory)

    await export_content_after_update('categories', db)
    
    return orm_to_dict(subcategory)


@router.delete(
    "/subcategories/{subcategory_id}",
    response_model=MessageResponse,
    summary="Delete subcategory (Admin)",
    description="Delete a subcategory"
)
async def delete_subcategory(
    subcategory_id: int,
    hard_delete: bool = Query(False, description="Permanently delete (use with caution)"),
    admin: AdminUser = Depends(require_role(AdminRole.SUPER_ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Delete a subcategory. Super admin only."""
    logger.info(f"Admin {admin.username} deleting subcategory {subcategory_id} (hard={hard_delete})")
    
    stmt = select(ProductSubcategory).where(ProductSubcategory.id == subcategory_id)
    result = await db.execute(stmt)
    subcategory = result.scalar_one_or_none()
    
    if not subcategory:
        raise HTTPException(status_code=404, detail=f"Subcategory {subcategory_id} not found")
    
    if hard_delete:
        await db.delete(subcategory)
    else:
        subcategory.is_active = False
    
    await db.commit()

    await export_content_after_update('categories', db)
    
    return MessageResponse(
        message=f"Subcategory '{subcategory.name}' {'deleted' if hard_delete else 'deactivated'} successfully"
    )


# ============================================================================
# Laminate Management
# ============================================================================

@router.get(
    "/laminates",
    summary="List all laminates (Admin)",
    description="Get all laminates with optional filtering"
)
async def get_laminates(
    brand: Optional[str] = Query(None, description="Filter by brand"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get all laminates. Admin only."""
    logger.info(f"Admin {admin.username} fetching laminates")
    
    query = select(Laminate)
    
    if brand:
        query = query.where(Laminate.brand == brand)
    
    if is_active is not None:
        query = query.where(Laminate.is_active == is_active)
    
    query = query.order_by(Laminate.display_order, Laminate.brand, Laminate.pattern_name)
    
    result = await db.execute(query)
    laminates = result.scalars().all()
    
    return orm_list_to_dict_list(laminates)


@router.post(
    "/laminates",
    status_code=status.HTTP_201_CREATED,
    summary="Create laminate (Admin)",
    description="Create a new laminate option"
)
async def create_laminate(
    laminate_data: LaminateCreate,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Create a new laminate. Admin only."""
    logger.info(f"Admin {admin.username} creating laminate: {laminate_data.brand} - {laminate_data.pattern_name}")
    
    laminate = Laminate(
        brand=laminate_data.brand,
        pattern_name=laminate_data.pattern_name,
        pattern_code=laminate_data.pattern_code,
        description=laminate_data.description,
        color_family=laminate_data.color_family,
        finish_type=laminate_data.finish_type,
        thickness=laminate_data.thickness,
        grade=laminate_data.grade,
        supplier_name=laminate_data.supplier_name,
        supplier_website=laminate_data.supplier_website,
        supplier_contact=laminate_data.supplier_contact,
        swatch_image_url=laminate_data.swatch_image_url,
        full_image_url=laminate_data.full_image_url,
        additional_images=laminate_data.additional_images,
        is_in_stock=laminate_data.is_in_stock,
        lead_time_days=laminate_data.lead_time_days,
        minimum_order=laminate_data.minimum_order,
        price_per_sheet=laminate_data.price_per_sheet,
        recommended_for=laminate_data.recommended_for,
        care_instructions=laminate_data.care_instructions,
        display_order=laminate_data.display_order,
        is_active=laminate_data.is_active,
        is_featured=laminate_data.is_featured,
        is_popular=laminate_data.is_popular
    )
    
    db.add(laminate)
    await db.commit()
    await db.refresh(laminate)
    
    # Export to CMS
    await export_content_after_update('laminates', db)
    
    return orm_to_dict(laminate)


@router.post(
    "/laminates/reorder",
    summary="Batch reorder laminates (Admin)",
    description="Set display_order for multiple laminates in one request",
)
async def reorder_laminates(
    body: ReorderBody,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    for item in body.order:
        stmt = select(Laminate).where(Laminate.id == item.id)
        result = await db.execute(stmt)
        laminate = result.scalar_one_or_none()
        if laminate:
            laminate.display_order = item.display_order
    await db.commit()
    await export_content_after_update('laminates', db)
    return {"message": "Order updated", "count": len(body.order)}


@router.put(
    "/laminates/{laminate_id}",
    summary="Update laminate (Admin)",
    description="Update an existing laminate"
)
async def update_laminate(
    laminate_id: int,
    laminate_data: LaminateUpdate,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Update a laminate. Admin only."""
    logger.info(f"Admin {admin.username} updating laminate {laminate_id}")
    
    stmt = select(Laminate).where(Laminate.id == laminate_id)
    result = await db.execute(stmt)
    laminate = result.scalar_one_or_none()
    
    if not laminate:
        raise HTTPException(status_code=404, detail=f"Laminate {laminate_id} not found")
    
    # Update only fields that were provided (not None)
    update_dict = laminate_data.dict(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(laminate, field, value)
    
    await db.commit()
    await db.refresh(laminate)
    
    # Export to CMS
    await export_content_after_update('laminates', db)
    
    return orm_to_dict(laminate)


@router.delete(
    "/laminates/{laminate_id}",
    response_model=MessageResponse,
    summary="Delete laminate (Admin)",
    description="Delete a laminate (soft delete by marking inactive)"
)
async def delete_laminate(
    laminate_id: int,
    hard_delete: bool = Query(False, description="Permanently delete (use with caution)"),
    admin: AdminUser = Depends(require_role(AdminRole.SUPER_ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Delete a laminate. Super admin only."""
    logger.info(f"Admin {admin.username} deleting laminate {laminate_id} (hard={hard_delete})")
    
    stmt = select(Laminate).where(Laminate.id == laminate_id)
    result = await db.execute(stmt)
    laminate = result.scalar_one_or_none()
    
    if not laminate:
        raise HTTPException(status_code=404, detail=f"Laminate {laminate_id} not found")
    
    if hard_delete:
        await db.delete(laminate)
    else:
        laminate.is_active = False
    
    await db.commit()
    
    # Export to CMS
    await export_content_after_update('laminates', db)
    
    return MessageResponse(
        message=f"Laminate '{laminate.brand} - {laminate.pattern_name}' {'deleted' if hard_delete else 'deactivated'} successfully"
    )


# ============================================================================
# Catalog Management
# ============================================================================

@router.get(
    "/catalogs",
    summary="List all catalogs (Admin)",
    description="Get all catalogs with optional filtering"
)
async def get_catalogs(
    catalog_type: Optional[str] = Query(None, description="Filter by catalog type"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get all catalogs. Admin only."""
    logger.info(f"Admin {admin.username} fetching catalogs")
    
    query = select(Catalog)
    
    if catalog_type:
        query = query.where(Catalog.catalog_type == catalog_type)
    
    if is_active is not None:
        query = query.where(Catalog.is_active == is_active)
    
    query = query.order_by(Catalog.display_order, Catalog.title)
    
    result = await db.execute(query)
    catalogs = result.scalars().all()
    
    return orm_list_to_dict_list(catalogs)


@router.post(
    "/catalogs",
    status_code=status.HTTP_201_CREATED,
    summary="Create catalog (Admin)",
    description="Create a new catalog with PDF upload"
)
async def create_catalog(
    title: str = Form(...),
    catalog_type: str = Form(...),
    description: Optional[str] = Form(None),
    version: Optional[str] = Form(None),
    year: Optional[str] = Form(None),
    category_id: Optional[int] = Form(None),
    display_order: int = Form(0),
    is_active: bool = Form(True),
    is_featured: bool = Form(False),
    file: Optional[UploadFile] = File(None, description="PDF catalog file"),
    thumbnail: Optional[UploadFile] = File(None, description="Thumbnail/cover image"),
    thumbnail_url: Optional[str] = Form(None, description="Thumbnail URL (if already uploaded)"),
    file_url: Optional[str] = Form(None, description="Existing file URL (if file not uploaded)"),
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Create a new catalog. Admin only."""
    logger.info(f"Admin {admin.username} creating catalog: {title}")
    
    # Validate and convert catalog_type to enum
    try:
        catalog_type_enum = CatalogType(catalog_type)
    except ValueError:
        valid_types = [e.value for e in CatalogType]
        raise HTTPException(
            status_code=400,
            detail=f"Invalid catalog_type: '{catalog_type}'. Valid types are: {', '.join(valid_types)}"
        )
    
    # Handle PDF file upload
    final_file_url = file_url
    file_size = None
    file_type = None
    
    if file:
        # Validate filename exists
        if not file.filename:
            raise HTTPException(status_code=400, detail="Filename is required")
        
        # Validate PDF
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are accepted")
        
        # Upload PDF to frontend using same logic as upload.py
        from backend.api.v1.routes.admin.upload import (
            ALLOWED_DOCUMENT_EXTENSIONS,
            MAX_PDF_SIZE,
            UPLOAD_BASE_DIR,
        )
        
        content = await file.read()
        if len(content) > MAX_PDF_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size: {MAX_PDF_SIZE / 1024 / 1024}MB"
            )
        
        upload_dir = UPLOAD_BASE_DIR / "documents" / "catalogs"
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = int(time.time())
        file_ext = Path(file.filename).suffix.lower()
        base_name = Path(file.filename).stem
        base_name = "".join(c for c in base_name if c.isalnum() or c in "-_")
        filename = f"{base_name}_{timestamp}{file_ext}"
        file_path = upload_dir / filename
        
        with open(file_path, "wb") as f:
            f.write(content)
        
        final_file_url = f"/uploads/documents/catalogs/{filename}"
        file_size = len(content)
        file_type = "PDF"
        logger.info(f"PDF uploaded: {final_file_url}")
    
    # Handle thumbnail - either from file upload or URL
    final_thumbnail_url = None
    if thumbnail:
        from backend.api.v1.routes.admin.upload import (
            ALLOWED_IMAGE_EXTENSIONS,
            MAX_FILE_SIZE,
            UPLOAD_BASE_DIR,
        )
        
        thumb_ext = Path(thumbnail.filename).suffix.lower()
        if thumb_ext not in ALLOWED_IMAGE_EXTENSIONS:
            raise HTTPException(status_code=400, detail="Invalid thumbnail image type")
        
        thumb_content = await thumbnail.read()
        if len(thumb_content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="Thumbnail too large")
        
        thumb_dir = UPLOAD_BASE_DIR / "images" / "catalogs"
        thumb_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = int(time.time())
        thumb_base_name = Path(thumbnail.filename).stem
        thumb_base_name = "".join(c for c in thumb_base_name if c.isalnum() or c in "-_")
        thumb_filename = f"{thumb_base_name}_{timestamp}{thumb_ext}"
        thumb_path = thumb_dir / thumb_filename
        
        with open(thumb_path, "wb") as f:
            f.write(thumb_content)
        
        final_thumbnail_url = f"/uploads/images/catalogs/{thumb_filename}"
        logger.info(f"Thumbnail uploaded: {final_thumbnail_url}")
    elif thumbnail_url:
        # Use provided thumbnail URL if no file uploaded (check after stripping whitespace)
        trimmed_url = thumbnail_url.strip()
        if trimmed_url:
            final_thumbnail_url = trimmed_url
            logger.info(f"Using provided thumbnail URL: {final_thumbnail_url}")
        else:
            # Empty string provided - leave as None
            logger.info("Thumbnail URL provided but empty, leaving as None")
    
    if not final_file_url:
        raise HTTPException(status_code=400, detail="Either file upload or file_url is required")
    
    if not file_type:
        # Infer from file_url extension
        if final_file_url.lower().endswith('.pdf'):
            file_type = "PDF"
        elif final_file_url.lower().endswith('.zip'):
            file_type = "ZIP"
        else:
            file_type = "DOCUMENT"
    
    catalog = Catalog(
        title=title,
        description=description,
        catalog_type=catalog_type_enum,
        file_type=file_type,
        file_url=final_file_url,
        file_size=file_size,
        thumbnail_url=final_thumbnail_url,
        version=version,
        year=year,
        category_id=category_id,
        display_order=display_order,
        is_active=is_active,
        is_featured=is_featured
    )
    
    db.add(catalog)
    await db.commit()
    await db.refresh(catalog)
    
    # Export to CMS
    await export_content_after_update('catalogs', db)
    
    return orm_to_dict(catalog)


@router.post(
    "/catalogs/reorder",
    summary="Batch reorder catalogs (Admin)",
)
async def reorder_catalogs(
    body: ReorderBody,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    for item in body.order:
        stmt = select(Catalog).where(Catalog.id == item.id)
        result = await db.execute(stmt)
        catalog = result.scalar_one_or_none()
        if catalog:
            catalog.display_order = item.display_order
    await db.commit()
    await export_content_after_update('catalogs', db)
    return {"message": "Order updated", "count": len(body.order)}


@router.put(
    "/catalogs/{catalog_id}",
    summary="Update catalog (Admin)",
    description="Update an existing catalog"
)
async def update_catalog(
    catalog_id: int,
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    catalog_type: Optional[str] = Form(None),
    version: Optional[str] = Form(None),
    year: Optional[str] = Form(None),
    category_id: Optional[int] = Form(None),
    display_order: Optional[int] = Form(None),
    is_active: Optional[bool] = Form(None),
    is_featured: Optional[bool] = Form(None),
    file: Optional[UploadFile] = File(None, description="New PDF catalog file (optional)"),
    thumbnail: Optional[UploadFile] = File(None, description="New thumbnail/cover image (optional)"),
    thumbnail_url: Optional[str] = Form(None, description="Thumbnail URL (if already uploaded)"),
    file_url: Optional[str] = Form(None, description="New file URL (if file not uploaded)"),
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Update a catalog. Admin only."""
    logger.info(f"Admin {admin.username} updating catalog {catalog_id}")
    
    stmt = select(Catalog).where(Catalog.id == catalog_id)
    result = await db.execute(stmt)
    catalog = result.scalar_one_or_none()
    
    if not catalog:
        raise HTTPException(status_code=404, detail=f"Catalog {catalog_id} not found")
    
    if title is not None:
        catalog.title = title
    if description is not None:
        catalog.description = description
    if catalog_type is not None:
        # Validate and convert catalog_type to enum
        try:
            catalog.catalog_type = CatalogType(catalog_type)
        except ValueError:
            valid_types = [e.value for e in CatalogType]
            raise HTTPException(
                status_code=400,
                detail=f"Invalid catalog_type: '{catalog_type}'. Valid types are: {', '.join(valid_types)}"
            )
    if version is not None:
        catalog.version = version
    if year is not None:
        catalog.year = year
    if category_id is not None:
        catalog.category_id = category_id
    if display_order is not None:
        catalog.display_order = display_order
    if is_active is not None:
        catalog.is_active = is_active
    if is_featured is not None:
        catalog.is_featured = is_featured
    
    # Handle PDF file upload (if provided)
    if file:
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are accepted")
        
        from backend.api.v1.routes.admin.upload import MAX_PDF_SIZE, UPLOAD_BASE_DIR
        
        content = await file.read()
        if len(content) > MAX_PDF_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size: {MAX_PDF_SIZE / 1024 / 1024}MB"
            )
        
        upload_dir = UPLOAD_BASE_DIR / "documents" / "catalogs"
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = int(time.time())
        file_ext = Path(file.filename).suffix.lower()
        base_name = Path(file.filename).stem
        base_name = "".join(c for c in base_name if c.isalnum() or c in "-_")
        filename = f"{base_name}_{timestamp}{file_ext}"
        file_path = upload_dir / filename
        
        with open(file_path, "wb") as f:
            f.write(content)
        
        catalog.file_url = f"/uploads/documents/catalogs/{filename}"
        catalog.file_size = len(content)
        catalog.file_type = "PDF"
        logger.info(f"PDF updated: {catalog.file_url}")
    elif file_url is not None:
        catalog.file_url = file_url
    
    # Handle thumbnail - either from file upload or URL
    if thumbnail:
        from backend.api.v1.routes.admin.upload import (
            ALLOWED_IMAGE_EXTENSIONS,
            MAX_FILE_SIZE,
            UPLOAD_BASE_DIR,
        )
        
        thumb_ext = Path(thumbnail.filename).suffix.lower()
        if thumb_ext not in ALLOWED_IMAGE_EXTENSIONS:
            raise HTTPException(status_code=400, detail="Invalid thumbnail image type")
        
        thumb_content = await thumbnail.read()
        if len(thumb_content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="Thumbnail too large")
        
        thumb_dir = UPLOAD_BASE_DIR / "images" / "catalogs"
        thumb_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = int(time.time())
        thumb_base_name = Path(thumbnail.filename).stem
        thumb_base_name = "".join(c for c in thumb_base_name if c.isalnum() or c in "-_")
        thumb_filename = f"{thumb_base_name}_{timestamp}{thumb_ext}"
        thumb_path = thumb_dir / thumb_filename
        
        with open(thumb_path, "wb") as f:
            f.write(thumb_content)
        
        catalog.thumbnail_url = f"/uploads/images/catalogs/{thumb_filename}"
        logger.info(f"Thumbnail updated: {catalog.thumbnail_url}")
    elif thumbnail_url is not None:
        # Update thumbnail URL from provided value
        # If empty string, set to None (clear thumbnail)
        # Otherwise use the provided URL
        if thumbnail_url.strip():
            catalog.thumbnail_url = thumbnail_url.strip()
            logger.info(f"Thumbnail URL updated: {catalog.thumbnail_url}")
        else:
            catalog.thumbnail_url = None
            logger.info("Thumbnail URL cleared")
    
    await db.commit()
    await db.refresh(catalog)
    
    # Export to CMS
    await export_content_after_update('catalogs', db)
    
    return orm_to_dict(catalog)


@router.delete(
    "/catalogs/{catalog_id}",
    response_model=MessageResponse,
    summary="Delete catalog (Admin)",
    description="Delete a catalog (soft delete by marking inactive)"
)
async def delete_catalog(
    catalog_id: int,
    hard_delete: bool = Query(False, description="Permanently delete (use with caution)"),
    admin: AdminUser = Depends(require_role(AdminRole.SUPER_ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Delete a catalog. Super admin only."""
    logger.info(f"Admin {admin.username} deleting catalog {catalog_id} (hard={hard_delete})")
    
    stmt = select(Catalog).where(Catalog.id == catalog_id)
    result = await db.execute(stmt)
    catalog = result.scalar_one_or_none()
    
    if not catalog:
        raise HTTPException(status_code=404, detail=f"Catalog {catalog_id} not found")
    
    if hard_delete:
        await db.delete(catalog)
    else:
        catalog.is_active = False
    
    await db.commit()
    
    # Export to CMS
    await export_content_after_update('catalogs', db)
    
    return MessageResponse(
        message=f"Catalog '{catalog.title}' {'deleted' if hard_delete else 'deactivated'} successfully"
    )


# ============================================================================
# Hardware Management
# ============================================================================

@router.get(
    "/hardware",
    summary="List all hardware (Admin)",
    description="Get all hardware items with optional filtering"
)
async def get_hardware(
    category: Optional[str] = Query(None, description="Filter by category"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get all hardware. Admin only."""
    logger.info(f"Admin {admin.username} fetching hardware")
    
    query = select(Hardware)
    
    if category:
        query = query.where(Hardware.category == category)
    
    if is_active is not None:
        query = query.where(Hardware.is_active == is_active)
    
    query = query.order_by(Hardware.display_order, Hardware.name)
    
    result = await db.execute(query)
    hardware_items = result.scalars().all()
    
    return orm_list_to_dict_list(hardware_items)


@router.post(
    "/hardware",
    status_code=status.HTTP_201_CREATED,
    summary="Create hardware (Admin)",
    description="Create a new hardware item"
)
async def create_hardware(
    hardware_data: HardwareCreate,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Create a new hardware item. Admin only."""
    logger.info(f"Admin {admin.username} creating hardware: {hardware_data.name}")
    
    hardware = Hardware(
        name=hardware_data.name,
        category=hardware_data.category,
        description=hardware_data.description,
        material=hardware_data.material,
        finish=hardware_data.finish,
        dimensions=hardware_data.dimensions,
        weight_capacity=hardware_data.weight_capacity,
        model_number=hardware_data.model_number,
        sku=hardware_data.sku,
        image_url=hardware_data.image_url,
        thumbnail_url=hardware_data.thumbnail_url,
        additional_images=hardware_data.additional_images,
        compatible_with=hardware_data.compatible_with,
        installation_notes=hardware_data.installation_notes,
        list_price=hardware_data.list_price,
        display_order=hardware_data.display_order,
        is_active=hardware_data.is_active,
        is_featured=hardware_data.is_featured
    )
    
    db.add(hardware)
    await db.commit()
    await db.refresh(hardware)
    
    # Export to CMS
    await export_content_after_update('hardware', db)
    
    return orm_to_dict(hardware)


@router.post(
    "/hardware/reorder",
    summary="Batch reorder hardware (Admin)",
)
async def reorder_hardware(
    body: ReorderBody,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    for item in body.order:
        stmt = select(Hardware).where(Hardware.id == item.id)
        result = await db.execute(stmt)
        hardware = result.scalar_one_or_none()
        if hardware:
            hardware.display_order = item.display_order
    await db.commit()
    await export_content_after_update('hardware', db)
    return {"message": "Order updated", "count": len(body.order)}


@router.put(
    "/hardware/{hardware_id}",
    summary="Update hardware (Admin)",
    description="Update an existing hardware item"
)
async def update_hardware(
    hardware_id: int,
    hardware_data: HardwareUpdate,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Update a hardware item. Admin only."""
    logger.info(f"Admin {admin.username} updating hardware {hardware_id}")
    
    stmt = select(Hardware).where(Hardware.id == hardware_id)
    result = await db.execute(stmt)
    hardware = result.scalar_one_or_none()
    
    if not hardware:
        raise HTTPException(status_code=404, detail=f"Hardware {hardware_id} not found")
    
    # Update only fields that were provided (not None)
    update_dict = hardware_data.dict(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(hardware, field, value)
    
    await db.commit()
    await db.refresh(hardware)
    
    # Export to CMS
    await export_content_after_update('hardware', db)
    
    return orm_to_dict(hardware)


@router.delete(
    "/hardware/{hardware_id}",
    response_model=MessageResponse,
    summary="Delete hardware (Admin)",
    description="Delete a hardware item (soft delete by marking inactive)"
)
async def delete_hardware(
    hardware_id: int,
    hard_delete: bool = Query(False, description="Permanently delete (use with caution)"),
    admin: AdminUser = Depends(require_role(AdminRole.SUPER_ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Delete a hardware item. Super admin only."""
    logger.info(f"Admin {admin.username} deleting hardware {hardware_id} (hard={hard_delete})")
    
    stmt = select(Hardware).where(Hardware.id == hardware_id)
    result = await db.execute(stmt)
    hardware = result.scalar_one_or_none()
    
    if not hardware:
        raise HTTPException(status_code=404, detail=f"Hardware {hardware_id} not found")
    
    if hard_delete:
        await db.delete(hardware)
    else:
        hardware.is_active = False
    
    await db.commit()
    
    # Export to CMS
    await export_content_after_update('hardware', db)
    
    return MessageResponse(
        message=f"Hardware '{hardware.name}' {'deleted' if hard_delete else 'deactivated'} successfully"
    )
