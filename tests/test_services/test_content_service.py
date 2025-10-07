"""
Unit Tests for Content Service

Tests all content service functionality
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.services.content_service import ContentService
from backend.models.content import FAQ, FAQCategory, TeamMember, CompanyInfo, ContactLocation


@pytest.mark.unit
@pytest.mark.asyncio
class TestContentService:
    """Test cases for ContentService"""
    
    async def test_get_all_faqs(self, db_session: AsyncSession):
        """Test retrieving all active FAQs."""
        # Create FAQ category
        category = FAQCategory(
            name="General",
            slug="general",
            is_active=True
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
        faq3 = FAQ(
            category_id=category.id,
            question="Inactive FAQ",
            answer="This should not appear.",
            is_active=False,
            sort_order=3
        )
        
        db_session.add_all([faq1, faq2, faq3])
        await db_session.commit()
        
        # Get FAQs
        service = ContentService(db_session)
        faqs = await service.get_all_faqs()
        
        assert len(faqs) == 2
        assert all(faq.is_active for faq in faqs)
    
    async def test_get_faqs_by_category(self, db_session: AsyncSession):
        """Test retrieving FAQs by category."""
        # Create FAQ categories
        category1 = FAQCategory(
            name="General",
            slug="general",
            is_active=True
        )
        category2 = FAQCategory(
            name="Products",
            slug="products",
            is_active=True
        )
        db_session.add_all([category1, category2])
        await db_session.commit()
        await db_session.refresh(category1)
        await db_session.refresh(category2)
        
        # Create FAQs
        faq1 = FAQ(
            category_id=category1.id,
            question="General question 1",
            answer="General answer 1",
            is_active=True,
            sort_order=1
        )
        faq2 = FAQ(
            category_id=category2.id,
            question="Product question 1",
            answer="Product answer 1",
            is_active=True,
            sort_order=1
        )
        
        db_session.add_all([faq1, faq2])
        await db_session.commit()
        
        # Get FAQs by category
        service = ContentService(db_session)
        general_faqs = await service.get_faqs_by_category(category1.id)
        
        assert len(general_faqs) == 1
        assert general_faqs[0].question == "General question 1"
    
    async def test_get_team_members(self, db_session: AsyncSession):
        """Test retrieving active team members."""
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
        member3 = TeamMember(
            name="Inactive Member",
            position="Former Employee",
            bio="No longer with company",
            email="former@example.com",
            is_active=False,
            sort_order=3
        )
        
        db_session.add_all([member1, member2, member3])
        await db_session.commit()
        
        # Get team members
        service = ContentService(db_session)
        members = await service.get_team_members()
        
        assert len(members) == 2
        assert all(member.is_active for member in members)
        assert members[0].name == "John Doe"
        assert members[1].name == "Jane Smith"
    
    async def test_get_company_info(self, db_session: AsyncSession):
        """Test retrieving company information."""
        # Create company info
        company_info = CompanyInfo(
            company_name="EagleChair",
            tagline="Premium Commercial Seating",
            about="We manufacture the finest commercial chairs.",
            mission="To provide quality seating solutions.",
            vision="To be the leading chair manufacturer.",
            values="Quality, Innovation, Customer Service",
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
        
        # Get company info
        service = ContentService(db_session)
        info = await service.get_company_info()
        
        assert info is not None
        assert info.company_name == "EagleChair"
        assert info.email == "info@eaglechair.com"
    
    async def test_get_contact_locations(self, db_session: AsyncSession):
        """Test retrieving contact locations."""
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
        
        # Get contact locations
        service = ContentService(db_session)
        locations = await service.get_contact_locations()
        
        assert len(locations) == 2
        assert locations[0].name == "Headquarters"
        assert locations[1].name == "Showroom"
    
    async def test_create_faq(self, db_session: AsyncSession):
        """Test creating a new FAQ."""
        # Create FAQ category
        category = FAQCategory(
            name="General",
            slug="general",
            is_active=True
        )
        db_session.add(category)
        await db_session.commit()
        await db_session.refresh(category)
        
        # Create FAQ
        service = ContentService(db_session)
        faq_data = {
            "category_id": category.id,
            "question": "New question?",
            "answer": "New answer.",
            "is_active": True,
            "sort_order": 1
        }
        
        faq = await service.create_faq(faq_data)
        
        assert faq is not None
        assert faq.question == "New question?"
        assert faq.category_id == category.id
    
    async def test_update_faq(self, db_session: AsyncSession):
        """Test updating an existing FAQ."""
        # Create FAQ category
        category = FAQCategory(
            name="General",
            slug="general",
            is_active=True
        )
        db_session.add(category)
        await db_session.commit()
        await db_session.refresh(category)
        
        # Create FAQ
        faq = FAQ(
            category_id=category.id,
            question="Original question?",
            answer="Original answer.",
            is_active=True,
            sort_order=1
        )
        db_session.add(faq)
        await db_session.commit()
        await db_session.refresh(faq)
        
        # Update FAQ
        service = ContentService(db_session)
        update_data = {
            "question": "Updated question?",
            "answer": "Updated answer."
        }
        
        updated_faq = await service.update_faq(faq.id, update_data)
        
        assert updated_faq is not None
        assert updated_faq.question == "Updated question?"
        assert updated_faq.answer == "Updated answer."
    
    async def test_delete_faq(self, db_session: AsyncSession):
        """Test deleting (soft delete) an FAQ."""
        # Create FAQ category
        category = FAQCategory(
            name="General",
            slug="general",
            is_active=True
        )
        db_session.add(category)
        await db_session.commit()
        await db_session.refresh(category)
        
        # Create FAQ
        faq = FAQ(
            category_id=category.id,
            question="Question to delete?",
            answer="Answer to delete.",
            is_active=True,
            sort_order=1
        )
        db_session.add(faq)
        await db_session.commit()
        await db_session.refresh(faq)
        
        # Delete FAQ
        service = ContentService(db_session)
        result = await service.delete_faq(faq.id)
        
        assert result is True
        
        # Verify soft delete
        await db_session.refresh(faq)
        assert faq.is_active is False

