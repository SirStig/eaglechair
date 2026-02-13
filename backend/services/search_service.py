"""
Search Service

Advanced search functionality with fuzzy matching and analytics
"""

import logging
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func, desc
from sqlalchemy.orm import selectinload
from fuzzywuzzy import fuzz, process

from backend.models.chair import Chair, Category, Finish, Upholstery
from backend.models.content import FAQ, Catalog, Installation
from backend.core.config import settings
from backend.services.cache_service import cache_service


logger = logging.getLogger(__name__)


class SearchAnalytics:
    """Track search queries for analytics"""
    
    # In-memory storage (replace with database table in production)
    search_history: List[Dict[str, Any]] = []
    
    @classmethod
    def track_search(
        cls,
        query: str,
        results_count: int,
        filters: Optional[Dict[str, Any]] = None,
        company_id: Optional[int] = None
    ) -> None:
        """Track a search query"""
        cls.search_history.append({
            'query': query,
            'results_count': results_count,
            'filters': filters or {},
            'company_id': company_id,
            'timestamp': datetime.utcnow().isoformat()
        })
        
        # Keep only last 1000 searches
        if len(cls.search_history) > 1000:
            cls.search_history = cls.search_history[-1000:]
        
        logger.debug(f"Tracked search: {query} ({results_count} results)")
    
    @classmethod
    def get_popular_searches(cls, limit: int = 10) -> List[Tuple[str, int]]:
        """Get most popular search queries"""
        from collections import Counter
        
        queries = [s['query'] for s in cls.search_history]
        counter = Counter(queries)
        return counter.most_common(limit)
    
    @classmethod
    def get_searches_with_no_results(cls, limit: int = 10) -> List[str]:
        """Get searches that returned no results"""
        no_results = [
            s['query'] 
            for s in cls.search_history 
            if s['results_count'] == 0
        ]
        return list(set(no_results))[-limit:]


