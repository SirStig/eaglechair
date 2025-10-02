"""
Pytest Configuration and Fixtures for EagleChair Tests

Provides test database, async client, and factory fixtures
"""

import pytest
import asyncio
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from backend.main import app
from backend.database.base import Base, get_db
from backend.core.config import settings


# Set testing mode
settings.TESTING = True

# Create test database engine
test_engine = create_async_engine(
    settings.TEST_DATABASE_URL,
    echo=False,
)

# Create test session factory
TestSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest.fixture(scope="session")
def event_loop():
    """
    Create an instance of the default event loop for each test case.
    """
    policy = asyncio.get_event_loop_policy()
    loop = policy.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Fixture to provide a clean database session for each test
    
    Creates all tables before the test and drops them after
    """
    # Create tables
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Create session
    async with TestSessionLocal() as session:
        yield session
    
    # Drop tables
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """
    Fixture to provide an async HTTP client for testing API endpoints
    
    Overrides the get_db dependency to use the test database
    """
    # Override dependency
    async def override_get_db():
        try:
            yield db_session
            await db_session.commit()
        except Exception:
            await db_session.rollback()
            raise
    
    app.dependency_overrides[get_db] = override_get_db
    
    # Create client
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    
    # Clean up
    app.dependency_overrides.clear()


@pytest.fixture
def test_user_data():
    """
    Fixture providing sample user data for tests
    """
    return {
        "email": "test@example.com",
        "username": "testuser",
        "password": "TestPassword123",
        "first_name": "Test",
        "last_name": "User",
    }


@pytest.fixture
def test_product_data():
    """
    Fixture providing sample product data for tests
    """
    return {
        "sku": "CHAIR-001",
        "name": "Executive Office Chair",
        "description": "Premium ergonomic office chair",
        "price": 299.99,
        "stock_quantity": 50,
        "category": "office",
        "brand": "EagleChair",
        "color": "Black",
        "material": "Leather",
        "slug": "executive-office-chair",
    }


@pytest.fixture
async def authenticated_client(
    client: AsyncClient,
    test_user_data: dict,
    db_session: AsyncSession
) -> tuple[AsyncClient, dict]:
    """
    Fixture providing an authenticated client with access token
    
    Returns:
        tuple: (client, user_data) - Client with auth headers and user info
    """
    # Register user
    response = await client.post(
        f"{settings.API_V1_PREFIX}/auth/register",
        json=test_user_data
    )
    assert response.status_code == 201
    
    # Login to get tokens
    login_response = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        }
    )
    assert login_response.status_code == 200
    
    tokens = login_response.json()
    
    # Set authorization header
    client.headers["Authorization"] = f"Bearer {tokens['access_token']}"
    
    return client, test_user_data

