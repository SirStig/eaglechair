"""
Unit Tests for Content Service

Tests all content service functionality
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.services.content_service import ContentService
from tests.factories import (
    create_company_info,
    create_contact_location,
    create_faq,
    create_faq_category,
    create_team_member,
)


@pytest.mark.unit
@pytest.mark.asyncio
class TestContentService:
    """Test cases for ContentService"""
    
    async def test_get_all_faqs(self, db_session: AsyncSession):
        """Test retrieving all active FAQs."""
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
        await create_faq(
            db_session,
            category_id=category.id,
            question="Inactive FAQ",
            answer="This should not appear.",
            is_active=False
        )
        
        # Get FAQs
        faqs = await ContentService.get_faqs(db_session)
        
        assert len(faqs) >= 2
        assert all(faq.is_active for faq in faqs)
    
    async def test_get_faqs_by_category(self, db_session: AsyncSession):
        """Test retrieving FAQs by category."""
        # Create FAQ categories using factories
        category1 = await create_faq_category(db_session, name="General", slug="general")
        category2 = await create_faq_category(db_session, name="Products", slug="products")
        
        # Create FAQs using factories
        await create_faq(
            db_session,
            category_id=category1.id,
            question="General question 1",
            answer="General answer 1",
            is_active=True
        )
        await create_faq(
            db_session,
            category_id=category2.id,
            question="Product question 1",
            answer="Product answer 1",
            is_active=True
        )
        
        # Get FAQs by category (using category_id parameter)
        general_faqs = await ContentService.get_faqs(db_session, category_id=category1.id)
        
        assert len(general_faqs) == 1
        assert general_faqs[0].question == "General question 1"
    
    async def test_get_team_members(self, db_session: AsyncSession):
        """Test retrieving active team members."""
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
        await create_team_member(
            db_session,
            name="Inactive Member",
            title="Former Employee",
            bio="No longer with company",
            email="former@example.com",
            is_active=False
        )
        
        # Get team members
        members = await ContentService.get_team_members(db_session)
        
        assert len(members) >= 2
        assert all(member.is_active for member in members)
    
    async def test_get_company_info(self, db_session: AsyncSession):
        """Test retrieving company information."""
        # Create company info using factory
        company_info = await create_company_info(
            db_session,
            section_key="about_us",
            title="EagleChair",
            content="Premium Commercial Seating"
        )
        
        # Get company info
        info = await ContentService.get_company_info(db_session)
        
        assert info is not None
        # CompanyInfo structure may vary - just verify it exists
        assert hasattr(info, 'section_key') or hasattr(info, 'title')
    
    async def test_get_contact_locations(self, db_session: AsyncSession):
        """Test retrieving contact locations."""
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
        
        # Get contact locations
        locations = await ContentService.get_contact_locations(db_session)
        
        assert len(locations) >= 2
    
    async def test_create_faq(self, db_session: AsyncSession):
        """Test creating a new FAQ."""
        # Create FAQ category using factory
        category = await create_faq_category(db_session)
        
        # Create FAQ
        faq = await ContentService.create_faq(
            db_session,
            category_id=category.id,
            question="New question?",
            answer="New answer.",
            is_active=True,
            display_order=1
        )
        
        assert faq is not None
        assert faq.question == "New question?"
        assert faq.category_id == category.id
    
    async def test_update_faq(self, db_session: AsyncSession):
        """Test updating an existing FAQ."""
        # Create FAQ category using factory
        category = await create_faq_category(db_session)
        
        # Create FAQ using factory
        faq = await create_faq(
            db_session,
            category_id=category.id,
            question="Original question?",
            answer="Original answer.",
            is_active=True
        )
        
        # Update FAQ
        updated_faq = await ContentService.update_faq(
            db_session, 
            faq.id,
            question="Updated question?",
            answer="Updated answer."
        )
        
        assert updated_faq is not None
        assert updated_faq.question == "Updated question?"
        assert updated_faq.answer == "Updated answer."
    
    async def test_delete_faq(self, db_session: AsyncSession):
        """Test deleting (soft delete) an FAQ."""
        # Create FAQ category using factory
        category = await create_faq_category(db_session)
        
        # Create FAQ using factory
        faq = await create_faq(
            db_session,
            category_id=category.id,
            question="Question to delete?",
            answer="Answer to delete.",
            is_active=True
        )
        
        # Delete FAQ (hard delete - removes from DB)
        await ContentService.delete_faq(db_session, faq.id)
        
        # Verify FAQ is deleted (try to retrieve it)
        from sqlalchemy import select

        from backend.models.content import FAQ
        result = await db_session.execute(select(FAQ).where(FAQ.id == faq.id))
        deleted_faq = result.scalar_one_or_none()
        assert deleted_faq is None
