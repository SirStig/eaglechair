"""
Pytest Configuration and Fixtures

Global test configuration and shared fixtures
"""

import asyncio
import os
import sys
from pathlib import Path
from typing import AsyncGenerator, Generator

# Test database URL (using SQLite for testing)
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"

# Set test environment variables BEFORE importing app. TESTING=true also makes
# backend.core.config skip backend/.env* files, so a developer's .env.local
# (local Postgres/Redis, DEBUG, CORS origins) never leaks into test settings.
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["TESTING"] = "true"
os.environ["ENVIRONMENT"] = "test"
os.environ["DEBUG"] = "false"
# The app's own engine (used by the lifespan startup tasks) points at the test
# DB, never a real one
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
# Nothing listens on port 1: Redis-backed code paths fall back to in-process
# behaviour instead of sharing state through a developer's live Redis
os.environ["REDIS_URL"] = "redis://127.0.0.1:1/0"
os.environ["ENABLE_CACHE"] = "false"

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.core.config import get_settings
from backend.database.base import Base, get_db

# Clear settings cache and reload with test environment
get_settings.cache_clear()
settings = get_settings()

# Lazy import of app to avoid import errors for optional dependencies
_app = None

def get_app():
    """Lazy import of FastAPI app"""
    global _app
    if _app is None:
        from backend.main import app
        _app = app
    return _app


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

    # pysqlite/aiosqlite defer BEGIN and don't support SAVEPOINT properly;
    # take over transaction control so the per-test SAVEPOINTs in db_session
    # work (SQLAlchemy's documented SQLite recipe)
    @event.listens_for(engine.sync_engine, "connect")
    def _sqlite_connect(dbapi_connection, connection_record):
        dbapi_connection.isolation_level = None

    @event.listens_for(engine.sync_engine, "begin")
    def _sqlite_begin(conn):
        conn.exec_driver_sql("BEGIN")

    # Register every model on Base.metadata before create_all, whichever test
    # module happens to run first
    import backend.models  # noqa: F401

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
    """Create a test database session with transaction rollback for isolation."""
    async_session = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False
    )
    
    # Create a connection and start a transaction
    connection = await test_engine.connect()
    trans = await connection.begin()
    try:
        # Bind the session to this connection. Session commit/rollback only
        # touch a SAVEPOINT, so a test that hits an IntegrityError and rolls
        # back can't end the outer transaction this fixture rolls back.
        session = async_session(bind=connection, join_transaction_mode="create_savepoint")
        try:
            yield session
        finally:
            await session.close()
    finally:
        # Rollback transaction to ensure clean state between tests
        await trans.rollback()
        await connection.close()


@pytest.fixture
def client(db_session: AsyncSession) -> TestClient:
    """Create a test client."""
    app = get_app()
    
    def override_get_db():
        return db_session
    
    app.dependency_overrides[get_db] = override_get_db

    # Browsers send Origin on state-changing requests; the CSRF middleware
    # rejects cookie-authenticated POST/PUT/PATCH/DELETE without a trusted one
    with TestClient(app, headers={"Origin": "http://testserver"}) as test_client:
        yield test_client
    
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def async_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create an async test client."""
    from httpx import ASGITransport
    app = get_app()
    
    # Rate limiting is already disabled via environment variables set at module level
    # Settings should reflect this via get_settings()
    
    def override_get_db():
        return db_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    transport = ASGITransport(app=app)
    # Same-origin Origin header, as a browser would send (see CSRF middleware)
    async with AsyncClient(
        transport=transport, base_url="http://test", headers={"Origin": "http://test"}
    ) as ac:
        yield ac
    
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def static_export_dir(tmp_path_factory, monkeypatch):
    """
    Point the CMS static exporter at a temp dir so tests never write
    contentData.json into the repo. Yields the frontend path used; the files
    land in <path>/data/.
    """
    from backend.utils import static_content_exporter

    frontend_dir = tmp_path_factory.mktemp("frontend_export")
    monkeypatch.setattr(
        static_content_exporter.StaticContentExporter,
        "_resolve_frontend_path",
        lambda self, custom_path=None: Path(custom_path) if custom_path else frontend_dir,
    )
    monkeypatch.setattr(static_content_exporter, "_exporter_instance", None)
    yield frontend_dir


@pytest.fixture(autouse=True)
def reset_ephemeral_store():
    """Clear in-process login-failure counters / WebAuthn challenges between tests"""
    from backend.core.ephemeral_store import ephemeral_store

    ephemeral_store.clear_memory()
    yield
    ephemeral_store.clear_memory()


def _reset_ddos_state() -> None:
    """Forget per-IP request history in the app's DDoS middleware."""
    main = sys.modules.get("backend.main")
    if main is None or main.app.middleware_stack is None:
        return  # app not imported / stack not built yet: nothing tracked

    from backend.core.middleware.ddos_protection import DDoSProtectionMiddleware

    node = main.app.middleware_stack
    while node is not None:
        if isinstance(node, DDoSProtectionMiddleware):
            node.request_counts.clear()
            node.banned_ips.clear()
            node.suspicious_ips.clear()
        node = getattr(node, "app", None)


@pytest.fixture(autouse=True)
def reset_ddos_counters():
    """
    Every test request comes from the same client IP, and the in-process DDoS
    middleware bans an IP after RATE_LIMIT_PER_MINUTE*2 requests a minute. The
    middleware stays enabled (it has its own behaviour worth exercising), but
    its per-IP history is reset per test so request counts never carry over.
    """
    _reset_ddos_state()
    yield
    _reset_ddos_state()


