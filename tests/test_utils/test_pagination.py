"""
Unit Tests for Pagination Utilities

Tests all pagination utility functionality
"""

import pytest
from backend.utils.pagination import PaginationParams


@pytest.mark.unit
class TestPagination:
    """Test cases for pagination utilities"""
    
    def test_pagination_params_defaults(self):
        """Test default pagination parameters."""
        params = PaginationParams()
        
        assert params.page == 1
        assert params.per_page == 20
        assert params.offset == 0
    
    def test_pagination_params_custom(self):
        """Test custom pagination parameters."""
        params = PaginationParams(page=3, per_page=10)
        
        assert params.page == 3
        assert params.per_page == 10
        assert params.offset == 20  # (page - 1) * per_page
    
    def test_pagination_params_max_page_size(self):
        """Test pagination with maximum page size."""
        params = PaginationParams(page=1, per_page=100)
        
        # Should be capped at 100
        assert params.per_page == 100
    
    def test_pagination_params_limit(self):
        """Test pagination limit property."""
        params = PaginationParams(page=1, per_page=25)
        
        assert params.limit == 25
    
    def test_pagination_params_offset_calculation(self):
        """Test offset calculation for different pages."""
        # Page 1
        params1 = PaginationParams(page=1, per_page=10)
        assert params1.offset == 0
        
        # Page 2
        params2 = PaginationParams(page=2, per_page=10)
        assert params2.offset == 10
        
        # Page 5
        params3 = PaginationParams(page=5, per_page=20)
        assert params3.offset == 80
    
    def test_pagination_params_validation_min_page(self):
        """Test that page must be at least 1."""
        with pytest.raises(Exception):  # Pydantic validation error
            PaginationParams(page=0, per_page=20)
    
    def test_pagination_params_validation_min_per_page(self):
        """Test that per_page must be at least 1."""
        with pytest.raises(Exception):  # Pydantic validation error
            PaginationParams(page=1, per_page=0)
    
    def test_pagination_params_validation_max_per_page(self):
        """Test that per_page is capped at 100."""
        with pytest.raises(Exception):  # Pydantic validation error
            PaginationParams(page=1, per_page=101)
    
    def test_pagination_params_various_sizes(self):
        """Test different valid per_page values."""
        for size in [1, 10, 25, 50, 100]:
            params = PaginationParams(page=1, per_page=size)
            assert params.per_page == size
            assert params.limit == size

