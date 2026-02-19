"""
Admin Quote Routes

Admin-only endpoints for quote management
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.api.dependencies import get_current_admin, require_role
from backend.api.v1.schemas.admin import QuoteStatusUpdate
from backend.api.v1.schemas.common import MessageResponse
from backend.api.v1.schemas.quote import (
    QuoteAdminUpdate,
    QuoteItemAdminCreate,
    QuoteItemAdminUpdate,
    QuoteItemResponse,
)
from backend.core.exceptions import ResourceNotFoundError, ValidationError
from backend.database.base import get_db
from backend.models.company import AdminRole, AdminUser
from backend.models.quote import Quote, QuoteItem, QuoteShippingDestination, QuoteItemAllocation, QuoteStatus
from backend.services.admin_service import AdminService
from backend.utils.serializers import orm_to_dict

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin - Quotes"])


@router.get(
    "",
    summary="Get all quotes (Admin)",
    description="Retrieve all quotes with pagination and filtering",
)
async def get_all_quotes(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    status: Optional[QuoteStatus] = Query(None, description="Filter by status"),
    company_id: Optional[int] = Query(None, description="Filter by company"),
    sort_by: Optional[str] = Query(None, description="Sort column: quote_number, status, created_at, company_name, contact_name, items_count"),
    sort_dir: Optional[str] = Query("desc", description="Sort direction: asc, desc"),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all quotes with admin filtering options.

    **Admin only** - Requires admin authentication.
    """
    logger.info(f"Admin {admin.username} fetching quotes (page {page})")

    quotes, total_count = await AdminService.get_all_quotes(
        db=db,
        page=page,
        page_size=page_size,
        status=status,
        company_id=company_id,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )

    # Convert ORM objects to dicts and enrich with company info and items
    quotes_data = []
    for quote in quotes:
        quote_dict = orm_to_dict(quote)
        if quote.company:
            quote_dict["company_name"] = quote.company.company_name
            quote_dict["company_id"] = quote.company.id
            quote_dict["contact_name"] = (
                f"{quote.company.rep_first_name} {quote.company.rep_last_name}".strip()
            )
            quote_dict["contact_email"] = quote.company.rep_email
            quote_dict["contact_phone"] = quote.company.rep_phone
        else:
            quote_dict["company_name"] = "Guest"
            quote_dict["company_id"] = None
            quote_dict["contact_name"] = quote.contact_name or ""
            quote_dict["contact_email"] = quote.contact_email or ""
            quote_dict["contact_phone"] = quote.contact_phone or ""

        # Serialize quote items with product info
        if quote.items:
            quote_dict["items"] = []
            for item in quote.items:
                item_dict = orm_to_dict(item)
                # Add product info if loaded
                if item.product:
                    item_dict["product"] = {
                        "id": item.product.id,
                        "name": item.product.name,
                        "model_number": item.product.model_number,
                        "slug": item.product.slug,
                        "primary_image_url": item.product.primary_image_url,
                        "hover_image_url": item.product.hover_images[0]
                        if item.product.hover_images
                        and len(item.product.hover_images) > 0
                        else None,
                        "thumbnail": item.product.thumbnail,
                        "images": item.product.images,
                        "base_price": item.product.base_price,
                    }
                else:
                    item_dict["product"] = None
                quote_dict["items"].append(item_dict)
        else:
            quote_dict["items"] = []

        quotes_data.append(quote_dict)

    response_data = {
        "items": quotes_data,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "pages": (total_count + page_size - 1) // page_size,
    }

    return response_data


