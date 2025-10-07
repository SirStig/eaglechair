# EagleChair Testing Documentation

## Overview

This directory contains comprehensive test suites for the EagleChair backend application. The tests are organized into multiple categories to ensure thorough coverage of all functionality.

## Test Organization

### Directory Structure

```
tests/
├── __init__.py
├── conftest.py              # Global fixtures and configuration
├── factories.py             # Factory Boy factories for test data
├── test_helpers.py          # Helper functions and utilities
├── test_auth.py            # Legacy auth tests (to be moved)
├── test_products.py        # Legacy product tests (to be moved)
├── test_services/          # Unit tests for service layer
│   ├── test_auth_service.py
│   ├── test_product_service.py
│   ├── test_quote_service.py
│   ├── test_content_service.py
│   ├── test_admin_service.py
│   ├── test_cache_service.py
│   └── test_email_service.py
├── test_models/            # Unit tests for database models
│   ├── test_company_model.py
│   ├── test_chair_model.py
│   ├── test_quote_model.py
│   └── test_content_model.py
├── test_routes/            # Integration tests for API routes
│   ├── test_auth_routes.py
│   ├── test_product_routes.py
│   ├── test_quote_routes.py
│   ├── test_content_routes.py
│   └── test_admin_routes.py
├── test_utils/             # Unit tests for utilities
│   ├── test_validators.py
│   ├── test_pagination.py
│   └── test_slug.py
├── test_middleware/        # Unit tests for middleware
│   ├── test_rate_limiter.py
│   └── test_security.py
└── test_integration/       # End-to-end integration tests
    ├── test_quote_workflow.py
    └── test_admin_workflow.py
```

## Test Categories

### 1. Unit Tests

Unit tests focus on testing individual components in isolation.

#### Services (`test_services/`)
- **Auth Service**: Authentication, registration, login, token management
- **Product Service**: Product CRUD operations, search, filtering
- **Quote Service**: Quote creation, modification, status management
- **Content Service**: FAQ, team members, company info management
- **Admin Service**: Dashboard stats, company/quote management
- **Cache Service**: Caching operations, TTL, pattern matching

#### Models (`test_models/`)
- **Company Model**: Company creation, validation, relationships
- **Chair Model**: Product models, categories, finishes, upholstery
- **Quote Model**: Quote, quote items, cart functionality
- **Content Model**: FAQ, team members, locations

#### Utilities (`test_utils/`)
- **Validators**: Email, phone, password, URL validation
- **Pagination**: Pagination parameters, page calculation
- **Slug**: Slug generation, uniqueness

#### Middleware (`test_middleware/`)
- **Rate Limiter**: Rate limiting functionality
- **Security**: CORS, security headers, authentication

### 2. Integration Tests

Integration tests verify that multiple components work together correctly.

#### Routes (`test_routes/`)
- **Auth Routes**: Registration, login, token refresh, password change
- **Product Routes**: Product listing, filtering, search, retrieval
- **Quote Routes**: Quote CRUD operations, submission
- **Content Routes**: FAQ, team, company info retrieval
- **Admin Routes**: Admin dashboard, company/product/quote management

#### Workflows (`test_integration/`)
- **Quote Workflow**: Complete quote creation and management process
- **Admin Workflow**: Admin dashboard and management operations

## Running Tests

### Run All Tests

```bash
pytest
```

### Run Specific Test Categories

```bash
# Unit tests only
pytest -m unit

# Integration tests only
pytest -m integration

# Specific markers
pytest -m auth
pytest -m products
pytest -m admin
```

### Run Tests by Directory

```bash
# Service tests
pytest tests/test_services/

# Model tests
pytest tests/test_models/

# Route tests
pytest tests/test_routes/

# Integration tests
pytest tests/test_integration/
```

### Run Specific Test Files

```bash
pytest tests/test_services/test_auth_service.py
pytest tests/test_routes/test_product_routes.py
```

### Run with Coverage

```bash
# Generate HTML coverage report
pytest --cov=backend --cov-report=html

# View coverage in terminal
pytest --cov=backend --cov-report=term-missing

# Coverage with specific threshold
pytest --cov=backend --cov-fail-under=80
```

### Run with Verbosity

```bash
# Verbose output
pytest -v

# Extra verbose
pytest -vv

# Show print statements
pytest -s
```

### Run in Parallel

```bash
# Requires pytest-xdist
pytest -n auto
```

## Test Markers

Tests are marked with pytest markers for easy filtering:

- `@pytest.mark.unit` - Unit tests
- `@pytest.mark.integration` - Integration tests
- `@pytest.mark.auth` - Authentication-related tests
- `@pytest.mark.products` - Product-related tests
- `@pytest.mark.admin` - Admin-related tests
- `@pytest.mark.slow` - Slow-running tests

## Fixtures

