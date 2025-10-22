"""
EagleChair Content Models

Models for About Us, FAQ, Catalogs, Guides, Installation Gallery, Contact Info
Fully customizable CMS-like content management
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, Enum as SQLEnum, DateTime, JSON
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


class HeroSlide(Base):
    """
    Homepage hero carousel slides
    Fully customizable hero sections
    """
    __tablename__ = "hero_slides"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    subtitle = Column(Text, nullable=True)
    background_image_url = Column(String(500), nullable=False)
    
    # Call to Action
    cta_text = Column(String(100), nullable=True)  # e.g., "Explore Products"
    cta_link = Column(String(500), nullable=True)  # e.g., "/products"
    cta_style = Column(String(50), default="primary", nullable=False)  # primary, outline, etc.
    
    # Secondary CTA (optional)
    secondary_cta_text = Column(String(100), nullable=True)
    secondary_cta_link = Column(String(500), nullable=True)
    secondary_cta_style = Column(String(50), nullable=True)
    
    # Display
    display_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    def __repr__(self) -> str:
        return f"<HeroSlide(id={self.id}, title={self.title})>"


class ClientLogo(Base):
    """
    Client/Partner logos for "Trusted By" section
    """
    __tablename__ = "client_logos"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    logo_url = Column(String(500), nullable=False)
    website_url = Column(String(500), nullable=True)
    
    # Display
    display_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    def __repr__(self) -> str:
        return f"<ClientLogo(id={self.id}, name={self.name})>"


class Feature(Base):
    """
    Features/Benefits for "Why Choose Us" sections
    Reusable across different pages
    """
    __tablename__ = "features"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    icon = Column(String(100), nullable=True)  # Icon name, emoji, or URL
    icon_color = Column(String(50), nullable=True)  # Hex color for icon
    
    # Categorization for different sections
    feature_type = Column(String(50), default="general", nullable=False)  # general, home_page, about_page, etc.
    
    # Display
    display_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    def __repr__(self) -> str:
        return f"<Feature(id={self.id}, title={self.title})>"


class CompanyValue(Base):
    """
    Company values for About Us page
    """
    __tablename__ = "company_values"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    icon = Column(String(100), nullable=True)
    
    # Display
    display_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    def __repr__(self) -> str:
        return f"<CompanyValue(id={self.id}, title={self.title})>"


class CompanyMilestone(Base):
    """
    Company milestones/timeline for About Us page
    """
    __tablename__ = "company_milestones"
    
    id = Column(Integer, primary_key=True, index=True)
    year = Column(String(10), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    image_url = Column(String(500), nullable=True)
    
    # Display
    display_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    def __repr__(self) -> str:
        return f"<CompanyMilestone(id={self.id}, year={self.year}, title={self.title})>"


class SalesRepresentative(Base):
    """
    Sales representatives with territory mapping
    For Find a Rep page with interactive US map
    """
    __tablename__ = "sales_representatives"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=False)
    title = Column(String(100), nullable=True)
    photo_url = Column(String(500), nullable=True)
    bio = Column(Text, nullable=True)
    
    # Territory
    territory_name = Column(String(255), nullable=False)  # e.g., "Southwest Region"
    states_covered = Column(JSON, nullable=False)  # Array of state codes: ["TX", "OK", "AR", "NM", "AZ"]
    
    # Additional contact
    mobile_phone = Column(String(20), nullable=True)
    fax = Column(String(20), nullable=True)
    linkedin_url = Column(String(500), nullable=True)
    
    # Display
    display_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    def __repr__(self) -> str:
        return f"<SalesRepresentative(id={self.id}, name={self.name}, territory={self.territory_name})>"


class SiteSettings(Base):
    """
    Global site settings - company branding, contact info, etc.
    Single row table for site-wide configuration
    """
    __tablename__ = "site_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Company Branding
    company_name = Column(String(255), default="Eagle Chair", nullable=False)
    company_tagline = Column(String(500), nullable=True)
    logo_url = Column(String(500), nullable=True)
    logo_dark_url = Column(String(500), nullable=True)  # For dark backgrounds
    favicon_url = Column(String(500), nullable=True)
    
    # Primary Contact Info
    primary_email = Column(String(255), nullable=True)
    primary_phone = Column(String(20), nullable=True)
    sales_email = Column(String(255), nullable=True)
    sales_phone = Column(String(20), nullable=True)
    support_email = Column(String(255), nullable=True)
    support_phone = Column(String(20), nullable=True)
    
    # Primary Address
    address_line1 = Column(String(255), nullable=True)
    address_line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(50), nullable=True)
    zip_code = Column(String(20), nullable=True)
    country = Column(String(100), default="USA", nullable=True)
    
    # Business Hours
    business_hours_weekdays = Column(String(255), nullable=True)
    business_hours_saturday = Column(String(255), nullable=True)
    business_hours_sunday = Column(String(255), nullable=True)
    
    # Social Media
    facebook_url = Column(String(500), nullable=True)
    instagram_url = Column(String(500), nullable=True)
    linkedin_url = Column(String(500), nullable=True)
    twitter_url = Column(String(500), nullable=True)
    youtube_url = Column(String(500), nullable=True)
    
    # SEO & Meta
    meta_title = Column(String(255), nullable=True)
    meta_description = Column(Text, nullable=True)
    meta_keywords = Column(Text, nullable=True)
    
    # Theme Colors (stored as JSON)
    theme_colors = Column(JSON, nullable=True)  # {"primary": "#8b7355", "secondary": "#627d98", ...}
    
    # Additional Settings (stored as JSON for flexibility)
    additional_settings = Column(JSON, nullable=True)
    
    def __repr__(self) -> str:
        return f"<SiteSettings(id={self.id}, company={self.company_name})>"


class PageContent(Base):
    """
    Flexible page content sections
    Allows creating custom content blocks for any page
    """
    __tablename__ = "page_contents"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Page identification
    page_slug = Column(String(100), nullable=False, index=True)  # e.g., "home", "about", "contact"
    section_key = Column(String(100), nullable=False, index=True)  # e.g., "hero", "about_story", "cta"
    
    # Content
    title = Column(String(500), nullable=True)
    subtitle = Column(String(500), nullable=True)
    content = Column(Text, nullable=True)
    
    # Media
    image_url = Column(String(500), nullable=True)
    video_url = Column(String(500), nullable=True)
    
    # Call to Action
    cta_text = Column(String(100), nullable=True)
    cta_link = Column(String(500), nullable=True)
    cta_style = Column(String(50), nullable=True)
    
    # Additional data (stored as JSON for flexibility)
    extra_data = Column(JSON, nullable=True)
    
    # Display
    display_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    def __repr__(self) -> str:
        return f"<PageContent(id={self.id}, page={self.page_slug}, section={self.section_key})>"


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
