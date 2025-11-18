"""
Test Auth Routes

Integration tests for authentication routes
"""

import pytest
from httpx import AsyncClient

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
            "rep_first_name": "John",
            "rep_last_name": "Doe",
            "rep_email": "john@testcompany.com",
            "rep_phone": "+1234567890",
            "billing_address_line1": "123 Test Street",
            "billing_city": "Test City",
            "billing_state": "TS",
            "billing_zip": "12345",
            "billing_country": "USA",
            "password": "TestPassword123!"
        }
        
        response = await async_client.post("/api/v1/auth/register", json=company_data)
        
        assert response.status_code == 201
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert "user" in data
        assert data["user"]["companyName"] == company_data["company_name"]
        assert data["user"]["email"] == company_data["rep_email"]
        assert data["user"]["status"] == "pending"
    
    @pytest.mark.asyncio
    async def test_register_company_duplicate_email(self, async_client: AsyncClient):
        """Test company registration with duplicate email."""
        company_data = {
            "company_name": "Test Company Inc",
            "rep_first_name": "John",
            "rep_last_name": "Doe",
            "rep_email": "john@testcompany.com",
            "rep_phone": "+1234567890",
            "billing_address_line1": "123 Test Street",
            "billing_city": "Test City",
            "billing_state": "TS",
            "billing_zip": "12345",
            "billing_country": "USA",
            "password": "TestPassword123!"
        }
        
        # Register first company
        await async_client.post("/api/v1/auth/register", json=company_data)
        
        # Try to register second company with same email
        company_data["company_name"] = "Another Company"
        
        response = await async_client.post("/api/v1/auth/register", json=company_data)
        
        assert response.status_code == 409
        data = response.json()
        assert "error" in data or "detail" in data
    
    @pytest.mark.asyncio
    async def test_login_company_success(self, async_client: AsyncClient, test_company, db_session):
        """Test successful company login."""
        # Activate the company
        test_company.status = CompanyStatus.ACTIVE
        test_company.is_active = True
        await db_session.commit()
        await db_session.refresh(test_company)
        
        login_data = {
            "email": test_company.rep_email,
            "password": "TestPassword123!"
        }
        
        response = await async_client.post("/api/v1/auth/login", json=login_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert "user" in data
        assert data["user"]["id"] == test_company.id
    
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
    async def test_login_company_inactive_status(self, async_client: AsyncClient, test_company, db_session):
        """Test company login with inactive status."""
        # Company remains PENDING status and inactive
        test_company.is_active = False
        await db_session.commit()
        
        login_data = {
            "email": test_company.rep_email,
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
        assert "rep_email" in data
    
    @pytest.mark.asyncio
    async def test_get_current_user_unauthorized(self, async_client: AsyncClient):
        """Test current user retrieval without token."""
        response = await async_client.get("/api/v1/auth/me")
        
        assert response.status_code == 401
        data = response.json()
        assert "error" in data or "detail" in data
    
    @pytest.mark.asyncio
    async def test_refresh_token_success(self, async_client: AsyncClient, test_company, db_session):
        """Test successful token refresh."""
        # Authenticate to get a refresh token
        test_company.status = CompanyStatus.ACTIVE
        test_company.is_active = True
        await db_session.commit()
        
        login_response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": test_company.rep_email, "password": "TestPassword123!"}
        )
        tokens = login_response.json()
        refresh_token = tokens["refresh_token"]
        
        # Use refresh token in Authorization header
        headers = {"Authorization": f"Bearer {refresh_token}"}
        response = await async_client.post("/api/v1/auth/refresh", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
    
    @pytest.mark.asyncio
    async def test_refresh_token_invalid(self, async_client: AsyncClient):
        """Test token refresh with invalid token."""
        headers = {"Authorization": "Bearer invalid_token"}
        
        response = await async_client.post("/api/v1/auth/refresh", headers=headers)
        
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
        
        response = await async_client.post(
            "/api/v1/auth/password/change", 
            json=password_data, 
            headers=headers
        )
        
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
        
        response = await async_client.post(
            "/api/v1/auth/password/change", 
            json=password_data, 
            headers=headers
        )
        
        assert response.status_code == 401
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