class SearchService:
    """Service for advanced product and content search"""
    
    @staticmethod
    async def search_products(
        db: AsyncSession,
        query: str,
        category_id: Optional[int] = None,
        min_price: Optional[int] = None,
        max_price: Optional[int] = None,
        finish_id: Optional[int] = None,
        upholstery_id: Optional[int] = None,
        is_active_only: bool = True,
        use_fuzzy: bool = True,
        fuzzy_threshold: int = 60,
        skip: int = 0,
        limit: int = 50,
        sort_by: str = "relevance",
        company_id: Optional[int] = None
    ) -> Tuple[List[Chair], int]:
        """
        Advanced product search with fuzzy matching
        
        Args:
            db: Database session
            query: Search query
            category_id: Filter by category
            min_price: Minimum price filter
            max_price: Maximum price filter
            finish_id: Filter by finish
            upholstery_id: Filter by upholstery
            is_active_only: Only active products
            use_fuzzy: Use fuzzy matching
            fuzzy_threshold: Fuzzy match threshold (0-100)
            skip: Pagination offset
            limit: Page size
            sort_by: Sort field (relevance, price_asc, price_desc, name, newest)
            company_id: Company making the search (for analytics)
            
        Returns:
            Tuple of (products list, total count)
        """
        # Check cache first
        cache_key = f"{query}_{category_id}_{min_price}_{max_price}_{finish_id}_{upholstery_id}_{skip}_{limit}_{sort_by}"
        cached_results = await cache_service.get_cached_search_results(cache_key)
        
        if cached_results:
            logger.debug(f"Returning cached search results for: {query}")
            return cached_results['products'], cached_results['total']
        
        # Build base query
        sql_query = select(Chair).options(
            selectinload(Chair.category),
            selectinload(Chair.finishes),
            selectinload(Chair.upholsteries)
        )
        
        if is_active_only:
            sql_query = sql_query.where(Chair.is_active == True)
        
        # Apply filters
        if category_id:
            sql_query = sql_query.where(Chair.category_id == category_id)
        
        if min_price is not None:
            sql_query = sql_query.where(Chair.base_price >= min_price)
        
        if max_price is not None:
            sql_query = sql_query.where(Chair.base_price <= max_price)
        
        # Get all products (we'll filter with fuzzy logic if needed)
        result = await db.execute(sql_query)
        all_products = list(result.scalars().all())
        
        # Apply text search
        if query:
            query_lower = query.lower()
            
            if use_fuzzy:
                # Use fuzzy matching
                scored_products = []
                
                for product in all_products:
                    name_score = fuzz.partial_ratio(query_lower, product.name.lower())
                    model_score = fuzz.partial_ratio(query_lower, product.model_number.lower())
                    desc = (product.short_description or "") + " " + (product.full_description or "")
                    desc_score = fuzz.partial_ratio(query_lower, desc.lower())
                    category_score = 0
                    if product.category:
                        category_score = fuzz.partial_ratio(query_lower, product.category.name.lower())
                    keyword_score = 0
                    kw_list = product.keywords if isinstance(product.keywords, list) else []
                    for k in kw_list:
                        if k:
                            keyword_score = max(keyword_score, fuzz.partial_ratio(query_lower, str(k).lower()))
                    best_score = max(name_score, model_score, desc_score, category_score, keyword_score)
                    
                    if best_score >= fuzzy_threshold:
                        scored_products.append((product, best_score))
                
                # Sort by relevance (score)
                scored_products.sort(key=lambda x: x[1], reverse=True)
                products = [p[0] for p in scored_products]
            else:
                products = [
                    p for p in all_products
                    if (query_lower in p.name.lower() or
                        query_lower in p.model_number.lower() or
                        (p.short_description and query_lower in p.short_description.lower()) or
                        (p.full_description and query_lower in p.full_description.lower()) or
                        (p.category and query_lower in p.category.name.lower()) or
                        (isinstance(p.keywords, list) and any(query_lower in (k or "").lower() for k in p.keywords)))
                ]
        else:
            products = all_products
        
        # Apply finish/upholstery filters (post-query since these are relationships)
        if finish_id:
            products = [p for p in products if any(f.id == finish_id for f in p.finishes)]
        
        if upholstery_id:
            products = [p for p in products if any(u.id == upholstery_id for u in p.upholsteries)]
        
        total = len(products)
        
        # Apply sorting
        if sort_by == "price_asc":
            products.sort(key=lambda x: x.base_price)
        elif sort_by == "price_desc":
            products.sort(key=lambda x: x.base_price, reverse=True)
        elif sort_by == "name":
            products.sort(key=lambda x: x.name)
        elif sort_by == "newest":
            products.sort(key=lambda x: x.created_at, reverse=True)
        # relevance is already sorted by fuzzy score
        
        # Apply pagination
        paginated_products = products[skip:skip + limit]
        
        # Track search
        SearchAnalytics.track_search(
            query=query,
            results_count=total,
            filters={
                'category_id': category_id,
                'min_price': min_price,
                'max_price': max_price,
                'finish_id': finish_id,
                'upholstery_id': upholstery_id
            },
            company_id=company_id
        )
        
        # Cache results
        await cache_service.cache_search_results(
            cache_key,
            {'products': paginated_products, 'total': total},
            ttl=600
        )
        
        logger.info(f"Search '{query}' returned {total} results")
        return paginated_products, total
    
    @staticmethod
    async def autocomplete_products(
        db: AsyncSession,
        query: str,
        limit: int = 5
    ) -> List[Dict[str, str]]:
        """
        Autocomplete suggestions for product search
        
        Args:
            db: Database session
            query: Partial search query
            limit: Max suggestions
            
        Returns:
            List of suggestions
        """
        query_lower = query.lower()
        
        # Get products that match
        result = await db.execute(
            select(Chair)
            .where(
                and_(
                    Chair.is_active == True,
                    or_(
                        Chair.name.ilike(f"%{query}%"),
                        Chair.model_number.ilike(f"%{query}%")
                    )
                )
            )
            .limit(limit)
        )
        products = result.scalars().all()
        
        suggestions = []
        for product in products:
            suggestions.append({
                'text': product.name,
                'model': product.model_number,
                'type': 'product'
            })
        
        # Also get category suggestions
        category_result = await db.execute(
            select(Category)
            .where(Category.name.ilike(f"%{query}%"))
            .limit(3)
        )
        categories = category_result.scalars().all()
        
        for category in categories:
            suggestions.append({
                'text': category.name,
                'type': 'category'
            })
        
        return suggestions[:limit]
    
    @staticmethod
    async def search_faqs(
        db: AsyncSession,
        query: str,
        category_id: Optional[int] = None,
        fuzzy_threshold: int = 60
    ) -> List[FAQ]:
        """
        Search FAQs with fuzzy matching
        
        Args:
            db: Database session
            query: Search query
            category_id: Filter by category
            fuzzy_threshold: Fuzzy match threshold
            
        Returns:
            List of matching FAQs
        """
        sql_query = select(FAQ).where(FAQ.is_active == True)
        
        if category_id:
            sql_query = sql_query.where(FAQ.category_id == category_id)
        
        result = await db.execute(sql_query)
        all_faqs = list(result.scalars().all())
        
        if not query:
            return all_faqs
        
        query_lower = query.lower()
        
        # Use fuzzy matching
        scored_faqs = []
        for faq in all_faqs:
            question_score = fuzz.partial_ratio(query_lower, faq.question.lower())
            answer_score = fuzz.partial_ratio(query_lower, faq.answer.lower())
            
            best_score = max(question_score, answer_score)
            
            if best_score >= fuzzy_threshold:
                scored_faqs.append((faq, best_score))
        
        # Sort by score
        scored_faqs.sort(key=lambda x: x[1], reverse=True)
        
        return [faq[0] for faq in scored_faqs]
    
    @staticmethod
    async def search_all(
        db: AsyncSession,
        query: str,
        limit_per_type: int = 5
    ) -> Dict[str, List[Any]]:
        """
        Search across all content types
        
        Args:
            db: Database session
            query: Search query
            limit_per_type: Max results per content type
            
        Returns:
            Dictionary with results by type
        """
        results = {}
        
        # Search products
        products, _ = await SearchService.search_products(
            db, query, limit=limit_per_type
        )
        results['products'] = products
        
        # Search FAQs
        faqs = await SearchService.search_faqs(db, query)
        results['faqs'] = faqs[:limit_per_type]
        
        # Search catalogs
        catalog_result = await db.execute(
            select(Catalog)
            .where(
                and_(
                    Catalog.is_active == True,
                    or_(
                        Catalog.title.ilike(f"%{query}%"),
                        Catalog.description.ilike(f"%{query}%")
                    )
                )
            )
            .limit(limit_per_type)
        )
        results['catalogs'] = list(catalog_result.scalars().all())
        
        # Search installation guides
        installation_result = await db.execute(
            select(Installation)
            .where(
                and_(
                    Installation.is_active == True,
                    or_(
                        Installation.title.ilike(f"%{query}%"),
                        Installation.description.ilike(f"%{query}%")
                    )
                )
            )
            .limit(limit_per_type)
        )
        results['installations'] = list(installation_result.scalars().all())
        
        return results
    
    @staticmethod
    def get_popular_searches(limit: int = 10) -> List[Tuple[str, int]]:
        """Get most popular search queries"""
        return SearchAnalytics.get_popular_searches(limit)
    
    @staticmethod
    def get_failed_searches(limit: int = 10) -> List[str]:
        """Get searches with no results"""
        return SearchAnalytics.get_searches_with_no_results(limit)

