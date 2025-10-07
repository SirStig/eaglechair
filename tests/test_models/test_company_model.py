"""
Unit Tests for Company Models

Tests all company model functionality
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.company import Company, CompanyStatus, AdminUser, AdminRole
from backend.core.security import SecurityManager

security_manager = SecurityManager()


@pytest.mark.unit
@pytest.mark.asyncio
class TestCompanyModel:
    """Test cases for Company model"""
    
    async def test_create_company(self, db_session: AsyncSession):
        """Test creating a new company."""
        company = Company(
            company_name="Test Company",
            rep_first_name="John",
            rep_last_name="Doe",
            rep_email="john@test.com",
            rep_phone="+1234567890",
            billing_address_line1="123 Main St",
            billing_city="Test City",
            billing_state="TS",
            billing_zip="12345",
            billing_country="USA",
            hashed_password=security_manager.hash_password("TestPassword123!"),
            status=CompanyStatus.PENDING
        )
        
        db_session.add(company)
        await db_session.commit()
        await db_session.refresh(company)
        
        assert company.id is not None
        assert company.company_name == "Test Company"
        assert company.status == CompanyStatus.PENDING
        assert company.created_at is not None
    
    async def test_company_password_verification(self, db_session: AsyncSession):
        """Test password verification for company."""
        password = "TestPassword123!"
        company = Company(
            company_name="Test Company",
            rep_first_name="John",
            rep_last_name="Doe",
            rep_email="john@test.com",
            rep_phone="+1234567890",
            billing_address_line1="123 Main St",
            billing_city="Test City",
            billing_state="TS",
            billing_zip="12345",
            billing_country="USA",
            hashed_password=security_manager.hash_password(password),
            status=CompanyStatus.ACTIVE
        )
        
        db_session.add(company)
        await db_session.commit()
        await db_session.refresh(company)
        
        # Verify correct password
        assert security_manager.verify_password(password, company.hashed_password) is True
        
        # Verify incorrect password
        assert security_manager.verify_password("WrongPassword", company.hashed_password) is False
    
    async def test_company_unique_email(self, db_session: AsyncSession):
        """Test that company email must be unique."""
        company1 = Company(
            company_name="Test Company 1",
            rep_first_name="John",
            rep_last_name="Doe",
            rep_email="john@test.com",
            rep_phone="+1234567890",
            billing_address_line1="123 Main St",
            billing_city="Test City",
            billing_state="TS",
            billing_zip="12345",
            billing_country="USA",
            hashed_password=security_manager.hash_password("TestPassword123!"),
            status=CompanyStatus.ACTIVE
        )
        
        db_session.add(company1)
        await db_session.commit()
        
        # Try to create another company with same email
        company2 = Company(
            company_name="Test Company 2",
            rep_first_name="Jane",
            rep_last_name="Smith",
            rep_email="john@test.com",  # Same email
            rep_phone="+1234567891",
            billing_address_line1="456 Oak Ave",
            billing_city="Test City",
            billing_state="TS",
            billing_zip="12345",
            billing_country="USA",
            hashed_password=security_manager.hash_password("TestPassword123!"),
            status=CompanyStatus.ACTIVE
        )
        
        db_session.add(company2)
        
        with pytest.raises(Exception):  # Should raise IntegrityError
            await db_session.commit()
    
    async def test_company_status_transitions(self, db_session: AsyncSession):
        """Test company status transitions."""
        company = Company(
            company_name="Test Company",
            rep_first_name="John",
            rep_last_name="Doe",
            rep_email="john@test.com",
            rep_phone="+1234567890",
            billing_address_line1="123 Main St",
            billing_city="Test City",
            billing_state="TS",
            billing_zip="12345",
            billing_country="USA",
            hashed_password=security_manager.hash_password("TestPassword123!"),
            status=CompanyStatus.PENDING
        )
        
        db_session.add(company)
        await db_session.commit()
        await db_session.refresh(company)
        
        # Test status change
        company.status = CompanyStatus.ACTIVE
        await db_session.commit()
        await db_session.refresh(company)
        
        assert company.status == CompanyStatus.ACTIVE
        
        # Test suspension
        company.status = CompanyStatus.SUSPENDED
        await db_session.commit()
        await db_session.refresh(company)
        
        assert company.status == CompanyStatus.SUSPENDED


@pytest.mark.unit
@pytest.mark.asyncio
class TestAdminUserModel:
    """Test cases for AdminUser model"""
    
    async def test_create_admin_user(self, db_session: AsyncSession):
        """Test creating a new admin user."""
        admin = AdminUser(
            username="testadmin",
            email="admin@test.com",
            hashed_password=security_manager.hash_password("AdminPassword123!"),
            first_name="Test",
            last_name="Admin",
            role=AdminRole.ADMIN,
            is_active=True
        )
        
        db_session.add(admin)
        await db_session.commit()
        await db_session.refresh(admin)
        
        assert admin.id is not None
        assert admin.username == "testadmin"
        assert admin.role == AdminRole.ADMIN
        assert admin.is_active is True
        assert admin.created_at is not None
    
    async def test_admin_user_roles(self, db_session: AsyncSession):
        """Test different admin user roles."""
        roles = [AdminRole.ADMIN, AdminRole.EDITOR, AdminRole.VIEWER]
        
        for i, role in enumerate(roles):
            admin = AdminUser(
                username=f"admin{i}",
                email=f"admin{i}@test.com",
                hashed_password=security_manager.hash_password("AdminPassword123!"),
                first_name="Test",
                last_name=f"Admin {i}",
                role=role,
                is_active=True
            )
            
            db_session.add(admin)
        
        await db_session.commit()
        
        # Verify all admins created
        from sqlalchemy import select
        result = await db_session.execute(select(AdminUser))
        admins = result.scalars().all()
        
        assert len(admins) == 3
        assert set(admin.role for admin in admins) == set(roles)
    
    async def test_admin_user_unique_username(self, db_session: AsyncSession):
        """Test that admin username must be unique."""
        admin1 = AdminUser(
            username="testadmin",
            email="admin1@test.com",
            hashed_password=security_manager.hash_password("AdminPassword123!"),
            first_name="Test",
            last_name="Admin",
            role=AdminRole.ADMIN,
            is_active=True
        )
        
        db_session.add(admin1)
        await db_session.commit()
        
        # Try to create another admin with same username
        admin2 = AdminUser(
            username="testadmin",  # Same username
            email="admin2@test.com",
            hashed_password=security_manager.hash_password("AdminPassword123!"),
            first_name="Test",
            last_name="Admin 2",
            role=AdminRole.EDITOR,
            is_active=True
        )
        
        db_session.add(admin2)
        
        with pytest.raises(Exception):  # Should raise IntegrityError
            await db_session.commit()
    
    async def test_admin_user_password_verification(self, db_session: AsyncSession):
        """Test password verification for admin user."""
        password = "AdminPassword123!"
        admin = AdminUser(
            username="testadmin",
            email="admin@test.com",
            hashed_password=security_manager.hash_password(password),
            first_name="Test",
            last_name="Admin",
            role=AdminRole.ADMIN,
            is_active=True
        )
        
        db_session.add(admin)
        await db_session.commit()
        await db_session.refresh(admin)
        
        # Verify correct password
        assert security_manager.verify_password(password, admin.hashed_password) is True
        
        # Verify incorrect password
        assert security_manager.verify_password("WrongPassword", admin.hashed_password) is False

