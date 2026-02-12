"""
Admin Service

Handles admin operations for products, companies, quotes, and content management
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, asc, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.core.exceptions import (
    AuthorizationError,
    BusinessLogicError,
    ResourceNotFoundError,
    ValidationError,
)
from backend.models.chair import Category, Chair, Finish, ProductVariation, Upholstery
from backend.models.company import AdminUser, Company, CompanyStatus
from backend.models.content import (
    FAQ,
    Catalog,
    CompanyInfo,
    ContactLocation,
    FAQCategory,
    Installation,
    TeamMember,
)
from backend.models.quote import Quote, QuoteItem, QuoteStatus

logger = logging.getLogger(__name__)


class AdminService:
    """Service for admin operations"""

    # ========================================================================
    # Product Management
    # ========================================================================

    @staticmethod
    async def get_all_products(
        db: AsyncSession,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        category_id: Optional[int] = None,
        is_active: Optional[bool] = None,
    ) -> Tuple[List[Chair], int]:
        """
        Get all products with pagination and filtering

        Args:
            db: Database session
            page: Page number
            page_size: Items per page
            search: Search term
            category_id: Filter by category
            is_active: Filter by active status

        Returns:
            Tuple of (products, total_count)
        """
        query = select(Chair).options(
            selectinload(Chair.category),
            selectinload(Chair.subcategory),
            selectinload(Chair.family),
            selectinload(Chair.variations).selectinload(ProductVariation.finish),
            selectinload(Chair.variations).selectinload(ProductVariation.upholstery),
            selectinload(Chair.variations).selectinload(ProductVariation.color),
        )

        # Apply filters
        if search:
            query = query.where(
                or_(
                    Chair.name.ilike(f"%{search}%"),
                    Chair.short_description.ilike(f"%{search}%"),
                    Chair.full_description.ilike(f"%{search}%"),
                    Chair.model_number.ilike(f"%{search}%"),
                )
            )

        if category_id:
            query = query.where(Chair.category_id == category_id)

        if is_active is not None:
            query = query.where(Chair.is_active == is_active)

        # Get total count
        count_query = select(func.count(Chair.id))
        if search:
            count_query = count_query.where(
                or_(
                    Chair.name.ilike(f"%{search}%"),
                    Chair.short_description.ilike(f"%{search}%"),
                    Chair.full_description.ilike(f"%{search}%"),
                    Chair.model_number.ilike(f"%{search}%"),
                )
            )
        if category_id:
            count_query = count_query.where(Chair.category_id == category_id)
        if is_active is not None:
            count_query = count_query.where(Chair.is_active == is_active)

        total_result = await db.execute(count_query)
        total_count = total_result.scalar()

        # Apply pagination
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size).order_by(desc(Chair.created_at))

        result = await db.execute(query)
        products = result.scalars().all()

        logger.info(
            f"Retrieved {len(products)} products (page {page}, total: {total_count})"
        )

        return list(products), total_count

    @staticmethod
    async def create_product(db: AsyncSession, product_data: Dict[str, Any]) -> Chair:
        """
        Create new product with variations if provided

        Args:
            db: Database session
            product_data: Product data (may include 'variations' key)

        Returns:
            Created product
        """
        # Extract variations and related products
        variations_data = product_data.pop("variations", None)
        related_product_ids = product_data.pop("related_product_ids", None)

        # Validate category exists
        if product_data.get("category_id"):
            result = await db.execute(
                select(Category).where(Category.id == product_data["category_id"])
            )
            category = result.scalar_one_or_none()
            if not category:
                raise ValidationError("Invalid category ID")

        product = Chair(**product_data)
        db.add(product)
        await db.flush()  # Flush to get product.id without committing

        # Create variations if provided
        if variations_data:
            await AdminService._update_product_variations(
                db=db, product_id=product.id, variations_data=variations_data
            )

        # Update related products if provided
        if related_product_ids is not None:
            await AdminService._update_product_relations(
                db=db, product_id=product.id, related_product_ids=related_product_ids
            )

        await db.commit()
        await db.refresh(product)

        logger.info(f"Created product {product.id}: {product.name}")

        return product

    @staticmethod
    async def update_product(
        db: AsyncSession, product_id: int, update_data: Dict[str, Any]
    ) -> Chair:
        """
        Update product

        Args:
            db: Database session
            product_id: Product ID
            update_data: Update data

        Returns:
            Updated product
        """
        result = await db.execute(select(Chair).where(Chair.id == product_id))
        product = result.scalar_one_or_none()

        if not product:
            raise ResourceNotFoundError(resource_type="Product", resource_id=product_id)

        # Read-only fields that should not be updated via this method
        read_only_fields = {
            "id",
            "created_at",
            "updated_at",
            "view_count",
            "quote_count",
            "cart_items",
            "quote_items",
            "image_records",
            "category",
            "subcategory",
            "family",  # These are relationships, not direct fields
        }

        # Handle variations separately (before other fields)
        if "variations" in update_data:
            variations_data = update_data.pop("variations")
            await AdminService._update_product_variations(
                db=db, product_id=product_id, variations_data=variations_data
            )

        # Handle related products separately
        if "related_product_ids" in update_data:
            related_product_ids = update_data.pop("related_product_ids")
            await AdminService._update_product_relations(
                db=db, product_id=product_id, related_product_ids=related_product_ids
            )

        # Update fields (excluding read-only)
        for key, value in update_data.items():
            if key not in read_only_fields and hasattr(product, key):
                setattr(product, key, value)

        await db.commit()
        await db.refresh(product)

        logger.info(f"Updated product {product_id}")

        return product

    @staticmethod
    async def _update_product_variations(
        db: AsyncSession, product_id: int, variations_data: List[Dict[str, Any]]
    ) -> None:
        """
        Update product variations - create new, update existing, delete removed

        Args:
            db: Database session
            product_id: Product ID
            variations_data: List of variation dictionaries
        """
        from backend.models.chair import ProductVariation
        from sqlalchemy import select

        if variations_data is None:
            variations_data = []

        # Get existing variations for this product
        stmt = select(ProductVariation).where(ProductVariation.product_id == product_id)
        result = await db.execute(stmt)
        existing_variations_by_id = {v.id: v for v in result.scalars().all()}
        existing_variations_by_sku = {v.sku: v for v in result.scalars().all() if v.sku}

        # Track which variations we're keeping
        kept_variation_ids = set()
        variations_to_create = []

        # First pass: identify which variations to update vs create
        for var_data in variations_data:
            var_id = var_data.get("id")
            sku = var_data.get("sku")

            if not sku:
                logger.warning(
                    f"Skipping variation without SKU for product {product_id}"
                )
                continue

            # Check if we should update an existing variation
            variation_to_update = None

            if var_id and var_id in existing_variations_by_id:
                # Update by ID
                variation_to_update = existing_variations_by_id[var_id]
                kept_variation_ids.add(var_id)
            elif sku and sku in existing_variations_by_sku:
                # Update by SKU (variation without ID but SKU matches existing for this product)
                variation_to_update = existing_variations_by_sku[sku]
                kept_variation_ids.add(variation_to_update.id)
                logger.debug(
                    f"Updating variation by SKU {sku} (ID: {variation_to_update.id}) for product {product_id}"
                )

            if variation_to_update:
                # Update existing variation
                if "sku" in var_data and var_data["sku"] != variation_to_update.sku:
                    # SKU is changing - need to handle this carefully
                    variation_to_update.sku = var_data["sku"]
                if "finish_id" in var_data:
                    variation_to_update.finish_id = var_data["finish_id"]
                if "upholstery_id" in var_data:
                    variation_to_update.upholstery_id = var_data["upholstery_id"]
                if "color_id" in var_data:
                    variation_to_update.color_id = var_data["color_id"]
                if "price_adjustment" in var_data:
                    variation_to_update.price_adjustment = int(
                        var_data["price_adjustment"]
                    )
                if "stock_status" in var_data:
                    variation_to_update.stock_status = var_data["stock_status"]
                if "is_available" in var_data:
                    variation_to_update.is_available = bool(var_data["is_available"])
                if "lead_time_days" in var_data:
                    variation_to_update.lead_time_days = var_data["lead_time_days"]
                if "display_order" in var_data:
                    variation_to_update.display_order = int(
                        var_data.get("display_order", 0)
                    )
                if "images" in var_data:
                    variation_to_update.images = var_data["images"]
                if "primary_image_url" in var_data:
                    variation_to_update.primary_image_url = var_data[
                        "primary_image_url"
                    ]

                logger.debug(
                    f"Updated variation {variation_to_update.id} for product {product_id}"
                )
            else:
                # Mark for creation (will create after deletions to avoid constraint violations)
                variations_to_create.append(var_data)

        # Delete variations that were not in the update data FIRST
        # This must happen before creating new ones to avoid unique constraint violations
        for var_id, variation in existing_variations_by_id.items():
            if var_id not in kept_variation_ids:
                await db.delete(variation)
                logger.debug(f"Deleted variation {var_id} for product {product_id}")

        # Flush deletions before creating new variations
        await db.flush()

        # Now create new variations (after deletions are flushed)
        for var_data in variations_to_create:
            sku = var_data.get("sku")
            new_variation = ProductVariation(
                product_id=product_id,
                sku=sku,
                finish_id=var_data.get("finish_id"),
                upholstery_id=var_data.get("upholstery_id"),
                color_id=var_data.get("color_id"),
                price_adjustment=int(var_data.get("price_adjustment", 0)),
                stock_status=var_data.get("stock_status", "Available"),
                is_available=bool(var_data.get("is_available", True)),
                lead_time_days=var_data.get("lead_time_days"),
                display_order=int(var_data.get("display_order", 0)),
                images=var_data.get("images", []),
                primary_image_url=var_data.get("primary_image_url"),
            )
            db.add(new_variation)
            logger.debug(
                f"Created new variation with SKU {sku} for product {product_id}"
            )

    @staticmethod
    async def _create_product_variations(
        db: AsyncSession, product_id: int, variations_data: List[Dict[str, Any]]
    ) -> None:
        """
        Create product variations

        Args:
            db: Database session
            product_id: Product ID
            variations_data: List of variation dictionaries
        """
        from backend.models.chair import ProductVariation

        if not variations_data:
            return

        for var_data in variations_data:
            if not var_data.get("sku"):
                logger.warning(
                    f"Skipping variation without SKU for product {product_id}"
                )
                continue

            new_variation = ProductVariation(
                product_id=product_id,
                sku=var_data["sku"],
                finish_id=var_data.get("finish_id"),
                upholstery_id=var_data.get("upholstery_id"),
                color_id=var_data.get("color_id"),
                price_adjustment=int(var_data.get("price_adjustment", 0)),
                stock_status=var_data.get("stock_status", "Available"),
                is_available=bool(var_data.get("is_available", True)),
                lead_time_days=var_data.get("lead_time_days"),
                display_order=int(var_data.get("display_order", 0)),
                images=var_data.get("images", []),
                primary_image_url=var_data.get("primary_image_url"),
            )
            db.add(new_variation)
            logger.debug(
                f"Created variation with SKU {var_data['sku']} for product {product_id}"
            )

    @staticmethod
    async def _update_product_relations(
        db: AsyncSession, product_id: int, related_product_ids: List[int]
    ) -> None:
        """
        Update product relations (add/remove related products)

        Args:
            db: Database session
            product_id: Product ID
            related_product_ids: List of related product IDs
        """
        from backend.models.chair import Chair, ProductRelation

        # Validate that related products existing
        if related_product_ids:
            stmt = select(Chair.id).where(Chair.id.in_(related_product_ids))
            result = await db.execute(stmt)
            valid_ids = result.scalars().all()

            if len(valid_ids) != len(set(related_product_ids)):
                # Some IDs are invalid
                missing_ids = set(related_product_ids) - set(valid_ids)
                logger.warning(f"Invalid related product IDs ignored: {missing_ids}")

        # Delete existing relations
        # We delete all and recreate to ensure order and avoid complex diffing
        stmt = select(ProductRelation).where(
            ProductRelation.product_id == product_id,
            ProductRelation.relation_type == "related",
        )
        result = await db.execute(stmt)
        existing_relations = result.scalars().all()

        for rel in existing_relations:
            await db.delete(rel)

        await db.flush()

        # Create new relations
        for idx, related_id in enumerate(related_product_ids or []):
            # Don't relate to self
            if related_id == product_id:
                continue

            new_relation = ProductRelation(
                product_id=product_id,
                related_product_id=related_id,
                relation_type="related",
                display_order=idx,
            )
            db.add(new_relation)

        logger.debug(
            f"Updated relations for product {product_id}: {len(related_product_ids or [])} related products"
        )

    @staticmethod
    async def delete_product(db: AsyncSession, product_id: int) -> bool:
        """
        Delete product (soft delete by setting is_active=False)

        Args:
            db: Database session
            product_id: Product ID

        Returns:
            True if successful
        """
        result = await db.execute(select(Chair).where(Chair.id == product_id))
        product = result.scalar_one_or_none()

        if not product:
            raise ResourceNotFoundError(resource_type="Product", resource_id=product_id)

        # Soft delete
        product.is_active = False
        await db.commit()

        logger.info(f"Deleted product {product_id}")

        return True

    # ========================================================================
    # Company Management
    # ========================================================================

    @staticmethod
    async def get_all_companies(
        db: AsyncSession,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        status: Optional[CompanyStatus] = None,
    ) -> Tuple[List[Company], int]:
        """
        Get all companies with pagination and filtering

        Args:
            db: Database session
            page: Page number
            page_size: Items per page
            search: Search term
            status: Filter by status

        Returns:
            Tuple of (companies, total_count)
        """
        query = select(Company)

        # Apply filters
        if search:
            query = query.where(
                or_(
                    Company.company_name.ilike(f"%{search}%"),
                    Company.contact_email.ilike(f"%{search}%"),
                    Company.contact_name.ilike(f"%{search}%"),
                )
            )

        if status:
            query = query.where(Company.status == status)

        # Get total count
        count_query = select(func.count(Company.id))
        if search:
            count_query = count_query.where(
                or_(
                    Company.company_name.ilike(f"%{search}%"),
                    Company.contact_email.ilike(f"%{search}%"),
                    Company.contact_name.ilike(f"%{search}%"),
                )
            )
        if status:
            count_query = count_query.where(Company.status == status)

        total_result = await db.execute(count_query)
        total_count = total_result.scalar()

        # Apply pagination
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size).order_by(desc(Company.created_at))

        result = await db.execute(query)
        companies = result.scalars().all()

        logger.info(
            f"Retrieved {len(companies)} companies (page {page}, total: {total_count})"
        )

        return list(companies), total_count

    @staticmethod
    async def update_company_status(
        db: AsyncSession,
        company_id: int,
        status: CompanyStatus,
        admin_notes: Optional[str] = None,
    ) -> Company:
        """
        Update company status

        Args:
            db: Database session
            company_id: Company ID
            status: New status
            admin_notes: Optional admin notes

        Returns:
            Updated company
        """
        result = await db.execute(select(Company).where(Company.id == company_id))
        company = result.scalar_one_or_none()

        if not company:
            raise ResourceNotFoundError(resource_type="Company", resource_id=company_id)

        company.status = status
        if admin_notes:
            company.admin_notes = admin_notes

        await db.commit()
        await db.refresh(company)

        logger.info(f"Updated company {company_id} status to {status}")

        return company

    # ========================================================================
    # Quote Management
    # ========================================================================

    @staticmethod
    async def get_all_quotes(
        db: AsyncSession,
        page: int = 1,
        page_size: int = 20,
        status: Optional[QuoteStatus] = None,
        company_id: Optional[int] = None,
    ) -> Tuple[List[Quote], int]:
        """
        Get all quotes with pagination and filtering

        Args:
            db: Database session
            page: Page number
            page_size: Items per page
            status: Filter by status
            company_id: Filter by company

        Returns:
            Tuple of (quotes, total_count)
        """
        query = select(Quote).options(
            selectinload(Quote.company),
            selectinload(Quote.items).selectinload(QuoteItem.product),
        )

        # Apply filters
        if status:
            query = query.where(Quote.status == status)

        if company_id:
            query = query.where(Quote.company_id == company_id)

        # Get total count
        count_query = select(func.count(Quote.id))
        if status:
            count_query = count_query.where(Quote.status == status)
        if company_id:
            count_query = count_query.where(Quote.company_id == company_id)

        total_result = await db.execute(count_query)
        total_count = total_result.scalar()

        # Apply pagination
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size).order_by(desc(Quote.created_at))

        result = await db.execute(query)
        quotes = result.scalars().all()

        logger.info(
            f"Retrieved {len(quotes)} quotes (page {page}, total: {total_count})"
        )

        return list(quotes), total_count

    @staticmethod
    async def update_quote_status(
        db: AsyncSession,
        quote_id: int,
        status: QuoteStatus,
        quoted_price: Optional[int] = None,
        quoted_lead_time: Optional[str] = None,
        quote_notes: Optional[str] = None,
        admin_notes: Optional[str] = None,
    ) -> Quote:
        """
        Update quote status and pricing

        Args:
            db: Database session
            quote_id: Quote ID
            status: New status
            quoted_price: Quoted price in cents
            quoted_lead_time: Lead time
            quote_notes: Quote notes
            admin_notes: Admin notes

        Returns:
            Updated quote
        """
        result = await db.execute(select(Quote).where(Quote.id == quote_id))
        quote = result.scalar_one_or_none()

        if not quote:
            raise ResourceNotFoundError(resource_type="Quote", resource_id=quote_id)

        quote.status = status

        if quoted_price is not None:
            quote.quoted_price = quoted_price

        if quoted_lead_time:
            quote.quoted_lead_time = quoted_lead_time

        if quote_notes:
            quote.quote_notes = quote_notes

        if admin_notes:
            quote.admin_notes = admin_notes

        # Set quoted date if status is being set to quoted
        if status == QuoteStatus.QUOTED:
            quote.quoted_at = datetime.utcnow().isoformat()

        await db.commit()
        await db.refresh(quote)

        logger.info(f"Updated quote {quote_id} status to {status}")

        # Send email notification to company
        try:
            from backend.services.email_service import EmailService
            from backend.core.config import settings
            from sqlalchemy.orm import selectinload

            # Reload quote with company and items for email
            result = await db.execute(
                select(Quote)
                .where(Quote.id == quote_id)
                .options(
                    selectinload(Quote.company),
                    selectinload(Quote.items).selectinload(QuoteItem.product),
                )
            )
            quote_for_email = result.scalar_one_or_none()

            if quote_for_email and quote_for_email.company:
                quote_url = (
                    f"{settings.FRONTEND_URL}/quotes/{quote_for_email.quote_number}"
                )

                # Prepare items for email
                items_data = []
                if quote_for_email.items:
                    for item in quote_for_email.items:
                        items_data.append(
                            {
                                "product_name": item.product_name,
                                "product_model_number": item.product_model_number,
                                "quantity": item.quantity,
                                "unit_price": item.unit_price,
                                "line_total": item.line_total,
                            }
                        )

                # Send detailed quote email if we have items, otherwise send simple update
                if items_data:
                    await EmailService.send_quote_detailed_email(
                        db=db,
                        to_email=quote_for_email.company.rep_email,
                        company_name=quote_for_email.company.company_name,
                        quote_number=quote_for_email.quote_number,
                        status=status.value,
                        items=items_data,
                        subtotal=quote_for_email.subtotal,
                        tax_amount=quote_for_email.tax_amount,
                        shipping_cost=quote_for_email.shipping_cost,
                        total_amount=quote_for_email.total_amount,
                        quoted_price=quote_for_email.quoted_price,
                        quoted_lead_time=quote_for_email.quoted_lead_time,
                        quote_valid_until=quote_for_email.quote_valid_until,
                        quote_notes=quote_for_email.quote_notes,
                        quote_url=quote_url,
                    )
                else:
                    await EmailService.send_quote_updated_email(
                        db=db,
                        to_email=quote_for_email.company.rep_email,
                        company_name=quote_for_email.company.company_name,
                        quote_number=quote_for_email.quote_number,
                        status=status.value,
                        admin_notes=admin_notes,
                        quoted_price=quote_for_email.quoted_price,
                        quoted_lead_time=quote_for_email.quoted_lead_time,
                        quote_url=quote_url,
                    )
                logger.info(
                    f"Quote update email sent to {quote_for_email.company.rep_email}"
                )
        except Exception as e:
            logger.error(f"Failed to send quote update email: {e}", exc_info=True)
            # Don't fail the update if email fails

        return quote

    @staticmethod
    async def recalculate_quote_totals(db: AsyncSession, quote_id: int) -> Quote:
        """
        Recalculate quote totals based on items

        Args:
            db: Database session
            quote_id: Quote ID

        Returns:
            Updated quote with recalculated totals
        """
        from backend.models.quote import Quote, QuoteItem
        from sqlalchemy.orm import selectinload

        result = await db.execute(
            select(Quote).where(Quote.id == quote_id).options(selectinload(Quote.items))
        )
        quote = result.scalar_one_or_none()

        if not quote:
            raise ResourceNotFoundError(resource_type="Quote", resource_id=quote_id)

        # Calculate subtotal from items
        subtotal = sum(item.line_total for item in quote.items) if quote.items else 0

        # Calculate tax (default 10% if not set)
        tax_rate = 0.10  # TODO: Make configurable
        tax_amount = int(subtotal * tax_rate)

        # Shipping cost and discount_amount are already set or calculated separately
        # Calculate total
        total_amount = (
            subtotal + tax_amount + quote.shipping_cost - quote.discount_amount
        )

        quote.subtotal = subtotal
        quote.tax_amount = tax_amount
        quote.total_amount = total_amount

        await db.commit()
        await db.refresh(quote)

        logger.info(
            f"Recalculated totals for quote {quote_id}: subtotal={subtotal}, total={total_amount}"
        )

        return quote

    # ========================================================================
    # Analytics
    # ========================================================================

    @staticmethod
    async def get_dashboard_stats(db: AsyncSession) -> Dict[str, Any]:
        """
        Get dashboard statistics

        Args:
            db: Database session

        Returns:
            Dashboard statistics
        """
        # Get counts
        companies_result = await db.execute(select(func.count(Company.id)))
        total_companies = companies_result.scalar()

        active_companies_result = await db.execute(
            select(func.count(Company.id)).where(Company.status == CompanyStatus.ACTIVE)
        )
        active_companies = active_companies_result.scalar()

        products_result = await db.execute(select(func.count(Chair.id)))
        total_products = products_result.scalar()

        active_products_result = await db.execute(
            select(func.count(Chair.id)).where(Chair.is_active == True)
        )
        active_products = active_products_result.scalar()

        quotes_result = await db.execute(select(func.count(Quote.id)))
        total_quotes = quotes_result.scalar()

        pending_quotes_result = await db.execute(
            select(func.count(Quote.id)).where(Quote.status == QuoteStatus.SUBMITTED)
        )
        pending_quotes = pending_quotes_result.scalar()

        # Get recent activity
        recent_quotes_result = await db.execute(
            select(Quote)
            .options(selectinload(Quote.company))
            .order_by(desc(Quote.created_at))
            .limit(5)
        )
        recent_quotes = recent_quotes_result.scalars().all()

        recent_companies_result = await db.execute(
            select(Company).order_by(desc(Company.created_at)).limit(5)
        )
        recent_companies = recent_companies_result.scalars().all()

        # Convert recent quotes to dicts
        recent_quotes_data = []
        for quote in recent_quotes:
            recent_quotes_data.append(
                {
                    "id": quote.id,
                    "company_id": quote.company_id,
                    "company_name": quote.company.company_name
                    if quote.company
                    else None,
                    "status": quote.status.value if quote.status else None,
                    "total_price": quote.total_amount,
                    "created_at": quote.created_at.isoformat()
                    if quote.created_at
                    else None,
                }
            )

        # Convert recent companies to dicts
        recent_companies_data = []
        for company in recent_companies:
            recent_companies_data.append(
                {
                    "id": company.id,
                    "name": company.company_name,
                    "status": company.status.value if company.status else None,
                    "created_at": company.created_at.isoformat()
                    if company.created_at
                    else None,
                }
            )

        stats = {
            "companies": {
                "total": total_companies,
                "active": active_companies,
                "pending": total_companies - active_companies,
            },
            "products": {
                "total": total_products,
                "active": active_products,
                "inactive": total_products - active_products,
            },
            "quotes": {"total": total_quotes, "pending": pending_quotes},
            "recent_quotes": recent_quotes_data,
            "recent_companies": recent_companies_data,
        }

        logger.info("Retrieved dashboard statistics")

        return stats
