"""
Test Auth Service

Unit tests for authentication service
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import AsyncMock, patch

from backend.services.auth_service import AuthService
from backend.models.company import Company, CompanyStatus
from backend.core.exceptions import (
    ResourceNotFoundError,
    ValidationError,
    AuthenticationError,
    BusinessLogicError
)


@pytest.mark.unit
@pytest.mark.auth
class TestAuthService:
    """Test cases for AuthService"""
    
    @pytest.mark.asyncio
    async def test_register_company_success(self, db_session: AsyncSession):
        """Test successful company registration."""
        password = "TestPassword123!"
        company_data = {
            "company_name": "Test Company Inc",
            "rep_first_name": "John",
            "rep_last_name": "Doe",
            "rep_phone": "+1234567890",
            "billing_address_line1": "123 Test Street",
            "billing_city": "Test City",
            "billing_state": "TS",
            "billing_zip": "12345",
            "billing_country": "USA"
        }
        email = "john@testcompany.com"
        
        company = await AuthService.register_company(
            db_session, 
            email, 
            password, 
            company_data
        )
        
        assert company.company_name == company_data["company_name"]
        assert company.rep_email == email
        assert company.status == CompanyStatus.PENDING
        assert company.hashed_password is not None
        assert company.hashed_password != password
    
    @pytest.mark.asyncio
    async def test_register_company_duplicate_email(self, db_session: AsyncSession):
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
        await AuthService.register_company(db_session, company_data)
        
        # Try to register second company with same email
        company_data["company_name"] = "Another Company"
        
        with pytest.raises(ValidationError) as exc_info:
            await AuthService.register_company(db_session, company_data)
        
        assert "email" in str(exc_info.value).lower()
    
    @pytest.mark.asyncio
    async def test_register_company_invalid_password(self, db_session: AsyncSession):
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
        
        with pytest.raises(ValidationError) as exc_info:
            await AuthService.register_company(db_session, company_data)
        
        assert "password" in str(exc_info.value).lower()
    
    @pytest.mark.asyncio
    async def test_login_company_success(self, db_session: AsyncSession):
        """Test successful company login."""
        # Create a company first
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
        
        company = await AuthService.register_company(db_session, company_data)
        
        # Activate the company
        company.status = CompanyStatus.ACTIVE
        await db_session.commit()
        
        # Test login
        login_data = {
            "email": company_data["contact_email"],
            "password": company_data["password"]
        }
        
        result = await AuthService.login_company(db_session, login_data)
        
        assert "access_token" in result
        assert "refresh_token" in result
        assert "company" in result
        assert result["company"]["id"] == company.id
    
    @pytest.mark.asyncio
    async def test_login_company_invalid_credentials(self, db_session: AsyncSession):
        """Test company login with invalid credentials."""
        login_data = {
            "email": "nonexistent@test.com",
            "password": "WrongPassword123!"
        }
        
        with pytest.raises(AuthenticationError) as exc_info:
            await AuthService.login_company(db_session, login_data)
        
        assert "invalid" in str(exc_info.value).lower()
    
    @pytest.mark.asyncio
    async def test_login_company_inactive_status(self, db_session: AsyncSession):
        """Test company login with inactive status."""
        # Create a company first
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
        
        company = await AuthService.register_company(db_session, company_data)
        # Company remains PENDING status
        
        # Test login
        login_data = {
            "email": company_data["contact_email"],
            "password": company_data["password"]
        }
        
        with pytest.raises(BusinessLogicError) as exc_info:
            await AuthService.login_company(db_session, login_data)
        
        assert "approved" in str(exc_info.value).lower()
    
    @pytest.mark.asyncio
    async def test_get_company_by_id_success(self, db_session: AsyncSession):
        """Test successful company retrieval by ID."""
        # Create a company first
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
        
        company = await AuthService.register_company(db_session, company_data)
        
        # Test retrieval
        retrieved_company = await AuthService.get_company_by_id(db_session, company.id)
        
        assert retrieved_company.id == company.id
        assert retrieved_company.company_name == company.company_name
        assert retrieved_company.contact_email == company.contact_email
    
    @pytest.mark.asyncio
    async def test_get_company_by_id_not_found(self, db_session: AsyncSession):
        """Test company retrieval with non-existent ID."""
        with pytest.raises(ResourceNotFoundError) as exc_info:
            await AuthService.get_company_by_id(db_session, 99999)
        
        assert "company" in str(exc_info.value).lower()
    
    @pytest.mark.asyncio
    async def test_get_company_by_email_success(self, db_session: AsyncSession):
        """Test successful company retrieval by email."""
        # Create a company first
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
        
        company = await AuthService.register_company(db_session, company_data)
        
        # Test retrieval
        retrieved_company = await AuthService.get_company_by_email(db_session, company.contact_email)
        
        assert retrieved_company.id == company.id
        assert retrieved_company.company_name == company.company_name
        assert retrieved_company.contact_email == company.contact_email
    
    @pytest.mark.asyncio
    async def test_get_company_by_email_not_found(self, db_session: AsyncSession):
        """Test company retrieval with non-existent email."""
        with pytest.raises(ResourceNotFoundError) as exc_info:
            await AuthService.get_company_by_email(db_session, "nonexistent@test.com")
        
        assert "company" in str(exc_info.value).lower()
    
    @pytest.mark.asyncio
    async def test_refresh_token_success(self, db_session: AsyncSession):
        """Test successful token refresh."""
        # Create a company first
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
        
        company = await AuthService.register_company(db_session, company_data)
        
        # Create refresh token
        from backend.core.security import create_refresh_token
        refresh_token = create_refresh_token(data={"sub": str(company.id), "type": "company"})
        
        # Test refresh
        result = await AuthService.refresh_token(db_session, refresh_token)
        
        assert "access_token" in result
        assert "refresh_token" in result
        assert "company" in result
        assert result["company"]["id"] == company.id
    
    @pytest.mark.asyncio
    async def test_refresh_token_invalid(self, db_session: AsyncSession):
        """Test token refresh with invalid token."""
        with pytest.raises(AuthenticationError) as exc_info:
            await AuthService.refresh_token(db_session, "invalid_token")
        
        assert "invalid" in str(exc_info.value).lower()
    
    @pytest.mark.asyncio
    async def test_change_password_success(self, db_session: AsyncSession):
        """Test successful password change."""
        # Create a company first
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
        
        company = await AuthService.register_company(db_session, company_data)
        old_password_hash = company.password_hash
        
        # Test password change
        new_password = "NewPassword123!"
        await AuthService.change_password(db_session, company.id, "TestPassword123!", new_password)
        
        # Verify password changed
        await db_session.refresh(company)
        assert company.password_hash != old_password_hash
        
        # Verify new password works
        login_data = {
            "email": company_data["contact_email"],
            "password": new_password
        }
        
        company.status = CompanyStatus.ACTIVE
        await db_session.commit()
        
        result = await AuthService.login_company(db_session, login_data)
        assert "access_token" in result
    
    @pytest.mark.asyncio
    async def test_change_password_wrong_current(self, db_session: AsyncSession):
        """Test password change with wrong current password."""
        # Create a company first
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
        
        company = await AuthService.register_company(db_session, company_data)
        
        # Test password change with wrong current password
        with pytest.raises(AuthenticationError) as exc_info:
            await AuthService.change_password(db_session, company.id, "WrongPassword123!", "NewPassword123!")
        
        assert "current password" in str(exc_info.value).lower()
