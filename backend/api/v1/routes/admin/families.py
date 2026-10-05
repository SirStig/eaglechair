"""
Admin Product Families Routes

CRUD operations for product families
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import get_current_admin
from backend.database.base import get_db
from backend.models.chair import (
    Chair,
    ProductFamily,
    ProductVariation,
    chair_secondary_families,
    variation_families,
)
from backend.models.company import AdminUser
from backend.services import family_categories as family_categories_service

router = APIRouter()


@router.get("")
async def get_families(
    category_id: Optional[int] = Query(None, description="Filter by category ID"),
    subcategory_id: Optional[int] = Query(None, description="Filter by subcategory ID"),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all product families, optionally filtered by category or subcategory
    """
    query = select(ProductFamily).where(ProductFamily.is_active)
    
    if category_id is not None:
        query = query.where(family_categories_service.in_categories([category_id]))
    
    if subcategory_id is not None:
        query = query.where(family_categories_service.in_subcategories([subcategory_id]))
    
    query = query.order_by(ProductFamily.display_order, ProductFamily.name)
    
    result = await db.execute(query)
    families = result.scalars().all()
    cats, subs = await family_categories_service.category_id_lists(db, [f.id for f in families])
    
    return {
        "items": [
            {
                "id": fam.id,
                "name": fam.name,
                "slug": fam.slug,
                "category_id": fam.category_id,
                "subcategory_id": fam.subcategory_id,
                "category_ids": family_categories_service.primary_first(fam.category_id, cats.get(fam.id, [])),
                "subcategory_ids": family_categories_service.primary_first(fam.subcategory_id, subs.get(fam.id, [])),
                "description": fam.description,
                "family_image": fam.family_image,
                "banner_image_url": fam.banner_image_url,
                "catalog_pdf_url": fam.catalog_pdf_url,
                "overview_text": fam.overview_text,
                "is_featured": fam.is_featured,
                "is_active": fam.is_active,
                "display_order": fam.display_order,
            }
            for fam in families
        ]
    }


@router.get("/{family_id}")
async def get_family(
    family_id: int,
    admin: AdminUser = Depends(get_current_admin),
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
    
    cats, subs = await family_categories_service.category_id_lists(db, [family.id])
    return {
        "id": family.id,
        "category_ids": family_categories_service.primary_first(family.category_id, cats.get(family.id, [])),
        "subcategory_ids": family_categories_service.primary_first(family.subcategory_id, subs.get(family.id, [])),
        "name": family.name,
        "slug": family.slug,
        "category_id": family.category_id,
        "subcategory_id": family.subcategory_id,
        "description": family.description,
        "family_image": family.family_image,
        "banner_image_url": family.banner_image_url,
        "catalog_pdf_url": family.catalog_pdf_url,
        "overview_text": family.overview_text,
        "is_featured": family.is_featured,
        "is_active": family.is_active,
        "display_order": family.display_order,
    }


@router.get("/{family_id}/members")
async def get_family_members(
    family_id: int,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Everything that belongs to a family: products whose primary family it is,
    products listed in it as a secondary family, and variations assigned to it.
    """
    if not await db.get(ProductFamily, family_id):
        raise HTTPException(status_code=404, detail="Product family not found")

    def product_row(p: Chair) -> dict:
        return {
            "id": p.id,
            "name": p.name,
            "model_number": p.model_number,
            "model_suffix": p.model_suffix,
            "primary_image_url": p.primary_image_url,
            "is_active": p.is_active,
        }

    primary = (
        await db.execute(
            select(Chair).where(Chair.family_id == family_id).order_by(Chair.model_number)
        )
    ).scalars().all()
    secondary = (
        await db.execute(
            select(Chair)
            .join(chair_secondary_families, chair_secondary_families.c.chair_id == Chair.id)
            .where(chair_secondary_families.c.family_id == family_id)
            .order_by(Chair.model_number)
        )
    ).scalars().all()
    variations = (
        await db.execute(
            select(ProductVariation.id, ProductVariation.sku, ProductVariation.product_id, Chair.name)
            .join(variation_families, variation_families.c.variation_id == ProductVariation.id)
            .join(Chair, Chair.id == ProductVariation.product_id)
            .where(variation_families.c.family_id == family_id)
            .order_by(ProductVariation.sku)
        )
    ).all()

    return {
        "products": [product_row(p) for p in primary],
        "secondary_products": [product_row(p) for p in secondary],
        "variations": [
            {"id": v.id, "sku": v.sku, "product_id": v.product_id, "product_name": v.name}
            for v in variations
        ],
    }
