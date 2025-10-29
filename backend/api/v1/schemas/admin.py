"""
Admin Schemas

Pydantic schemas for admin operations
"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from backend.models.company import CompanyStatus
from backend.models.quote import QuoteStatus

# ============================================================================
# Dashboard Schemas
# ============================================================================

class DashboardStatsResponse(BaseModel):
    """Dashboard statistics response"""
    
    companies: Dict[str, int] = Field(..., description="Company statistics")
    products: Dict[str, int] = Field(..., description="Product statistics")
    quotes: Dict[str, int] = Field(..., description="Quote statistics")
    recent_quotes: List[Dict[str, Any]] = Field(..., description="Recent quotes")
    recent_companies: List[Dict[str, Any]] = Field(..., description="Recent companies")


# ============================================================================
# Company Management Schemas
# ============================================================================

class CompanyStatusUpdate(BaseModel):
    """Update company status request"""
    
    status: CompanyStatus = Field(..., description="New company status")
    admin_notes: Optional[str] = Field(None, description="Admin notes")


class CompanyListResponse(BaseModel):
    """Company list response"""
    
    items: List[Dict[str, Any]] = Field(..., description="List of companies")
    total: int = Field(..., description="Total number of companies")
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Items per page")
    pages: int = Field(..., description="Total number of pages")


# ============================================================================
# Quote Management Schemas
# ============================================================================

class QuoteStatusUpdate(BaseModel):
    """Update quote status request"""
    
    status: QuoteStatus = Field(..., description="New quote status")
    quoted_price: Optional[int] = Field(None, description="Quoted price in cents")
    quoted_lead_time: Optional[str] = Field(None, description="Lead time")
    quote_notes: Optional[str] = Field(None, description="Quote notes")
    admin_notes: Optional[str] = Field(None, description="Admin notes")


class QuoteListResponse(BaseModel):
    """Quote list response"""
    
    items: List[Dict[str, Any]] = Field(..., description="List of quotes")
    total: int = Field(..., description="Total number of quotes")
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Items per page")
    pages: int = Field(..., description="Total number of pages")


# ============================================================================
# Product Management Schemas
# ============================================================================

class ProductCreate(BaseModel):
    """Create product request - matches Chair model"""
    
    # Basic Information
    name: str = Field(..., min_length=1, max_length=255, description="Product name")
    model_number: str = Field(..., min_length=1, max_length=100, description="Model number")
    model_suffix: Optional[str] = Field(None, max_length=50, description="Model suffix (e.g., 'WB.P', 'P')")
    suffix_description: Optional[str] = Field(None, max_length=255, description="Suffix description")
    slug: str = Field(..., min_length=1, max_length=255, description="URL slug")
    short_description: Optional[str] = Field(None, description="Short description")
    full_description: Optional[str] = Field(None, description="Full description")
    
    # Category & Family
    category_id: int = Field(..., description="Category ID (required)")
    subcategory_id: Optional[int] = Field(None, description="Subcategory ID")
    family_id: Optional[int] = Field(None, description="Product family ID")
    
    # Pricing
    base_price: int = Field(0, ge=0, description="Base price in cents")
    msrp: Optional[int] = Field(None, ge=0, description="MSRP in cents")
    
    # Dimensions (inches)
    width: Optional[float] = Field(None, ge=0, description="Width in inches")
    depth: Optional[float] = Field(None, ge=0, description="Depth in inches")
    height: Optional[float] = Field(None, ge=0, description="Height in inches")
    seat_width: Optional[float] = Field(None, ge=0, description="Seat width in inches")
    seat_depth: Optional[float] = Field(None, ge=0, description="Seat depth in inches")
    seat_height: Optional[float] = Field(None, ge=0, description="Seat height in inches")
    arm_height: Optional[float] = Field(None, ge=0, description="Arm height in inches")
    back_height: Optional[float] = Field(None, ge=0, description="Back height in inches")
    additional_dimensions: Optional[Dict[str, Any]] = Field(None, description="Additional dimensions JSON")
    
    # Weight (pounds)
    weight: Optional[float] = Field(None, ge=0, description="Weight in pounds")
    shipping_weight: Optional[float] = Field(None, ge=0, description="Shipping weight in pounds")
    
    # Materials & Construction
    frame_material: Optional[str] = Field(None, max_length=100, description="Frame material")
    construction_details: Optional[str] = Field(None, description="Construction details")
    features: Optional[List[Any]] = Field(None, description="Product features (JSON array)")
    
    # Available Options
    available_finishes: Optional[List[Any]] = Field(None, description="Available finish IDs (JSON array)")
    available_upholsteries: Optional[List[Any]] = Field(None, description="Available upholstery IDs (JSON array)")
    available_colors: Optional[List[Any]] = Field(None, description="Available color IDs (JSON array)")
    
    # Images
    images: Optional[List[Any]] = Field(None, description="Images JSON array")
    primary_image_url: Optional[str] = Field(None, max_length=500, description="Primary image URL")
    hover_image_url: Optional[str] = Field(None, max_length=500, description="Hover image URL")
    thumbnail: Optional[str] = Field(None, max_length=500, description="Thumbnail URL")
    dimensional_drawing_url: Optional[str] = Field(None, max_length=500, description="Dimensional drawing URL")
    cad_file_url: Optional[str] = Field(None, max_length=500, description="CAD file URL")
    spec_sheet_url: Optional[str] = Field(None, max_length=500, description="Spec sheet URL")
    
    # Inventory & Availability
    stock_status: str = Field("instock", max_length=50, description="Stock status")
    lead_time_days: Optional[int] = Field(None, ge=0, description="Lead time in days")
    minimum_order_quantity: int = Field(1, ge=1, description="Minimum order quantity")
    
    # Certifications & Standards
    flame_certifications: Optional[List[Any]] = Field(None, description="Flame certifications (JSON array)")
    green_certifications: Optional[List[Any]] = Field(None, description="Green certifications (JSON array)")
    ada_compliant: bool = Field(False, description="ADA compliant")
    
    # Usage & Application
    recommended_use: Optional[str] = Field(None, max_length=255, description="Recommended use")
    is_outdoor_suitable: bool = Field(False, description="Outdoor suitable")
    warranty_info: Optional[str] = Field(None, description="Warranty information")
    care_instructions: Optional[str] = Field(None, description="Care instructions")
    
    # SEO & Marketing
    meta_title: Optional[str] = Field(None, max_length=255, description="Meta title")
    meta_description: Optional[str] = Field(None, description="Meta description")
    keywords: Optional[List[Any]] = Field(None, description="Keywords (JSON array)")
    
    # Product Status
    is_active: bool = Field(True, description="Is active")
    is_featured: bool = Field(False, description="Is featured")
    is_new: bool = Field(False, description="Is new")
    is_custom_only: bool = Field(False, description="Custom only")
    
    # Display
    display_order: int = Field(0, ge=0, description="Display order")


class ProductUpdate(BaseModel):
    """Update product request - all fields optional for PATCH"""
    
    # Basic Information
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Product name")
    model_number: Optional[str] = Field(None, min_length=1, max_length=100, description="Model number")
    model_suffix: Optional[str] = Field(None, max_length=50, description="Model suffix (e.g., 'WB.P', 'P')")
    suffix_description: Optional[str] = Field(None, max_length=255, description="Suffix description")
    slug: Optional[str] = Field(None, min_length=1, max_length=255, description="URL slug")
    short_description: Optional[str] = Field(None, description="Short description")
    full_description: Optional[str] = Field(None, description="Full description")
    
    # Category & Family
    category_id: Optional[int] = Field(None, description="Category ID")
    subcategory_id: Optional[int] = Field(None, description="Subcategory ID")
    family_id: Optional[int] = Field(None, description="Product family ID")
    
    # Pricing
    base_price: Optional[int] = Field(None, ge=0, description="Base price in cents")
    msrp: Optional[int] = Field(None, ge=0, description="MSRP in cents")
    
    # Dimensions (inches)
    width: Optional[float] = Field(None, ge=0, description="Width in inches")
    depth: Optional[float] = Field(None, ge=0, description="Depth in inches")
    height: Optional[float] = Field(None, ge=0, description="Height in inches")
    seat_width: Optional[float] = Field(None, ge=0, description="Seat width in inches")
    seat_depth: Optional[float] = Field(None, ge=0, description="Seat depth in inches")
    seat_height: Optional[float] = Field(None, ge=0, description="Seat height in inches")
    arm_height: Optional[float] = Field(None, ge=0, description="Arm height in inches")
    back_height: Optional[float] = Field(None, ge=0, description="Back height in inches")
    additional_dimensions: Optional[Dict[str, Any]] = Field(None, description="Additional dimensions JSON")
    
    # Weight (pounds)
    weight: Optional[float] = Field(None, ge=0, description="Weight in pounds")
    shipping_weight: Optional[float] = Field(None, ge=0, description="Shipping weight in pounds")
    
    # Materials & Construction
    frame_material: Optional[str] = Field(None, max_length=100, description="Frame material")
    construction_details: Optional[str] = Field(None, description="Construction details")
    features: Optional[List[Any]] = Field(None, description="Product features (JSON array)")
    
    # Available Options
    available_finishes: Optional[List[Any]] = Field(None, description="Available finish IDs (JSON array)")
    available_upholsteries: Optional[List[Any]] = Field(None, description="Available upholstery IDs (JSON array)")
    available_colors: Optional[List[Any]] = Field(None, description="Available color IDs (JSON array)")
    
    # Images
    images: Optional[List[Any]] = Field(None, description="Images JSON array")
    primary_image_url: Optional[str] = Field(None, max_length=500, description="Primary image URL")
    hover_image_url: Optional[str] = Field(None, max_length=500, description="Hover image URL")
    thumbnail: Optional[str] = Field(None, max_length=500, description="Thumbnail URL")
    dimensional_drawing_url: Optional[str] = Field(None, max_length=500, description="Dimensional drawing URL")
    cad_file_url: Optional[str] = Field(None, max_length=500, description="CAD file URL")
    spec_sheet_url: Optional[str] = Field(None, max_length=500, description="Spec sheet URL")
    
    # Inventory & Availability
    stock_status: Optional[str] = Field(None, max_length=50, description="Stock status")
    lead_time_days: Optional[int] = Field(None, ge=0, description="Lead time in days")
    minimum_order_quantity: Optional[int] = Field(None, ge=1, description="Minimum order quantity")
    
    # Certifications & Standards
    flame_certifications: Optional[List[Any]] = Field(None, description="Flame certifications (JSON array)")
    green_certifications: Optional[List[Any]] = Field(None, description="Green certifications (JSON array)")
    ada_compliant: Optional[bool] = Field(None, description="ADA compliant")
    
    # Usage & Application
    recommended_use: Optional[str] = Field(None, max_length=255, description="Recommended use")
    is_outdoor_suitable: Optional[bool] = Field(None, description="Outdoor suitable")
    warranty_info: Optional[str] = Field(None, description="Warranty information")
    care_instructions: Optional[str] = Field(None, description="Care instructions")
    
    # SEO & Marketing
    meta_title: Optional[str] = Field(None, max_length=255, description="Meta title")
    meta_description: Optional[str] = Field(None, description="Meta description")
    keywords: Optional[List[Any]] = Field(None, description="Keywords (JSON array)")
    
    # Product Status
    is_active: Optional[bool] = Field(None, description="Is active")
    is_featured: Optional[bool] = Field(None, description="Is featured")
    is_new: Optional[bool] = Field(None, description="Is new")
    is_custom_only: Optional[bool] = Field(None, description="Custom only")
    
    # Display
    display_order: Optional[int] = Field(None, ge=0, description="Display order")


class ProductListResponse(BaseModel):
    """Product list response"""
    
    items: List[Dict[str, Any]] = Field(..., description="List of products")
    total: int = Field(..., description="Total number of products")
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Items per page")
    pages: int = Field(..., description="Total number of pages")


# ============================================================================
# Catalog Management Schemas (Families, Subcategories, etc.)
# ============================================================================

class FamilyCreate(BaseModel):
    """Create product family request"""
    
    name: str = Field(..., min_length=1, max_length=255, description="Family name")
    slug: str = Field(..., min_length=1, max_length=255, description="URL slug")
    description: Optional[str] = Field(None, description="Family description")
    category_id: Optional[int] = Field(None, description="Category ID")
    subcategory_id: Optional[int] = Field(None, description="Subcategory ID")
    family_image: Optional[str] = Field(None, max_length=500, description="Family image URL")
    banner_image_url: Optional[str] = Field(None, max_length=500, description="Banner image URL")
    overview_text: Optional[str] = Field(None, description="Overview text")
    display_order: int = Field(0, ge=0, description="Display order")
    is_active: bool = Field(True, description="Is active")
    is_featured: bool = Field(False, description="Is featured")


class FamilyUpdate(BaseModel):
    """Update product family request"""
    
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Family name")
    slug: Optional[str] = Field(None, min_length=1, max_length=255, description="URL slug")
    description: Optional[str] = Field(None, description="Family description")
    category_id: Optional[int] = Field(None, description="Category ID")
    subcategory_id: Optional[int] = Field(None, description="Subcategory ID")
    family_image: Optional[str] = Field(None, max_length=500, description="Family image URL")
    banner_image_url: Optional[str] = Field(None, max_length=500, description="Banner image URL")
    overview_text: Optional[str] = Field(None, description="Overview text")
    display_order: Optional[int] = Field(None, ge=0, description="Display order")
    is_active: Optional[bool] = Field(None, description="Is active")
    is_featured: Optional[bool] = Field(None, description="Is featured")


class SubcategoryCreate(BaseModel):
    """Create subcategory request"""
    
    name: str = Field(..., min_length=1, max_length=255, description="Subcategory name")
    slug: str = Field(..., min_length=1, max_length=255, description="URL slug")
    category_id: int = Field(..., description="Parent category ID")
    description: Optional[str] = Field(None, description="Subcategory description")
    display_order: int = Field(0, ge=0, description="Display order")
    is_active: bool = Field(True, description="Is active")


class SubcategoryUpdate(BaseModel):
    """Update subcategory request"""
    
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Subcategory name")
    slug: Optional[str] = Field(None, min_length=1, max_length=255, description="URL slug")
    category_id: Optional[int] = Field(None, description="Parent category ID")
    description: Optional[str] = Field(None, description="Subcategory description")
    display_order: Optional[int] = Field(None, ge=0, description="Display order")
    is_active: Optional[bool] = Field(None, description="Is active")


# ============================================================================
# Finish Management Schemas
# ============================================================================

class FinishCreate(BaseModel):
    """Create finish request"""
    
    name: str = Field(..., min_length=1, max_length=100, description="Finish name")
    finish_code: Optional[str] = Field(None, max_length=50, description="Finish code")
    description: Optional[str] = Field(None, description="Finish description")
    finish_type: Optional[str] = Field(None, max_length=50, description="Finish type (e.g., Wood Stain, Paint)")
    color_id: Optional[int] = Field(None, description="Color reference ID")
    color_hex: Optional[str] = Field(None, max_length=7, description="Hex color code")
    image_url: Optional[str] = Field(None, max_length=500, description="Finish sample image URL")
    additional_cost: int = Field(0, ge=0, description="Additional cost in cents")
    display_order: int = Field(0, ge=0, description="Display order")
    is_active: bool = Field(True, description="Is active")
    is_custom: bool = Field(False, description="Is custom finish")
    is_to_match: bool = Field(False, description="Is to-match finish")


class FinishUpdate(BaseModel):
    """Update finish request"""
    
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Finish name")
    finish_code: Optional[str] = Field(None, max_length=50, description="Finish code")
    description: Optional[str] = Field(None, description="Finish description")
    finish_type: Optional[str] = Field(None, max_length=50, description="Finish type")
    color_id: Optional[int] = Field(None, description="Color reference ID")
    color_hex: Optional[str] = Field(None, max_length=7, description="Hex color code")
    image_url: Optional[str] = Field(None, max_length=500, description="Finish sample image URL")
    additional_cost: Optional[int] = Field(None, ge=0, description="Additional cost in cents")
    display_order: Optional[int] = Field(None, ge=0, description="Display order")
    is_active: Optional[bool] = Field(None, description="Is active")
    is_custom: Optional[bool] = Field(None, description="Is custom finish")
    is_to_match: Optional[bool] = Field(None, description="Is to-match finish")


# ============================================================================
# Upholstery Management Schemas
# ============================================================================

class UpholsteryCreate(BaseModel):
    """Create upholstery request"""
    
    name: str = Field(..., min_length=1, max_length=100, description="Upholstery name")
    material_code: Optional[str] = Field(None, max_length=50, description="Material code")
    material_type: str = Field(..., max_length=50, description="Material type (e.g., Vinyl, Fabric, Leather)")
    description: Optional[str] = Field(None, description="Upholstery description")
    grade: Optional[str] = Field(None, max_length=20, description="Grade (A, B, C, Premium, Luxury)")
    color_id: Optional[int] = Field(None, description="Color reference ID")
    pattern: Optional[str] = Field(None, max_length=100, description="Pattern name")
    texture_description: Optional[str] = Field(None, description="Texture description")
    is_seat_option_only: bool = Field(False, description="Seat option only (for P suffix products)")
    color: Optional[str] = Field(None, max_length=50, description="Color name (legacy)")
    color_hex: Optional[str] = Field(None, max_length=7, description="Hex color code")
    image_url: Optional[str] = Field(None, max_length=500, description="Image URL")
    swatch_image_url: Optional[str] = Field(None, max_length=500, description="Swatch image URL")
    is_com: bool = Field(False, description="Customer's Own Material")
    com_requirements: Optional[str] = Field(None, description="COM yardage requirements")
    durability_rating: Optional[str] = Field(None, max_length=50, description="Durability rating")
    flame_rating: Optional[str] = Field(None, max_length=50, description="Flame rating")
    cleanability: Optional[str] = Field(None, max_length=50, description="Cleanability rating")
    is_active: bool = Field(True, description="Is active")
    additional_cost: int = Field(0, ge=0, description="Base additional cost in cents")
    grade_a_cost: int = Field(0, ge=0, description="Grade A cost in cents")
    grade_b_cost: int = Field(0, ge=0, description="Grade B cost in cents")
    grade_c_cost: int = Field(0, ge=0, description="Grade C cost in cents")
    premium_cost: int = Field(0, ge=0, description="Premium cost in cents")
    display_order: int = Field(0, ge=0, description="Display order")


class UpholsteryUpdate(BaseModel):
    """Update upholstery request"""
    
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Upholstery name")
    material_code: Optional[str] = Field(None, max_length=50, description="Material code")
    material_type: Optional[str] = Field(None, max_length=50, description="Material type")
    description: Optional[str] = Field(None, description="Upholstery description")
    grade: Optional[str] = Field(None, max_length=20, description="Grade")
    color_id: Optional[int] = Field(None, description="Color reference ID")
    pattern: Optional[str] = Field(None, max_length=100, description="Pattern name")
    texture_description: Optional[str] = Field(None, description="Texture description")
    is_seat_option_only: Optional[bool] = Field(None, description="Seat option only")
    color: Optional[str] = Field(None, max_length=50, description="Color name")
    color_hex: Optional[str] = Field(None, max_length=7, description="Hex color code")
    image_url: Optional[str] = Field(None, max_length=500, description="Image URL")
    swatch_image_url: Optional[str] = Field(None, max_length=500, description="Swatch image URL")
    is_com: Optional[bool] = Field(None, description="Customer's Own Material")
    com_requirements: Optional[str] = Field(None, description="COM yardage requirements")
    durability_rating: Optional[str] = Field(None, max_length=50, description="Durability rating")
    flame_rating: Optional[str] = Field(None, max_length=50, description="Flame rating")
    cleanability: Optional[str] = Field(None, max_length=50, description="Cleanability rating")
    is_active: Optional[bool] = Field(None, description="Is active")
    additional_cost: Optional[int] = Field(None, ge=0, description="Base additional cost in cents")
    grade_a_cost: Optional[int] = Field(None, ge=0, description="Grade A cost in cents")
    grade_b_cost: Optional[int] = Field(None, ge=0, description="Grade B cost in cents")
    grade_c_cost: Optional[int] = Field(None, ge=0, description="Grade C cost in cents")
    premium_cost: Optional[int] = Field(None, ge=0, description="Premium cost in cents")
    display_order: Optional[int] = Field(None, ge=0, description="Display order")
