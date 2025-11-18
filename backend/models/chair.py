"""
EagleChair Product Models

Comprehensive models for chairs, booths, tables with categories, finishes, materials, etc.
"""

from sqlalchemy import JSON, Boolean, Column, Float, ForeignKey, Integer, String, Text
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
        try:
            # Safely access attributes, checking if they're loaded
            cat_id = getattr(self, 'id', '<unknown>')
            name = getattr(self, 'name', '<unknown>')
            return f"<Category(id={cat_id}, name={name})>"
        except:
            # Fallback if anything goes wrong
            return f"<Category at {hex(id(self))}>"


class ProductSubcategory(Base):
    """
    Product subcategories within main categories
    Examples: Wood, Metal, Upholstered (for Chairs); Indoor, Outdoor (for Tables)
    """
    __tablename__ = "product_subcategories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    slug = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    
    # Category relationship
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=False)
    category = relationship("Category", backref="product_subcategories")
    
    # Display
    display_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    def __repr__(self) -> str:
        try:
            # Safely access attributes, checking if they're loaded
            subcat_id = getattr(self, 'id', '<unknown>')
            name = getattr(self, 'name', '<unknown>')
            cat_id = getattr(self, 'category_id', '<unknown>')
            return f"<ProductSubcategory(id={subcat_id}, name={name}, category_id={cat_id})>"
        except:
            # Fallback if anything goes wrong
            return f"<ProductSubcategory at {hex(id(self))}>"


