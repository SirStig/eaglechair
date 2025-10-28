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
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import get_current_admin, require_role
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
from backend.utils.serializers import orm_list_to_dict_list, orm_to_dict

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin - Catalog"])


# ============================================================================
# Color Management
# ============================================================================

@router.get(
    "/colors",
    summary="List all colors (Admin)",
    description="Get all colors with optional filtering"
)
async def get_colors(
    category: Optional[str] = Query(None, description="Filter by category (wood/metal/fabric/paint)"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get all colors. Admin only."""
    logger.info(f"Admin {admin.username} fetching colors")
    
    query = select(Color)
    
    if category:
        query = query.where(Color.category == category)
    
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
    
    return orm_to_dict(color, status_code=status.HTTP_201_CREATED)


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
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get all finishes. Admin only."""
    logger.info(f"Admin {admin.username} fetching finishes")
    
    query = select(Finish)
    
    if finish_type:
        query = query.where(Finish.finish_type == finish_type)
    
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
    
    return orm_to_dict(finish, status_code=status.HTTP_201_CREATED)


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
    
    return orm_to_dict(upholstery, status_code=status.HTTP_201_CREATED)


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
    
    return orm_to_dict(custom_option, status_code=status.HTTP_201_CREATED)


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
    name: str,
    slug: str,
    description: Optional[str] = None,
    category_id: Optional[int] = None,
    subcategory_id: Optional[int] = None,
    family_image: Optional[str] = None,
    banner_image_url: Optional[str] = None,
    overview_text: Optional[str] = None,
    display_order: int = 0,
    is_active: bool = True,
    is_featured: bool = False,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Create a new product family. Admin only."""
    logger.info(f"Admin {admin.username} creating family: {name}")
    
    family = ProductFamily(
        name=name,
        slug=slug,
        description=description,
        category_id=category_id,
        subcategory_id=subcategory_id,
        family_image=family_image,
        banner_image_url=banner_image_url,
        overview_text=overview_text,
        display_order=display_order,
        is_active=is_active,
        is_featured=is_featured
    )
    
    db.add(family)
    await db.commit()
    await db.refresh(family)
    
    return orm_to_dict(family, status_code=status.HTTP_201_CREATED)


@router.put(
    "/families/{family_id}",
    summary="Update family (Admin)",
    description="Update an existing product family"
)
async def update_family(
    family_id: int,
    name: Optional[str] = None,
    slug: Optional[str] = None,
    description: Optional[str] = None,
    category_id: Optional[int] = None,
    subcategory_id: Optional[int] = None,
    family_image: Optional[str] = None,
    banner_image_url: Optional[str] = None,
    overview_text: Optional[str] = None,
    display_order: Optional[int] = None,
    is_active: Optional[bool] = None,
    is_featured: Optional[bool] = None,
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
    
    if name is not None:
        family.name = name
    if slug is not None:
        family.slug = slug
    if description is not None:
        family.description = description
    if category_id is not None:
        family.category_id = category_id
    if subcategory_id is not None:
        family.subcategory_id = subcategory_id
    if family_image is not None:
        family.family_image = family_image
    if banner_image_url is not None:
        family.banner_image_url = banner_image_url
    if overview_text is not None:
        family.overview_text = overview_text
    if display_order is not None:
        family.display_order = display_order
    if is_active is not None:
        family.is_active = is_active
    if is_featured is not None:
        family.is_featured = is_featured
    
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
    name: str,
    slug: str,
    category_id: int,
    description: Optional[str] = None,
    display_order: int = 0,
    is_active: bool = True,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Create a new subcategory. Admin only."""
    logger.info(f"Admin {admin.username} creating subcategory: {name}")
    
    subcategory = ProductSubcategory(
        name=name,
        slug=slug,
        category_id=category_id,
        description=description,
        display_order=display_order,
        is_active=is_active
    )
    
    db.add(subcategory)
    await db.commit()
    await db.refresh(subcategory)
    
    return orm_to_dict(subcategory, status_code=status.HTTP_201_CREATED)


@router.put(
    "/subcategories/{subcategory_id}",
    summary="Update subcategory (Admin)",
    description="Update an existing subcategory"
)
async def update_subcategory(
    subcategory_id: int,
    name: Optional[str] = None,
    slug: Optional[str] = None,
    category_id: Optional[int] = None,
    description: Optional[str] = None,
    display_order: Optional[int] = None,
    is_active: Optional[bool] = None,
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
    
    if name is not None:
        subcategory.name = name
    if slug is not None:
        subcategory.slug = slug
    if category_id is not None:
        subcategory.category_id = category_id
    if description is not None:
        subcategory.description = description
    if display_order is not None:
        subcategory.display_order = display_order
    if is_active is not None:
        subcategory.is_active = is_active
    
    await db.commit()
    await db.refresh(subcategory)
    
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
    
    return MessageResponse(
        message=f"Subcategory '{subcategory.name}' {'deleted' if hard_delete else 'deactivated'} successfully"
    )