# ============================================================================
# Test Data Fixtures
# ============================================================================

@pytest.fixture
def sample_company_data():
    """Sample company data for testing."""
    return {
        "company_name": "Test Company Inc",
        "legal_name": "Test Company LLC",
        "tax_id": "12-3456789",
        "industry": "Technology",
        "website": "https://testcompany.com",
        "rep_first_name": "John",
        "rep_last_name": "Doe",
        "rep_title": "CEO",
        "rep_email": "john@testcompany.com",
        "rep_phone": "+1234567890",
        "billing_address_line1": "123 Test Street",
        "billing_address_line2": "Suite 100",
        "billing_city": "Test City",
        "billing_state": "TS",
        "billing_zip": "12345",
        "billing_country": "USA"
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
async def test_company(db_session: AsyncSession):
    """Create a test company using factory."""
    from backend.models.company import CompanyStatus
    from tests.factories import create_company
    
    # An approved company that has verified its email (quote requests are
    # refused with ACCOUNT_NOT_VERIFIED until it has)
    company = await create_company(
        db_session,
        status=CompanyStatus.ACTIVE,
        is_active=True,
        is_verified=True,
    )
    return company


@pytest_asyncio.fixture
async def test_admin(db_session: AsyncSession):
    """Create a test admin user using factory."""
    from tests.factories import create_admin
    
    admin = await create_admin(db_session)
    return admin


@pytest_asyncio.fixture
async def company_token(test_company):
    """Generate a JWT token for test company."""
    from backend.core.security import SecurityManager
    
    security_manager = SecurityManager()
    token_data = {
        "sub": str(test_company.id),
        "type": "company",
        "email": test_company.rep_email
    }
    
    return security_manager.create_access_token(data=token_data)


@pytest_asyncio.fixture
async def admin_token(test_admin):
    """Generate a JWT token for test admin."""
    from backend.core.security import SecurityManager
    
    security_manager = SecurityManager()
    token_data = {
        "sub": str(test_admin.id),
        "type": "admin",
        "email": test_admin.email,
        "role": test_admin.role.value
    }
    
    return security_manager.create_access_token(data=token_data)


@pytest_asyncio.fixture
async def admin_headers(db_session: AsyncSession, test_admin, admin_token):
    """
    Headers for a fully authenticated admin. Admin routes need the JWT plus
    the per-login session and admin tokens (dual-token admin auth, enforced by
    RouteProtectionMiddleware and get_current_admin).
    """
    import secrets

    from backend.core.security import SecurityManager

    session_token = secrets.token_urlsafe(32)
    admin_session_token = secrets.token_urlsafe(32)
    test_admin.session_token = SecurityManager.hash_token(session_token)
    test_admin.admin_token = SecurityManager.hash_token(admin_session_token)
    await db_session.commit()
    return {
        "Authorization": f"Bearer {admin_token}",
        "X-Session-Token": session_token,
        "X-Admin-Token": admin_session_token,
    }


@pytest_asyncio.fixture
async def test_category(db_session):
    """Create a test category using factory."""
    from tests.factories import create_category
    return await create_category(db_session)


@pytest_asyncio.fixture
async def test_chair(db_session, test_category):
    """Create a test chair using factory."""
    from tests.factories import create_chair
    return await create_chair(db_session, category_id=test_category.id)


@pytest_asyncio.fixture
async def test_quote(db_session, test_company):
    """Create a test quote using factory."""
    from tests.factories import create_quote
    return await create_quote(db_session, company_id=test_company.id)


@pytest_asyncio.fixture
async def test_finish(db_session):
    """Create a test finish using factory."""
    from tests.factories import create_finish
    return await create_finish(db_session)


@pytest_asyncio.fixture
async def test_upholstery(db_session):
    """Create a test upholstery using factory."""
    from tests.factories import create_upholstery
    return await create_upholstery(db_session)


# ============================================================================
# Test Utilities
# ============================================================================

def assert_response_success(response, expected_status=200):
    """Assert that a response is successful."""
    assert response.status_code == expected_status
    assert "error" not in response.json()


@pytest.fixture
def test_user_data():
    """Test user data for registration tests."""
    return {
        "company_name": "Test Company",
        "legal_name": "Test Company LLC",
        "tax_id": "12-3456789",
        "industry": "Technology",
        "website": "https://testcompany.com",
        "rep_first_name": "John",
        "rep_last_name": "Doe",
        "rep_title": "CEO",
        "rep_email": "john.doe@testcompany.com",
        "rep_phone": "555-123-4567",
        "password": "TestPassword123!",
        "billing_address_line1": "123 Test St",
        "billing_address_line2": "Suite 100",
        "billing_city": "Test City",
        "billing_state": "TS",
        "billing_zip": "12345",
        "billing_country": "United States",
        "shipping_address_line1": "123 Test St",
        "shipping_address_line2": "Suite 100",
        "shipping_city": "Test City",
        "shipping_state": "TS",
        "shipping_zip": "12345",
        "shipping_country": "United States"
    }


def assert_response_error(response, expected_status=400):
    """Assert that a response contains an error."""
    assert response.status_code == expected_status
    assert "error" in response.json() or "detail" in response.json()