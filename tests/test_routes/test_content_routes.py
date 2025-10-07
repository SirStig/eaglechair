"""
Test Content Routes

Integration tests for content routes
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.content import FAQ, FAQCategory, TeamMember, CompanyInfo, ContactLocation


@pytest.mark.integration
@pytest.mark.asyncio
class TestContentRoutes:
    """Test cases for content routes"""
    
    async def test_get_faqs_success(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test successful FAQ retrieval."""
        # Create FAQ category
        category = FAQCategory(
            name="General",
            slug="general",
            is_active=True,
            sort_order=1
        )
        db_session.add(category)
        await db_session.commit()
        await db_session.refresh(category)
        
        # Create FAQs
        faq1 = FAQ(
            category_id=category.id,
            question="What is your return policy?",
            answer="We offer a 30-day return policy.",
            is_active=True,
            sort_order=1
        )
        faq2 = FAQ(
            category_id=category.id,
            question="Do you ship internationally?",
            answer="Yes, we ship worldwide.",
            is_active=True,
            sort_order=2
        )
        
        db_session.add_all([faq1, faq2])
        await db_session.commit()
        
        response = await async_client.get("/api/v1/content/faqs")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["question"] == "What is your return policy?"
    
    async def test_get_faq_categories_success(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test successful FAQ category retrieval."""
        # Create FAQ categories
        category1 = FAQCategory(
            name="General",
            slug="general",
            is_active=True,
            sort_order=1
        )
        category2 = FAQCategory(
            name="Products",
            slug="products",
            is_active=True,
            sort_order=2
        )
        
        db_session.add_all([category1, category2])
        await db_session.commit()
        
        response = await async_client.get("/api/v1/content/faq-categories")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["name"] == "General"
        assert data[1]["name"] == "Products"
    
    async def test_get_team_members_success(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test successful team member retrieval."""
        # Create team members
        member1 = TeamMember(
            name="John Doe",
            position="CEO",
            bio="Founder and CEO",
            email="john@example.com",
            is_active=True,
            sort_order=1
        )
        member2 = TeamMember(
            name="Jane Smith",
            position="CTO",
            bio="Chief Technology Officer",
            email="jane@example.com",
            is_active=True,
            sort_order=2
        )
        
        db_session.add_all([member1, member2])
        await db_session.commit()
        
        response = await async_client.get("/api/v1/content/team")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["name"] == "John Doe"
        assert data[1]["name"] == "Jane Smith"
    
    async def test_get_company_info_success(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test successful company info retrieval."""
        # Create company info
        company_info = CompanyInfo(
            company_name="EagleChair",
            tagline="Premium Commercial Seating",
            about="We manufacture the finest commercial chairs.",
            email="info@eaglechair.com",
            phone="+1234567890",
            address_line1="123 Main St",
            city="Manufacturing City",
            state="MC",
            zip_code="12345",
            country="USA"
        )
        
        db_session.add(company_info)
        await db_session.commit()
        
        response = await async_client.get("/api/v1/content/company-info")
        
        assert response.status_code == 200
        data = response.json()
        assert data["company_name"] == "EagleChair"
        assert data["email"] == "info@eaglechair.com"
    
    async def test_get_contact_locations_success(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test successful contact location retrieval."""
        # Create contact locations
        location1 = ContactLocation(
            name="Headquarters",
            address_line1="123 Main St",
            city="Test City",
            state="TS",
            zip_code="12345",
            country="USA",
            phone="+1234567890",
            email="hq@example.com",
            is_active=True,
            sort_order=1
        )
        location2 = ContactLocation(
            name="Showroom",
            address_line1="456 Oak Ave",
            city="Test City",
            state="TS",
            zip_code="12345",
            country="USA",
            phone="+1234567891",
            email="showroom@example.com",
            is_active=True,
            sort_order=2
        )
        
        db_session.add_all([location1, location2])
        await db_session.commit()
        
        response = await async_client.get("/api/v1/content/contact-locations")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["name"] == "Headquarters"
        assert data[1]["name"] == "Showroom"
    
    async def test_get_faqs_empty(self, async_client: AsyncClient):
        """Test FAQ retrieval with no FAQs."""
        response = await async_client.get("/api/v1/content/faqs")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 0
    
    async def test_get_team_members_only_active(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test that only active team members are returned."""
        # Create team members
        member1 = TeamMember(
            name="Active Member",
            position="Manager",
            bio="Active team member",
            email="active@example.com",
            is_active=True,
            sort_order=1
        )
        member2 = TeamMember(
            name="Inactive Member",
            position="Former Employee",
            bio="No longer with company",
            email="inactive@example.com",
            is_active=False,
            sort_order=2
        )
        
        db_session.add_all([member1, member2])
        await db_session.commit()
        
        response = await async_client.get("/api/v1/content/team")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Active Member"

