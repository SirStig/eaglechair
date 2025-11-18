"""
Cache Service

YokedCache-based caching service with fuzzy search for improved performance
"""

import logging
from typing import Any, Dict, List, Optional

from yokedcache import CacheConfig, YokedCache

from backend.core.config import settings

logger = logging.getLogger(__name__)


class CacheService:
    """Service for YokedCache caching operations with fuzzy search"""
    
    _instance: Optional['CacheService'] = None
    
    def __new__(cls):
        """Singleton pattern to ensure single cache instance."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize YokedCache connection"""
        if not hasattr(self, 'enabled'):
            try:
                config = CacheConfig(
                    redis_url=settings.REDIS_URL,
                    default_ttl=settings.REDIS_CACHE_TTL,
                    key_prefix="eaglechair",
                    enable_fuzzy=True,  # Enable fuzzy search
                    fuzzy_threshold=75  # Minimum similarity score (0-100)
                )
                self.cache = YokedCache(config=config)
                self.enabled = settings.ENABLE_CACHE
                logger.info("YokedCache initialized successfully with fuzzy search")
            except Exception as e:
                logger.warning(f"YokedCache unavailable, using memory backend: {e}")
                # Fallback to memory backend
                try:
                    config = CacheConfig(
                        backend="memory",
                        default_ttl=settings.REDIS_CACHE_TTL,
                        key_prefix="eaglechair",
                        enable_fuzzy=True,
                        fuzzy_threshold=75
                    )
                    self.cache = YokedCache(config=config)
                    self.enabled = settings.ENABLE_CACHE
                    logger.info("Using memory backend for YokedCache")
                except Exception as mem_error:
                    logger.error(f"Failed to initialize cache: {mem_error}")
                    self.cache = None
                    self.enabled = False
    
    def _make_key(self, prefix: str, identifier: str) -> str:
        """Create a cache key with prefix"""
        return f"eaglechair:{prefix}:{identifier}"
    
    async def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None
        """
        if not self.enabled or not self.cache:
            return None
        
        try:
            return await self.cache.get(key)
        except Exception as e:
            logger.error(f"Cache get error for key {key}: {e}")
            return None
    
    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
        tags: Optional[List[str]] = None
    ) -> bool:
        """
        Set value in cache with optional tags
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds (default: settings.REDIS_CACHE_TTL)
            tags: Optional tags for grouping and invalidation
            
        Returns:
            True if successful
        """
        if not self.enabled or not self.cache:
            return False
        
        try:
            ttl = ttl or settings.REDIS_CACHE_TTL
            await self.cache.set(key, value, ttl=ttl, tags=set(tags) if tags else None)
            return True
        except Exception as e:
            logger.error(f"Cache set error for key {key}: {e}")
            return False
    
    async def delete(self, key: str) -> bool:
        """
        Delete key from cache
        
        Args:
            key: Cache key
            
        Returns:
            True if successful
        """
        if not self.enabled or not self.cache:
            return False
        
        try:
            await self.cache.delete(key)
            return True
        except Exception as e:
            logger.error(f"Cache delete error for key {key}: {e}")
            return False
    
    async def delete_pattern(self, pattern: str) -> int:
        """
        Delete all keys matching pattern
        
        Args:
            pattern: Pattern to match (e.g., "product:*")
            
        Returns:
            Number of keys deleted
        """
        if not self.enabled or not self.cache:
            return 0
        
        try:
            await self.cache.invalidate_pattern(pattern)
            return 1  # YokedCache doesn't return count
        except Exception as e:
            logger.error(f"Cache delete pattern error for {pattern}: {e}")
            return 0
    
    async def invalidate_tags(self, tags: List[str]) -> bool:
        """
        Invalidate all cache entries with specified tags
        
        Args:
            tags: List of tags to invalidate
            
        Returns:
            True if successful
        """
        if not self.enabled or not self.cache:
            return False
        
        try:
            await self.cache.invalidate_tags(tags)
            logger.info(f"Invalidated cache tags: {tags}")
            return True
        except Exception as e:
            logger.error(f"Cache tag invalidation error for {tags}: {e}")
            return False
    
    async def clear_all(self) -> bool:
        """Clear all cache (use with caution)"""
        if not self.enabled or not self.cache:
            return False
        
        try:
            # YokedCache doesn't have flushdb, use pattern invalidation
            await self.cache.invalidate_pattern("*")
            logger.warning("All cache cleared")
            return True
        except Exception as e:
            logger.error(f"Cache clear error: {e}")
            return False
    
    # Fuzzy search operations
    async def fuzzy_search(
        self,
        query: str,
        threshold: int = 75,
        max_results: int = 50,
        tags: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Perform fuzzy search across cached entries
        
        Args:
            query: Search query string
            threshold: Minimum similarity score (0-100)
            max_results: Maximum number of results to return
            tags: Optional tags to filter search scope
            
        Returns:
            List of search results with key, value, score, and matched_term
        """
        if not self.enabled or not self.cache:
            return []
        
        try:
            results = await self.cache.fuzzy_search(
                query=query,
                threshold=threshold,
                max_results=max_results,
                tags=set(tags) if tags else None
            )
            
            return [
                {
                    "key": result.key,
                    "value": result.value,
                    "score": result.score,
                    "matched_term": result.matched_term
                }
                for result in results
            ]
        except Exception as e:
            logger.error(f"Fuzzy search failed for query '{query}': {e}")
            return []
    
    # Specialized caching methods
    
    async def cache_product(self, product_id: int, product_data: dict, ttl: int = 600) -> bool:
        """Cache product data with tags"""
        key = self._make_key("product", str(product_id))
        tags = ["products", f"product:{product_id}"]
        
        # Add category tags if available
        if product_data.get("category_id"):
            tags.append(f"category:{product_data['category_id']}")
        
        # Add family tags if available
        if product_data.get("family_id"):
            tags.append(f"family:{product_data['family_id']}")
        
        return await self.set(key, product_data, ttl, tags)
    
    async def index_product_for_search(
        self,
        product_id: int,
        searchable_text: str,
        ttl: int = 3600
    ) -> bool:
        """
        Index a product for fuzzy search by storing searchable text
        
        Args:
            product_id: Product ID
            searchable_text: Concatenated searchable fields (name, model, description)
            ttl: Time to live in seconds (default 1 hour)
            
        Returns:
            bool: Success status
        """
        try:
            key = self._make_key("product_search", str(product_id))
            tags = ["products", f"product:{product_id}"]
            
            # Store the searchable text for fuzzy matching
            return await self.set(key, searchable_text, ttl=ttl, tags=tags)
        except Exception as e:
            logger.error(f"Error indexing product {product_id} for search: {e}")
            return False
    
    async def get_cached_product(self, product_id: int) -> Optional[dict]:
        """Get cached product"""
        key = self._make_key("product", str(product_id))
        return await self.get(key)
    
    async def invalidate_product(self, product_id: int) -> bool:
        """Invalidate product cache"""
        return await self.invalidate_tags([f"product:{product_id}", "products_list"])
    
    async def invalidate_all_products(self) -> bool:
        """Invalidate all product caches"""
        return await self.invalidate_tags(["products", "products_list"])
    
    async def cache_products_list(
        self,
        filters_hash: str,
        products_data: List[dict],
        ttl: int = 300
    ) -> bool:
        """Cache a list of products with specific filters"""
        key = self._make_key("products_list", filters_hash)
        tags = ["products_list"]
        return await self.set(key, products_data, ttl, tags)
    
    async def get_cached_products_list(self, filters_hash: str) -> Optional[List[dict]]:
        """Get cached products list"""
        key = self._make_key("products_list", filters_hash)
        return await self.get(key)
    
    async def cache_family(self, family_id: int, family_data: dict, ttl: int = 600) -> bool:
        """Cache product family with tags"""
        key = self._make_key("family", str(family_id))
        tags = ["families", f"family:{family_id}"]
        return await self.set(key, family_data, ttl, tags)
    
    async def get_cached_family(self, family_id: int) -> Optional[dict]:
        """Get cached family"""
        key = self._make_key("family", str(family_id))
        return await self.get(key)
    
    async def invalidate_family(self, family_id: int) -> bool:
        """Invalidate family cache"""
        return await self.invalidate_tags([f"family:{family_id}", "products_list"])
    
    async def cache_category(self, category_id: int, category_data: dict, ttl: int = 1800) -> bool:
        """Cache category data with tags"""
        key = self._make_key("category", str(category_id))
        tags = ["categories", f"category:{category_id}"]
        return await self.set(key, category_data, ttl, tags)
    
    async def get_cached_category(self, category_id: int) -> Optional[dict]:
        """Get cached category"""
        key = self._make_key("category", str(category_id))
        return await self.get(key)
    
    async def invalidate_category(self, category_id: int) -> bool:
        """Invalidate category cache"""
        return await self.invalidate_tags([f"category:{category_id}", "products_list"])
    
    async def cache_categories_list(self, categories_data: List[dict], ttl: int = 1800) -> bool:
        """Cache all categories"""
        key = self._make_key("categories", "all")
        tags = ["categories"]
        return await self.set(key, categories_data, ttl, tags)
    
    async def get_cached_categories_list(self) -> Optional[List[dict]]:
        """Get cached categories list"""
        key = self._make_key("categories", "all")
        return await self.get(key)
    
    async def cache_faq_list(self, category_id: Optional[int], faqs_data: List[dict], ttl: int = 900) -> bool:
        """Cache FAQ list"""
        key_suffix = f"cat_{category_id}" if category_id else "all"
        key = self._make_key("faqs", key_suffix)
        tags = ["faqs"]
        return await self.set(key, faqs_data, ttl, tags)
    
    async def get_cached_faq_list(self, category_id: Optional[int] = None) -> Optional[List[dict]]:
        """Get cached FAQ list"""
        key_suffix = f"cat_{category_id}" if category_id else "all"
        key = self._make_key("faqs", key_suffix)
        return await self.get(key)
    
    async def cache_company_info(self, info_data: dict, ttl: int = 3600) -> bool:
        """Cache company info"""
        key = self._make_key("company_info", "main")
        tags = ["company_info"]
        return await self.set(key, info_data, ttl, tags)
    
    async def get_cached_company_info(self) -> Optional[dict]:
        """Get cached company info"""
        key = self._make_key("company_info", "main")
        return await self.get(key)
    
    async def cache_team_members(self, team_data: List[dict], ttl: int = 1800) -> bool:
        """Cache team members"""
        key = self._make_key("team", "all")
        tags = ["team"]
        return await self.set(key, team_data, ttl, tags)
    
    async def get_cached_team_members(self) -> Optional[List[dict]]:
        """Get cached team members"""
        key = self._make_key("team", "all")
        return await self.get(key)
    
    async def cache_contact_locations(self, locations_data: List[dict], ttl: int = 1800) -> bool:
        """Cache contact locations"""
        key = self._make_key("locations", "all")
        tags = ["locations"]
        return await self.set(key, locations_data, ttl, tags)
    
    async def get_cached_contact_locations(self) -> Optional[List[dict]]:
        """Get cached contact locations"""
        key = self._make_key("locations", "all")
        return await self.get(key)
    
    async def cache_catalogs(self, catalogs_data: List[dict], ttl: int = 900) -> bool:
        """Cache catalogs list"""
        key = self._make_key("catalogs", "all")
        tags = ["catalogs"]
        return await self.set(key, catalogs_data, ttl, tags)
    
    async def get_cached_catalogs(self) -> Optional[List[dict]]:
        """Get cached catalogs"""
        key = self._make_key("catalogs", "all")
        return await self.get(key)
    
    async def cache_session(
        self,
        session_token: str,
        session_data: dict,
        ttl: int = 1800
    ) -> bool:
        """Cache user session"""
        key = self._make_key("session", session_token)
        tags = ["sessions"]
        return await self.set(key, session_data, ttl, tags)
    
    async def get_cached_session(self, session_token: str) -> Optional[dict]:
        """Get cached session"""
        key = self._make_key("session", session_token)
        return await self.get(key)
    
    async def invalidate_session(self, session_token: str) -> bool:
        """Invalidate session"""
        key = self._make_key("session", session_token)
        return await self.delete(key)
    
    async def cache_search_results(
        self,
        search_query: str,
        results: List[dict],
        ttl: int = 600
    ) -> bool:
        """Cache search results"""
        # Create a normalized key from the search query
        normalized_query = search_query.lower().strip().replace(" ", "_")
        key = self._make_key("search", normalized_query)
        tags = ["search_results"]
        return await self.set(key, results, ttl, tags)
    
    async def get_cached_search_results(self, search_query: str) -> Optional[List[dict]]:
        """Get cached search results"""
        normalized_query = search_query.lower().strip().replace(" ", "_")
        key = self._make_key("search", normalized_query)
        return await self.get(key)
    
    async def cache_dashboard_stats(self, stats: dict, ttl: int = 300) -> bool:
        """Cache dashboard statistics"""
        key = self._make_key("stats", "dashboard")
        tags = ["dashboard"]
        return await self.set(key, stats, ttl, tags)
    
    async def get_cached_dashboard_stats(self) -> Optional[dict]:
        """Get cached dashboard stats"""
        key = self._make_key("stats", "dashboard")
        return await self.get(key)
    
    async def invalidate_content_caches(self) -> None:
        """Invalidate all content-related caches"""
        await self.invalidate_tags(["faqs", "team", "locations", "catalogs", "company_info"])
        logger.info("Content caches invalidated")
    
    async def health_check(self) -> Dict[str, Any]:
        """Check cache health and get statistics"""
        if not self.enabled or not self.cache:
            return {"healthy": False, "error": "Cache not initialized"}
        
        try:
            stats = await self.cache.get_stats()
            return {
                "healthy": True,
                "stats": {
                    "hit_rate": getattr(stats, 'hit_rate', 0),
                    "key_count": getattr(stats, 'key_count', 0),
                    "memory_usage_mb": getattr(stats, 'memory_usage_mb', 0)
                }
            }
        except Exception as e:
            logger.error(f"Cache health check failed: {e}")
            return {"healthy": False, "error": str(e)}
    
    async def close(self):
        """Close cache connections gracefully"""
        if self.cache:
            try:
                # YokedCache should have a close method for Redis cleanup
                if hasattr(self.cache, 'close'):
                    await self.cache.close()
                    logger.info("Cache connections closed")
                elif hasattr(self.cache, '_redis'):
                    # Manually close Redis connection if available
                    await self.cache._redis.close()
                    logger.info("Redis connection closed")
            except Exception as e:
                logger.warning(f"Error closing cache: {e}")


# Create global cache service instance
cache_service = CacheService()

