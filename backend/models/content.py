"""
EagleChair Content Models

Models for About Us, FAQ, Catalogs, Guides, Installation Gallery, Contact Info
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, Enum as SQLEnum, DateTime
from sqlalchemy.orm import relationship
import enum

from backend.database.base import Base


class TeamMember(Base):
    """
    About Us - Team members
    """
    __tablename__ = "team_members"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    title = Column(String(255), nullable=False)  # e.g., "CEO", "Sales Manager"
    bio = Column(Text, nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    photo_url = Column(String(500), nullable=True)
    
    # Social links
    linkedin_url = Column(String(500), nullable=True)
    
    # Display
    display_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_featured = Column(Boolean, default=False, nullable=False)
    
    def __repr__(self) -> str:
        return f"<TeamMember(id={self.id}, name={self.name}, title={self.title})>"


class CompanyInfo(Base):
    """
    Company information for About Us section
    """
    __tablename__ = "company_info"
    
    id = Column(Integer, primary_key=True, index=True)
    section_key = Column(String(100), unique=True, nullable=False)  # e.g., "about_us", "mission", "history"
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    image_url = Column(String(500), nullable=True)
    display_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    def __repr__(self) -> str:
        return f"<CompanyInfo(id={self.id}, key={self.section_key})>"


class FAQCategory(Base):
    """
    FAQ Categories and subcategories
    """
    __tablename__ = "faq_categories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    slug = Column(String(255), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String(100), nullable=True)  # Icon name or emoji
    
    # Hierarchy support
    parent_id = Column(Integer, ForeignKey("faq_categories.id"), nullable=True)
    parent = relationship("FAQCategory", remote_side=[id], backref="subcategories")
    
    display_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Relationships
    faqs = relationship("FAQ", back_populates="category")
    
    def __repr__(self) -> str:
        return f"<FAQCategory(id={self.id}, name={self.name})>"


class FAQ(Base):
    """
    Frequently Asked Questions
    """
    __tablename__ = "faqs"
    
    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("faq_categories.id"), nullable=False)
    category = relationship("FAQCategory", back_populates="faqs")
    
    question = Column(Text, nullable=False, index=True)
    answer = Column(Text, nullable=False)
    
    # Additional info
    helpful_links = Column(Text, nullable=True)  # JSON or comma-separated URLs
    related_products = Column(Text, nullable=True)  # JSON array of product IDs
    
    # Display
    display_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_featured = Column(Boolean, default=False, nullable=False)
    
    # Analytics
    view_count = Column(Integer, default=0, nullable=False)
    helpful_count = Column(Integer, default=0, nullable=False)
    
    def __repr__(self) -> str:
        return f"<FAQ(id={self.id}, question={self.question[:50]}...)>"


class CatalogType(str, enum.Enum):
    """Catalog/guide type enumeration"""
    FULL_CATALOG = "full_catalog"
    PRODUCT_LINE = "product_line"
    PRICE_LIST = "price_list"
    FINISH_GUIDE = "finish_guide"
    UPHOLSTERY_GUIDE = "upholstery_guide"
    CARE_GUIDE = "care_guide"
    INSTALLATION_GUIDE = "installation_guide"
    SPECIFICATION_SHEET = "specification_sheet"
    OTHER = "other"


class Catalog(Base):
    """
    Virtual catalogs and guides (PDFs, images)
    """
    __tablename__ = "catalogs"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    catalog_type = Column(SQLEnum(CatalogType), nullable=False)
    
    # File information
    file_type = Column(String(20), nullable=False)  # "PDF", "IMAGE", "ZIP"
    file_url = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=True)  # In bytes
    thumbnail_url = Column(String(500), nullable=True)
    
    # Version control
    version = Column(String(20), nullable=True)
    year = Column(String(4), nullable=True)
    
    # Related category (optional)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    
    # Display
    display_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_featured = Column(Boolean, default=False, nullable=False)
    
    # Analytics
    download_count = Column(Integer, default=0, nullable=False)
    
    def __repr__(self) -> str:
        return f"<Catalog(id={self.id}, title={self.title}, type={self.catalog_type})>"


class Installation(Base):
    """
    Installation gallery - showcase completed projects
    """
    __tablename__ = "installations"
    
    id = Column(Integer, primary_key=True, index=True)
    project_name = Column(String(255), nullable=False, index=True)
    client_name = Column(String(255), nullable=True)
    location = Column(String(255), nullable=True)  # City, State
    project_type = Column(String(100), nullable=True)  # e.g., "Restaurant", "Hotel", "Healthcare"
    description = Column(Text, nullable=True)
    
    # Images (stored as JSON array of URLs)
    images = Column(String, nullable=False)  # JSON array
    primary_image = Column(String(500), nullable=True)
    
    # Products used (JSON array of product IDs)
    products_used = Column(String, nullable=True)  # JSON array
    
    # Date
    completion_date = Column(String(50), nullable=True)
    
    # Display
    display_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_featured = Column(Boolean, default=False, nullable=False)
    
    # Analytics
    view_count = Column(Integer, default=0, nullable=False)
    
    def __repr__(self) -> str:
        return f"<Installation(id={self.id}, project={self.project_name})>"


class ContactLocation(Base):
    """
    Contact information for different locations/offices
    """
    __tablename__ = "contact_locations"
    
    id = Column(Integer, primary_key=True, index=True)
    location_name = Column(String(255), nullable=False)  # e.g., "Main Office", "West Coast Showroom"
    description = Column(Text, nullable=True)
    
    # Address
    address_line1 = Column(String(255), nullable=False)
    address_line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=False)
    state = Column(String(50), nullable=False)
    zip_code = Column(String(20), nullable=False)
    country = Column(String(100), default="USA", nullable=False)
    
    # Contact Details
    phone = Column(String(20), nullable=False)
    fax = Column(String(20), nullable=True)
    email = Column(String(255), nullable=False)
    toll_free = Column(String(20), nullable=True)
    
    # Hours
    business_hours = Column(Text, nullable=True)  # e.g., "Mon-Fri: 8am-5pm"
    
    # Media
    image_url = Column(String(500), nullable=True)
    map_embed_url = Column(Text, nullable=True)  # Google Maps embed
    
    # Type
    location_type = Column(String(50), default="office", nullable=False)  # office, showroom, warehouse
    
    # Display
    display_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_primary = Column(Boolean, default=False, nullable=False)
    
    def __repr__(self) -> str:
        return f"<ContactLocation(id={self.id}, name={self.location_name})>"


class Feedback(Base):
    """
    Customer feedback/contact form submissions
    """
    __tablename__ = "feedback"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Submitter info
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    company_name = Column(String(255), nullable=True)
    
    # Message
    subject = Column(String(255), nullable=True)
    message = Column(Text, nullable=False)
    feedback_type = Column(String(50), default="general", nullable=False)  # general, inquiry, complaint, suggestion
    
    # Status
    is_read = Column(Boolean, default=False, nullable=False)
    is_responded = Column(Boolean, default=False, nullable=False)
    admin_notes = Column(Text, nullable=True)
    
    # Metadata
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)
    
    def __repr__(self) -> str:
        return f"<Feedback(id={self.id}, from={self.name}, type={self.feedback_type})>"


class EmailTemplate(Base):
    """
    Email templates for various system emails
    """
    __tablename__ = "email_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Template info
    template_type = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Content
    subject = Column(String(500), nullable=False)
    body = Column(Text, nullable=False)
    
    # Variables available for this template (stored as JSON)
    available_variables = Column(Text, nullable=True)  # JSON string of variable names and descriptions
    
    # Status
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Usage tracking
    times_sent = Column(Integer, default=0, nullable=False)
    last_sent_at = Column(DateTime(timezone=True), nullable=True)
    
    def __repr__(self) -> str:
        return f"<EmailTemplate(id={self.id}, type={self.template_type})>"
