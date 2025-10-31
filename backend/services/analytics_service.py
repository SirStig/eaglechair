"""
Analytics Service

Handles analytics tracking and dashboard statistics
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.models.chair import Category, Chair
from backend.models.company import Company, CompanyStatus
from backend.models.content import FAQ, Catalog, Installation
from backend.models.quote import Quote, QuoteItem, QuoteStatus

logger = logging.getLogger(__name__)


class AnalyticsService:
    """Service for analytics and statistics"""
    
    @staticmethod
    async def get_dashboard_stats(db: AsyncSession) -> Dict[str, Any]:
        """
        Get comprehensive dashboard statistics (admin)
        
        Returns:
            Dictionary with various stats
        """
        stats = {}
        
        # Company Statistics
        total_companies = await db.execute(select(func.count(Company.id)))
        stats['total_companies'] = total_companies.scalar()
        
        pending_companies = await db.execute(
            select(func.count(Company.id)).where(Company.status == CompanyStatus.PENDING)
        )
        stats['pending_companies'] = pending_companies.scalar()
        
        active_companies = await db.execute(
            select(func.count(Company.id)).where(Company.status == CompanyStatus.ACTIVE)
        )
        stats['active_companies'] = active_companies.scalar()
        
        # Quote Statistics
        total_quotes = await db.execute(select(func.count(Quote.id)))
        stats['total_quotes'] = total_quotes.scalar()
        
        pending_quotes = await db.execute(
            select(func.count(Quote.id)).where(
                or_(
                    Quote.status == QuoteStatus.SUBMITTED,
                    Quote.status == QuoteStatus.UNDER_REVIEW
                )
            )
        )
        stats['pending_quotes'] = pending_quotes.scalar()
        
        accepted_quotes = await db.execute(
            select(func.count(Quote.id)).where(Quote.status == QuoteStatus.ACCEPTED)
        )
        stats['accepted_quotes'] = accepted_quotes.scalar()
        
        # Revenue Statistics (from accepted quotes)
        revenue_result = await db.execute(
            select(func.sum(Quote.quoted_price)).where(
                Quote.status == QuoteStatus.ACCEPTED
            )
        )
        stats['total_revenue'] = revenue_result.scalar() or 0
        
        potential_revenue = await db.execute(
            select(func.sum(Quote.quoted_price)).where(
                Quote.status == QuoteStatus.QUOTED
            )
        )
        stats['potential_revenue'] = potential_revenue.scalar() or 0
        
        # Product Statistics
        total_products = await db.execute(select(func.count(Chair.id)))
        stats['total_products'] = total_products.scalar()
        
        active_products = await db.execute(
            select(func.count(Chair.id)).where(Chair.is_active == True)
        )
        stats['active_products'] = active_products.scalar()
        
        # Recent Activity (last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        
        recent_quotes_count = await db.execute(
            select(func.count(Quote.id)).where(Quote.created_at >= thirty_days_ago)
        )
        stats['recent_quotes_30d'] = recent_quotes_count.scalar()
        
        recent_companies_count = await db.execute(
            select(func.count(Company.id)).where(Company.created_at >= thirty_days_ago)
        )
        stats['recent_companies_30d'] = recent_companies_count.scalar()
        
        # Get recent quotes with details (last 5, ordered by created_at desc)
        recent_quotes_result = await db.execute(
            select(Quote)
            .options(selectinload(Quote.company))
            .order_by(desc(Quote.created_at))
            .limit(5)
        )
        recent_quotes = recent_quotes_result.scalars().all()
        
        # Get recent companies with details (last 5, ordered by created_at desc)
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
                "quote_number": quote.quote_number,
                "company_id": quote.company_id,
                "company_name": quote.company.company_name if quote.company else None,
                "status": quote.status.value if quote.status else None,
                "total_amount": quote.total_amount,
                "quoted_price": quote.quoted_price,
                "created_at": quote.created_at.isoformat() if quote.created_at else None,
                "project_name": quote.project_name,
            })
        
        # Convert recent companies to dicts
        recent_companies_data = []
        for company in recent_companies:
            recent_companies_data.append({
                "id": company.id,
                "company_name": company.company_name,
                "rep_email": company.rep_email,
                "status": company.status.value if company.status else None,
                "created_at": company.created_at.isoformat() if company.created_at else None,
            })
        
        stats['recent_quotes'] = recent_quotes_data
        stats['recent_companies'] = recent_companies_data
        
        logger.info("Dashboard stats calculated")
        return stats
    
    @staticmethod
    async def get_popular_products(
        db: AsyncSession,
        limit: int = 10,
        days: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Get most popular products based on quote requests
        
        Args:
            db: Database session
            limit: Number of products to return
            days: Only consider last N days (optional)
            
        Returns:
            List of products with quote counts
        """
        query = (
            select(
                Chair,
                func.count(QuoteItem.id).label('item_quote_count'),
                func.sum(QuoteItem.quantity).label('total_quantity')
            )
            .join(QuoteItem, QuoteItem.product_id == Chair.id)
            .join(Quote, Quote.id == QuoteItem.quote_id)
            .group_by(Chair.id)
            .order_by(desc('item_quote_count'))
            .limit(limit)
        )
        
        if days:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            query = query.where(Quote.created_at >= cutoff_date)
        
        result = await db.execute(query)
        
        popular_products = []
        for chair, item_quote_count, total_quantity in result:
            popular_products.append({
                'product': chair,
                'quote_count': item_quote_count,
                'total_quantity': total_quantity
            })
        
        return popular_products
    
    @staticmethod
    async def get_category_stats(db: AsyncSession) -> List[Dict[str, Any]]:
        """
        Get statistics by product category
        
        Returns:
            List of category stats
        """
        result = await db.execute(
            select(
                Category,
                func.count(Chair.id).label('product_count')
            )
            .outerjoin(Chair, Chair.category_id == Category.id)
            .group_by(Category.id)
            .order_by(desc('product_count'))
        )
        
        category_stats = []
        for category, product_count in result:
            category_stats.append({
                'category': category,
                'product_count': product_count
            })
        
        return category_stats
    
    @staticmethod
    async def get_quote_trends(
        db: AsyncSession,
        days: int = 30
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Get quote trends over time
        
        Args:
            db: Database session
            days: Number of days to analyze
            
        Returns:
            Dictionary with daily quote counts
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Get quotes by status over time
        result = await db.execute(
            select(
                Quote.status,
                func.date(Quote.created_at).label('date'),
                func.count(Quote.id).label('count')
            )
            .where(Quote.created_at >= cutoff_date)
            .group_by(Quote.status, func.date(Quote.created_at))
            .order_by(func.date(Quote.created_at))
        )
        
        trends = {}
        for status, date, count in result:
            if status.value not in trends:
                trends[status.value] = []
            trends[status.value].append({
                'date': date,
                'count': count
            })
        
        return trends
    
    @staticmethod
    async def get_top_customers(
        db: AsyncSession,
        limit: int = 10,
        by: str = 'quote_count'
    ) -> List[Dict[str, Any]]:
        """
        Get top customers by various metrics
        
        Args:
            db: Database session
            limit: Number of customers to return
            by: Metric to sort by ('quote_count', 'total_value', 'accepted_quotes')
            
        Returns:
            List of top customers
        """
        if by == 'quote_count':
            query = (
                select(
                    Company,
                    func.count(Quote.id).label('quote_count')
                )
                .outerjoin(Quote, Quote.company_id == Company.id)
                .group_by(Company.id)
                .order_by(desc('quote_count'))
                .limit(limit)
            )
        elif by == 'total_value':
            query = (
                select(
                    Company,
                    func.sum(Quote.quoted_price).label('total_value')
                )
                .outerjoin(Quote, Quote.company_id == Company.id)
                .where(Quote.status.in_([QuoteStatus.ACCEPTED, QuoteStatus.QUOTED]))
                .group_by(Company.id)
                .order_by(desc('total_value'))
                .limit(limit)
            )
        else:  # accepted_quotes
            query = (
                select(
                    Company,
                    func.count(Quote.id).label('accepted_count')
                )
                .outerjoin(Quote, Quote.company_id == Company.id)
                .where(Quote.status == QuoteStatus.ACCEPTED)
                .group_by(Company.id)
                .order_by(desc('accepted_count'))
                .limit(limit)
            )
        
        result = await db.execute(query)
        
        top_customers = []
        for company, metric_value in result:
            top_customers.append({
                'company': company,
                'metric_value': metric_value
            })
        
        return top_customers
    
    @staticmethod
    async def get_conversion_rates(db: AsyncSession) -> Dict[str, float]:
        """
        Calculate various conversion rates
        
        Returns:
            Dictionary with conversion rates
        """
        rates = {}
        
        # Total quotes
        total_quotes = await db.execute(select(func.count(Quote.id)))
        total = total_quotes.scalar() or 0
        
        if total > 0:
            # Quote to Accepted rate
            accepted = await db.execute(
                select(func.count(Quote.id)).where(Quote.status == QuoteStatus.ACCEPTED)
            )
            rates['quote_to_accepted'] = (accepted.scalar() or 0) / total * 100
            
            # Quote to Declined rate
            declined = await db.execute(
                select(func.count(Quote.id)).where(Quote.status == QuoteStatus.DECLINED)
            )
            rates['quote_to_declined'] = (declined.scalar() or 0) / total * 100
            
            # Quotes awaiting response
            pending = await db.execute(
                select(func.count(Quote.id)).where(
                    Quote.status.in_([QuoteStatus.SUBMITTED, QuoteStatus.UNDER_REVIEW])
                )
            )
            rates['pending_rate'] = (pending.scalar() or 0) / total * 100
        else:
            rates['quote_to_accepted'] = 0
            rates['quote_to_declined'] = 0
            rates['pending_rate'] = 0
        
        return rates
    
    @staticmethod
    async def get_content_stats(db: AsyncSession) -> Dict[str, Any]:
        """
        Get content engagement statistics
        
        Returns:
            Dictionary with content stats
        """
        stats = {}
        
        # FAQ views
        faq_views = await db.execute(select(func.sum(FAQ.view_count)))
        stats['total_faq_views'] = faq_views.scalar() or 0
        
        # Catalog downloads
        catalog_downloads = await db.execute(select(func.sum(Catalog.download_count)))
        stats['total_catalog_downloads'] = catalog_downloads.scalar() or 0
        
        # Installation guide downloads
        installation_downloads = await db.execute(select(func.sum(Installation.download_count)))
        stats['total_installation_downloads'] = installation_downloads.scalar() or 0
        
        # Most viewed FAQs
        top_faqs = await db.execute(
            select(FAQ)
            .where(FAQ.is_active == True)
            .order_by(desc(FAQ.view_count))
            .limit(5)
        )
        stats['top_faqs'] = list(top_faqs.scalars().all())
        
        # Most downloaded catalogs
        top_catalogs = await db.execute(
            select(Catalog)
            .where(Catalog.is_active == True)
            .order_by(desc(Catalog.download_count))
            .limit(5)
        )
        stats['top_catalogs'] = list(top_catalogs.scalars().all())
        
        return stats
    
    @staticmethod
    async def track_product_view(
        db: AsyncSession,
        product_id: int
    ) -> None:
        """
        Track a product view (increment view count)
        
        Args:
            db: Database session
            product_id: Product ID
        """
        result = await db.execute(
            select(Chair).where(Chair.id == product_id)
        )
        product = result.scalar_one_or_none()
        
        if product:
            product.view_count = (product.view_count or 0) + 1
            await db.commit()
            logger.debug(f"Tracked view for product {product_id}")
    
    @staticmethod
    async def get_average_quote_value(db: AsyncSession) -> Dict[str, int]:
        """
        Calculate average quote values
        
        Returns:
            Dictionary with average values
        """
        # Average total amount
        avg_total = await db.execute(
            select(func.avg(Quote.total_amount))
        )
        
        # Average quoted price
        avg_quoted = await db.execute(
            select(func.avg(Quote.quoted_price)).where(Quote.quoted_price.isnot(None))
        )
        
        # Average for accepted quotes
        avg_accepted = await db.execute(
            select(func.avg(Quote.quoted_price)).where(Quote.status == QuoteStatus.ACCEPTED)
        )
        
        return {
            'average_total_amount': int(avg_total.scalar() or 0),
            'average_quoted_price': int(avg_quoted.scalar() or 0),
            'average_accepted_value': int(avg_accepted.scalar() or 0)
        }
    
    @staticmethod
    async def get_quote_response_time(db: AsyncSession) -> Dict[str, float]:
        """
        Calculate average quote response times
        
        Returns:
            Dictionary with response time metrics (in hours)
        """
        # This would require actual datetime calculations
        # For now, returning placeholder structure
        return {
            'average_response_time_hours': 0,
            'median_response_time_hours': 0,
            'fastest_response_hours': 0,
            'slowest_response_hours': 0
        }

