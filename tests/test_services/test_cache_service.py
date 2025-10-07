"""
Unit Tests for Cache Service

Tests all cache service functionality
"""

import pytest
import asyncio

from backend.services.cache_service import CacheService


@pytest.mark.unit
class TestCacheService:
    """Test cases for CacheService"""
    
    def test_cache_set_and_get(self):
        """Test setting and getting cache values."""
        service = CacheService()
        
        # Set value
        service.set("test_key", "test_value")
        
        # Get value
        value = service.get("test_key")
        
        assert value == "test_value"
    
    def test_cache_get_nonexistent(self):
        """Test getting a nonexistent cache key."""
        service = CacheService()
        
        value = service.get("nonexistent_key")
        
        assert value is None
    
    def test_cache_get_with_default(self):
        """Test getting cache with default value."""
        service = CacheService()
        
        value = service.get("nonexistent_key", default="default_value")
        
        assert value == "default_value"
    
    def test_cache_delete(self):
        """Test deleting cache value."""
        service = CacheService()
        
        # Set value
        service.set("test_key", "test_value")
        
        # Delete value
        service.delete("test_key")
        
        # Try to get deleted value
        value = service.get("test_key")
        
        assert value is None
    
    def test_cache_clear(self):
        """Test clearing all cache."""
        service = CacheService()
        
        # Set multiple values
        service.set("key1", "value1")
        service.set("key2", "value2")
        service.set("key3", "value3")
        
        # Clear cache
        service.clear()
        
        # Verify all values are gone
        assert service.get("key1") is None
        assert service.get("key2") is None
        assert service.get("key3") is None
    
    def test_cache_ttl(self):
        """Test cache time-to-live."""
        service = CacheService()
        
        # Set value with TTL
        service.set("test_key", "test_value", ttl=1)
        
        # Value should exist immediately
        assert service.get("test_key") == "test_value"
        
        # Wait for expiration
        import time
        time.sleep(2)
        
        # Value should be expired
        assert service.get("test_key") is None
    
    def test_cache_complex_types(self):
        """Test caching complex data types."""
        service = CacheService()
        
        # Test dict
        dict_value = {"key": "value", "nested": {"inner": "data"}}
        service.set("dict_key", dict_value)
        assert service.get("dict_key") == dict_value
        
        # Test list
        list_value = [1, 2, 3, "four", {"five": 5}]
        service.set("list_key", list_value)
        assert service.get("list_key") == list_value
        
        # Test tuple (will be converted to list)
        tuple_value = (1, 2, 3)
        service.set("tuple_key", tuple_value)
        retrieved = service.get("tuple_key")
        assert list(retrieved) == list(tuple_value)
    
    def test_cache_pattern_delete(self):
        """Test deleting cache keys by pattern."""
        service = CacheService()
        
        # Set multiple values
        service.set("user:1", "User 1")
        service.set("user:2", "User 2")
        service.set("product:1", "Product 1")
        
        # Delete all user keys
        service.delete_pattern("user:*")
        
        # Verify user keys are gone
        assert service.get("user:1") is None
        assert service.get("user:2") is None
        
        # Verify product key still exists
        assert service.get("product:1") == "Product 1"
    
    def test_cache_increment(self):
        """Test incrementing cache values."""
        service = CacheService()
        
        # Set initial value
        service.set("counter", 0)
        
        # Increment
        new_value = service.increment("counter")
        assert new_value == 1
        
        # Increment again
        new_value = service.increment("counter")
        assert new_value == 2
        
        # Increment with amount
        new_value = service.increment("counter", amount=5)
        assert new_value == 7
    
    def test_cache_decrement(self):
        """Test decrementing cache values."""
        service = CacheService()
        
        # Set initial value
        service.set("counter", 10)
        
        # Decrement
        new_value = service.decrement("counter")
        assert new_value == 9
        
        # Decrement again
        new_value = service.decrement("counter")
        assert new_value == 8
        
        # Decrement with amount
        new_value = service.decrement("counter", amount=3)
        assert new_value == 5