class ProductFamily(Base):
    """
    Product families for grouping related products
    Examples: Alpine Family, Café Tesla Family, Andy Family, Argento Family
    """
    __tablename__ = "product_families"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    slug = Column(String(255), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    
    # Category associations
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    category = relationship("Category", backref="families")
    
    subcategory_id = Column(Integer, ForeignKey("product_subcategories.id", ondelete="SET NULL"), nullable=True)
    subcategory = relationship("ProductSubcategory", backref="families")
    
    # Display
    family_image = Column(String(500), nullable=True)
    banner_image_url = Column(String(500), nullable=True)
    overview_text = Column(Text, nullable=True)
    display_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_featured = Column(Boolean, default=False, nullable=False)
    
    def __repr__(self) -> str:
        try:
            fam_id = getattr(self, 'id', '<unknown>')
            name = getattr(self, 'name', '<unknown>')
            return f"<ProductFamily(id={fam_id}, name={name})>"
        except:
            return f"<ProductFamily at {hex(id(self))}>"


class Finish(Base):
    """
    Available finishes for products (wood stains, paint colors, etc.)
    """
    __tablename__ = "finishes"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    finish_code = Column(String(50), nullable=True, unique=True)
    description = Column(Text, nullable=True)
    finish_type = Column(String(50), nullable=True)  # e.g., "Wood Stain", "Paint", "Metal", "Powder Coat"
    
    # Color reference (NEW - references Color table)
    color_id = Column(Integer, ForeignKey("colors.id", ondelete="SET NULL"), nullable=True)
    color = relationship("Color", backref="finishes")
    
    # Display (keep color_hex for backwards compatibility)
    color_hex = Column(String(7), nullable=True)  # Hex color representation
    image_url = Column(String(500), nullable=True)  # Finish sample image
    
    # Flags
    is_custom = Column(Boolean, default=False, nullable=False)
    is_to_match = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Pricing
    additional_cost = Column(Integer, default=0, nullable=False)  # In cents
    
    # Display
    display_order = Column(Integer, default=0, nullable=False)
    
    def __repr__(self) -> str:
        try:
            fin_id = getattr(self, 'id', '<unknown>')
            name = getattr(self, 'name', '<unknown>')
            code = getattr(self, 'finish_code', '<unknown>')
            return f"<Finish(id={fin_id}, name={name}, code={code})>"
        except:
            return f"<Finish at {hex(id(self))}>"


class Upholstery(Base):
    """
    Upholstery materials and fabrics with grade system
    """
    __tablename__ = "upholsteries"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    material_code = Column(String(50), nullable=True, unique=True)
    material_type = Column(String(50), nullable=False)  # e.g., "Vinyl", "Fabric", "Leather"
    description = Column(Text, nullable=True)
    
    # Grade System
    grade = Column(String(20), nullable=True)  # e.g., "A", "B", "C", "Premium", "Luxury"
    
    # Color reference (NEW - references Color table)
    color_id = Column(Integer, ForeignKey("colors.id", ondelete="SET NULL"), nullable=True)
    color_relationship = relationship("Color", backref="upholsteries")
    
    # Pattern/Texture
    pattern = Column(String(100), nullable=True)
    texture_description = Column(Text, nullable=True)
    
    # Seat-only option (NEW - for "P" suffix products)
    is_seat_option_only = Column(Boolean, default=False, nullable=False)
    
    # Display (keep for backwards compatibility)
    color = Column(String(50), nullable=True)
    color_hex = Column(String(7), nullable=True)
    image_url = Column(String(500), nullable=True)
    swatch_image_url = Column(String(500), nullable=True)
    
    # COM/COL (Customer's Own Material/Customer's Own Leather)
    is_com = Column(Boolean, default=False, nullable=False)
    com_requirements = Column(Text, nullable=True)  # Yardage requirements
    
    # Specifications
    durability_rating = Column(String(50), nullable=True)
    flame_rating = Column(String(50), nullable=True)
    cleanability = Column(String(50), nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Pricing (grade-based - NEW)
    additional_cost = Column(Integer, default=0, nullable=False)  # In cents, base grade
    grade_a_cost = Column(Integer, default=0, nullable=False)
    grade_b_cost = Column(Integer, default=0, nullable=False)
    grade_c_cost = Column(Integer, default=0, nullable=False)
    premium_cost = Column(Integer, default=0, nullable=False)
    
    # Display
    display_order = Column(Integer, default=0, nullable=False)
    
    def __repr__(self) -> str:
        try:
            uph_id = getattr(self, 'id', '<unknown>')
            name = getattr(self, 'name', '<unknown>')
            mat_type = getattr(self, 'material_type', '<unknown>')
            grade = getattr(self, 'grade', '<unknown>')
            return f"<Upholstery(id={uph_id}, name={name}, type={mat_type}, grade={grade})>"
        except:
            return f"<Upholstery at {hex(id(self))}>"


class Chair(Base):
    """
    Main product model for chairs, booths, tables, bar stools
    Comprehensive product information
    """
    __tablename__ = "chairs"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Basic Information
    model_number = Column(String(100), index=True, nullable=False)  # e.g., "6246"
    model_suffix = Column(String(50), nullable=True, index=True)  # e.g., "WB.P", "P", "W", "PF", "PB"
    suffix_description = Column(String(255), nullable=True)  # What the suffix means
    name = Column(String(255), nullable=False, index=True)
    slug = Column(String(255), unique=True, index=True, nullable=False)
    short_description = Column(Text, nullable=True)
    full_description = Column(Text, nullable=True)
    
    # Category & Family Relationships
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False)
    category = relationship("Category", back_populates="products")
    
    subcategory_id = Column(Integer, ForeignKey("product_subcategories.id", ondelete="SET NULL"), nullable=True)
    subcategory = relationship("ProductSubcategory", backref="products")
    
    family_id = Column(Integer, ForeignKey("product_families.id", ondelete="SET NULL"), nullable=True)
    family = relationship("ProductFamily", backref="products")
    
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
    available_colors = Column(JSON, nullable=True)  # Array of color IDs (NEW)
    
    # Images (stored as JSON array with enhanced structure)
    # Structure: [{"url": "...", "type": "side|front|gallery", "order": 1, "alt": "..."}, ...]
    images = Column(JSON, nullable=False, default='[]')
    primary_image_url = Column(String(500), nullable=True)  # Side view (main catalog image)
    hover_image_url = Column(String(500), nullable=True)  # Front view (hover state)
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
        try:
            # Safely access attributes, checking if they're loaded
            chair_id = getattr(self, 'id', '<unknown>')
            model = getattr(self, 'model_number', '<unknown>')
            name = getattr(self, 'name', '<unknown>')
            return f"<Chair(id={chair_id}, model={model}, name={name})>"
        except:
            # Fallback if anything goes wrong
            return f"<Chair at {hex(id(self))}>"


class ProductRelation(Base):
    """
    Related products (for cross-selling)
    """
    __tablename__ = "product_relations"
    
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("chairs.id", ondelete="CASCADE"), nullable=False)
    related_product_id = Column(Integer, ForeignKey("chairs.id", ondelete="CASCADE"), nullable=False)
    relation_type = Column(String(50), default="related", nullable=False)  # e.g., "related", "alternative", "accessory"
    display_order = Column(Integer, default=0, nullable=False)
    
    def __repr__(self) -> str:
        try:
            prod_id = getattr(self, 'product_id', '<unknown>')
            rel_id = getattr(self, 'related_product_id', '<unknown>')
            return f"<ProductRelation(product_id={prod_id}, related_id={rel_id})>"
        except:
            return f"<ProductRelation at {hex(id(self))}>"


