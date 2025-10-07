"""
Cache Service

Redis-based caching service for improved performance
"""

import json
import logging
from typing import Any, Optional, List
from redis import Redis
from redis.exceptions import RedisError

from backend.core.config import settings


logger = logging.getLogger(__name__)


class CacheService:
    """Service for Redis caching operations"""
    
    def __init__(self):
        """Initialize Redis connection"""
        try:
            self.redis_client = Redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=5
            )
            # Test connection
            self.redis_client.ping()
            self.enabled = True
            logger.info("Redis cache initialized successfully")
        except (RedisError, Exception) as e:
            logger.warning(f"Redis unavailable, caching disabled: {e}")
            self.redis_client = None
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
        if not self.enabled or not settings.ENABLE_CACHE:
            return None
        
        try:
            value = self.redis_client.get(key)
            if value:
                return json.loads(value)
        except (RedisError, json.JSONDecodeError) as e:
            logger.error(f"Cache get error for key {key}: {e}")
        
        return None
    
    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None
    ) -> bool:
        """
        Set value in cache
        
        Args:
            key: Cache key
            value: Value to cache (will be JSON serialized)
            ttl: Time to live in seconds (default: settings.REDIS_CACHE_TTL)
            
        Returns:
            True if successful
        """
        if not self.enabled or not settings.ENABLE_CACHE:
            return False
        
        try:
            ttl = ttl or settings.REDIS_CACHE_TTL
            serialized = json.dumps(value, default=str)
            self.redis_client.setex(key, ttl, serialized)
            return True
        except (RedisError, TypeError, ValueError) as e:
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
        if not self.enabled:
            return False
        
        try:
            self.redis_client.delete(key)
            return True
        except RedisError as e:
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
        if not self.enabled:
            return 0
        
        try:
            keys = self.redis_client.keys(pattern)
            if keys:
                return self.redis_client.delete(*keys)
        except RedisError as e:
            logger.error(f"Cache delete pattern error for {pattern}: {e}")
        
        return 0
    
    async def clear_all(self) -> bool:
        """Clear all cache (use with caution)"""
        if not self.enabled:
            return False
        
        try:
            self.redis_client.flushdb()
            logger.warning("All cache cleared")
            return True
        except RedisError as e:
            logger.error(f"Cache clear error: {e}")
            return False
    
    # Specialized caching methods
    
    async def cache_product(self, product_id: int, product_data: dict, ttl: int = 600) -> bool:
        """Cache product data"""
        key = self._make_key("product", str(product_id))
        return await self.set(key, product_data, ttl)
    
    async def get_cached_product(self, product_id: int) -> Optional[dict]:
        """Get cached product"""
        key = self._make_key("product", str(product_id))
        return await self.get(key)
    
    async def invalidate_product(self, product_id: int) -> bool:
        """Invalidate product cache"""
        key = self._make_key("product", str(product_id))
        return await self.delete(key)
    
    async def invalidate_all_products(self) -> int:
        """Invalidate all product caches"""
        pattern = self._make_key("product", "*")
        return await self.delete_pattern(pattern)
    
    async def cache_products_list(
        self,
        filters_hash: str,
        products_data: List[dict],
        ttl: int = 300
    ) -> bool:
        """Cache a list of products with specific filters"""
        key = self._make_key("products_list", filters_hash)
        return await self.set(key, products_data, ttl)
    
    async def get_cached_products_list(self, filters_hash: str) -> Optional[List[dict]]:
        """Get cached products list"""
        key = self._make_key("products_list", filters_hash)
        return await self.get(key)
    
    async def cache_category(self, category_id: int, category_data: dict, ttl: int = 1800) -> bool:
        """Cache category data"""
        key = self._make_key("category", str(category_id))
        return await self.set(key, category_data, ttl)
    
    async def get_cached_category(self, category_id: int) -> Optional[dict]:
        """Get cached category"""
        key = self._make_key("category", str(category_id))
        return await self.get(key)
    
    async def cache_categories_list(self, categories_data: List[dict], ttl: int = 1800) -> bool:
        """Cache all categories"""
        key = self._make_key("categories", "all")
        return await self.set(key, categories_data, ttl)
    
    async def get_cached_categories_list(self) -> Optional[List[dict]]:
        """Get cached categories list"""
        key = self._make_key("categories", "all")
        return await self.get(key)
    
    async def cache_faq_list(self, category_id: Optional[int], faqs_data: List[dict], ttl: int = 900) -> bool:
        """Cache FAQ list"""
        key_suffix = f"cat_{category_id}" if category_id else "all"
        key = self._make_key("faqs", key_suffix)
        return await self.set(key, faqs_data, ttl)
    
    async def get_cached_faq_list(self, category_id: Optional[int] = None) -> Optional[List[dict]]:
        """Get cached FAQ list"""
        key_suffix = f"cat_{category_id}" if category_id else "all"
        key = self._make_key("faqs", key_suffix)
        return await self.get(key)
    
    async def cache_company_info(self, info_data: dict, ttl: int = 3600) -> bool:
        """Cache company info"""
        key = self._make_key("company_info", "main")
        return await self.set(key, info_data, ttl)
    
    async def get_cached_company_info(self) -> Optional[dict]:
        """Get cached company info"""
        key = self._make_key("company_info", "main")
        return await self.get(key)
    
    async def cache_team_members(self, team_data: List[dict], ttl: int = 1800) -> bool:
        """Cache team members"""
        key = self._make_key("team", "all")
        return await self.set(key, team_data, ttl)
    
    async def get_cached_team_members(self) -> Optional[List[dict]]:
        """Get cached team members"""
        key = self._make_key("team", "all")
        return await self.get(key)
    
    async def cache_contact_locations(self, locations_data: List[dict], ttl: int = 1800) -> bool:
        """Cache contact locations"""
        key = self._make_key("locations", "all")
        return await self.set(key, locations_data, ttl)
    
    async def get_cached_contact_locations(self) -> Optional[List[dict]]:
        """Get cached contact locations"""
        key = self._make_key("locations", "all")
        return await self.get(key)
    
    async def cache_catalogs(self, catalogs_data: List[dict], ttl: int = 900) -> bool:
        """Cache catalogs list"""
        key = self._make_key("catalogs", "all")
        return await self.set(key, catalogs_data, ttl)
    
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
        return await self.set(key, session_data, ttl)
    
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
        return await self.set(key, results, ttl)
    
    async def get_cached_search_results(self, search_query: str) -> Optional[List[dict]]:
        """Get cached search results"""
        normalized_query = search_query.lower().strip().replace(" ", "_")
        key = self._make_key("search", normalized_query)
        return await self.get(key)
    
    async def cache_dashboard_stats(self, stats: dict, ttl: int = 300) -> bool:
        """Cache dashboard statistics"""
        key = self._make_key("stats", "dashboard")
        return await self.set(key, stats, ttl)
    
    async def get_cached_dashboard_stats(self) -> Optional[dict]:
        """Get cached dashboard stats"""
        key = self._make_key("stats", "dashboard")
        return await self.get(key)
    
    async def invalidate_content_caches(self) -> None:
        """Invalidate all content-related caches"""
        patterns = [
            self._make_key("faqs", "*"),
            self._make_key("team", "*"),
            self._make_key("locations", "*"),
            self._make_key("catalogs", "*"),
            self._make_key("company_info", "*")
        ]
        
        for pattern in patterns:
            await self.delete_pattern(pattern)
        
        logger.info("Content caches invalidated")


# Create global cache service instance
cache_service = CacheService()

