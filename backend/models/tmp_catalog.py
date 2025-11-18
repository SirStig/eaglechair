"""
Temporary Catalog Models
Mirror production models (chair.py) with additional tmp-specific fields
Used for staging parsed catalog data before import to production
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from backend.database.base import Base


class TmpProductFamily(Base):
    """
    Temporary product families extracted from catalogs
    """
    __tablename__ = "tmp_product_families"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Production fields (from ProductFamily)
    name = Column(String(255), nullable=False, default="Unknown", index=True)
    slug = Column(String(255), index=True, nullable=True)
    description = Column(Text, nullable=True)
    
    # Category associations (optional - can be assigned in review)
    category_id = Column(Integer, nullable=True)
    subcategory_id = Column(Integer, nullable=True)
    
    # Display
    family_image = Column(String(500), nullable=True)
    banner_image_url = Column(String(500), nullable=True)
    overview_text = Column(Text, nullable=True)
    display_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_featured = Column(Boolean, default=False, nullable=False)
    
    # Family-level information (from catalog)
    features = Column(JSON, nullable=True)  # Array of feature strings
    wood_species = Column(JSON, nullable=True)  # Array of wood species
    standard_info = Column(JSON, nullable=True)  # Standard options
    options = Column(JSON, nullable=True)  # Available options
    environmental_info = Column(JSON, nullable=True)  # Environmental/sustainability info
    finish_info = Column(Text, nullable=True)
    
    # Tmp-specific metadata
    upload_id = Column(String(100), nullable=False, index=True)
    source_page = Column(Integer, nullable=True)
    extraction_confidence = Column(Integer, default=50, nullable=False)
    requires_review = Column(Boolean, default=True, nullable=False)
    import_status = Column(String(20), default='pending', nullable=False)  # pending, approved, imported, skipped
    parsed_data = Column(JSON, nullable=True)  # Raw extracted data for reference
    extraction_notes = Column(JSON, nullable=True)  # Array of notes/warnings
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=True)  # Auto-delete after this time (24-48 hours)
    
    # Relationships
    products = relationship("TmpChair", back_populates="family")
    
    def __repr__(self) -> str:
        return f"<TmpProductFamily(id={self.id}, name={self.name}, upload_id={self.upload_id})>"


class TmpChair(Base):
    """
    Temporary product model matching Chair schema
    """
    __tablename__ = "tmp_chairs"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Basic Information (from Chair)
    model_number = Column(String(100), index=True, nullable=False)
    model_suffix = Column(String(50), nullable=True, index=True)
    suffix_description = Column(String(255), nullable=True)
    name = Column(String(255), nullable=False, default="Unknown", index=True)
    slug = Column(String(255), index=True, nullable=True)
    short_description = Column(Text, nullable=True)
    full_description = Column(Text, nullable=True)
    
    # Category & Family Relationships
    category_id = Column(Integer, nullable=True)  # Can be null, assigned in review
    subcategory_id = Column(Integer, nullable=True)
    
    family_id = Column(Integer, ForeignKey("tmp_product_families.id", ondelete="CASCADE"), nullable=True)
    family = relationship("TmpProductFamily", back_populates="products")
    
    # Pricing (defaults)
    base_price = Column(Integer, nullable=False, default=0)  # In cents
    msrp = Column(Integer, nullable=True)
    
    # Dimensions (from PDF parsing)
    width = Column(Float, nullable=True)
    depth = Column(Float, nullable=True)
    height = Column(Float, nullable=True)
    seat_width = Column(Float, nullable=True)
    seat_depth = Column(Float, nullable=True)
    seat_height = Column(Float, nullable=True)
    arm_height = Column(Float, nullable=True)
    back_height = Column(Float, nullable=True)
    additional_dimensions = Column(JSON, nullable=True)
    
    # Weight & Volume
    weight = Column(Float, nullable=True)  # In pounds
    shipping_weight = Column(Float, nullable=True)
    volume = Column(Float, nullable=True)  # Cubic feet
    yardage = Column(Float, nullable=True)  # Upholstery yardage
    
    # Materials & Construction
    frame_material = Column(String(100), nullable=True, default="Unknown")
    construction_details = Column(Text, nullable=True)
    
    # Features (from family or product-specific)
    features = Column(JSON, nullable=True)  # Array of features
    
    # Available Options
    available_finishes = Column(JSON, nullable=True)
    available_upholsteries = Column(JSON, nullable=True)
    available_colors = Column(JSON, nullable=True)
    
    # Images
    images = Column(JSON, nullable=False, default='[]')
    primary_image_url = Column(String(500), nullable=True)
    hover_image_url = Column(String(500), nullable=True)
    thumbnail = Column(String(500), nullable=True)
    
    # Additional media
    dimensional_drawing_url = Column(String(500), nullable=True)
    cad_file_url = Column(String(500), nullable=True)
    spec_sheet_url = Column(String(500), nullable=True)
    
    # Inventory & Availability
    stock_status = Column(String(50), default="Unknown", nullable=False)
    lead_time_days = Column(Integer, nullable=True)
    minimum_order_quantity = Column(Integer, default=1, nullable=False)
    
    # Certifications & Standards
    flame_certifications = Column(JSON, nullable=True)
    green_certifications = Column(JSON, nullable=True)
    ada_compliant = Column(Boolean, default=False, nullable=False)
    
    # Usage & Application
    recommended_use = Column(String(255), nullable=True)
    is_outdoor_suitable = Column(Boolean, default=False, nullable=False)
    warranty_info = Column(Text, nullable=True)
    care_instructions = Column(Text, nullable=True)
    
    # SEO & Marketing
    meta_title = Column(String(255), nullable=True)
    meta_description = Column(Text, nullable=True)
    keywords = Column(JSON, nullable=True)
    
    # Product Status
    is_active = Column(Boolean, default=True, nullable=False)
    is_featured = Column(Boolean, default=False, nullable=False)
    is_new = Column(Boolean, default=False, nullable=False)
    is_custom_only = Column(Boolean, default=False, nullable=False)
    
    # Display Order
    display_order = Column(Integer, default=0, nullable=False)
    
    # Tmp-specific metadata
    upload_id = Column(String(100), nullable=False, index=True)
    source_page = Column(Integer, nullable=True)
    extraction_confidence = Column(Integer, default=50, nullable=False)
    requires_review = Column(Boolean, default=True, nullable=False)
    import_status = Column(String(20), default='pending', nullable=False)
    parsed_data = Column(JSON, nullable=True)  # Raw extracted data
    extraction_notes = Column(JSON, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=True)
    
    # Relationships
    variations = relationship("TmpProductVariation", back_populates="product", cascade="all, delete-orphan")
    image_records = relationship("TmpProductImage", back_populates="product", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        return f"<TmpChair(id={self.id}, model={self.model_number}, name={self.name}, upload_id={self.upload_id})>"


class TmpProductVariation(Base):
    """
    Temporary product variations (different suffixes of same model)
    """
    __tablename__ = "tmp_product_variations"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Product relationship
    product_id = Column(Integer, ForeignKey("tmp_chairs.id", ondelete="CASCADE"), nullable=False)
    product = relationship("TmpChair", back_populates="variations")
    
    # SKU (unique identifier for this variation)
    sku = Column(String(100), index=True, nullable=False)
    
    # Variation components
    finish_id = Column(Integer, nullable=True)  # Reference to production Finish (if matched)
    upholstery_id = Column(Integer, nullable=True)
    color_id = Column(Integer, nullable=True)
    
    # Variation details
    suffix = Column(String(50), nullable=True)  # e.g., V, P, W, PB, P3N
    suffix_description = Column(String(255), nullable=True)  # What the suffix means
    
    # Pricing
    price_adjustment = Column(Integer, default=0, nullable=False)  # In cents
    
    # Images specific to this variation
    images = Column(JSON, nullable=True, default='[]')
    primary_image_url = Column(String(500), nullable=True)
    
    # Inventory
    stock_status = Column(String(50), default="Unknown", nullable=False)
    is_available = Column(Boolean, default=True, nullable=False)
    lead_time_days = Column(Integer, nullable=True)
    
    # Display
    display_order = Column(Integer, default=0, nullable=False)
    
    # Tmp-specific metadata
    upload_id = Column(String(100), nullable=False, index=True)
    extraction_confidence = Column(Integer, default=50, nullable=False)
    import_status = Column(String(20), default='pending', nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=True)
    
    def __repr__(self) -> str:
        return f"<TmpProductVariation(id={self.id}, sku={self.sku}, suffix={self.suffix})>"


class TmpProductImage(Base):
    """
    Temporary product image records
    """
    __tablename__ = "tmp_product_images"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Relationships
    product_id = Column(Integer, ForeignKey("tmp_chairs.id", ondelete="CASCADE"), nullable=False)
    product = relationship("TmpChair", back_populates="image_records")
    
    variation_id = Column(Integer, ForeignKey("tmp_product_variations.id", ondelete="SET NULL"), nullable=True)
    variation = relationship("TmpProductVariation", backref="variation_images")
    
    # Image data
    image_url = Column(String(500), nullable=False)
    image_type = Column(String(50), nullable=False, default="product")  # product, family_name, gallery
    image_classification = Column(String(50), nullable=True)  # Classification from parser
    alt_text = Column(String(255), nullable=True)
    display_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    
    # Image metadata
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    file_size = Column(Integer, nullable=True)  # In bytes
    format = Column(String(10), nullable=True)  # png, jpg, etc.
    
    # Tmp-specific metadata
    upload_id = Column(String(100), nullable=False, index=True)
    source_page = Column(Integer, nullable=True)
    original_filename = Column(String(255), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=True)
    
    def __repr__(self) -> str:
        return f"<TmpProductImage(id={self.id}, product_id={self.product_id}, type={self.image_type})>"


class CatalogUpload(Base):
    """
    Track catalog upload sessions
    """
    __tablename__ = "catalog_uploads"
    
    id = Column(Integer, primary_key=True, index=True)
    upload_id = Column(String(100), unique=True, nullable=False, index=True, default=lambda: str(uuid.uuid4()))
    
    # File information
    filename = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=False)  # In bytes
    file_path = Column(String(500), nullable=True)  # Path to uploaded PDF (set after upload)
    
    # Processing status
    status = Column(String(50), default='uploaded', nullable=False)  # uploaded, parsing, completed, failed
    progress_percentage = Column(Integer, default=0, nullable=False)
    current_step = Column(String(100), nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Results
    total_pages = Column(Integer, nullable=True)
    pages_processed = Column(Integer, default=0, nullable=False)
    families_found = Column(Integer, default=0, nullable=False)
    products_found = Column(Integer, default=0, nullable=False)
    variations_found = Column(Integer, default=0, nullable=False)
    images_extracted = Column(Integer, default=0, nullable=False)
    
    # Metadata
    uploaded_by = Column(String(100), nullable=True)  # User ID or email
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)  # Auto-delete after 48 hours
    
    def __repr__(self) -> str:
        return f"<CatalogUpload(id={self.id}, upload_id={self.upload_id}, status={self.status})>"
