"""
Pytest Configuration and Fixtures

Global test configuration and shared fixtures
"""

import asyncio
import pytest
import pytest_asyncio
from typing import AsyncGenerator, Generator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from httpx import AsyncClient
from fastapi.testclient import TestClient

from backend.main import app
from backend.database.base import get_db, Base
from backend.core.config import settings


# Test database URL (using SQLite for testing)
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def test_engine():
    """Create test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        future=True
    )
    
    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    # Drop all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create a test database session."""
    async_session = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False
    )
    
    async with async_session() as session:
        yield session


@pytest.fixture
def client(db_session: AsyncSession) -> TestClient:
    """Create a test client."""
    
    def override_get_db():
        return db_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as test_client:
        yield test_client
    
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def async_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create an async test client."""
    
    def override_get_db():
        return db_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    
    app.dependency_overrides.clear()


# ============================================================================
# Test Data Fixtures
# ============================================================================

@pytest.fixture
def sample_company_data():
    """Sample company data for testing."""
    return {
        "company_name": "Test Company Inc",
        "contact_name": "John Doe",
        "contact_email": "john@testcompany.com",
        "contact_phone": "+1234567890",
        "address_line1": "123 Test Street",
        "address_line2": "Suite 100",
        "city": "Test City",
        "state": "TS",
        "zip_code": "12345",
        "country": "USA",
        "website": "https://testcompany.com",
        "industry": "Technology",
        "company_size": "50-100",
        "tax_id": "12-3456789"
    }


@pytest.fixture
def sample_product_data():
    """Sample product data for testing."""
    return {
        "name": "Test Executive Chair",
        "description": "A premium executive chair for testing",
        "model_number": "TEC-001",
        "base_price": 49999,  # $499.99 in cents
        "minimum_order_quantity": 1,
        "is_active": True,
        "specifications": {
            "seat_height": "18-22 inches",
            "weight_capacity": "300 lbs"
        },
        "features": ["Lumbar support", "Adjustable height"],
        "dimensions": {
            "width": 24,
            "depth": 26,
            "height": 42
        },
        "weight": 45.5,
        "materials": ["Leather", "Steel"],
        "colors": ["Black", "Brown"]
    }


@pytest.fixture
def sample_admin_data():
    """Sample admin data for testing."""
    return {
        "username": "testadmin",
        "email": "admin@test.com",
        "password": "TestPassword123!",
        "first_name": "Test",
        "last_name": "Admin",
        "role": "admin"
    }


# ============================================================================
# Authentication Fixtures
# ============================================================================

@pytest_asyncio.fixture
async def test_company(db_session: AsyncSession, sample_company_data):
    """Create a test company."""
    from backend.models.company import Company
    from backend.core.security import hash_password
    
    company = Company(
        **sample_company_data,
        password_hash=hash_password("TestPassword123!"),
        status="active"
    )
    
    db_session.add(company)
    await db_session.commit()
    await db_session.refresh(company)
    
    return company


@pytest_asyncio.fixture
async def test_admin(db_session: AsyncSession, sample_admin_data):
    """Create a test admin user."""
    from backend.models.company import AdminUser
    from backend.core.security import hash_password
    
    admin = AdminUser(
        **sample_admin_data,
        password_hash=hash_password(sample_admin_data["password"]),
        is_active=True
    )
    
    db_session.add(admin)
    await db_session.commit()
    await db_session.refresh(admin)
    
    return admin


@pytest_asyncio.fixture
async def company_token(test_company):
    """Generate a JWT token for test company."""
    from backend.core.security import create_access_token
    
    token_data = {
        "sub": str(test_company.id),
        "type": "company",
        "email": test_company.contact_email
    }
    
    return create_access_token(data=token_data)


@pytest_asyncio.fixture
async def admin_token(test_admin):
    """Generate a JWT token for test admin."""
    from backend.core.security import create_access_token
    
    token_data = {
        "sub": str(test_admin.id),
        "type": "admin",
        "email": test_admin.email,
        "role": test_admin.role
    }
    
    return create_access_token(data=token_data)


# ============================================================================
# Test Utilities
# ============================================================================

def assert_response_success(response, expected_status=200):
    """Assert that a response is successful."""
    assert response.status_code == expected_status
    assert "error" not in response.json()


def assert_response_error(response, expected_status=400):
    """Assert that a response contains an error."""
    assert response.status_code == expected_status
    assert "error" in response.json() or "detail" in response.json()