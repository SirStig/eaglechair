"""
EagleChair Product Models

Comprehensive models for chairs, booths, tables with categories, finishes, materials, etc.
"""

from sqlalchemy import Column, Integer, String, Float, Text, Boolean, JSON, ForeignKey
from sqlalchemy.orm import relationship

from backend.database.base import Base


class Category(Base):
    """
    Product categories (e.g., Chairs, Booths, Tables, Bar Stools)
    """
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    slug = Column(String(255), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    
    # Hierarchy support
    parent_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    parent = relationship("Category", remote_side=[id], backref="subcategories")
    
    # Display
    display_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    icon_url = Column(String(500), nullable=True)
    banner_image_url = Column(String(500), nullable=True)
    
    # SEO
    meta_title = Column(String(255), nullable=True)
    meta_description = Column(Text, nullable=True)
    
    # Relationships
    products = relationship("Chair", back_populates="category")
    
    def __repr__(self) -> str:
        return f"<Category(id={self.id}, name={self.name})>"


class Finish(Base):
    """
    Available finishes for products (wood stains, paint colors, etc.)
    """
    __tablename__ = "finishes"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    finish_code = Column(String(50), nullable=True, unique=True)
    description = Column(Text, nullable=True)
    finish_type = Column(String(50), nullable=True)  # e.g., "Wood Stain", "Paint", "Metal"
    color_hex = Column(String(7), nullable=True)  # Hex color representation
    image_url = Column(String(500), nullable=True)
    is_custom = Column(Boolean, default=False, nullable=False)
    is_to_match = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    additional_cost = Column(Integer, default=0, nullable=False)  # In cents
    display_order = Column(Integer, default=0, nullable=False)
    
    def __repr__(self) -> str:
        return f"<Finish(id={self.id}, name={self.name}, code={self.finish_code})>"


class Upholstery(Base):
    """
    Upholstery materials and fabrics
    """
    __tablename__ = "upholsteries"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    material_code = Column(String(50), nullable=True, unique=True)
    material_type = Column(String(50), nullable=False)  # e.g., "Vinyl", "Fabric", "Leather"
    description = Column(Text, nullable=True)
    color = Column(String(50), nullable=True)
    color_hex = Column(String(7), nullable=True)
    pattern = Column(String(100), nullable=True)
    grade = Column(String(20), nullable=True)  # e.g., "Grade A", "Grade B", "Premium"
    image_url = Column(String(500), nullable=True)
    swatch_image_url = Column(String(500), nullable=True)
    
    # COM/COL (Customer's Own Material/Customer's Own Leather)
    is_com = Column(Boolean, default=False, nullable=False)
    com_requirements = Column(Text, nullable=True)  # Yardage requirements
    
    # Specifications
    durability_rating = Column(String(50), nullable=True)
    flame_rating = Column(String(50), nullable=True)
    cleanability = Column(String(50), nullable=True)
    
    is_active = Column(Boolean, default=True, nullable=False)
    additional_cost = Column(Integer, default=0, nullable=False)  # In cents
    display_order = Column(Integer, default=0, nullable=False)
    
    def __repr__(self) -> str:
        return f"<Upholstery(id={self.id}, name={self.name}, type={self.material_type})>"


class Chair(Base):
    """
    Main product model for chairs, booths, tables, bar stools
    Comprehensive product information
    """
    __tablename__ = "chairs"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Basic Information
    model_number = Column(String(100), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False, index=True)
    slug = Column(String(255), unique=True, index=True, nullable=False)
    short_description = Column(Text, nullable=True)
    full_description = Column(Text, nullable=True)
    
    # Category
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    category = relationship("Category", back_populates="products")
    
    # Pricing
    base_price = Column(Integer, nullable=False)  # In cents
    msrp = Column(Integer, nullable=True)  # Manufacturer's suggested retail price
    
    # Dimensions (all in inches)
    width = Column(Float, nullable=True)
    depth = Column(Float, nullable=True)
    height = Column(Float, nullable=True)
    seat_width = Column(Float, nullable=True)
    seat_depth = Column(Float, nullable=True)
    seat_height = Column(Float, nullable=True)
    arm_height = Column(Float, nullable=True)
    back_height = Column(Float, nullable=True)
    
    # Additional dimensions stored as JSON for flexibility
    # e.g., {"table_diameter": 36, "booth_length": 48}
    additional_dimensions = Column(JSON, nullable=True)
    
    # Weight
    weight = Column(Float, nullable=True)  # In pounds
    shipping_weight = Column(Float, nullable=True)
    
    # Materials & Construction
    frame_material = Column(String(100), nullable=True)  # e.g., "Solid Wood", "Metal"
    construction_details = Column(Text, nullable=True)
    
    # Features (stored as JSON array)
    # e.g., ["Stackable", "Ganging", "Swivel", "Arms"]
    features = Column(JSON, nullable=True)
    
    # Available Options
    available_finishes = Column(JSON, nullable=True)  # Array of finish IDs
    available_upholsteries = Column(JSON, nullable=True)  # Array of upholstery IDs
    
    # Images (stored as JSON array of URLs)
    images = Column(JSON, nullable=False)
    primary_image = Column(String(500), nullable=True)
    thumbnail = Column(String(500), nullable=True)
    
    # Additional media
    dimensional_drawing_url = Column(String(500), nullable=True)
    cad_file_url = Column(String(500), nullable=True)
    spec_sheet_url = Column(String(500), nullable=True)
    
    # Inventory & Availability
    stock_status = Column(String(50), default="In Stock", nullable=False)
    lead_time_days = Column(Integer, nullable=True)
    minimum_order_quantity = Column(Integer, default=1, nullable=False)
    
    # Certifications & Standards
    flame_certifications = Column(JSON, nullable=True)  # e.g., ["CAL 117", "UFAC Class 1"]
    green_certifications = Column(JSON, nullable=True)  # e.g., ["FSC", "GREENGUARD"]
    ada_compliant = Column(Boolean, default=False, nullable=False)
    
    # Usage & Application
    recommended_use = Column(String(255), nullable=True)  # e.g., "Restaurant", "Healthcare"
    is_outdoor_suitable = Column(Boolean, default=False, nullable=False)  # Patio/outdoor furniture
    warranty_info = Column(Text, nullable=True)
    care_instructions = Column(Text, nullable=True)
    
    # SEO & Marketing
    meta_title = Column(String(255), nullable=True)
    meta_description = Column(Text, nullable=True)
    keywords = Column(JSON, nullable=True)  # Array of keywords
    
    # Product Status
    is_active = Column(Boolean, default=True, nullable=False)
    is_featured = Column(Boolean, default=False, nullable=False)
    is_new = Column(Boolean, default=False, nullable=False)
    is_custom_only = Column(Boolean, default=False, nullable=False)
    
    # Analytics
    view_count = Column(Integer, default=0, nullable=False)
    quote_count = Column(Integer, default=0, nullable=False)
    
    # Display Order
    display_order = Column(Integer, default=0, nullable=False)
    
    # Relationships
    cart_items = relationship("CartItem", back_populates="product")
    quote_items = relationship("QuoteItem", back_populates="product")
    
    def __repr__(self) -> str:
        return f"<Chair(id={self.id}, model={self.model_number}, name={self.name})>"


class ProductRelation(Base):
    """
    Related products (for cross-selling)
    """
    __tablename__ = "product_relations"
    
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("chairs.id"), nullable=False)
    related_product_id = Column(Integer, ForeignKey("chairs.id"), nullable=False)
    relation_type = Column(String(50), default="related", nullable=False)  # e.g., "related", "alternative", "accessory"
    display_order = Column(Integer, default=0, nullable=False)
    
    def __repr__(self) -> str:
        return f"<ProductRelation(product_id={self.product_id}, related_id={self.related_product_id})>"

