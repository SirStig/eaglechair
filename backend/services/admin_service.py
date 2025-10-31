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
from backend.models.chair import Category, Chair, Finish, Upholstery
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
        is_active: Optional[bool] = None
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
            selectinload(Chair.family)
        )
        
        # Apply filters
        if search:
            query = query.where(
                or_(
                    Chair.name.ilike(f"%{search}%"),
                    Chair.description.ilike(f"%{search}%"),
                    Chair.model_number.ilike(f"%{search}%")
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
                    Chair.description.ilike(f"%{search}%"),
                    Chair.model_number.ilike(f"%{search}%")
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
        
        logger.info(f"Retrieved {len(products)} products (page {page}, total: {total_count})")
        
        return list(products), total_count
    
    @staticmethod
    async def create_product(
        db: AsyncSession,
        product_data: Dict[str, Any]
    ) -> Chair:
        """
        Create new product
        
        Args:
            db: Database session
            product_data: Product data
            
        Returns:
            Created product
        """
        # Validate category exists
        if product_data.get('category_id'):
            result = await db.execute(
                select(Category).where(Category.id == product_data['category_id'])
            )
            category = result.scalar_one_or_none()
            if not category:
                raise ValidationError("Invalid category ID")
        
        product = Chair(**product_data)
        db.add(product)
        await db.commit()
        await db.refresh(product)
        
        logger.info(f"Created product {product.id}: {product.name}")
        
        return product
    
    @staticmethod
    async def update_product(
        db: AsyncSession,
        product_id: int,
        update_data: Dict[str, Any]
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
        result = await db.execute(
            select(Chair).where(Chair.id == product_id)
        )
        product = result.scalar_one_or_none()
        
        if not product:
            raise ResourceNotFoundError(resource_type="Product", resource_id=product_id)
        
        # Read-only fields that should not be updated via this method
        read_only_fields = {
            'id', 'created_at', 'updated_at', 'view_count', 'quote_count',
            'variations', 'cart_items', 'quote_items', 'image_records',
            'category', 'subcategory', 'family'  # These are relationships, not direct fields
        }
        
        # Update fields (excluding read-only)
        for key, value in update_data.items():
            if key not in read_only_fields and hasattr(product, key):
                setattr(product, key, value)
        
        await db.commit()
        await db.refresh(product)
        
        logger.info(f"Updated product {product_id}")
        
        return product
    
    @staticmethod
    async def delete_product(
        db: AsyncSession,
        product_id: int
    ) -> bool:
        """
        Delete product (soft delete by setting is_active=False)
        
        Args:
            db: Database session
            product_id: Product ID
            
        Returns:
            True if successful
        """
        result = await db.execute(
            select(Chair).where(Chair.id == product_id)
        )
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
        status: Optional[CompanyStatus] = None
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
                    Company.contact_name.ilike(f"%{search}%")
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
                    Company.contact_name.ilike(f"%{search}%")
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
        
        logger.info(f"Retrieved {len(companies)} companies (page {page}, total: {total_count})")
        
        return list(companies), total_count
    
    @staticmethod
    async def update_company_status(
        db: AsyncSession,
        company_id: int,
        status: CompanyStatus,
        admin_notes: Optional[str] = None
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
        result = await db.execute(
            select(Company).where(Company.id == company_id)
        )
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
        company_id: Optional[int] = None
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
            selectinload(Quote.items).selectinload(QuoteItem.product)
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
        
        logger.info(f"Retrieved {len(quotes)} quotes (page {page}, total: {total_count})")
        
        return list(quotes), total_count
    
    @staticmethod
    async def update_quote_status(
        db: AsyncSession,
        quote_id: int,
        status: QuoteStatus,
        quoted_price: Optional[int] = None,
        quoted_lead_time: Optional[str] = None,
        quote_notes: Optional[str] = None,
        admin_notes: Optional[str] = None
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
        result = await db.execute(
            select(Quote).where(Quote.id == quote_id)
        )
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
                    selectinload(Quote.items).selectinload(QuoteItem.product)
                )
            )
            quote_for_email = result.scalar_one_or_none()
            
            if quote_for_email and quote_for_email.company:
                quote_url = f"{settings.FRONTEND_URL}/quotes/{quote_for_email.quote_number}"
                
                # Prepare items for email
                items_data = []
                if quote_for_email.items:
                    for item in quote_for_email.items:
                        items_data.append({
                            'product_name': item.product_name,
                            'product_model_number': item.product_model_number,
                            'quantity': item.quantity,
                            'unit_price': item.unit_price,
                            'line_total': item.line_total
                        })
                
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
                        quote_url=quote_url
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
                        quote_url=quote_url
                    )
                logger.info(f"Quote update email sent to {quote_for_email.company.rep_email}")
        except Exception as e:
            logger.error(f"Failed to send quote update email: {e}", exc_info=True)
            # Don't fail the update if email fails
        
        return quote
    
    @staticmethod
    async def recalculate_quote_totals(
        db: AsyncSession,
        quote_id: int
    ) -> Quote:
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
            select(Quote)
            .where(Quote.id == quote_id)
            .options(selectinload(Quote.items))
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
        total_amount = subtotal + tax_amount + quote.shipping_cost - quote.discount_amount
        
        quote.subtotal = subtotal
        quote.tax_amount = tax_amount
        quote.total_amount = total_amount
        
        await db.commit()
        await db.refresh(quote)
        
        logger.info(f"Recalculated totals for quote {quote_id}: subtotal={subtotal}, total={total_amount}")
        
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
            select(Company)
            .order_by(desc(Company.created_at))
            .limit(5)
        )
        recent_companies = recent_companies_result.scalars().all()
        
        # Convert recent quotes to dicts
        recent_quotes_data = []
        for quote in recent_quotes:
            recent_quotes_data.append({
                "id": quote.id,
                "company_id": quote.company_id,
                "company_name": quote.company.company_name if quote.company else None,
                "status": quote.status.value if quote.status else None,
                "total_price": quote.total_amount,
                "created_at": quote.created_at.isoformat() if quote.created_at else None
            })
        
        # Convert recent companies to dicts
        recent_companies_data = []
        for company in recent_companies:
            recent_companies_data.append({
                "id": company.id,
                "name": company.company_name,
                "status": company.status.value if company.status else None,
                "created_at": company.created_at.isoformat() if company.created_at else None
            })
        
        stats = {
            "companies": {
                "total": total_companies,
                "active": active_companies,
                "pending": total_companies - active_companies
            },
            "products": {
                "total": total_products,
                "active": active_products,
                "inactive": total_products - active_products
            },
            "quotes": {
                "total": total_quotes,
                "pending": pending_quotes
            },
            "recent_quotes": recent_quotes_data,
            "recent_companies": recent_companies_data
        }
        
        logger.info("Retrieved dashboard statistics")
        
        return stats