@router.get(
    "/{quote_id}",
    summary="Get quote by ID (Admin)",
    description="Retrieve a specific quote",
)
async def get_quote(
    quote_id: int,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Get quote by ID.

    **Admin only** - Requires admin authentication.
    """
    logger.info(f"Admin {admin.username} fetching quote {quote_id}")

    try:
        result = await db.execute(
            select(Quote)
            .where(Quote.id == quote_id)
            .options(
                selectinload(Quote.company),
                selectinload(Quote.items).selectinload(QuoteItem.product),
                selectinload(Quote.items).selectinload(QuoteItem.allocations),
                selectinload(Quote.shipping_destinations),
            )
        )
        quote = result.scalar_one_or_none()

        if not quote:
            raise ResourceNotFoundError(resource_type="Quote", resource_id=quote_id)

        quote_dict = orm_to_dict(quote)
        quote_dict["shipping_destinations"] = [orm_to_dict(d) for d in (quote.shipping_destinations or [])]
        if quote.company:
            quote_dict["company_name"] = quote.company.company_name
            quote_dict["company_id"] = quote.company.id
            quote_dict["contact_name"] = (
                f"{quote.company.rep_first_name} {quote.company.rep_last_name}".strip()
            )
            quote_dict["contact_email"] = quote.company.rep_email
            quote_dict["contact_phone"] = quote.company.rep_phone
        else:
            quote_dict["company_name"] = "Guest"
            quote_dict["company_id"] = None
            quote_dict["contact_name"] = quote.contact_name or ""
            quote_dict["contact_email"] = quote.contact_email or ""
            quote_dict["contact_phone"] = quote.contact_phone or ""

        if quote.items:
            quote_dict["items"] = []
            for item in quote.items:
                item_dict = orm_to_dict(item)
                item_dict["allocations"] = [orm_to_dict(a) for a in (item.allocations or [])]
                if item.product:
                    item_dict["product"] = {
                        "id": item.product.id,
                        "name": item.product.name,
                        "model_number": item.product.model_number,
                        "slug": item.product.slug,
                        "primary_image_url": item.product.primary_image_url,
                        "hover_image_url": item.product.hover_images[0]
                        if item.product.hover_images
                        and len(item.product.hover_images) > 0
                        else None,
                        "thumbnail": item.product.thumbnail,
                        "images": item.product.images,
                        "base_price": item.product.base_price,
                    }
                else:
                    item_dict["product"] = None
                quote_dict["items"].append(item_dict)
        else:
            quote_dict["items"] = []

        return quote_dict

    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch(
    "/{quote_id}/status",
    summary="Update quote status (Admin)",
    description="Update quote status, pricing, and notes",
)
async def update_quote_status(
    quote_id: int,
    status_data: QuoteStatusUpdate,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """
    Update quote status and pricing.

    **Admin only** - Requires admin role.
    """
    logger.info(
        f"Admin {admin.username} updating quote {quote_id} status to {status_data.status}"
    )

    try:
        quote = await AdminService.update_quote_status(
            db=db,
            quote_id=quote_id,
            status=status_data.status,
            quoted_price=status_data.quoted_price,
            quoted_lead_time=status_data.quoted_lead_time,
            quote_notes=status_data.quote_notes,
            admin_notes=status_data.admin_notes,
        )

        # Reload quote with relationships for response
        from sqlalchemy.orm import selectinload

        result = await db.execute(
            select(Quote)
            .where(Quote.id == quote_id)
            .options(
                selectinload(Quote.company),
                selectinload(Quote.items).selectinload(QuoteItem.product),
            )
        )
        quote = result.scalar_one_or_none()

        if not quote:
            raise ResourceNotFoundError(resource_type="Quote", resource_id=quote_id)

        quote_dict = orm_to_dict(quote)
        if quote.company:
            quote_dict["company_name"] = quote.company.company_name
            quote_dict["company_id"] = quote.company.id
            quote_dict["contact_name"] = (
                f"{quote.company.rep_first_name} {quote.company.rep_last_name}".strip()
            )
            quote_dict["contact_email"] = quote.company.rep_email
            quote_dict["contact_phone"] = quote.company.rep_phone
        else:
            quote_dict["company_name"] = "Guest"
            quote_dict["company_id"] = None
            quote_dict["contact_name"] = quote.contact_name or ""
            quote_dict["contact_email"] = quote.contact_email or ""
            quote_dict["contact_phone"] = quote.contact_phone or ""

        if quote.items:
            quote_dict["items"] = []
            for item in quote.items:
                item_dict = orm_to_dict(item)
                # Add product info if loaded
                if item.product:
                    item_dict["product"] = {
                        "id": item.product.id,
                        "name": item.product.name,
                        "model_number": item.product.model_number,
                        "slug": item.product.slug,
                        "primary_image_url": item.product.primary_image_url,
                        "hover_image_url": item.product.hover_images[0]
                        if item.product.hover_images
                        and len(item.product.hover_images) > 0
                        else None,
                        "thumbnail": item.product.thumbnail,
                        "images": item.product.images,
                        "base_price": item.product.base_price,
                    }
                else:
                    item_dict["product"] = None
                quote_dict["items"].append(item_dict)
        else:
            quote_dict["items"] = []

        return quote_dict

    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch(
    "/{quote_id}",
    summary="Update quote (Admin)",
    description="Update quote details, status, pricing, and notes",
)
async def update_quote(
    quote_id: int,
    update_data: QuoteAdminUpdate,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """
    Update quote with full admin access.

    **Admin only** - Requires admin role.
    """
    logger.info(f"Admin {admin.username} updating quote {quote_id}")

    try:
        from backend.models.quote import Quote

        # Fetch quote with relationships
        result = await db.execute(
            select(Quote)
            .where(Quote.id == quote_id)
            .options(selectinload(Quote.company), selectinload(Quote.items))
        )
        quote = result.scalar_one_or_none()

        if not quote:
            raise ResourceNotFoundError(resource_type="Quote", resource_id=quote_id)

        # Update fields from update_data
        update_dict = update_data.model_dump(exclude_unset=True)

        # Handle status conversion if needed
        if "status" in update_dict and isinstance(update_dict["status"], str):
            from backend.models.quote import QuoteStatus

            try:
                update_dict["status"] = QuoteStatus(update_dict["status"])
            except ValueError:
                raise ValidationError(f"Invalid status: {update_dict['status']}")

        for field, value in update_dict.items():
            if hasattr(quote, field):
                setattr(quote, field, value)

        # Recalculate totals if items exist and totals weren't manually set
        if quote.items and not any(
            k in update_dict for k in ["subtotal", "tax_amount", "total_amount"]
        ):
            # Recalculate based on items
            await AdminService.recalculate_quote_totals(db=db, quote_id=quote_id)
        else:
            await db.commit()

        result = await db.execute(
            select(Quote)
            .where(Quote.id == quote_id)
            .options(
                selectinload(Quote.company),
                selectinload(Quote.items).selectinload(QuoteItem.product),
                selectinload(Quote.items).selectinload(QuoteItem.allocations),
                selectinload(Quote.shipping_destinations),
            )
        )
        quote = result.scalar_one_or_none()
        if not quote:
            raise ResourceNotFoundError(resource_type="Quote", resource_id=quote_id)

        quote_dict = orm_to_dict(quote)
        quote_dict["shipping_destinations"] = [orm_to_dict(d) for d in (quote.shipping_destinations or [])]
        if quote.company:
            quote_dict["company_name"] = quote.company.company_name
            quote_dict["company_id"] = quote.company.id
            quote_dict["contact_name"] = (
                f"{quote.company.rep_first_name} {quote.company.rep_last_name}".strip()
            )
            quote_dict["contact_email"] = quote.company.rep_email
            quote_dict["contact_phone"] = quote.company.rep_phone
        else:
            quote_dict["company_name"] = "Guest"
            quote_dict["company_id"] = None
            quote_dict["contact_name"] = quote.contact_name or ""
            quote_dict["contact_email"] = quote.contact_email or ""
            quote_dict["contact_phone"] = quote.contact_phone or ""

        if quote.items:
            quote_dict["items"] = []
            for item in quote.items:
                item_dict = orm_to_dict(item)
                item_dict["allocations"] = [orm_to_dict(a) for a in (item.allocations or [])]
                if item.product:
                    item_dict["product"] = {
                        "id": item.product.id,
                        "name": item.product.name,
                        "model_number": item.product.model_number,
                        "slug": item.product.slug,
                        "primary_image_url": item.product.primary_image_url,
                        "hover_image_url": item.product.hover_images[0]
                        if item.product.hover_images
                        and len(item.product.hover_images) > 0
                        else None,
                        "thumbnail": item.product.thumbnail,
                        "images": item.product.images,
                        "base_price": item.product.base_price,
                    }
                else:
                    item_dict["product"] = None
                quote_dict["items"].append(item_dict)
        else:
            quote_dict["items"] = []

        return quote_dict

    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/{quote_id}/assign",
    summary="Assign quote to admin (Admin)",
    description="Assign a quote to a specific admin for handling",
)
async def assign_quote(
    quote_id: int,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """
    Assign a quote to the current admin.

    **Admin only** - Requires admin role.
    """
    logger.info(f"Admin {admin.username} assigning quote {quote_id} to themselves")

    try:
        quote = await AdminService.update_quote_status(
            db=db,
            quote_id=quote_id,
            status=QuoteStatus.SUBMITTED,  # Keep current status
            admin_notes=f"Assigned to admin {admin.username}",
        )

        # Update assigned admin
        quote.assigned_to_admin_id = admin.id
        await db.commit()

        result = await db.execute(
            select(Quote)
            .where(Quote.id == quote_id)
            .options(
                selectinload(Quote.company),
                selectinload(Quote.items).selectinload(QuoteItem.product),
                selectinload(Quote.items).selectinload(QuoteItem.allocations),
                selectinload(Quote.shipping_destinations),
            )
        )
        quote = result.scalar_one_or_none()

        if not quote:
            raise ResourceNotFoundError(resource_type="Quote", resource_id=quote_id)

        quote_dict = orm_to_dict(quote)
        quote_dict["shipping_destinations"] = [orm_to_dict(d) for d in (quote.shipping_destinations or [])]
        if quote.company:
            quote_dict["company_name"] = quote.company.company_name
            quote_dict["company_id"] = quote.company.id
            quote_dict["contact_name"] = (
                f"{quote.company.rep_first_name} {quote.company.rep_last_name}".strip()
            )
            quote_dict["contact_email"] = quote.company.rep_email
            quote_dict["contact_phone"] = quote.company.rep_phone
        else:
            quote_dict["company_name"] = "Guest"
            quote_dict["company_id"] = None
            quote_dict["contact_name"] = quote.contact_name or ""
            quote_dict["contact_email"] = quote.contact_email or ""
            quote_dict["contact_phone"] = quote.contact_phone or ""

        if quote.items:
            quote_dict["items"] = []
            for item in quote.items:
                item_dict = orm_to_dict(item)
                item_dict["allocations"] = [orm_to_dict(a) for a in (item.allocations or [])]
                if item.product:
                    item_dict["product"] = {
                        "id": item.product.id,
                        "name": item.product.name,
                        "model_number": item.product.model_number,
                        "slug": item.product.slug,
                        "primary_image_url": item.product.primary_image_url,
                        "hover_image_url": item.product.hover_images[0]
                        if item.product.hover_images
                        and len(item.product.hover_images) > 0
                        else None,
                        "thumbnail": item.product.thumbnail,
                        "images": item.product.images,
                        "base_price": item.product.base_price,
                    }
                else:
                    item_dict["product"] = None
                quote_dict["items"].append(item_dict)
        else:
            quote_dict["items"] = []

        return quote_dict

    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ============================================================================
# Quote Item Management Endpoints
# ============================================================================


@router.post(
    "/{quote_id}/items",
    response_model=QuoteItemResponse,
    status_code=201,
    summary="Add item to quote (Admin)",
    description="Add a product/item to an existing quote",
)
async def add_quote_item(
    quote_id: int,
    item_data: QuoteItemAdminCreate,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """
    Add a new item to a quote.

    **Admin only** - Requires admin role.
    """
    logger.info(f"Admin {admin.username} adding item to quote {quote_id}")

    try:
        # Fetch quote
        result = await db.execute(select(Quote).where(Quote.id == quote_id))
        quote = result.scalar_one_or_none()

        if not quote:
            raise ResourceNotFoundError(resource_type="Quote", resource_id=quote_id)

        # Fetch product to get name and model number
        from backend.models.chair import Chair

        product_result = await db.execute(
            select(Chair).where(Chair.id == item_data.product_id)
        )
        product = product_result.scalar_one_or_none()

        if not product:
            raise ResourceNotFoundError(
                resource_type="Product", resource_id=item_data.product_id
            )

        # Calculate line_total
        line_total = (
            item_data.unit_price + item_data.customization_cost
        ) * item_data.quantity

        # Create quote item
        quote_item = QuoteItem(
            quote_id=quote_id,
            product_id=item_data.product_id,
            product_model_number=product.model_number,
            product_name=product.name,
            quantity=item_data.quantity,
            unit_price=item_data.unit_price,
            customization_cost=item_data.customization_cost,
            line_total=line_total,
            selected_finish_id=item_data.selected_finish_id,
            selected_upholstery_id=item_data.selected_upholstery_id,
            custom_options=item_data.custom_options,
            item_notes=item_data.item_notes,
        )

        db.add(quote_item)
        await db.commit()
        await db.refresh(quote_item)

        # Recalculate quote totals
        await AdminService.recalculate_quote_totals(db=db, quote_id=quote_id)

        # Reload item with product relationship
        item_id = quote_item.id  # Save ID before reload
        result = await db.execute(
            select(QuoteItem)
            .where(QuoteItem.id == item_id)
            .options(selectinload(QuoteItem.product))
        )
        quote_item = result.scalar_one_or_none()

        if not quote_item:
            raise ResourceNotFoundError(resource_type="QuoteItem", resource_id=item_id)

        item_dict = orm_to_dict(quote_item)
        if quote_item.product:
            item_dict["product"] = {
                "id": quote_item.product.id,
                "name": quote_item.product.name,
                "model_number": quote_item.product.model_number,
                "slug": quote_item.product.slug,
                "primary_image_url": quote_item.product.primary_image_url,
                "hover_image_url": quote_item.product.hover_images[0]
                if quote_item.product.hover_images
                and len(quote_item.product.hover_images) > 0
                else None,
                "thumbnail": quote_item.product.thumbnail,
                "images": quote_item.product.images,
                "base_price": quote_item.product.base_price,
            }
        else:
            item_dict["product"] = None

        return item_dict

    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch(
    "/{quote_id}/items/{item_id}",
    response_model=QuoteItemResponse,
    summary="Update quote item (Admin)",
    description="Update an item in a quote",
)
async def update_quote_item(
    quote_id: int,
    item_id: int,
    item_data: QuoteItemAdminUpdate,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """
    Update an item in a quote.

    **Admin only** - Requires admin role.
    """
    logger.info(f"Admin {admin.username} updating item {item_id} in quote {quote_id}")

    try:
        # Fetch quote item
        result = await db.execute(
            select(QuoteItem).where(
                QuoteItem.id == item_id, QuoteItem.quote_id == quote_id
            )
        )
        quote_item = result.scalar_one_or_none()

        if not quote_item:
            raise ResourceNotFoundError(resource_type="QuoteItem", resource_id=item_id)

        # Update fields
        update_dict = item_data.model_dump(exclude_unset=True)

        for field, value in update_dict.items():
            if hasattr(quote_item, field):
                setattr(quote_item, field, value)

        # Recalculate line_total if quantity, unit_price, or customization_cost changed
        if any(
            k in update_dict for k in ["quantity", "unit_price", "customization_cost"]
        ):
            if "line_total" not in update_dict:
                # Auto-calculate line_total
                quote_item.line_total = quote_item.quantity * (
                    quote_item.unit_price + quote_item.customization_cost
                )  # type: ignore[assignment]

        await db.commit()
        await db.refresh(quote_item)

        # Recalculate quote totals
        await AdminService.recalculate_quote_totals(db=db, quote_id=quote_id)

        # Reload item with product relationship
        result = await db.execute(
            select(QuoteItem)
            .where(QuoteItem.id == item_id)
            .options(selectinload(QuoteItem.product))
        )
        quote_item = result.scalar_one_or_none()

        if not quote_item:
            raise ResourceNotFoundError(resource_type="QuoteItem", resource_id=item_id)

        item_dict = orm_to_dict(quote_item)
        if quote_item.product:
            item_dict["product"] = {
                "id": quote_item.product.id,
                "name": quote_item.product.name,
                "model_number": quote_item.product.model_number,
                "slug": quote_item.product.slug,
                "primary_image_url": quote_item.product.primary_image_url,
                "hover_image_url": quote_item.product.hover_images[0]
                if quote_item.product.hover_images
                and len(quote_item.product.hover_images) > 0
                else None,
                "thumbnail": quote_item.product.thumbnail,
                "images": quote_item.product.images,
                "base_price": quote_item.product.base_price,
            }
        else:
            item_dict["product"] = None

        return item_dict

    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete(
    "/{quote_id}/items/{item_id}",
    response_model=MessageResponse,
    summary="Remove item from quote (Admin)",
    description="Remove an item from a quote",
)
async def delete_quote_item(
    quote_id: int,
    item_id: int,
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """
    Remove an item from a quote.

    **Admin only** - Requires admin role.
    """
    logger.info(f"Admin {admin.username} removing item {item_id} from quote {quote_id}")

    try:
        # Fetch quote item
        result = await db.execute(
            select(QuoteItem).where(
                QuoteItem.id == item_id, QuoteItem.quote_id == quote_id
            )
        )
        quote_item = result.scalar_one_or_none()

        if not quote_item:
            raise ResourceNotFoundError(resource_type="QuoteItem", resource_id=item_id)

        await db.delete(quote_item)
        await db.commit()

        # Recalculate quote totals
        await AdminService.recalculate_quote_totals(db=db, quote_id=quote_id)

        return MessageResponse(message="Quote item removed successfully")

    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ============================================================================
# Quote Shipping Destinations & Allocations (Admin)
# ============================================================================

class QuoteDestinationInput(BaseModel):
    label: Optional[str] = None
    line1: str
    line2: Optional[str] = None
    city: str
    state: str
    zip: str
    country: str = "USA"


class QuoteAllocationInput(BaseModel):
    quote_shipping_destination_id: int
    quantity: int


@router.put(
    "/{quote_id}/shipping-destinations",
    summary="Replace quote shipping destinations (Admin)",
)
async def replace_quote_shipping_destinations(
    quote_id: int,
    destinations: list[QuoteDestinationInput],
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    if not destinations:
        raise HTTPException(status_code=400, detail="At least one destination required")
    result = await db.execute(select(Quote).where(Quote.id == quote_id).options(selectinload(Quote.items), selectinload(Quote.shipping_destinations)))
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    for d in quote.shipping_destinations or []:
        await db.delete(d)
    await db.flush()
    for i, d in enumerate(destinations):
        dest = QuoteShippingDestination(
            quote_id=quote_id,
            label=d.label,
            line1=d.line1,
            line2=d.line2,
            city=d.city,
            state=d.state,
            zip=d.zip,
            country=d.country,
            sort_order=i,
        )
        db.add(dest)
    await db.flush()
    new_dests = (await db.execute(select(QuoteShippingDestination).where(QuoteShippingDestination.quote_id == quote_id).order_by(QuoteShippingDestination.sort_order, QuoteShippingDestination.id))).scalars().all()
    first_dest_id = new_dests[0].id if new_dests else None
    for item in quote.items or []:
        for a in item.allocations or []:
            await db.delete(a)
        if first_dest_id and item.quantity > 0:
            db.add(QuoteItemAllocation(quote_item_id=item.id, quote_shipping_destination_id=first_dest_id, quantity=item.quantity))
    await db.commit()
    return MessageResponse(message="Shipping destinations updated")


@router.put(
    "/{quote_id}/items/{item_id}/allocations",
    summary="Replace quote item allocations (Admin)",
)
async def replace_quote_item_allocations(
    quote_id: int,
    item_id: int,
    allocations: list[QuoteAllocationInput],
    admin: AdminUser = Depends(require_role(AdminRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(QuoteItem).where(QuoteItem.id == item_id, QuoteItem.quote_id == quote_id).options(selectinload(QuoteItem.allocations))
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Quote item not found")
    dest_ids = (await db.execute(select(QuoteShippingDestination.id).where(QuoteShippingDestination.quote_id == quote_id))).scalars().all()
    dest_ids = [r[0] for r in dest_ids]
    total = sum(a.quantity for a in allocations)
    if total != item.quantity:
        raise HTTPException(status_code=400, detail=f"Allocation total {total} must equal item quantity {item.quantity}")
    for a in item.allocations or []:
        await db.delete(a)
    for a in allocations:
        if a.quote_shipping_destination_id not in dest_ids:
            raise HTTPException(status_code=400, detail="Invalid quote_shipping_destination_id")
        if a.quantity > 0:
            db.add(QuoteItemAllocation(quote_item_id=item_id, quote_shipping_destination_id=a.quote_shipping_destination_id, quantity=a.quantity))
    await db.commit()
    return MessageResponse(message="Allocations updated")
