"""
Test Auth Service

Unit tests for authentication service
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.exceptions import (
    AccountSuspendedError,
    InvalidCredentialsError,
    ResourceAlreadyExistsError,
    ResourceNotFoundError,
)
from backend.models.company import CompanyStatus
from backend.services.auth_service import AuthService


@pytest.mark.unit
@pytest.mark.auth
class TestAuthService:
    """Test cases for AuthService"""
    
    @pytest.mark.asyncio
    async def test_register_company_success(self, db_session: AsyncSession):
        """Test successful company registration."""
        import uuid
        
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
        # Use unique email to avoid conflicts with test_company fixture
        email = f"john-{uuid.uuid4().hex[:8]}@testcompany.com"
        
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
        import uuid
        
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
        # Use unique email for this specific test
        email = f"duplicate-{uuid.uuid4().hex[:8]}@testcompany.com"
        
        # Register first company
        await AuthService.register_company(db_session, email, password, company_data)
        
        # Try to register second company with same email
        company_data["company_name"] = "Another Company"
        
        with pytest.raises(ResourceAlreadyExistsError):
            await AuthService.register_company(db_session, email, password, company_data)
    
    @pytest.mark.asyncio
    async def test_authenticate_company_success(self, db_session: AsyncSession):
        """Test successful company authentication."""
        import uuid
        
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
        # Use unique email to avoid conflicts
        email = f"auth-{uuid.uuid4().hex[:8]}@testcompany.com"
        
        # Register company
        company = await AuthService.register_company(
            db_session, email, password, company_data
        )
        
        # Activate the company
        company.status = CompanyStatus.ACTIVE
        company.is_active = True
        await db_session.commit()
        
        # Test authentication
        authenticated_company, tokens = await AuthService.authenticate_company(
            db_session, email, password
        )
        
        assert authenticated_company.id == company.id
        assert "access_token" in tokens
        assert "refresh_token" in tokens
        assert "token_type" in tokens
    
    @pytest.mark.asyncio
    async def test_authenticate_company_invalid_credentials(self, db_session: AsyncSession):
        """Test company authentication with invalid credentials."""
        with pytest.raises(InvalidCredentialsError):
            await AuthService.authenticate_company(
                db_session, "nonexistent@test.com", "WrongPassword123!"
            )
    
    @pytest.mark.asyncio
    async def test_authenticate_company_inactive_account(self, db_session: AsyncSession):
        """Test company authentication with inactive account."""
        import uuid
        
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
        # Use unique email to avoid conflicts
        email = f"inactive-{uuid.uuid4().hex[:8]}@testcompany.com"
        
        # Register company
        company = await AuthService.register_company(
            db_session, email, password, company_data
        )
        
        # Deactivate the company
        company.is_active = False
        await db_session.commit()
        
        # Test authentication should fail
        with pytest.raises(AccountSuspendedError):
            await AuthService.authenticate_company(db_session, email, password)
    
    # Note: AuthService doesn't have get_company_by_id or get_company_by_email methods
    # These would be handled by AdminService or direct database queries if needed
    
    @pytest.mark.asyncio
    async def test_refresh_access_token_success(self, db_session: AsyncSession, test_company):
        """Test successful token refresh."""
        from jose import jwt

        from backend.core.config import settings
        from backend.core.security import security_manager
        
        # Authenticate to get tokens
        test_company.status = CompanyStatus.ACTIVE
        test_company.is_active = True
        await db_session.commit()
        
        _, tokens = await AuthService.authenticate_company(
            db_session, test_company.rep_email, "TestPassword123!"
        )
        refresh_token = tokens["refresh_token"]
        
        # Decode token to get payload
        token_payload = jwt.decode(
            refresh_token, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM]
        )
        
        # Test refresh
        new_tokens = await AuthService.refresh_access_token(
            db_session, token_payload, refresh_token
        )
        
        assert "access_token" in new_tokens
        assert "refresh_token" in new_tokens
    
    @pytest.mark.asyncio
    async def test_change_password_success(self, db_session: AsyncSession, test_company):
        """Test successful password change."""
        old_password_hash = test_company.hashed_password
        
        # Test password change
        new_password = "NewPassword123!"
        await AuthService.change_password(
            db_session, test_company.id, "TestPassword123!", new_password, "company"
        )
        
        # Verify password changed
        await db_session.refresh(test_company)
        assert test_company.hashed_password != old_password_hash
        
        # Verify new password works
        test_company.status = CompanyStatus.ACTIVE
        test_company.is_active = True
        await db_session.commit()
        
        _, tokens = await AuthService.authenticate_company(
            db_session, test_company.rep_email, new_password
        )
        assert "access_token" in tokens
    
    @pytest.mark.asyncio
    async def test_change_password_wrong_current(self, db_session: AsyncSession, test_company):
        """Test password change with wrong current password."""
        with pytest.raises(InvalidCredentialsError):
            await AuthService.change_password(
                db_session, test_company.id, "WrongPassword123!", "NewPassword123!", "company"
            )
