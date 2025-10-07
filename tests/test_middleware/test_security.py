"""
Unit Tests for Security Middleware

Tests all security middleware functionality
"""

import pytest
from httpx import AsyncClient


@pytest.mark.unit
@pytest.mark.asyncio
class TestSecurityMiddleware:
    """Test cases for security middleware"""
    
    async def test_cors_headers(self, async_client: AsyncClient):
        """Test that CORS headers are present."""
        response = await async_client.get("/api/v1/products")
        
        # Check for CORS headers
        assert "access-control-allow-origin" in response.headers or \
               "Access-Control-Allow-Origin" in response.headers
    
    async def test_security_headers(self, async_client: AsyncClient):
        """Test that security headers are present."""
        response = await async_client.get("/api/v1/products")
        
        # Common security headers (case-insensitive check)
        headers_lower = {k.lower(): v for k, v in response.headers.items()}
        
        # At least some basic security headers should be present
        assert any(header in headers_lower for header in [
            'x-content-type-options',
            'x-frame-options',
            'x-xss-protection',
            'strict-transport-security'
        ])
    
    async def test_protected_route_without_token(self, async_client: AsyncClient):
        """Test that protected routes require authentication."""
        # Try to access a protected route without token
        response = await async_client.get("/api/v1/auth/me")
        
        # Should be unauthorized
        assert response.status_code == 401
    
    async def test_protected_route_with_invalid_token(self, async_client: AsyncClient):
        """Test that protected routes reject invalid tokens."""
        headers = {"Authorization": "Bearer invalid_token_here"}
        
        response = await async_client.get("/api/v1/auth/me", headers=headers)
        
        # Should be unauthorized
        assert response.status_code == 401
    
    async def test_sql_injection_prevention(self, async_client: AsyncClient):
        """Test that SQL injection attempts are handled safely."""
        # Attempt SQL injection in query parameter
        malicious_query = "'; DROP TABLE companies; --"
        
        response = await async_client.get(
            f"/api/v1/products?search={malicious_query}"
        )
        
        # Should not cause server error
        assert response.status_code in [200, 400, 422]
    
    async def test_xss_prevention(self, async_client: AsyncClient):
        """Test that XSS attempts are handled safely."""
        # Attempt XSS in search parameter
        xss_payload = "<script>alert('XSS')</script>"
        
        response = await async_client.get(
            f"/api/v1/products?search={xss_payload}"
        )
        
        # Should not cause server error
        assert response.status_code in [200, 400, 422]

