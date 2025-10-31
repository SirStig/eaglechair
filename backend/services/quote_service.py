"""
Quote Service

Handles quote requests, cart operations, and saved configurations
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.core.exceptions import (
    AuthorizationError,
    BusinessLogicError,
    ResourceNotFoundError,
    ValidationError,
)
from backend.models.chair import Chair
from backend.models.company import Company
from backend.models.quote import (
    Cart,
    CartItem,
    Quote,
    QuoteAttachment,
    QuoteHistory,
    QuoteItem,
    QuoteStatus,
    SavedConfiguration,
)

logger = logging.getLogger(__name__)


class QuoteService:
    """Service for quote and cart operations"""
    
    # ========================================================================
    # Cart Operations
    # ========================================================================
    
    @staticmethod
    async def get_or_create_cart(
        db: AsyncSession,
        company_id: int
    ) -> Cart:
        """
        Get active cart for company or create new one
        
        Args:
            db: Database session
            company_id: Company ID
            
        Returns:
            Cart instance
        """
        # Check for existing active cart
        result = await db.execute(
            select(Cart)
            .where(
                and_(
                    Cart.company_id == company_id,
                    Cart.is_active == True
                )
            )
        )
        cart = result.scalar_one_or_none()
        
        if not cart:
            # Create new cart
            cart = Cart(company_id=company_id)
            db.add(cart)
            await db.commit()
            await db.refresh(cart)
            logger.info(f"Created new cart for company {company_id}: Cart ID {cart.id}")
        
        return cart
    
    @staticmethod
    async def get_cart_with_items(
        db: AsyncSession,
        cart_id: int,
        company_id: int
    ) -> Cart:
        """
        Get cart with items, ensuring it belongs to the company
        
        Args:
            db: Database session
            cart_id: Cart ID
            company_id: Company ID (for authorization)
            
        Returns:
            Cart with items
            
        Raises:
            ResourceNotFoundError: If cart not found
            AuthorizationError: If cart doesn't belong to company
        """
        result = await db.execute(
            select(Cart)
            .options(
                selectinload(Cart.items).selectinload(CartItem.product)
            )
            .where(Cart.id == cart_id)
        )
        cart = result.scalar_one_or_none()
        
        if not cart:
            raise ResourceNotFoundError(resource_type="Cart", resource_id=cart_id)
        
        if cart.company_id != company_id:
            logger.warning(
                f"Company {company_id} attempted to access cart {cart_id} "
                f"belonging to company {cart.company_id}"
            )
            raise AuthorizationError("You don't have permission to access this cart")
        
        return cart
    
    @staticmethod
    async def add_to_cart(
        db: AsyncSession,
        company_id: int,
        product_id: int,
        quantity: int,
        selected_finish_id: Optional[int] = None,
        selected_upholstery_id: Optional[int] = None,
        custom_notes: Optional[str] = None,
        configuration: Optional[Dict[str, Any]] = None
    ) -> CartItem:
        """
        Add item to cart
        
        Args:
            db: Database session
            company_id: Company ID
            product_id: Product ID
            quantity: Quantity
            selected_finish_id: Optional finish selection
            selected_upholstery_id: Optional upholstery selection
            custom_notes: Optional custom notes
            configuration: Optional configuration details
            
        Returns:
            Created cart item
            
        Raises:
            ResourceNotFoundError: If product not found
            ValidationError: If quantity invalid
        """
        # Validate quantity
        if quantity < 1:
            raise ValidationError("Quantity must be at least 1")
        
        # Verify product exists
        result = await db.execute(
            select(Chair).where(Chair.id == product_id)
        )
        product = result.scalar_one_or_none()
        
        if not product:
            raise ResourceNotFoundError(resource_type="Product", resource_id=product_id)
        
        if not product.is_active:
            raise BusinessLogicError("This product is no longer available")
        
        # Check minimum order quantity
        if quantity < product.minimum_order_quantity:
            raise ValidationError(
                f"Minimum order quantity for this product is {product.minimum_order_quantity}"
            )
        
        # Get or create cart
        cart = await QuoteService.get_or_create_cart(db, company_id)
        
        # Check if item already exists in cart
        result = await db.execute(
            select(CartItem).where(
                and_(
                    CartItem.cart_id == cart.id,
                    CartItem.product_id == product_id,
                    CartItem.selected_finish_id == selected_finish_id,
                    CartItem.selected_upholstery_id == selected_upholstery_id
                )
            )
        )
        existing_item = result.scalar_one_or_none()
        
        if existing_item:
            # Update existing item
            existing_item.quantity += quantity
            if custom_notes:
                existing_item.custom_notes = custom_notes
            if configuration:
                existing_item.configuration = configuration
            
            await db.commit()
            await db.refresh(existing_item)
            
            logger.info(
                f"Updated cart item {existing_item.id}: new quantity {existing_item.quantity}"
            )
            
            return existing_item
        else:
            # Create new cart item
            cart_item = CartItem(
                cart_id=cart.id,
                product_id=product_id,
                quantity=quantity,
                unit_price=product.base_price,
                selected_finish_id=selected_finish_id,
                selected_upholstery_id=selected_upholstery_id,
                custom_notes=custom_notes,
                configuration=configuration
            )
            
            db.add(cart_item)
            await db.commit()
            await db.refresh(cart_item)
            
            logger.info(
                f"Added item to cart {cart.id}: Product {product_id}, "
                f"Quantity {quantity}"
            )
            
            return cart_item
    
    @staticmethod
    async def update_cart_item(
        db: AsyncSession,
        cart_item_id: int,
        company_id: int,
        quantity: Optional[int] = None,
        selected_finish_id: Optional[int] = None,
        selected_upholstery_id: Optional[int] = None,
        custom_notes: Optional[str] = None
    ) -> CartItem:
        """
        Update cart item
        
        Args:
            db: Database session
            cart_item_id: Cart item ID
            company_id: Company ID (for authorization)
            quantity: New quantity
            selected_finish_id: New finish
            selected_upholstery_id: New upholstery
            custom_notes: New notes
            
        Returns:
            Updated cart item
            
        Raises:
            ResourceNotFoundError: If item not found
            AuthorizationError: If item doesn't belong to company
        """
        # Get cart item with cart
        result = await db.execute(
            select(CartItem)
            .options(selectinload(CartItem.cart), selectinload(CartItem.product))
            .where(CartItem.id == cart_item_id)
        )
        cart_item = result.scalar_one_or_none()
        
        if not cart_item:
            raise ResourceNotFoundError(resource_type="Cart Item", resource_id=cart_item_id)
        
        if cart_item.cart.company_id != company_id:
            raise AuthorizationError("You don't have permission to modify this item")
        
        # Update fields
        if quantity is not None:
            if quantity < 1:
                raise ValidationError("Quantity must be at least 1")
            
            # Check minimum order quantity
            if quantity < cart_item.product.minimum_order_quantity:
                raise ValidationError(
                    f"Minimum order quantity for this product is "
                    f"{cart_item.product.minimum_order_quantity}"
                )
            
            cart_item.quantity = quantity
        
        if selected_finish_id is not None:
            cart_item.selected_finish_id = selected_finish_id
        
        if selected_upholstery_id is not None:
            cart_item.selected_upholstery_id = selected_upholstery_id
        
        if custom_notes is not None:
            cart_item.custom_notes = custom_notes
        
        await db.commit()
        await db.refresh(cart_item)
        
        logger.info(f"Updated cart item {cart_item_id}")
        
        return cart_item
    
    @staticmethod
    async def remove_from_cart(
        db: AsyncSession,
        cart_item_id: int,
        company_id: int
    ) -> bool:
        """
        Remove item from cart
        
        Args:
            db: Database session
            cart_item_id: Cart item ID
            company_id: Company ID (for authorization)
            
        Returns:
            True if successful
            
        Raises:
            ResourceNotFoundError: If item not found
            AuthorizationError: If item doesn't belong to company
        """
        # Get cart item with cart
        result = await db.execute(
            select(CartItem)
            .options(selectinload(CartItem.cart))
            .where(CartItem.id == cart_item_id)
        )
        cart_item = result.scalar_one_or_none()
        
        if not cart_item:
            raise ResourceNotFoundError(resource_type="Cart Item", resource_id=cart_item_id)
        
        if cart_item.cart.company_id != company_id:
            raise AuthorizationError("You don't have permission to remove this item")
        
        await db.delete(cart_item)
        await db.commit()
        
        logger.info(f"Removed cart item {cart_item_id}")
        
        return True
    
    @staticmethod
    async def clear_cart(
        db: AsyncSession,
        cart_id: int,
        company_id: int
    ) -> bool:
        """
        Clear all items from cart
        
        Args:
            db: Database session
            cart_id: Cart ID
            company_id: Company ID (for authorization)
            
        Returns:
            True if successful
        """
        # Verify cart ownership
        cart = await QuoteService.get_cart_with_items(db, cart_id, company_id)
        
        # Delete all items
        for item in cart.items:
            await db.delete(item)
        
        await db.commit()
        
        logger.info(f"Cleared cart {cart_id}")
        
        return True
    
    @staticmethod
    async def merge_guest_cart(
        db: AsyncSession,
        company_id: int,
        guest_items: List[Dict[str, Any]]
    ) -> Cart:
        """
        Merge guest cart items into authenticated cart
        
        Args:
            db: Database session
            company_id: Company ID
            guest_items: List of guest cart items to merge
            
        Returns:
            Updated cart with merged items
        """
        # Get or create cart
        cart = await QuoteService.get_or_create_cart(db, company_id)
        
        # Add each guest item to the cart
        for item_data in guest_items:
            try:
                await QuoteService.add_to_cart(
                    db=db,
                    company_id=company_id,
                    product_id=item_data.product_id,
                    quantity=item_data.quantity,
                    selected_finish_id=item_data.selected_finish_id,
                    selected_upholstery_id=item_data.selected_upholstery_id,
                    custom_notes=item_data.item_notes,
                    configuration=item_data.custom_options
                )
            except Exception as e:
                logger.error(f"Error merging guest item {item_data.product_id}: {e}")
                # Continue with other items even if one fails
                continue
        
        # Reload cart with items
        cart = await QuoteService.get_cart_with_items(db, cart.id, company_id)
        
        logger.info(f"Merged {len(guest_items)} guest items into cart {cart.id}")
        
        return cart
    
    # ========================================================================
    # Quote Request Operations
    # ========================================================================
    
    @staticmethod
    async def create_quote_request(
        db: AsyncSession,
        company_id: int,
        cart_id: int,
        delivery_address: str,
        delivery_city: str,
        delivery_state: str,
        delivery_zip: str,
        requested_delivery_date: Optional[str] = None,
        special_instructions: Optional[str] = None
    ) -> Quote:
        """
        Convert cart to quote request
        
        Args:
            db: Database session
            company_id: Company ID
            cart_id: Cart ID to convert
            delivery_address: Delivery address
            delivery_city: City
            delivery_state: State
            delivery_zip: ZIP code
            requested_delivery_date: Optional requested delivery date
            special_instructions: Optional special instructions
            
        Returns:
            Created quote request
            
        Raises:
            ValidationError: If cart is empty
        """
        # Get cart with items
        cart = await QuoteService.get_cart_with_items(db, cart_id, company_id)
        
        if not cart.items:
            raise ValidationError("Cannot create quote request from empty cart")
        
        # Generate quote number
        quote_number = await QuoteService._generate_quote_number(db)
        
        # Create quote request
        quote_request = Quote(
            quote_number=quote_number,
            company_id=company_id,
            status=QuoteStatus.PENDING,
            delivery_address=delivery_address,
            delivery_city=delivery_city,
            delivery_state=delivery_state,
            delivery_zip=delivery_zip,
            requested_delivery_date=requested_delivery_date,
            special_instructions=special_instructions
        )
        
        db.add(quote_request)
        await db.flush()  # Get quote_request.id
        
        # Convert cart items to quote items
        for cart_item in cart.items:
            quote_item = QuoteItem(
                quote_request_id=quote_request.id,
                product_id=cart_item.product_id,
                quantity=cart_item.quantity,
                unit_price=cart_item.unit_price,
                selected_finish_id=cart_item.selected_finish_id,
                selected_upholstery_id=cart_item.selected_upholstery_id,
                custom_notes=cart_item.custom_notes,
                configuration=cart_item.configuration
            )
            db.add(quote_item)
        
        # Mark cart as inactive
        cart.is_active = False
        
        await db.commit()
        await db.refresh(quote_request)
        
        logger.info(
            f"Created quote request {quote_number} for company {company_id} "
            f"with {len(cart.items)} items"
        )
        
        return quote_request
    
    @staticmethod
    async def get_company_quotes(
        db: AsyncSession,
        company_id: int,
        status: Optional[QuoteStatus] = None
    ) -> List[Quote]:
        """
        Get all quote requests for a company
        
        Args:
            db: Database session
            company_id: Company ID
            status: Optional status filter
            
        Returns:
            List of quote requests
        """
        query = (
            select(Quote)
            .options(selectinload(Quote.items))
            .where(Quote.company_id == company_id)
        )
        
        if status:
            query = query.where(Quote.status == status)
        
        query = query.order_by(Quote.created_at.desc())
        
        result = await db.execute(query)
        quotes = result.scalars().all()
        
        logger.info(f"Retrieved {len(quotes)} quotes for company {company_id}")
        
        return list(quotes)
    
    @staticmethod
    async def get_quote_by_id(
        db: AsyncSession,
        quote_id: int,
        company_id: int
    ) -> Quote:
        """
        Get quote request by ID
        
        Args:
            db: Database session
            quote_id: Quote request ID
            company_id: Company ID (for authorization)
            
        Returns:
            Quote request
            
        Raises:
            ResourceNotFoundError: If quote not found
            AuthorizationError: If quote doesn't belong to company
        """
        result = await db.execute(
            select(Quote)
            .options(
                selectinload(Quote.items).selectinload(QuoteItem.product),
                selectinload(Quote.company)
            )
            .where(Quote.id == quote_id)
        )
        quote = result.scalar_one_or_none()
        
        if not quote:
            raise ResourceNotFoundError(resource_type="Quote", resource_id=quote_id)
        
        if quote.company_id != company_id:
            raise AuthorizationError("You don't have permission to view this quote")
        
        return quote
    
    # ========================================================================
    # Helper Methods
    # ========================================================================
    
    @staticmethod
    async def _generate_quote_number(db: AsyncSession) -> str:
        """
        Generate unique quote number
        
        Format: Q-YYYYMMDD-XXXXX
        
        Args:
            db: Database session
            
        Returns:
            Quote number
        """
        today = datetime.utcnow().strftime("%Y%m%d")
        
        # Get count of quotes created today
        result = await db.execute(
            select(Quote)
            .where(Quote.quote_number.like(f"Q-{today}-%"))
        )
        count = len(result.scalars().all())
        
        # Generate number
        quote_number = f"Q-{today}-{count + 1:05d}"
        
        return quote_number
    
    # ========================================================================
    # Quote Management (Admin & Customer)
    # ========================================================================
    
    @staticmethod
    async def update_quote_status(
        db: AsyncSession,
        quote_id: int,
        new_status: QuoteStatus,
        admin_id: Optional[int] = None,
        notes: Optional[str] = None
    ) -> Quote:
        """
        Update quote status with history tracking
        
        Args:
            db: Database session
            quote_id: Quote ID
            new_status: New status
            admin_id: Admin making the change (if applicable)
            notes: Notes about the status change
            
        Returns:
            Updated quote
        """
        result = await db.execute(
            select(Quote).where(Quote.id == quote_id)
        )
        quote = result.scalar_one_or_none()
        
        if not quote:
            raise ResourceNotFoundError(resource_type="Quote", resource_id=quote_id)
        
        old_status = quote.status
        quote.status = new_status
        
        # Update timestamps based on status
        now = datetime.utcnow().isoformat()
        if new_status == QuoteStatus.SUBMITTED:
            quote.submitted_at = now
        elif new_status == QuoteStatus.QUOTED:
            quote.quoted_at = now
        elif new_status == QuoteStatus.ACCEPTED:
            quote.accepted_at = now
        
        # Add to history
        history = QuoteHistory(
            quote_id=quote_id,
            action="status_changed",
            old_status=old_status.value if old_status else None,
            new_status=new_status.value,
            changed_by_type="admin" if admin_id else "system",
            changed_by_id=admin_id,
            notes=notes,
            changed_at=now
        )
        db.add(history)
        
        await db.commit()
        await db.refresh(quote)
        
        logger.info(f"Quote {quote_id} status changed from {old_status} to {new_status}")
        return quote
    
    @staticmethod
    async def update_quote_pricing(
        db: AsyncSession,
        quote_id: int,
        quoted_price: int,
        lead_time: Optional[str] = None,
        notes: Optional[str] = None,
        valid_until: Optional[str] = None,
        admin_id: Optional[int] = None
    ) -> Quote:
        """
        Update quote with pricing information (admin only)
        
        Args:
            db: Database session
            quote_id: Quote ID
            quoted_price: Final quoted price in cents
            lead_time: Estimated lead time
            notes: Quote notes
            valid_until: Quote expiration date
            admin_id: Admin ID
            
        Returns:
            Updated quote
        """
        result = await db.execute(
            select(Quote).where(Quote.id == quote_id)
        )
        quote = result.scalar_one_or_none()
        
        if not quote:
            raise ResourceNotFoundError(resource_type="Quote", resource_id=quote_id)
        
        quote.quoted_price = quoted_price
        quote.quoted_lead_time = lead_time
        quote.quote_notes = notes
        quote.quote_valid_until = valid_until
        quote.quoted_at = datetime.utcnow().isoformat()
        
        # Update status to QUOTED if not already
        if quote.status != QuoteStatus.QUOTED:
            await QuoteService.update_quote_status(
                db, quote_id, QuoteStatus.QUOTED, admin_id, "Quote pricing provided"
            )
        
        await db.commit()
        await db.refresh(quote)
        
        logger.info(f"Quote {quote_id} pricing updated")
        return quote
    
    @staticmethod
    async def add_quote_attachment(
        db: AsyncSession,
        quote_id: int,
        file_name: str,
        file_url: str,
        file_type: str,
        file_size_bytes: int,
        description: Optional[str] = None,
        attachment_type: str = "general",
        uploaded_by: str = "company"
    ) -> QuoteAttachment:
        """
        Add attachment to quote
        
        Args:
            db: Database session
            quote_id: Quote ID
            file_name: File name
            file_url: URL to the file
            file_type: MIME type
            file_size_bytes: File size in bytes
            description: Description of the attachment
            attachment_type: Type of attachment
            uploaded_by: Who uploaded (company or admin)
            
        Returns:
            Created attachment
        """
        attachment = QuoteAttachment(
            quote_id=quote_id,
            file_name=file_name,
            file_url=file_url,
            file_type=file_type,
            file_size_bytes=file_size_bytes,
            description=description,
            attachment_type=attachment_type,
            uploaded_by=uploaded_by,
            uploaded_at=datetime.utcnow().isoformat()
        )
        
        db.add(attachment)
        await db.commit()
        await db.refresh(attachment)
        
        logger.info(f"Attachment added to quote {quote_id}: {file_name}")
        return attachment
    
    @staticmethod
    async def get_quote_attachments(
        db: AsyncSession,
        quote_id: int
    ) -> List[QuoteAttachment]:
        """Get all attachments for a quote"""
        result = await db.execute(
            select(QuoteAttachment)
            .where(QuoteAttachment.quote_id == quote_id)
            .order_by(QuoteAttachment.uploaded_at.desc())
        )
        return list(result.scalars().all())
    
    @staticmethod
    async def delete_quote_attachment(
        db: AsyncSession,
        attachment_id: int,
        quote_id: int
    ) -> None:
        """Delete a quote attachment"""
        result = await db.execute(
            select(QuoteAttachment).where(
                QuoteAttachment.id == attachment_id,
                QuoteAttachment.quote_id == quote_id
            )
        )
        attachment = result.scalar_one_or_none()
        
        if not attachment:
            raise ResourceNotFoundError(resource_type="Attachment", resource_id=attachment_id)
        
        await db.delete(attachment)
        await db.commit()
        
        logger.info(f"Deleted attachment {attachment_id} from quote {quote_id}")
    
    @staticmethod
    async def get_quote_history(
        db: AsyncSession,
        quote_id: int
    ) -> List[QuoteHistory]:
        """Get full history for a quote"""
        result = await db.execute(
            select(QuoteHistory)
            .where(QuoteHistory.quote_id == quote_id)
            .order_by(QuoteHistory.changed_at.desc())
        )
        return list(result.scalars().all())
    
    @staticmethod
    async def add_quote_note(
        db: AsyncSession,
        quote_id: int,
        notes: str,
        note_type: str = "admin",
        added_by_id: Optional[int] = None,
        added_by_name: Optional[str] = None
    ) -> QuoteHistory:
        """Add a note to quote history"""
        history = QuoteHistory(
            quote_id=quote_id,
            action="note_added",
            notes=notes,
            changed_by_type=note_type,
            changed_by_id=added_by_id,
            changed_by_name=added_by_name,
            changed_at=datetime.utcnow().isoformat()
        )
        
        db.add(history)
        await db.commit()
        await db.refresh(history)
        
        return history
    
    @staticmethod
    async def get_all_quotes(
        db: AsyncSession,
        status: Optional[QuoteStatus] = None,
        company_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 50,
        sort_by: str = "created_at",
        sort_desc: bool = True
    ) -> tuple[List[Quote], int]:
        """
        Get all quotes with filtering and pagination (admin)
        
        Args:
            db: Database session
            status: Filter by status
            company_id: Filter by company
            skip: Pagination offset
            limit: Page size
            sort_by: Sort field
            sort_desc: Sort descending
            
        Returns:
            Tuple of (quotes list, total count)
        """
        query = select(Quote).options(
            selectinload(Quote.items),
            selectinload(Quote.company)
        )
        
        if status:
            query = query.where(Quote.status == status)
        
        if company_id:
            query = query.where(Quote.company_id == company_id)
        
        # Get total count
        count_result = await db.execute(
            select(Quote).where(*query.whereclause.clauses if query.whereclause else [])
        )
        total = len(count_result.scalars().all())
        
        # Apply sorting
        if sort_desc:
            query = query.order_by(getattr(Quote, sort_by).desc())
        else:
            query = query.order_by(getattr(Quote, sort_by))
        
        # Apply pagination
        query = query.offset(skip).limit(limit)
        
        result = await db.execute(query)
        quotes = list(result.scalars().all())
        
        return quotes, total
    
    @staticmethod
    async def accept_quote(
        db: AsyncSession,
        quote_id: int,
        company_id: int
    ) -> Quote:
        """Customer accepts a quote"""
        result = await db.execute(
            select(Quote).where(
                Quote.id == quote_id,
                Quote.company_id == company_id
            )
        )
        quote = result.scalar_one_or_none()
        
        if not quote:
            raise ResourceNotFoundError(resource_type="Quote", resource_id=quote_id)
        
        if quote.status != QuoteStatus.QUOTED:
            raise BusinessLogicError("Can only accept quotes in QUOTED status")
        
        quote.status = QuoteStatus.ACCEPTED
        quote.accepted_at = datetime.utcnow().isoformat()
        
        # Add to history
        history = QuoteHistory(
            quote_id=quote_id,
            action="quote_accepted",
            old_status=QuoteStatus.QUOTED.value,
            new_status=QuoteStatus.ACCEPTED.value,
            changed_by_type="company",
            changed_by_id=company_id,
            changed_at=datetime.utcnow().isoformat()
        )
        db.add(history)
        
        await db.commit()
        await db.refresh(quote)
        
        logger.info(f"Quote {quote_id} accepted by company {company_id}")
        return quote
    
    @staticmethod
    async def decline_quote(
        db: AsyncSession,
        quote_id: int,
        company_id: int,
        reason: Optional[str] = None
    ) -> Quote:
        """Customer declines a quote"""
        result = await db.execute(
            select(Quote).where(
                Quote.id == quote_id,
                Quote.company_id == company_id
            )
        )
        quote = result.scalar_one_or_none()
        
        if not quote:
            raise ResourceNotFoundError(resource_type="Quote", resource_id=quote_id)
        
        quote.status = QuoteStatus.DECLINED
        
        # Add to history
        history = QuoteHistory(
            quote_id=quote_id,
            action="quote_declined",
            old_status=quote.status.value,
            new_status=QuoteStatus.DECLINED.value,
            changed_by_type="company",
            changed_by_id=company_id,
            notes=reason,
            changed_at=datetime.utcnow().isoformat()
        )
        db.add(history)
        
        await db.commit()
        await db.refresh(quote)
        
        logger.info(f"Quote {quote_id} declined by company {company_id}")
        return quote

