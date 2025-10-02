"""
Content Service

Handles content management (FAQs, team, company info, contact, catalogs, etc.)
"""

import logging
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from backend.models.content import (
    FAQ,
    FAQCategory,
    TeamMember,
    CompanyInfo,
    ContactLocation,
    Catalog,
    Installation,
    Feedback
)
from backend.core.exceptions import ResourceNotFoundError


logger = logging.getLogger(__name__)


class ContentService:
    """Service for content management operations"""
    
    # ========================================================================
    # FAQ Operations
    # ========================================================================
    
    @staticmethod
    async def get_faq_categories(
        db: AsyncSession,
        include_inactive: bool = False
    ) -> List[FAQCategory]:
        """
        Get all FAQ categories
        
        Args:
            db: Database session
            include_inactive: Include inactive categories
            
        Returns:
            List of FAQ categories
        """
        query = select(FAQCategory)
        
        if not include_inactive:
            query = query.where(FAQCategory.is_active == True)
        
        query = query.order_by(FAQCategory.display_order, FAQCategory.name)
        
        result = await db.execute(query)
        categories = result.scalars().all()
        
        logger.info(f"Retrieved {len(categories)} FAQ categories")
        return list(categories)
    
    @staticmethod
    async def get_faqs(
        db: AsyncSession,
        category_id: Optional[int] = None,
        search_query: Optional[str] = None,
        include_inactive: bool = False
    ) -> List[FAQ]:
        """
        Get FAQs with optional filtering
        
        Args:
            db: Database session
            category_id: Filter by category
            search_query: Search in question and answer
            include_inactive: Include inactive FAQs
            
        Returns:
            List of FAQs
        """
        query = select(FAQ)
        
        if not include_inactive:
            query = query.where(FAQ.is_active == True)
        
        if category_id:
            query = query.where(FAQ.category_id == category_id)
        
        if search_query:
            search_term = f"%{search_query}%"
            query = query.where(
                FAQ.question.ilike(search_term) | FAQ.answer.ilike(search_term)
            )
        
        query = query.order_by(FAQ.display_order, FAQ.question)
        
        result = await db.execute(query)
        faqs = result.scalars().all()
        
        logger.info(f"Retrieved {len(faqs)} FAQs")
        return list(faqs)
    
    @staticmethod
    async def get_faq_by_id(
        db: AsyncSession,
        faq_id: int
    ) -> FAQ:
        """
        Get FAQ by ID
        
        Args:
            db: Database session
            faq_id: FAQ ID
            
        Returns:
            FAQ instance
            
        Raises:
            ResourceNotFoundError: If FAQ not found
        """
        result = await db.execute(
            select(FAQ).where(FAQ.id == faq_id)
        )
        faq = result.scalar_one_or_none()
        
        if not faq:
            raise ResourceNotFoundError(resource_type="FAQ", resource_id=faq_id)
        
        # Increment view count
        faq.view_count += 1
        await db.commit()
        
        return faq
    
    # ========================================================================
    # Team Operations
    # ========================================================================
    
    @staticmethod
    async def get_team_members(
        db: AsyncSession,
        include_inactive: bool = False
    ) -> List[TeamMember]:
        """
        Get all team members
        
        Args:
            db: Database session
            include_inactive: Include inactive team members
            
        Returns:
            List of team members
        """
        query = select(TeamMember)
        
        if not include_inactive:
            query = query.where(TeamMember.is_active == True)
        
        query = query.order_by(TeamMember.display_order, TeamMember.name)
        
        result = await db.execute(query)
        team_members = result.scalars().all()
        
        logger.info(f"Retrieved {len(team_members)} team members")
        return list(team_members)
    
    @staticmethod
    async def get_team_member_by_id(
        db: AsyncSession,
        member_id: int
    ) -> TeamMember:
        """
        Get team member by ID
        
        Args:
            db: Database session
            member_id: Team member ID
            
        Returns:
            Team member instance
            
        Raises:
            ResourceNotFoundError: If team member not found
        """
        result = await db.execute(
            select(TeamMember).where(TeamMember.id == member_id)
        )
        member = result.scalar_one_or_none()
        
        if not member:
            raise ResourceNotFoundError(resource_type="Team Member", resource_id=member_id)
        
        return member
    
    # ========================================================================
    # Company Info Operations
    # ========================================================================
    
    @staticmethod
    async def get_company_info(
        db: AsyncSession
    ) -> Optional[CompanyInfo]:
        """
        Get company information (should only be one record)
        
        Args:
            db: Database session
            
        Returns:
            Company info or None
        """
        result = await db.execute(
            select(CompanyInfo).limit(1)
        )
        company_info = result.scalar_one_or_none()
        
        return company_info
    
    # ========================================================================
    # Contact Location Operations
    # ========================================================================
    
    @staticmethod
    async def get_contact_locations(
        db: AsyncSession,
        include_inactive: bool = False
    ) -> List[ContactLocation]:
        """
        Get all contact locations
        
        Args:
            db: Database session
            include_inactive: Include inactive locations
            
        Returns:
            List of contact locations
        """
        query = select(ContactLocation)
        
        if not include_inactive:
            query = query.where(ContactLocation.is_active == True)
        
        query = query.order_by(ContactLocation.display_order, ContactLocation.name)
        
        result = await db.execute(query)
        locations = result.scalars().all()
        
        logger.info(f"Retrieved {len(locations)} contact locations")
        return list(locations)
    
    @staticmethod
    async def get_contact_location_by_id(
        db: AsyncSession,
        location_id: int
    ) -> ContactLocation:
        """
        Get contact location by ID
        
        Args:
            db: Database session
            location_id: Location ID
            
        Returns:
            Contact location instance
            
        Raises:
            ResourceNotFoundError: If location not found
        """
        result = await db.execute(
            select(ContactLocation).where(ContactLocation.id == location_id)
        )
        location = result.scalar_one_or_none()
        
        if not location:
            raise ResourceNotFoundError(resource_type="Contact Location", resource_id=location_id)
        
        return location
    
    # ========================================================================
    # Catalog Operations
    # ========================================================================
    
    @staticmethod
    async def get_catalogs(
        db: AsyncSession,
        include_inactive: bool = False
    ) -> List[Catalog]:
        """
        Get all catalogs
        
        Args:
            db: Database session
            include_inactive: Include inactive catalogs
            
        Returns:
            List of catalogs
        """
        query = select(Catalog)
        
        if not include_inactive:
            query = query.where(Catalog.is_active == True)
        
        query = query.order_by(Catalog.display_order, Catalog.title)
        
        result = await db.execute(query)
        catalogs = result.scalars().all()
        
        logger.info(f"Retrieved {len(catalogs)} catalogs")
        return list(catalogs)
    
    @staticmethod
    async def get_catalog_by_id(
        db: AsyncSession,
        catalog_id: int
    ) -> Catalog:
        """
        Get catalog by ID
        
        Args:
            db: Database session
            catalog_id: Catalog ID
            
        Returns:
            Catalog instance
            
        Raises:
            ResourceNotFoundError: If catalog not found
        """
        result = await db.execute(
            select(Catalog).where(Catalog.id == catalog_id)
        )
        catalog = result.scalar_one_or_none()
        
        if not catalog:
            raise ResourceNotFoundError(resource_type="Catalog", resource_id=catalog_id)
        
        return catalog
    
    # ========================================================================
    # Installation Guide Operations
    # ========================================================================
    
    @staticmethod
    async def get_installation_guides(
        db: AsyncSession,
        include_inactive: bool = False
    ) -> List[Installation]:
        """
        Get all installation guides
        
        Args:
            db: Database session
            include_inactive: Include inactive guides
            
        Returns:
            List of installation guides
        """
        query = select(Installation)
        
        if not include_inactive:
            query = query.where(Installation.is_active == True)
        
        query = query.order_by(Installation.display_order, Installation.title)
        
        result = await db.execute(query)
        guides = result.scalars().all()
        
        logger.info(f"Retrieved {len(guides)} installation guides")
        return list(guides)
    
    @staticmethod
    async def get_installation_guide_by_id(
        db: AsyncSession,
        guide_id: int
    ) -> Installation:
        """
        Get installation guide by ID
        
        Args:
            db: Database session
            guide_id: Guide ID
            
        Returns:
            Installation guide instance
            
        Raises:
            ResourceNotFoundError: If guide not found
        """
        result = await db.execute(
            select(Installation).where(Installation.id == guide_id)
        )
        guide = result.scalar_one_or_none()
        
        if not guide:
            raise ResourceNotFoundError(resource_type="Installation Guide", resource_id=guide_id)
        
        return guide
    
    # ========================================================================
    # Feedback Operations
    # ========================================================================
    
    @staticmethod
    async def create_feedback(
        db: AsyncSession,
        name: str,
        email: str,
        subject: str,
        message: str,
        company_id: Optional[int] = None
    ) -> Feedback:
        """
        Create feedback submission
        
        Args:
            db: Database session
            name: Submitter name
            email: Submitter email
            subject: Subject
            message: Message
            company_id: Optional company ID if authenticated
            
        Returns:
            Created feedback
        """
        feedback = Feedback(
            name=name,
            email=email,
            subject=subject,
            message=message,
            company_id=company_id
        )
        
        db.add(feedback)
        await db.commit()
        await db.refresh(feedback)
        
        logger.info(f"Feedback submitted by {email}: {subject}")
        
        return feedback
    
    @staticmethod
    async def get_all_feedback(
        db: AsyncSession,
        is_read: Optional[bool] = None
    ) -> List[Feedback]:
        """
        Get all feedback submissions (admin only)
        
        Args:
            db: Database session
            is_read: Filter by read status
            
        Returns:
            List of feedback
        """
        query = select(Feedback)
        
        if is_read is not None:
            query = query.where(Feedback.is_read == is_read)
        
        query = query.order_by(Feedback.created_at.desc())
        
        result = await db.execute(query)
        feedback_list = result.scalars().all()
        
        logger.info(f"Retrieved {len(feedback_list)} feedback submissions")
        return list(feedback_list)

