"""
Unit Tests for Slug Utilities

Tests all slug utility functionality
"""

import pytest
from backend.utils.slug import slugify, ensure_unique_slug


@pytest.mark.unit
class TestSlug:
    """Test cases for slug utilities"""
    
    def test_slugify_basic(self):
        """Test basic slugification."""
        text = "Hello World"
        slug = slugify(text)
        
        assert slug == "hello-world"
    
    def test_slugify_with_special_chars(self):
        """Test slugification with special characters."""
        text = "Hello, World!"
        slug = slugify(text)
        
        assert slug == "hello-world"
    
    def test_slugify_with_numbers(self):
        """Test slugification with numbers."""
        text = "Product 123"
        slug = slugify(text)
        
        assert slug == "product-123"
    
    def test_slugify_with_multiple_spaces(self):
        """Test slugification with multiple spaces."""
        text = "Hello    World"
        slug = slugify(text)
        
        assert slug == "hello-world"
    
    def test_slugify_with_leading_trailing_spaces(self):
        """Test slugification with leading/trailing spaces."""
        text = "  Hello World  "
        slug = slugify(text)
        
        assert slug == "hello-world"
    
    def test_slugify_with_hyphens(self):
        """Test slugification with existing hyphens."""
        text = "Hello-World"
        slug = slugify(text)
        
        assert slug == "hello-world"
    
    def test_slugify_with_underscores(self):
        """Test slugification with underscores."""
        text = "Hello_World"
        slug = slugify(text)
        
        assert slug == "hello_world" or slug == "hello-world"
    
    def test_slugify_empty_string(self):
        """Test slugification of empty string."""
        text = ""
        slug = slugify(text)
        
        assert slug == ""
    
    def test_slugify_special_chars_only(self):
        """Test slugification of special characters only."""
        text = "!@#$%^&*()"
        slug = slugify(text)
        
        assert slug == ""
    
    def test_slugify_unicode(self):
        """Test slugification with unicode characters."""
        text = "Café München"
        slug = slugify(text)
        
        # Should handle unicode gracefully
        assert slug is not None
        assert " " not in slug
    
    def test_slugify_long_text(self):
        """Test slugification of long text."""
        text = "This is a very long title that should be slugified properly and handle all the words"
        slug = slugify(text)
        
        assert slug == "this-is-a-very-long-title-that-should-be-slugified-properly-and-handle-all-the-words"
    
    def test_slugify_with_apostrophes(self):
        """Test slugification with apostrophes."""
        text = "It's a Beautiful Day"
        slug = slugify(text)
        
        assert "its" in slug or "it-s" in slug
    
    def test_slugify_consecutive_special_chars(self):
        """Test slugification with consecutive special characters."""
        text = "Hello---World!!!"
        slug = slugify(text)
        
        assert slug == "hello-world"
    
    def test_ensure_unique_slug_basic(self):
        """Test ensuring unique slug."""
        slug = "test-product"
        existing_slugs = []
        
        result = ensure_unique_slug(slug, existing_slugs)
        
        assert result == "test-product"
    
    def test_ensure_unique_slug_with_conflict(self):
        """Test ensuring unique slug with conflict."""
        slug = "test-product"
        existing_slugs = ["test-product"]
        
        result = ensure_unique_slug(slug, existing_slugs)
        
        assert result == "test-product-1"
    
    def test_ensure_unique_slug_multiple_conflicts(self):
        """Test ensuring unique slug with multiple conflicts."""
        slug = "test-product"
        existing_slugs = ["test-product", "test-product-1", "test-product-2"]
        
        result = ensure_unique_slug(slug, existing_slugs)
        
        assert result == "test-product-3"

