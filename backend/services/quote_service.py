"""
Quote Service

Handles quote requests, cart operations, and saved configurations
"""

import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload

from backend.models.quote import (
    Quote,
    QuoteItem,
    Cart,
    CartItem,
    SavedConfiguration,
    QuoteStatus
)
from backend.models.chair import Chair
from backend.models.company import Company
from backend.core.exceptions import (
    ResourceNotFoundError,
    ValidationError,
    BusinessLogicError,
    AuthorizationError,
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

