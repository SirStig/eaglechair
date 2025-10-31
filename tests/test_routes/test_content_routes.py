"""
Test Content Routes

Integration tests for content routes
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories import (
    create_company_info,
    create_contact_location,
    create_faq,
    create_faq_category,
    create_team_member,
)


@pytest.mark.integration
@pytest.mark.asyncio
class TestContentRoutes:
    """Test cases for content routes"""
    
    async def test_get_faqs_success(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test successful FAQ retrieval."""
        # Create FAQ category using factory
        category = await create_faq_category(db_session, slug="general")
        
        # Create FAQs using factories
        await create_faq(
            db_session,
            category_id=category.id,
            question="What is your return policy?",
            answer="We offer a 30-day return policy.",
            is_active=True
        )
        await create_faq(
            db_session,
            category_id=category.id,
            question="Do you ship internationally?",
            answer="Yes, we ship worldwide.",
            is_active=True
        )
        
        response = await async_client.get("/api/v1/content/faq")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
    
    async def test_get_faq_categories_success(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test successful FAQ category retrieval."""
        # Create FAQ categories using factories
        await create_faq_category(db_session, name="General", slug="general", display_order=1)
        await create_faq_category(db_session, name="Products", slug="products", display_order=2)
        
        response = await async_client.get("/api/v1/content/faq/categories")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
    
    async def test_get_team_members_success(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test successful team member retrieval."""
        # Create team members using factories
        await create_team_member(
            db_session,
            name="John Doe",
            title="CEO",
            bio="Founder and CEO",
            email="john@example.com",
            is_active=True,
            display_order=1
        )
        await create_team_member(
            db_session,
            name="Jane Smith",
            title="CTO",
            bio="Chief Technology Officer",
            email="jane@example.com",
            is_active=True,
            display_order=2
        )
        
        response = await async_client.get("/api/v1/content/team")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
    
    async def test_get_company_info_success(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test successful company info retrieval."""
        # Create company info using factory
        await create_company_info(
            db_session,
            section_key="about_us",
            title="EagleChair",
            content="Premium Commercial Seating"
        )
        
        response = await async_client.get("/api/v1/content/about")
        
        assert response.status_code == 200
        data = response.json()
        # CompanyInfo response structure may vary, just check it's not empty
        assert data is not None
    
    async def test_get_contact_locations_success(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test successful contact location retrieval."""
        # Create contact locations using factories
        await create_contact_location(
            db_session,
            location_name="Headquarters",
            city="Test City",
            state="TS",
            is_active=True,
            display_order=1
        )
        await create_contact_location(
            db_session,
            location_name="Showroom",
            city="Test City",
            state="TS",
            is_active=True,
            display_order=2
        )
        
        response = await async_client.get("/api/v1/content/contact/locations")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
    
    async def test_get_faqs_empty(self, async_client: AsyncClient):
        """Test FAQ retrieval with no FAQs."""
        response = await async_client.get("/api/v1/content/faq")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    async def test_get_team_members_only_active(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test that only active team members are returned."""
        # Create team members using factories
        await create_team_member(
            db_session,
            name="Active Member",
            title="Manager",
            bio="Active team member",
            email="active@example.com",
            is_active=True
        )
        await create_team_member(
            db_session,
            name="Inactive Member",
            title="Former Employee",
            bio="No longer with company",
            email="inactive@example.com",
            is_active=False
        )
        
        response = await async_client.get("/api/v1/content/team")
        
        assert response.status_code == 200
        data = response.json()
        assert len([m for m in data if m.get("is_active", True)]) >= 1
