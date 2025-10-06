"""
Test Auth Routes

Integration tests for authentication routes
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.company import Company, CompanyStatus


@pytest.mark.integration
@pytest.mark.auth
class TestAuthRoutes:
    """Test cases for authentication routes"""
    
    @pytest.mark.asyncio
    async def test_register_company_success(self, async_client: AsyncClient):
        """Test successful company registration."""
        company_data = {
            "company_name": "Test Company Inc",
            "contact_name": "John Doe",
            "contact_email": "john@testcompany.com",
            "contact_phone": "+1234567890",
            "address_line1": "123 Test Street",
            "city": "Test City",
            "state": "TS",
            "zip_code": "12345",
            "country": "USA",
            "password": "TestPassword123!"
        }
        
        response = await async_client.post("/api/v1/auth/register", json=company_data)
        
        assert response.status_code == 201
        data = response.json()
        assert data["company_name"] == company_data["company_name"]
        assert data["contact_email"] == company_data["contact_email"]
        assert data["status"] == "pending"
        assert "id" in data
    
    @pytest.mark.asyncio
    async def test_register_company_duplicate_email(self, async_client: AsyncClient):
        """Test company registration with duplicate email."""
        company_data = {
            "company_name": "Test Company Inc",
            "contact_name": "John Doe",
            "contact_email": "john@testcompany.com",
            "contact_phone": "+1234567890",
            "address_line1": "123 Test Street",
            "city": "Test City",
            "state": "TS",
            "zip_code": "12345",
            "country": "USA",
            "password": "TestPassword123!"
        }
        
        # Register first company
        await async_client.post("/api/v1/auth/register", json=company_data)
        
        # Try to register second company with same email
        company_data["company_name"] = "Another Company"
        
        response = await async_client.post("/api/v1/auth/register", json=company_data)
        
        assert response.status_code == 400
        data = response.json()
        assert "error" in data or "detail" in data
    
    @pytest.mark.asyncio
    async def test_register_company_invalid_password(self, async_client: AsyncClient):
        """Test company registration with invalid password."""
        company_data = {
            "company_name": "Test Company Inc",
            "contact_name": "John Doe",
            "contact_email": "john@testcompany.com",
            "contact_phone": "+1234567890",
            "address_line1": "123 Test Street",
            "city": "Test City",
            "state": "TS",
            "zip_code": "12345",
            "country": "USA",
            "password": "weak"  # Too weak
        }
        
        response = await async_client.post("/api/v1/auth/register", json=company_data)
        
        assert response.status_code == 400
        data = response.json()
        assert "error" in data or "detail" in data
    
    @pytest.mark.asyncio
    async def test_login_company_success(self, async_client: AsyncClient, test_company):
        """Test successful company login."""
        # Activate the company
        test_company.status = CompanyStatus.ACTIVE
        await async_client.app.dependency_overrides[async_client.app.dependency_overrides.get]().commit()
        
        login_data = {
            "email": test_company.contact_email,
            "password": "TestPassword123!"
        }
        
        response = await async_client.post("/api/v1/auth/login", json=login_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert "company" in data
        assert data["company"]["id"] == test_company.id
    
    @pytest.mark.asyncio
    async def test_login_company_invalid_credentials(self, async_client: AsyncClient):
        """Test company login with invalid credentials."""
        login_data = {
            "email": "nonexistent@test.com",
            "password": "WrongPassword123!"
        }
        
        response = await async_client.post("/api/v1/auth/login", json=login_data)
        
        assert response.status_code == 401
        data = response.json()
        assert "error" in data or "detail" in data
    
    @pytest.mark.asyncio
    async def test_login_company_inactive_status(self, async_client: AsyncClient, test_company):
        """Test company login with inactive status."""
        # Company remains PENDING status
        
        login_data = {
            "email": test_company.contact_email,
            "password": "TestPassword123!"
        }
        
        response = await async_client.post("/api/v1/auth/login", json=login_data)
        
        assert response.status_code == 403
        data = response.json()
        assert "error" in data or "detail" in data
    
    @pytest.mark.asyncio
    async def test_get_current_user_success(self, async_client: AsyncClient, company_token):
        """Test successful current user retrieval."""
        headers = {"Authorization": f"Bearer {company_token}"}
        
        response = await async_client.get("/api/v1/auth/me", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "company_name" in data
        assert "contact_email" in data
    
    @pytest.mark.asyncio
    async def test_get_current_user_unauthorized(self, async_client: AsyncClient):
        """Test current user retrieval without token."""
        response = await async_client.get("/api/v1/auth/me")
        
        assert response.status_code == 401
        data = response.json()
        assert "error" in data or "detail" in data
    
    @pytest.mark.asyncio
    async def test_refresh_token_success(self, async_client: AsyncClient, test_company):
        """Test successful token refresh."""
        # Create refresh token
        from backend.core.security import create_refresh_token
        refresh_token = create_refresh_token(data={"sub": str(test_company.id), "type": "company"})
        
        refresh_data = {"refresh_token": refresh_token}
        
        response = await async_client.post("/api/v1/auth/refresh", json=refresh_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert "company" in data
    
    @pytest.mark.asyncio
    async def test_refresh_token_invalid(self, async_client: AsyncClient):
        """Test token refresh with invalid token."""
        refresh_data = {"refresh_token": "invalid_token"}
        
        response = await async_client.post("/api/v1/auth/refresh", json=refresh_data)
        
        assert response.status_code == 401
        data = response.json()
        assert "error" in data or "detail" in data
    
    @pytest.mark.asyncio
    async def test_change_password_success(self, async_client: AsyncClient, company_token):
        """Test successful password change."""
        password_data = {
            "current_password": "TestPassword123!",
            "new_password": "NewPassword123!"
        }
        
        headers = {"Authorization": f"Bearer {company_token}"}
        
        response = await async_client.post("/api/v1/auth/password/change", json=password_data, headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
    
    @pytest.mark.asyncio
    async def test_change_password_wrong_current(self, async_client: AsyncClient, company_token):
        """Test password change with wrong current password."""
        password_data = {
            "current_password": "WrongPassword123!",
            "new_password": "NewPassword123!"
        }
        
        headers = {"Authorization": f"Bearer {company_token}"}
        
        response = await async_client.post("/api/v1/auth/password/change", json=password_data, headers=headers)
        
        assert response.status_code == 400
        data = response.json()
        assert "error" in data or "detail" in data
    
    @pytest.mark.asyncio
    async def test_logout_success(self, async_client: AsyncClient, company_token):
        """Test successful logout."""
        headers = {"Authorization": f"Bearer {company_token}"}
        
        response = await async_client.post("/api/v1/auth/logout", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
