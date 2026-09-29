"""
Pricing Calculation Service

Handles dynamic pricing calculations for products with:
- Company-specific pricing tiers
- Product variations
- Custom options/add-ons
- Price breakdowns for transparency
"""

import logging
from datetime import date
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.chair import Chair, CustomOption, ProductVariation
from backend.models.company import Company, CompanyPricing

logger = logging.getLogger(__name__)


class PricingService:
    """Service for calculating product prices with company tiers"""
    
    @staticmethod
    async def calculate_product_price(
        db: AsyncSession,
        product_id: int,
        company_id: Optional[int] = None,
        variation_id: Optional[int] = None,
        custom_option_ids: Optional[list[int]] = None
    ) -> dict:
        """
        Calculate final product price with all adjustments
        
        Args:
            db: Database session
            product_id: Product ID
            company_id: Company ID for pricing tier (optional)
            variation_id: Specific variation ID (optional)
            custom_option_ids: List of custom option IDs (optional)
            
        Returns:
            dict with:
                - final_price (int): Final price in cents
                - breakdown (dict): Price breakdown
                - currency (str): Currency code
        """
        # Get base product
        stmt = select(Chair).where(Chair.id == product_id)
        result = await db.execute(stmt)
        product = result.scalar_one_or_none()
        
        if not product:
            raise ValueError(f"Product {product_id} not found")
        
        # Start with base price (in cents)
        base_price = product.base_price or 0
        breakdown = {
            "base_price": base_price,
            "company_tier_adjustment": 0,
            "company_tier_percentage": 0,
            "variation_adjustment": 0,
            "custom_options_total": 0,
            "custom_options": []
        }
        
        # Apply company pricing tier
        if company_id:
            tier_adjustment, tier_percentage = await PricingService._get_company_tier_adjustment(
                db, company_id, product.category_id, base_price
            )
            breakdown["company_tier_adjustment"] = tier_adjustment
            breakdown["company_tier_percentage"] = tier_percentage
        
        # Apply variation adjustment
        if variation_id:
            variation_adjustment = await PricingService._get_variation_adjustment(
                db, variation_id
            )
            breakdown["variation_adjustment"] = variation_adjustment
        
        # Apply custom options
        if custom_option_ids:
            options_total, options_list = await PricingService._get_custom_options_total(
                db, custom_option_ids, product.category_id
            )
            breakdown["custom_options_total"] = options_total
            breakdown["custom_options"] = options_list
        
        # Calculate final price
        final_price = (
            base_price +
            breakdown["company_tier_adjustment"] +
            breakdown["variation_adjustment"] +
            breakdown["custom_options_total"]
        )
        
        return {
            "final_price": final_price,
            "final_price_dollars": round(final_price / 100, 2),
            "breakdown": breakdown,
            "currency": "USD"
        }
    
    @staticmethod
    async def _get_company_tier_adjustment(
        db: AsyncSession,
        company_id: int,
        product_category_id: int,
        base_price: int
    ) -> tuple[int, int]:
        """
        Get company pricing tier adjustment
        
        Returns:
            tuple: (adjustment_in_cents, percentage)
        """
        pricing_tier = await PricingService._get_active_company_tier(db, company_id)
        return PricingService._compute_tier_adjustment(
            pricing_tier, product_category_id, base_price, company_id
        )

    @staticmethod
    async def _get_active_company_tier(
        db: AsyncSession,
        company_id: int
    ) -> Optional[CompanyPricing]:
        """
        Load the company's pricing tier if it is active and within its date range.

        Returns None when no tier applies. Load once and pass to
        _compute_tier_adjustment() when pricing many products.
        """
        stmt = (
            select(CompanyPricing)
            .join(Company, Company.pricing_tier_id == CompanyPricing.id)
            .where(Company.id == company_id)
        )
        result = await db.execute(stmt)
        pricing_tier = result.scalars().first()
        
        if not pricing_tier:  # No pricing tier assigned
            return None
        
        # Check if pricing tier is active and within date range
        today = date.today()
        if not pricing_tier.is_active:
            return None
        
        if pricing_tier.effective_from and pricing_tier.effective_from > today:
            return None
            
        if pricing_tier.expires_at and pricing_tier.expires_at < today:
            return None
        
        return pricing_tier

    @staticmethod
    def _compute_tier_adjustment(
        pricing_tier: Optional[CompanyPricing],
        product_category_id: int,
        base_price: int,
        company_id: Optional[int] = None
    ) -> tuple[int, int]:
        """
        Compute the tier adjustment for one product (no DB access).
        
        Returns:
            tuple: (adjustment_in_cents, percentage)
        """
        if not pricing_tier:
            return 0, 0
        
        # Check if applies to this product category
        if not pricing_tier.applies_to_all_products:
            specific_categories = pricing_tier.specific_categories or []
            if product_category_id not in specific_categories:
                return 0, 0
        
        # Calculate adjustment (percentage is stored as integer, e.g., 10 = 10%)
        percentage = pricing_tier.percentage_adjustment
        adjustment = round((base_price * percentage) / 100)
        
        logger.debug(
            f"Company {company_id} pricing tier '{pricing_tier.pricing_tier_name}': "
            f"{percentage}% = ${adjustment/100:.2f} on ${base_price/100:.2f}"
        )
        
        return adjustment, percentage
    
    @staticmethod
    async def _get_variation_adjustment(
        db: AsyncSession,
        variation_id: int
    ) -> int:
        """Get price adjustment for specific variation"""
        stmt = select(ProductVariation).where(ProductVariation.id == variation_id)
        result = await db.execute(stmt)
        variation = result.scalar_one_or_none()
        
        if not variation:
            logger.warning(f"Variation {variation_id} not found")
            return 0
        
        return variation.price_adjustment or 0
    
    @staticmethod
    async def _get_custom_options_total(
        db: AsyncSession,
        option_ids: list[int],
        product_category_id: int
    ) -> tuple[int, list[dict]]:
        """
        Get total cost of custom options
        
        Returns:
            tuple: (total_cost, list of option details)
        """
        stmt = select(CustomOption).where(CustomOption.id.in_(option_ids))
        result = await db.execute(stmt)
        options = result.scalars().all()
        
        total_cost = 0
        options_list = []
        
        for option in options:
            # Check if option is active
            if not option.is_active:
                logger.warning(f"Skipping inactive option: {option.name}")
                continue
            
            # Check if option applies to this product category
            applicable_categories = option.applicable_categories or []
            if applicable_categories and product_category_id not in applicable_categories:
                logger.warning(
                    f"Option '{option.name}' not applicable to category {product_category_id}"
                )
                continue
            
            total_cost += option.price_adjustment
            options_list.append({
                "id": option.id,
                "name": option.name,
                "option_code": option.option_code,
                "price_adjustment": option.price_adjustment,
                "requires_quote": option.requires_quote
            })
        
        return total_cost, options_list
    
    @staticmethod
    async def get_product_price_range(
        db: AsyncSession,
        product_id: int,
        company_id: Optional[int] = None
    ) -> dict:
        """
        Get price range for product (min/max based on variations)
        
        Useful for product listings to show price ranges
        """
        # Get base product
        stmt = select(Chair).where(Chair.id == product_id)
        result = await db.execute(stmt)
        product = result.scalar_one_or_none()
        
        if not product:
            raise ValueError(f"Product {product_id} not found")
        
        # Get all variations
        variations_stmt = (
            select(ProductVariation)
            .where(ProductVariation.product_id == product_id)
            .where(ProductVariation.is_available == True)
        )
        variations_result = await db.execute(variations_stmt)
        variations = variations_result.scalars().all()
        
        # Calculate base price with company tier (product already loaded)
        base_price = product.base_price or 0
        base_final = base_price
        if company_id:
            tier_adjustment, _ = await PricingService._get_company_tier_adjustment(
                db, company_id, product.category_id, base_price
            )
            base_final += tier_adjustment
        
        if not variations:
            # No variations, return single price
            return {
                "min_price": base_final,
                "max_price": base_final,
                "min_price_dollars": round(base_final / 100, 2),
                "max_price_dollars": round(base_final / 100, 2),
                "has_variations": False,
                "currency": "USD"
            }
        
        # Calculate prices with each variation (variation price is the base
        # final price plus its adjustment; no per-variation queries needed)
        prices = [base_final]
        for variation in variations:
            prices.append(base_final + (variation.price_adjustment or 0))
        
        min_price = min(prices)
        max_price = max(prices)
        
        return {
            "min_price": min_price,
            "max_price": max_price,
            "min_price_dollars": round(min_price / 100, 2),
            "max_price_dollars": round(max_price / 100, 2),
            "has_variations": True,
            "variation_count": len(variations),
            "currency": "USD"
        }