### Global Fixtures (conftest.py)

- `event_loop` - Async event loop for tests
- `test_engine` - Test database engine
- `db_session` - Database session for tests
- `client` - Synchronous test client
- `async_client` - Asynchronous test client
- `test_company` - Pre-created test company
- `test_admin` - Pre-created test admin user
- `company_token` - JWT token for company authentication
- `admin_token` - JWT token for admin authentication

### Sample Data Fixtures

- `sample_company_data` - Sample company registration data
- `sample_product_data` - Sample product data
- `sample_admin_data` - Sample admin user data

## Factories

Factory Boy factories are provided in `factories.py` for easy test data creation:

- `CompanyFactory` - Create company instances
- `AdminUserFactory` - Create admin user instances
- `CategoryFactory` - Create category instances
- `ChairFactory` - Create chair/product instances
- `QuoteFactory` - Create quote instances
- `QuoteItemFactory` - Create quote item instances
- `FAQFactory` - Create FAQ instances
- `TeamMemberFactory` - Create team member instances

### Using Factories

```python
from tests.factories import CompanyFactory, ChairFactory

# Create a company
company = CompanyFactory()

# Create a chair with specific attributes
chair = ChairFactory(
    name="Custom Chair",
    base_price=50000
)
```

## Test Helpers

Helper functions are available in `test_helpers.py`:

- `generate_random_string()` - Generate random strings
- `generate_random_email()` - Generate random email addresses
- `generate_company_data()` - Generate random company data
- `generate_product_data()` - Generate random product data
- `generate_quote_data()` - Generate random quote data
- `assert_valid_timestamp()` - Assert valid timestamp format
- `assert_response_has_pagination()` - Assert pagination structure
- `assert_response_has_error()` - Assert error response structure

## Writing New Tests

### Unit Test Example

```python
import pytest
from backend.services.product_service import ProductService

@pytest.mark.unit
@pytest.mark.asyncio
class TestProductService:
    async def test_get_product_by_id(self, db_session):
        """Test retrieving a product by ID."""
        service = ProductService(db_session)
        # ... test implementation
```

### Integration Test Example

```python
import pytest
from httpx import AsyncClient

@pytest.mark.integration
@pytest.mark.asyncio
class TestProductRoutes:
    async def test_list_products(self, async_client: AsyncClient):
        """Test listing products."""
        response = await async_client.get("/api/v1/products")
        assert response.status_code == 200
```

## Code Coverage Goals

- **Overall Coverage**: 80% minimum
- **Services**: 90% minimum
- **Models**: 85% minimum
- **Routes**: 85% minimum
- **Utilities**: 90% minimum

## Continuous Integration

Tests are automatically run on:
- Pull requests
- Pushes to main branch
- Scheduled daily runs

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **Clear Names**: Use descriptive test function names
3. **AAA Pattern**: Arrange, Act, Assert
4. **Use Fixtures**: Leverage fixtures for common setup
5. **Mock External Services**: Don't make real API calls
6. **Test Edge Cases**: Include boundary conditions
7. **Keep Tests Fast**: Optimize slow tests or mark them
8. **Document Complex Tests**: Add docstrings for clarity
9. **Use Factories**: Prefer factories over manual object creation
10. **Clean Up**: Ensure tests clean up after themselves

## Common Testing Patterns

### Testing Protected Routes

```python
async def test_protected_route(self, async_client, company_token):
    headers = {"Authorization": f"Bearer {company_token}"}
    response = await async_client.get("/api/v1/protected", headers=headers)
    assert response.status_code == 200
```

### Testing Database Operations

```python
async def test_create_and_retrieve(self, db_session):
    # Create
    obj = Model(name="Test")
    db_session.add(obj)
    await db_session.commit()
    await db_session.refresh(obj)
    
    # Retrieve
    result = await db_session.execute(select(Model).where(Model.id == obj.id))
    retrieved = result.scalar_one()
    assert retrieved.name == "Test"
```

### Testing Validation

```python
def test_invalid_input(self):
    result = validate_email("invalid")
    assert result is False
```

## Troubleshooting

### Common Issues

1. **Database conflicts**: Ensure unique test data or use transactions
2. **Async issues**: Use `@pytest.mark.asyncio` for async tests
3. **Fixture scope**: Check fixture scopes for session/function fixtures
4. **Import errors**: Verify PYTHONPATH includes backend directory

### Debug Mode

```bash
# Run with pdb on failure
pytest --pdb

# Stop on first failure
pytest -x

# Show local variables on failure
pytest -l
```

## Resources

- [pytest Documentation](https://docs.pytest.org/)
- [pytest-asyncio](https://pytest-asyncio.readthedocs.io/)
- [Factory Boy](https://factoryboy.readthedocs.io/)
- [FastAPI Testing](https://fastapi.tiangolo.com/tutorial/testing/)

