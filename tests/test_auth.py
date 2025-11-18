"""
Authentication Tests for EagleChair API

NOTE: This file contains outdated tests that don't match the current API structure.
The API now uses company registration, not user registration.
These tests are kept for reference but should be updated or removed.
"""

import pytest
from httpx import AsyncClient

from backend.core.config import settings


@pytest.mark.skip(reason="Outdated test file - API now uses company registration, not user registration")
@pytest.mark.asyncio
class TestAuthentication:
    """Test authentication endpoints"""
    
    async def test_register_success(self, async_client: AsyncClient, test_user_data: dict):
        """Test successful user registration"""
        response = await async_client.post(
            f"{settings.API_V1_PREFIX}/auth/register",
            json=test_user_data
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == test_user_data["email"]
        assert data["username"] == test_user_data["username"]
        assert "hashed_password" not in data
        assert data["is_active"] is True
    
    async def test_register_duplicate_email(self, async_client: AsyncClient, test_user_data: dict):
        """Test registration with duplicate email"""
        # First registration
        await async_client.post(
            f"{settings.API_V1_PREFIX}/auth/register",
            json=test_user_data
        )
        
        # Attempt duplicate
        response = await async_client.post(
            f"{settings.API_V1_PREFIX}/auth/register",
            json=test_user_data
        )
        
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"].lower()
    
    async def test_register_weak_password(self, async_client: AsyncClient, test_user_data: dict):
        """Test registration with weak password"""
        test_user_data["password"] = "weak"
        
        response = await async_client.post(
            f"{settings.API_V1_PREFIX}/auth/register",
            json=test_user_data
        )
        
        assert response.status_code == 422  # Validation error
    
    async def test_login_success(self, async_client: AsyncClient, test_user_data: dict):
        """Test successful login"""
        # Register first
        await async_client.post(
            f"{settings.API_V1_PREFIX}/auth/register",
            json=test_user_data
        )
        
        # Login
        response = await async_client.post(
            f"{settings.API_V1_PREFIX}/auth/login",
            json={
                "email": test_user_data["email"],
                "password": test_user_data["password"]
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
    
    async def test_login_wrong_password(self, async_client: AsyncClient, test_user_data: dict):
        """Test login with wrong password"""
        # Register first
        await async_client.post(
            f"{settings.API_V1_PREFIX}/auth/register",
            json=test_user_data
        )
        
        # Login with wrong password
        response = await async_client.post(
            f"{settings.API_V1_PREFIX}/auth/login",
            json={
                "email": test_user_data["email"],
                "password": "WrongPassword123"
            }
        )
        
        assert response.status_code == 401
    
    async def test_login_nonexistent_user(self, async_client: AsyncClient):
        """Test login with nonexistent user"""
        response = await async_client.post(
            f"{settings.API_V1_PREFIX}/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "SomePassword123"
            }
        )
        
        assert response.status_code == 401
    
    async def test_refresh_token(self, async_client: AsyncClient, test_user_data: dict):
        """Test token refresh"""
        # Register and login
        await async_client.post(
            f"{settings.API_V1_PREFIX}/auth/register",
            json=test_user_data
        )
        
        login_response = await async_client.post(
            f"{settings.API_V1_PREFIX}/auth/login",
            json={
                "email": test_user_data["email"],
                "password": test_user_data["password"]
            }
        )
        
        tokens = login_response.json()
        
        # Refresh token
        client.headers["Authorization"] = f"Bearer {tokens['refresh_token']}"
        response = await async_client.post(
            f"{settings.API_V1_PREFIX}/auth/refresh"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
    
    async def test_access_protected_endpoint_without_token(self, async_client: AsyncClient):
        """Test accessing protected endpoint without token"""
        response = await async_client.get(f"{settings.API_V1_PREFIX}/users/me")
        
        assert response.status_code == 403  # HTTPBearer returns 403
    
    async def test_access_protected_endpoint_with_token(
        self,
        authenticated_client: tuple[AsyncClient, dict]
    ):
        """Test accessing protected endpoint with valid token"""
        client, user_data = authenticated_client
        
        response = await async_client.get(f"{settings.API_V1_PREFIX}/users/me")
        
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == user_data["email"]