class Color(Base):
    """
    Standalone color management
    Used by both Finishes and Upholsteries
    """
    __tablename__ = "colors"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)  # e.g., "Walnut Brown", "Black", "Charcoal Gray"
    color_code = Column(String(50), unique=True, nullable=True)  # e.g., "WB-001", "BLK", "CG-100"
    hex_value = Column(String(7), nullable=True)  # e.g., "#A0522D"
    
    # Category (wood/metal/fabric/paint)
    category = Column(String(50), nullable=True)
    
    # Display
    image_url = Column(String(500), nullable=True)  # Color swatch image
    display_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    def __repr__(self) -> str:
        try:
            col_id = getattr(self, 'id', '<unknown>')
            name = getattr(self, 'name', '<unknown>')
            code = getattr(self, 'color_code', '<unknown>')
            return f"<Color(id={col_id}, name={name}, code={code})>"
        except:
            return f"<Color at {hex(id(self))}>"


class ProductVariation(Base):
    """
    Specific combinations of finish, upholstery, and color for a product
    Example: "Alpine Chair #6246 in Walnut finish with Grade A Black Vinyl"
    """
    __tablename__ = "product_variations"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Product relationship
    product_id = Column(Integer, ForeignKey("chairs.id", ondelete="CASCADE"), nullable=False)
    product = relationship("Chair", backref="variations")
    
    # SKU (unique identifier for this variation)
    sku = Column(String(100), unique=True, nullable=False, index=True)
    
    # Variation components
    finish_id = Column(Integer, ForeignKey("finishes.id", ondelete="SET NULL"), nullable=True)
    finish = relationship("Finish", backref="variations")
    
    upholstery_id = Column(Integer, ForeignKey("upholsteries.id", ondelete="SET NULL"), nullable=True)
    upholstery = relationship("Upholstery", backref="variations")
    
    color_id = Column(Integer, ForeignKey("colors.id", ondelete="SET NULL"), nullable=True)
    color = relationship("Color", backref="variations")
    
    # Pricing
    price_adjustment = Column(Integer, default=0, nullable=False)  # In cents (+/-)
    
    # Images specific to this variation
    # JSON array: [{"url": "...", "type": "side|front|gallery", "order": 1}, ...]
    images = Column(JSON, nullable=True, default='[]')
    primary_image_url = Column(String(500), nullable=True)
    
    # Inventory
    stock_status = Column(String(50), default="Available", nullable=False)
    is_available = Column(Boolean, default=True, nullable=False)
    lead_time_days = Column(Integer, nullable=True)
    
    # Display
    display_order = Column(Integer, default=0, nullable=False)
    
    def __repr__(self) -> str:
        try:
            var_id = getattr(self, 'id', '<unknown>')
            sku = getattr(self, 'sku', '<unknown>')
            prod_id = getattr(self, 'product_id', '<unknown>')
            return f"<ProductVariation(id={var_id}, sku={sku}, product_id={prod_id})>"
        except:
            return f"<ProductVariation at {hex(id(self))}>"


