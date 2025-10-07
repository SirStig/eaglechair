"""
EagleChair Quote and Cart Models

Models for quote requests and shopping cart (quotes only, no actual purchasing)
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, Float, ForeignKey, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship
import enum

from backend.database.base import Base


class QuoteStatus(str, enum.Enum):
    """Quote status enumeration"""
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    QUOTED = "quoted"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    EXPIRED = "expired"


class Quote(Base):
    """
    Quote requests from companies
    Cart contents are converted to quote requests
    """
    __tablename__ = "quotes"
    
    id = Column(Integer, primary_key=True, index=True)
    quote_number = Column(String(50), unique=True, index=True, nullable=False)
    
    # Company/Customer
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    company = relationship("Company", back_populates="quotes")
    
    # Contact Information (at time of quote)
    contact_name = Column(String(255), nullable=False)
    contact_email = Column(String(255), nullable=False)
    contact_phone = Column(String(20), nullable=False)
    
    # Project Information
    project_name = Column(String(255), nullable=True)
    project_description = Column(Text, nullable=True)
    project_type = Column(String(100), nullable=True)  # e.g., "Restaurant", "Hotel"
    estimated_quantity = Column(Integer, nullable=True)
    target_budget = Column(Integer, nullable=True)  # In cents
    desired_delivery_date = Column(String(50), nullable=True)
    
    # Shipping Information
    shipping_address_line1 = Column(String(255), nullable=False)
    shipping_address_line2 = Column(String(255), nullable=True)
    shipping_city = Column(String(100), nullable=False)
    shipping_state = Column(String(50), nullable=False)
    shipping_zip = Column(String(20), nullable=False)
    shipping_country = Column(String(100), default="USA", nullable=False)
    
    # Quote Details
    status = Column(SQLEnum(QuoteStatus), default=QuoteStatus.DRAFT, nullable=False)
    subtotal = Column(Integer, default=0, nullable=False)  # In cents
    tax_amount = Column(Integer, default=0, nullable=False)
    shipping_cost = Column(Integer, default=0, nullable=False)
    discount_amount = Column(Integer, default=0, nullable=False)
    total_amount = Column(Integer, default=0, nullable=False)
    
    # Special Requests
    special_instructions = Column(Text, nullable=True)
    requires_com = Column(Boolean, default=False, nullable=False)  # Customer's Own Material
    rush_order = Column(Boolean, default=False, nullable=False)
    
    # Quote Response (filled by admin)
    quoted_price = Column(Integer, nullable=True)  # Final quoted price in cents
    quoted_lead_time = Column(String(100), nullable=True)
    quote_notes = Column(Text, nullable=True)
    quote_valid_until = Column(String(50), nullable=True)
    quote_pdf_url = Column(String(500), nullable=True)
    
    # Admin Information
    assigned_to_admin_id = Column(Integer, ForeignKey("admin_users.id"), nullable=True)
    admin_notes = Column(Text, nullable=True)
    
    # Dates
    submitted_at = Column(String(50), nullable=True)
    quoted_at = Column(String(50), nullable=True)
    accepted_at = Column(String(50), nullable=True)
    expires_at = Column(String(50), nullable=True)
    
    # Relationships
    items = relationship("QuoteItem", back_populates="quote", cascade="all, delete-orphan")
    attachments = relationship("QuoteAttachment", back_populates="quote", cascade="all, delete-orphan")
    history = relationship("QuoteHistory", back_populates="quote", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        return f"<Quote(id={self.id}, number={self.quote_number}, status={self.status})>"


class QuoteItem(Base):
    """
    Individual items in a quote
    """
    __tablename__ = "quote_items"
    
    id = Column(Integer, primary_key=True, index=True)
    quote_id = Column(Integer, ForeignKey("quotes.id"), nullable=False)
    quote = relationship("Quote", back_populates="items")
    
    product_id = Column(Integer, ForeignKey("chairs.id"), nullable=False)
    product = relationship("Chair", back_populates="quote_items")
    
    # Product details (captured at time of quote)
    product_model_number = Column(String(100), nullable=False)
    product_name = Column(String(255), nullable=False)
    
    # Quantity
    quantity = Column(Integer, nullable=False)
    
    # Customization Options
    selected_finish_id = Column(Integer, ForeignKey("finishes.id"), nullable=True)
    selected_upholstery_id = Column(Integer, ForeignKey("upholsteries.id"), nullable=True)
    
    # Custom options (stored as JSON)
    # e.g., {"seat_color": "Red", "logo_embroidery": "Company Logo"}
    custom_options = Column(JSON, nullable=True)
    
    # Pricing
    unit_price = Column(Integer, nullable=False)  # In cents
    customization_cost = Column(Integer, default=0, nullable=False)
    line_total = Column(Integer, nullable=False)  # quantity * (unit_price + customization_cost)
    
    # Special notes for this item
    item_notes = Column(Text, nullable=True)
    
    def __repr__(self) -> str:
        return f"<QuoteItem(id={self.id}, product={self.product_name}, qty={self.quantity})>"


class Cart(Base):
    """
    Shopping cart (temporary storage before quote submission)
    """
    __tablename__ = "carts"
    
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, unique=True)
    company = relationship("Company", back_populates="carts")
    
    # Cart totals (calculated)
    subtotal = Column(Integer, default=0, nullable=False)
    estimated_tax = Column(Integer, default=0, nullable=False)
    estimated_shipping = Column(Integer, default=0, nullable=False)
    estimated_total = Column(Integer, default=0, nullable=False)
    
    # Status
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Dates
    last_updated = Column(String(50), nullable=True)
    
    # Relationships
    items = relationship("CartItem", back_populates="cart", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        return f"<Cart(id={self.id}, company_id={self.company_id})>"


class CartItem(Base):
    """
    Individual items in shopping cart
    """
    __tablename__ = "cart_items"
    
    id = Column(Integer, primary_key=True, index=True)
    cart_id = Column(Integer, ForeignKey("carts.id"), nullable=False)
    cart = relationship("Cart", back_populates="items")
    
    product_id = Column(Integer, ForeignKey("chairs.id"), nullable=False)
    product = relationship("Chair", back_populates="cart_items")
    
    # Quantity
    quantity = Column(Integer, nullable=False, default=1)
    
    # Customization Options
    selected_finish_id = Column(Integer, ForeignKey("finishes.id"), nullable=True)
    selected_upholstery_id = Column(Integer, ForeignKey("upholsteries.id"), nullable=True)
    
    # Custom options (stored as JSON)
    custom_options = Column(JSON, nullable=True)
    
    # Pricing (cached)
    unit_price = Column(Integer, nullable=False)
    customization_cost = Column(Integer, default=0, nullable=False)
    line_total = Column(Integer, nullable=False)
    
    # Notes
    item_notes = Column(Text, nullable=True)
    
    # Dates
    added_at = Column(String(50), nullable=True)
    updated_at = Column(String(50), nullable=True)
    
    def __repr__(self) -> str:
        return f"<CartItem(id={self.id}, product_id={self.product_id}, qty={self.quantity})>"


class SavedConfiguration(Base):
    """
    Saved product configurations for later
    Allows companies to save customized products
    """
    __tablename__ = "saved_configurations"
    
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("chairs.id"), nullable=False)
    
    # Configuration details
    configuration_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Options (stored as JSON)
    configuration_data = Column(JSON, nullable=False)
    
    # Pricing
    estimated_price = Column(Integer, nullable=False)
    
    # Display
    is_favorite = Column(Boolean, default=False, nullable=False)
    
    def __repr__(self) -> str:
        return f"<SavedConfiguration(id={self.id}, name={self.configuration_name})>"


class QuoteAttachment(Base):
    """
    File attachments for quotes (images, documents, etc.)
    """
    __tablename__ = "quote_attachments"
    
    id = Column(Integer, primary_key=True, index=True)
    quote_id = Column(Integer, ForeignKey("quotes.id"), nullable=False)
    quote = relationship("Quote", back_populates="attachments")
    
    # File information
    file_name = Column(String(255), nullable=False)
    file_url = Column(String(500), nullable=False)
    file_type = Column(String(50), nullable=False)  # image/jpeg, application/pdf, etc.
    file_size_bytes = Column(Integer, nullable=False)
    
    # Description
    description = Column(Text, nullable=True)
    attachment_type = Column(String(50), default="general", nullable=False)  # general, reference_image, floor_plan, specification, etc.
    
    # Metadata
    uploaded_by = Column(String(100), nullable=True)  # company or admin
    uploaded_at = Column(String(50), nullable=False)
    
    def __repr__(self) -> str:
        return f"<QuoteAttachment(id={self.id}, file={self.file_name})>"


class QuoteHistory(Base):
    """
    Audit trail for quote status changes and updates
    """
    __tablename__ = "quote_history"
    
    id = Column(Integer, primary_key=True, index=True)
    quote_id = Column(Integer, ForeignKey("quotes.id"), nullable=False)
    quote = relationship("Quote", back_populates="history")
    
    # Change information
    action = Column(String(100), nullable=False)  # created, updated, status_changed, etc.
    old_value = Column(Text, nullable=True)  # JSON string of old values
    new_value = Column(Text, nullable=True)  # JSON string of new values
    
    # Status changes
    old_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=True)
    
    # Who made the change
    changed_by_type = Column(String(20), nullable=False)  # company, admin, system
    changed_by_id = Column(Integer, nullable=True)
    changed_by_name = Column(String(255), nullable=True)
    
    # Details
    notes = Column(Text, nullable=True)
    ip_address = Column(String(50), nullable=True)
    
    # Timestamp
    changed_at = Column(String(50), nullable=False)
    
    def __repr__(self) -> str:
        return f"<QuoteHistory(id={self.id}, action={self.action})>"

