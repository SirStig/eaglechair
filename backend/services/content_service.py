"""
Content Service

Handles content management (FAQs, team, company info, contact, catalogs, etc.)
"""

import logging
from typing import List, Optional

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.exceptions import ResourceAlreadyExistsError, ResourceNotFoundError
from backend.models.content import (
    FAQ,
    Catalog,
    CompanyInfo,
    ContactLocation,
    FAQCategory,
    Feedback,
    Installation,
    TeamMember,
)
from backend.utils.static_content_exporter import export_content_after_update

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
    
    @staticmethod
    async def create_faq_category(
        db: AsyncSession,
        name: str,
        description: Optional[str] = None,
        display_order: int = 0,
        is_active: bool = True
    ) -> FAQCategory:
        """Create a new FAQ category"""
        category = FAQCategory(
            name=name,
            description=description,
            display_order=display_order,
            is_active=is_active
        )
        db.add(category)
        await db.commit()
        await db.refresh(category)
        logger.info(f"Created FAQ category: {name}")
        
        # Export updated FAQ categories
        await export_content_after_update('faqCategories', db)
        
        return category
    
    @staticmethod
    async def update_faq_category(
        db: AsyncSession,
        category_id: int,
        **updates
    ) -> FAQCategory:
        """Update FAQ category"""
        result = await db.execute(
            select(FAQCategory).where(FAQCategory.id == category_id)
        )
        category = result.scalar_one_or_none()
        
        if not category:
            raise ResourceNotFoundError(resource_type="FAQ Category", resource_id=category_id)
        
        for key, value in updates.items():
            if hasattr(category, key):
                setattr(category, key, value)
        
        await db.commit()
        await db.refresh(category)
        logger.info(f"Updated FAQ category {category_id}")
        
        # Export updated FAQ categories
        await export_content_after_update('faqCategories', db)
        
        return category
    
    @staticmethod
    async def delete_faq_category(db: AsyncSession, category_id: int) -> None:
        """Delete FAQ category"""
        result = await db.execute(
            select(FAQCategory).where(FAQCategory.id == category_id)
        )
        category = result.scalar_one_or_none()
        
        if not category:
            raise ResourceNotFoundError(resource_type="FAQ Category", resource_id=category_id)
        
        await db.delete(category)
        await db.commit()
        logger.info(f"Deleted FAQ category {category_id}")
        
        # Export updated FAQ categories
        await export_content_after_update('faqCategories', db)
    
    @staticmethod
    async def create_faq(
        db: AsyncSession,
        category_id: int,
        question: str,
        answer: str,
        display_order: int = 0,
        is_active: bool = True
    ) -> FAQ:
        """Create a new FAQ"""
        faq = FAQ(
            category_id=category_id,
            question=question,
            answer=answer,
            display_order=display_order,
            is_active=is_active
        )
        db.add(faq)
        await db.commit()
        await db.refresh(faq)
        logger.info(f"Created FAQ: {question[:50]}...")
        
        # Export updated FAQs
        await export_content_after_update('faqs', db)
        
        return faq
    
    @staticmethod
    async def update_faq(
        db: AsyncSession,
        faq_id: int,
        **updates
    ) -> FAQ:
        """Update FAQ"""
        result = await db.execute(
            select(FAQ).where(FAQ.id == faq_id)
        )
        faq = result.scalar_one_or_none()
        
        if not faq:
            raise ResourceNotFoundError(resource_type="FAQ", resource_id=faq_id)
        
        for key, value in updates.items():
            if hasattr(faq, key):
                setattr(faq, key, value)
        
        await db.commit()
        await db.refresh(faq)
        logger.info(f"Updated FAQ {faq_id}")
        
        # Export updated FAQs
        await export_content_after_update('faqs', db)
        
        return faq
    
    @staticmethod
    async def delete_faq(db: AsyncSession, faq_id: int) -> None:
        """Delete FAQ"""
        result = await db.execute(
            select(FAQ).where(FAQ.id == faq_id)
        )
        faq = result.scalar_one_or_none()
        
        if not faq:
            raise ResourceNotFoundError(resource_type="FAQ", resource_id=faq_id)
        
        await db.delete(faq)
        await db.commit()
        logger.info(f"Deleted FAQ {faq_id}")
        
        # Export updated FAQs
        await export_content_after_update('faqs', db)
    
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
    
    @staticmethod
    async def create_team_member(
        db: AsyncSession,
        name: str,
        title: str,
        bio: Optional[str] = None,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        image_url: Optional[str] = None,
        linkedin_url: Optional[str] = None,
        display_order: int = 0,
        is_active: bool = True
    ) -> TeamMember:
        """Create a new team member"""
        member = TeamMember(
            name=name,
            title=title,
            bio=bio,
            email=email,
            phone=phone,
            image_url=image_url,
            linkedin_url=linkedin_url,
            display_order=display_order,
            is_active=is_active
        )
        db.add(member)
        await db.commit()
        await db.refresh(member)
        logger.info(f"Created team member: {name}")
        return member
    
    @staticmethod
    async def update_team_member(
        db: AsyncSession,
        member_id: int,
        **updates
    ) -> TeamMember:
        """Update team member"""
        result = await db.execute(
            select(TeamMember).where(TeamMember.id == member_id)
        )
        member = result.scalar_one_or_none()
        
        if not member:
            raise ResourceNotFoundError(resource_type="Team Member", resource_id=member_id)
        
        for key, value in updates.items():
            if hasattr(member, key):
                setattr(member, key, value)
        
        await db.commit()
        await db.refresh(member)
        logger.info(f"Updated team member {member_id}")
        return member
    
    @staticmethod
    async def delete_team_member(db: AsyncSession, member_id: int) -> None:
        """Delete team member"""
        result = await db.execute(
            select(TeamMember).where(TeamMember.id == member_id)
        )
        member = result.scalar_one_or_none()
        
        if not member:
            raise ResourceNotFoundError(resource_type="Team Member", resource_id=member_id)
        
        await db.delete(member)
        await db.commit()
        logger.info(f"Deleted team member {member_id}")
    
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
    
    @staticmethod
    async def update_company_info(
        db: AsyncSession,
        **updates
    ) -> CompanyInfo:
        """Update company information (creates if doesn't exist)"""
        result = await db.execute(
            select(CompanyInfo).limit(1)
        )
        company_info = result.scalar_one_or_none()
        
        if not company_info:
            # Create if doesn't exist
            company_info = CompanyInfo()
            db.add(company_info)
        
        for key, value in updates.items():
            if hasattr(company_info, key):
                setattr(company_info, key, value)
        
        await db.commit()
        await db.refresh(company_info)
        logger.info("Updated company info")
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
    
    @staticmethod
    async def create_contact_location(
        db: AsyncSession,
        name: str,
        address_line1: str,
        city: str,
        state: str,
        zip_code: str,
        country: str = "USA",
        address_line2: Optional[str] = None,
        phone: Optional[str] = None,
        fax: Optional[str] = None,
        email: Optional[str] = None,
        hours: Optional[str] = None,
        is_headquarters: bool = False,
        display_order: int = 0,
        is_active: bool = True
    ) -> ContactLocation:
        """Create a new contact location"""
        location = ContactLocation(
            name=name,
            address_line1=address_line1,
            address_line2=address_line2,
            city=city,
            state=state,
            zip_code=zip_code,
            country=country,
            phone=phone,
            fax=fax,
            email=email,
            hours=hours,
            is_headquarters=is_headquarters,
            display_order=display_order,
            is_active=is_active
        )
        db.add(location)
        await db.commit()
        await db.refresh(location)
        logger.info(f"Created contact location: {name}")
        return location
    
    @staticmethod
    async def update_contact_location(
        db: AsyncSession,
        location_id: int,
        **updates
    ) -> ContactLocation:
        """Update contact location"""
        result = await db.execute(
            select(ContactLocation).where(ContactLocation.id == location_id)
        )
        location = result.scalar_one_or_none()
        
        if not location:
            raise ResourceNotFoundError(resource_type="Contact Location", resource_id=location_id)
        
        for key, value in updates.items():
            if hasattr(location, key):
                setattr(location, key, value)
        
        await db.commit()
        await db.refresh(location)
        logger.info(f"Updated contact location {location_id}")
        return location
    
    @staticmethod
    async def delete_contact_location(db: AsyncSession, location_id: int) -> None:
        """Delete contact location"""
        result = await db.execute(
            select(ContactLocation).where(ContactLocation.id == location_id)
        )
        location = result.scalar_one_or_none()
        
        if not location:
            raise ResourceNotFoundError(resource_type="Contact Location", resource_id=location_id)
        
        await db.delete(location)
        await db.commit()
        logger.info(f"Deleted contact location {location_id}")
    
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
    
    @staticmethod
    async def create_catalog(
        db: AsyncSession,
        title: str,
        description: Optional[str] = None,
        file_url: Optional[str] = None,
        cover_image_url: Optional[str] = None,
        file_size_mb: Optional[float] = None,
        display_order: int = 0,
        is_active: bool = True
    ) -> Catalog:
        """Create a new catalog"""
        catalog = Catalog(
            title=title,
            description=description,
            file_url=file_url,
            cover_image_url=cover_image_url,
            file_size_mb=file_size_mb,
            display_order=display_order,
            is_active=is_active
        )
        db.add(catalog)
        await db.commit()
        await db.refresh(catalog)
        logger.info(f"Created catalog: {title}")
        
        # Export updated catalogs
        await export_content_after_update('catalogs', db)
        
        return catalog
    
    @staticmethod
    async def update_catalog(
        db: AsyncSession,
        catalog_id: int,
        **updates
    ) -> Catalog:
        """Update catalog"""
        result = await db.execute(
            select(Catalog).where(Catalog.id == catalog_id)
        )
        catalog = result.scalar_one_or_none()
        
        if not catalog:
            raise ResourceNotFoundError(resource_type="Catalog", resource_id=catalog_id)
        
        for key, value in updates.items():
            if hasattr(catalog, key):
                setattr(catalog, key, value)
        
        # Increment download count if file_url was accessed
        if 'download_count' in updates:
            catalog.download_count = updates['download_count']
        
        await db.commit()
        await db.refresh(catalog)
        logger.info(f"Updated catalog {catalog_id}")
        
        # Export updated catalogs
        await export_content_after_update('catalogs', db)
        
        return catalog
    
    @staticmethod
    async def delete_catalog(db: AsyncSession, catalog_id: int) -> None:
        """Delete catalog"""
        result = await db.execute(
            select(Catalog).where(Catalog.id == catalog_id)
        )
        catalog = result.scalar_one_or_none()
        
        if not catalog:
            raise ResourceNotFoundError(resource_type="Catalog", resource_id=catalog_id)
        
        await db.delete(catalog)
        await db.commit()
        logger.info(f"Deleted catalog {catalog_id}")
        
        # Export updated catalogs
        await export_content_after_update('catalogs', db)
    
    @staticmethod
    async def increment_catalog_downloads(
        db: AsyncSession,
        catalog_id: int
    ) -> Catalog:
        """Increment catalog download count"""
        result = await db.execute(
            select(Catalog).where(Catalog.id == catalog_id)
        )
        catalog = result.scalar_one_or_none()
        
        if not catalog:
            raise ResourceNotFoundError(resource_type="Catalog", resource_id=catalog_id)
        
        catalog.download_count += 1
        await db.commit()
        await db.refresh(catalog)
        
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
    
    @staticmethod
    async def create_installation_guide(
        db: AsyncSession,
        title: str,
        description: Optional[str] = None,
        file_url: Optional[str] = None,
        cover_image_url: Optional[str] = None,
        file_size_mb: Optional[float] = None,
        display_order: int = 0,
        is_active: bool = True
    ) -> Installation:
        """Create a new installation guide"""
        guide = Installation(
            title=title,
            description=description,
            file_url=file_url,
            cover_image_url=cover_image_url,
            file_size_mb=file_size_mb,
            display_order=display_order,
            is_active=is_active
        )
        db.add(guide)
        await db.commit()
        await db.refresh(guide)
        logger.info(f"Created installation guide: {title}")
        
        # Export updated installations/gallery
        await export_content_after_update('galleryImages', db)
        
        return guide
    
    @staticmethod
    async def update_installation_guide(
        db: AsyncSession,
        guide_id: int,
        **updates
    ) -> Installation:
        """Update installation guide"""
        result = await db.execute(
            select(Installation).where(Installation.id == guide_id)
        )
        guide = result.scalar_one_or_none()
        
        if not guide:
            raise ResourceNotFoundError(resource_type="Installation Guide", resource_id=guide_id)
        
        for key, value in updates.items():
            if hasattr(guide, key):
                setattr(guide, key, value)
        
        await db.commit()
        await db.refresh(guide)
        logger.info(f"Updated installation guide {guide_id}")
        
        # Export updated installations/gallery
        await export_content_after_update('galleryImages', db)
        
        return guide
    
    @staticmethod
    async def delete_installation_guide(db: AsyncSession, guide_id: int) -> None:
        """Delete installation guide"""
        result = await db.execute(
            select(Installation).where(Installation.id == guide_id)
        )
        guide = result.scalar_one_or_none()
        
        if not guide:
            raise ResourceNotFoundError(resource_type="Installation Guide", resource_id=guide_id)
        
        await db.delete(guide)
        await db.commit()
        logger.info(f"Deleted installation guide {guide_id}")
        
        # Export updated installations/gallery
        await export_content_after_update('galleryImages', db)
    
    @staticmethod
    async def increment_installation_downloads(
        db: AsyncSession,
        guide_id: int
    ) -> Installation:
        """Increment installation guide download count"""
        result = await db.execute(
            select(Installation).where(Installation.id == guide_id)
        )
        guide = result.scalar_one_or_none()
        
        if not guide:
            raise ResourceNotFoundError(resource_type="Installation Guide", resource_id=guide_id)
        
        guide.download_count += 1
        await db.commit()
        await db.refresh(guide)
        
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