class ProductImage(Base):
    """
    Standalone product image records for admin management
    This complements the Chair.images JSON for granular CRUD in admin APIs
    """
    __tablename__ = "product_images"

    id = Column(Integer, primary_key=True, index=True)

    # Relationships
    product_id = Column(Integer, ForeignKey("chairs.id", ondelete="CASCADE"), nullable=False)
    product = relationship("Chair", backref="image_records")

    variation_id = Column(Integer, ForeignKey("product_variations.id", ondelete="SET NULL"), nullable=True)
    # Use a distinct backref name to avoid clashing with ProductVariation.images JSON column
    variation = relationship("ProductVariation", backref="variation_images")

    # Image data
    image_url = Column(String(500), nullable=False)
    image_type = Column(String(50), nullable=False, default="gallery")  # primary|hover|gallery|side|front|back|detail
    alt_text = Column(String(255), nullable=True)
    display_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)

    def __repr__(self) -> str:
        try:
            img_id = getattr(self, 'id', '<unknown>')
            prod_id = getattr(self, 'product_id', '<unknown>')
            img_type = getattr(self, 'image_type', '<unknown>')
            return f"<ProductImage(id={img_id}, product_id={prod_id}, type={img_type})>"
        except:
            return f"<ProductImage at {hex(id(self))}>"


class CustomOption(Base):
    """
    Custom options/add-ons for products
    Examples: Back handles, special glides, custom dimensions
    """
    __tablename__ = "custom_options"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    option_code = Column(String(50), unique=True, nullable=True)
    description = Column(Text, nullable=True)
    
    # Option type
    option_type = Column(String(100), nullable=False)  # "back_handle", "special_glide", "custom_dimension", etc.
    
    # Applicability (which categories can use this option)
    applicable_categories = Column(JSON, nullable=True)  # Array of category IDs
    
    # Pricing
    price_adjustment = Column(Integer, default=0, nullable=False)  # In cents
    requires_quote = Column(Boolean, default=False, nullable=False)  # Some options need manual quoting
    
    # Admin
    admin_notes = Column(Text, nullable=True)
    
    # Display
    is_active = Column(Boolean, default=True, nullable=False)
    display_order = Column(Integer, default=0, nullable=False)
    
    def __repr__(self) -> str:
        try:
            opt_id = getattr(self, 'id', '<unknown>')
            name = getattr(self, 'name', '<unknown>')
            opt_type = getattr(self, 'option_type', '<unknown>')
            return f"<CustomOption(id={opt_id}, name={name}, type={opt_type})>"
        except:
            return f"<CustomOption at {hex(id(self))}>"


class ProductTag(Base):
    """
    Flexible tagging system for products
    Examples: "Stackable", "Ganging", "Swivel", "Commercial Grade", "Healthcare"
    """
    __tablename__ = "product_tags"
    
    id = Column(Integer, primary_key=True, index=True)
    tag_name = Column(String(100), nullable=False, index=True)
    tag_type = Column(String(50), nullable=True)  # "feature", "material", "style", "use_case"
    description = Column(Text, nullable=True)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    
    # Display
    is_active = Column(Boolean, default=True, nullable=False)
    
    def __repr__(self) -> str:
        try:
            tag_id = getattr(self, 'id', '<unknown>')
            name = getattr(self, 'tag_name', '<unknown>')
            tag_type = getattr(self, 'tag_type', '<unknown>')
            return f"<ProductTag(id={tag_id}, name={name}, type={tag_type})>"
        except:
            return f"<ProductTag at {hex(id(self))}>"


# Many-to-many association table for Product and ProductTag
class ProductTagAssociation(Base):
    """
    Association table for Product and ProductTag many-to-many relationship
    """
    __tablename__ = "product_tag_associations"
    
    product_id = Column(Integer, ForeignKey("chairs.id", ondelete="CASCADE"), primary_key=True)
    tag_id = Column(Integer, ForeignKey("product_tags.id", ondelete="CASCADE"), primary_key=True)
    
    def __repr__(self) -> str:
        try:
            prod_id = getattr(self, 'product_id', '<unknown>')
            tag_id = getattr(self, 'tag_id', '<unknown>')
            return f"<ProductTagAssociation(product_id={prod_id}, tag_id={tag_id})>"
        except:
            return f"<ProductTagAssociation at {hex(id(self))}>"

