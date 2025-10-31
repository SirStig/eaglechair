"""
Test CMS Content Routes

Integration tests for CMS content routes (public read-only)
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories import (
    create_client_logo,
    create_company_milestone,
    create_company_value,
    create_feature,
    create_hero_slide,
    create_installation,
    create_page_content,
    create_sales_representative,
    create_site_settings,
)


@pytest.mark.integration
@pytest.mark.cms
class TestCMSContentRoutes:
    """Test cases for CMS content routes"""
    
    @pytest.mark.asyncio
    async def test_get_hero_slides_success(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession
    ):
        """Test successful retrieval of hero slides."""
        await create_hero_slide(db_session, title="Slide 1", is_active=True)
        await create_hero_slide(db_session, title="Slide 2", is_active=True)
        
        response = await async_client.get("/api/v1/content/hero-slides")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
    
    @pytest.mark.asyncio
    async def test_get_features_success(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession
    ):
        """Test successful retrieval of features."""
        await create_feature(db_session, title="Feature 1", is_active=True)
        await create_feature(db_session, title="Feature 2", is_active=True)
        
        response = await async_client.get("/api/v1/content/features")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
    
    @pytest.mark.asyncio
    async def test_get_client_logos_success(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession
    ):
        """Test successful retrieval of client logos."""
        await create_client_logo(db_session, name="Client 1", is_active=True)
        await create_client_logo(db_session, name="Client 2", is_active=True)
        
        response = await async_client.get("/api/v1/content/client-logos")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
    
    @pytest.mark.asyncio
    async def test_get_company_values_success(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession
    ):
        """Test successful retrieval of company values."""
        await create_company_value(db_session, title="Value 1", is_active=True)
        await create_company_value(db_session, title="Value 2", is_active=True)
        
        response = await async_client.get("/api/v1/content/company-values")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
    
    @pytest.mark.asyncio
    async def test_get_company_milestones_success(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession
    ):
        """Test successful retrieval of company milestones."""
        await create_company_milestone(db_session, title="Milestone 1", is_active=True)
        await create_company_milestone(db_session, title="Milestone 2", is_active=True)
        
        response = await async_client.get("/api/v1/content/company-milestones")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
    
    @pytest.mark.asyncio
    async def test_get_sales_representatives_success(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession
    ):
        """Test successful retrieval of sales representatives."""
        await create_sales_representative(
            db_session,
            name="John Doe",
            is_active=True
        )
        await create_sales_representative(
            db_session,
            name="Jane Smith",
            is_active=True
        )
        
        response = await async_client.get("/api/v1/content/sales-reps")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
    
    @pytest.mark.asyncio
    async def test_get_installations_success(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession
    ):
        """Test successful retrieval of installations."""
        await create_installation(
            db_session,
            project_name="Project 1",
            is_active=True
        )
        await create_installation(
            db_session,
            project_name="Project 2",
            is_active=True
        )
        
        response = await async_client.get("/api/v1/content/installations")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
    
    @pytest.mark.asyncio
    async def test_get_page_content_success(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession
    ):
        """Test successful retrieval of page content."""
        await create_page_content(
            db_session,
            page_slug="about",
            section_key="intro",
            is_active=True
        )
        
        response = await async_client.get("/api/v1/content/page-content/about")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list) or isinstance(data, dict)
    
    @pytest.mark.asyncio
    async def test_get_site_settings_success(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession
    ):
        """Test successful retrieval of site settings."""
        await create_site_settings(db_session)
        
        response = await async_client.get("/api/v1/content/site-settings")
        
        assert response.status_code == 200
        data = response.json()
        assert "companyName" in data

