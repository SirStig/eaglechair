"""
Test Admin Routes

Integration tests for admin routes
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.company import AdminUser, AdminRole
from backend.models.chair import Chair, Category
from backend.models.quote import Quote, QuoteStatus
from tests.factories import (
    create_company,
    create_category,
    create_chair,
    create_quote,
)


@pytest.mark.integration
@pytest.mark.admin
class TestAdminRoutes:
    """Test cases for admin routes"""
    
    @pytest.mark.asyncio
    async def test_get_dashboard_stats_success(self, async_client: AsyncClient, admin_token):
        """Test successful dashboard statistics retrieval."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = await async_client.get("/api/v1/admin/dashboard/stats", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "companies" in data
        assert "products" in data
        assert "quotes" in data
        assert "recent_quotes" in data
        assert "recent_companies" in data
    
    @pytest.mark.asyncio
    async def test_get_dashboard_stats_unauthorized(self, async_client: AsyncClient):
        """Test dashboard statistics retrieval without admin token."""
        response = await async_client.get("/api/v1/admin/dashboard/stats")
        
        assert response.status_code == 401
        data = response.json()
        assert "error" in data or "detail" in data
    
    @pytest.mark.asyncio
    async def test_get_all_products_admin_success(self, async_client: AsyncClient, admin_token, db_session: AsyncSession):
        """Test successful admin product retrieval."""
        # Create test category using factory
        category = await create_category(
            db_session,
            name="Test Category",
            slug="test-category",
            is_active=True,
            display_order=1
        )
        
        # Create test products using factories
        product1 = await create_chair(
            db_session,
            name="Product 1",
            short_description="Test product 1",
            model_number="P1-001",
            category_id=category.id,
            base_price=10000,
            minimum_order_quantity=1,
            is_active=True
        )
        product2 = await create_chair(
            db_session,
            name="Product 2",
            short_description="Test product 2",
            model_number="P2-001",
            category_id=category.id,
            base_price=20000,
            minimum_order_quantity=1,
            is_active=False
        )
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = await async_client.get("/api/v1/admin/products", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2
        assert data["total"] == 2
        assert data["page"] == 1
        assert data["page_size"] == 20
        assert data["pages"] == 1
    
    @pytest.mark.asyncio
    async def test_get_all_products_admin_with_filters(self, async_client: AsyncClient, admin_token, db_session: AsyncSession):
        """Test admin product retrieval with filters."""
        # Create test category using factory
        category = await create_category(
            db_session,
            name="Test Category",
            slug="test-category",
            is_active=True,
            display_order=1
        )
        
        # Create test products
        product1 = Chair(
            name="Active Product",
            short_description="Active test product",
            model_number="AP-001",
            slug="active-product-ap001",
            category_id=category.id,
            base_price=10000,
            minimum_order_quantity=1,
            is_active=True
        )
        product2 = Chair(
            name="Inactive Product",
            short_description="Inactive test product",
            model_number="IP-001",
            slug="inactive-product-ip001",
            category_id=category.id,
            base_price=20000,
            minimum_order_quantity=1,
            is_active=False
        )
        
        db_session.add(product1)
        db_session.add(product2)
        await db_session.commit()
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Test filter by active status
        response = await async_client.get("/api/v1/admin/products?is_active=true", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["total"] == 1
        assert data["items"][0]["name"] == "Active Product"
        
        # Test filter by category
        response = await async_client.get(f"/api/v1/admin/products?category_id={category.id}", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2
        assert data["total"] == 2
    
    @pytest.mark.asyncio
    async def test_create_product_admin_success(self, async_client: AsyncClient, admin_token, db_session: AsyncSession):
        """Test successful admin product creation."""
        # Create test category using factory
        category = await create_category(
            db_session,
            name="Test Category",
            slug="test-category",
            is_active=True,
            display_order=1
        )
        
        product_data = {
            "name": "New Product",
            "description": "New test product",
            "model_number": "NP-001",
            "category_id": category.id,
            "base_price": 15000,
            "minimum_order_quantity": 1,
            "is_active": True,
            "specifications": {"seat_height": "20 inches"},
            "features": ["Lumbar support"],
            "dimensions": {"width": 24, "depth": 26, "height": 42},
            "weight": 45.5,
            "materials": ["Leather", "Steel"],
            "colors": ["Black", "Brown"]
        }
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = await async_client.post("/api/v1/admin/products", json=product_data, headers=headers)
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == product_data["name"]
        assert data["model_number"] == product_data["model_number"]
        assert data["base_price"] == product_data["base_price"]
        assert "id" in data
    
    @pytest.mark.asyncio
    async def test_create_product_admin_unauthorized(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test admin product creation without admin token."""
        # Create test category using factory
        category = await create_category(
            db_session,
            name="Test Category",
            slug="test-category",
            is_active=True,
            display_order=1
        )
        
        product_data = {
            "name": "New Product",
            "description": "New test product",
            "model_number": "NP-001",
            "category_id": category.id,
            "base_price": 15000,
            "minimum_order_quantity": 1,
            "is_active": True
        }
        
        response = await async_client.post("/api/v1/admin/products", json=product_data)
        
        assert response.status_code == 401
        data = response.json()
        assert "error" in data or "detail" in data
    
    @pytest.mark.asyncio
    async def test_update_product_admin_success(self, async_client: AsyncClient, admin_token, db_session: AsyncSession):
        """Test successful admin product update."""
        # Create test category using factory
        category = await create_category(
            db_session,
            name="Test Category",
            slug="test-category",
            is_active=True,
            display_order=1
        )
        
        # Create test product
        product = Chair(
            name="Original Product",
            short_description="Original test product",
            model_number="OP-001",
            slug="original-product-op001",
            category_id=category.id,
            base_price=10000,
            minimum_order_quantity=1,
            is_active=True
        )
        
        db_session.add(product)
        await db_session.commit()
        await db_session.refresh(product)
        
        update_data = {
            "name": "Updated Product",
            "short_description": "Updated test product",
            "base_price": 15000
        }
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = await async_client.patch(f"/api/v1/admin/products/{product.id}", json=update_data, headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == update_data["name"]
        assert data["description"] == update_data["description"]
        assert data["base_price"] == update_data["base_price"]
        assert data["id"] == product.id
    
    @pytest.mark.asyncio
    async def test_delete_product_admin_success(self, async_client: AsyncClient, admin_token, db_session: AsyncSession):
        """Test successful admin product deletion."""
        # Create test category using factory
        category = await create_category(
            db_session,
            name="Test Category",
            slug="test-category",
            is_active=True,
            display_order=1
        )
        
        # Create test product
        product = Chair(
            name="Product to Delete",
            short_description="Product to be deleted",
            model_number="PTD-001",
            slug="product-to-delete-ptd001",
            category_id=category.id,
            base_price=10000,
            minimum_order_quantity=1,
            is_active=True
        )
        
        db_session.add(product)
        await db_session.commit()
        await db_session.refresh(product)
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = await async_client.delete(f"/api/v1/admin/products/{product.id}", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        
        # Verify product is soft deleted
        await db_session.refresh(product)
        assert product.is_active == False
    
    @pytest.mark.asyncio
    async def test_get_all_companies_admin_success(self, async_client: AsyncClient, admin_token, db_session: AsyncSession):
        """Test successful admin company retrieval."""
        from backend.models.company import Company, CompanyStatus
        
        # Create test companies using factories
        company1 = await create_company(
            db_session,
            company_name="Company 1",
            rep_first_name="John",
            rep_last_name="Doe",
            rep_email="john@company1.com",
            rep_phone="+1234567890",
            billing_address_line1="123 Main St",
            billing_city="Test City",
            billing_state="TS",
            billing_zip="12345",
            billing_country="USA",
            status=CompanyStatus.ACTIVE
        )
        company2 = await create_company(
            db_session,
            company_name="Company 2",
            rep_first_name="Jane",
            rep_last_name="Smith",
            rep_email="jane@company2.com",
            rep_phone="+1234567891",
            billing_address_line1="456 Oak Ave",
            billing_city="Test City",
            billing_state="TS",
            billing_zip="12345",
            billing_country="USA",
            status=CompanyStatus.PENDING
        )
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = await async_client.get("/api/v1/admin/companies", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2
        assert data["total"] == 2
        assert data["page"] == 1
        assert data["page_size"] == 20
        assert data["pages"] == 1
    
    @pytest.mark.asyncio
    async def test_update_company_status_admin_success(self, async_client: AsyncClient, admin_token, db_session: AsyncSession):
        """Test successful admin company status update."""
        from backend.models.company import Company, CompanyStatus
        
        # Create test company using factory
        company = await create_company(
            db_session,
            company_name="Test Company",
            rep_first_name="John",
            rep_last_name="Doe",
            rep_email="john@testcompany.com",
            rep_phone="+1234567890",
            billing_address_line1="123 Main St",
            billing_city="Test City",
            billing_state="TS",
            billing_zip="12345",
            billing_country="USA",
            status=CompanyStatus.PENDING
        )
        
        status_data = {
            "status": "active",
            "admin_notes": "Approved by admin"
        }
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = await async_client.patch(f"/api/v1/admin/companies/{company.id}/status", json=status_data, headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "active"
        assert data["id"] == company.id
    
    @pytest.mark.asyncio
    async def test_get_all_quotes_admin_success(self, async_client: AsyncClient, admin_token, db_session: AsyncSession):
        """Test successful admin quote retrieval."""
        from backend.models.company import CompanyStatus
        
        # Create test company using factory
        company = await create_company(
            db_session,
            company_name="Test Company",
            rep_first_name="John",
            rep_last_name="Doe",
            rep_email="john@testcompany.com",
            rep_phone="+1234567890",
            billing_address_line1="123 Main St",
            billing_city="Test City",
            billing_state="TS",
            billing_zip="12345",
            billing_country="USA",
            status=CompanyStatus.ACTIVE
        )
        
        # Create test quotes using factories
        quote1 = await create_quote(
            db_session,
            company_id=company.id,
            contact_name="John Doe",
            contact_email="john@testcompany.com",
            contact_phone="+1234567890",
            shipping_address_line1="123 Main St",
            shipping_city="Test City",
            shipping_state="TS",
            shipping_zip="12345",
            shipping_country="USA",
            status=QuoteStatus.UNDER_REVIEW,
            subtotal=100000,
            total_amount=110000
        )
        quote2 = await create_quote(
            db_session,
            company_id=company.id,
            contact_name="John Doe",
            contact_email="john@testcompany.com",
            contact_phone="+1234567890",
            shipping_address_line1="123 Main St",
            shipping_city="Test City",
            shipping_state="TS",
            shipping_zip="12345",
            shipping_country="USA",
            status=QuoteStatus.QUOTED,
            subtotal=200000,
            total_amount=220000
        )
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = await async_client.get("/api/v1/admin/quotes", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2
        assert data["total"] == 2
        assert data["page"] == 1
        assert data["page_size"] == 20
        assert data["pages"] == 1
    
    @pytest.mark.asyncio
    async def test_update_quote_status_admin_success(self, async_client: AsyncClient, admin_token, db_session: AsyncSession):
        """Test successful admin quote status update."""
        from backend.models.company import CompanyStatus
        
        # Create test company using factory
        company = await create_company(
            db_session,
            company_name="Test Company",
            rep_first_name="John",
            rep_last_name="Doe",
            rep_email="john@testcompany.com",
            rep_phone="+1234567890",
            billing_address_line1="123 Main St",
            billing_city="Test City",
            billing_state="TS",
            billing_zip="12345",
            billing_country="USA",
            status=CompanyStatus.ACTIVE
        )
        
        # Create test quote
        quote = Quote(
            quote_number="Q-001",
            company_id=company.id,
            contact_name="John Doe",
            contact_email="john@testcompany.com",
            contact_phone="+1234567890",
            shipping_address_line1="123 Main St",
            shipping_city="Test City",
            shipping_state="TS",
            shipping_zip="12345",
            shipping_country="USA",
            status=QuoteStatus.UNDER_REVIEW,
            subtotal=100000,
            total_amount=110000
        )
        
        db_session.add(quote)
        await db_session.commit()
        await db_session.refresh(quote)
        
        status_data = {
            "status": "quoted",
            "quoted_price": 95000,
            "quoted_lead_time": "4-6 weeks",
            "quote_notes": "Special pricing applied",
            "admin_notes": "Reviewed by admin"
        }
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = await async_client.patch(f"/api/v1/admin/quotes/{quote.id}/status", json=status_data, headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "quoted"
        assert data["quoted_price"] == 95000
        assert data["quoted_lead_time"] == "4-6 weeks"
        assert data["id"] == quote.id
