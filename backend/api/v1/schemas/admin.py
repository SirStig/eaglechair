"""
Admin Schemas

Pydantic schemas for admin operations
"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, EmailStr, Field

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


class CompanyInviteRequest(BaseModel):
    """Company invitation request"""

    company_name: str = Field(
        ..., min_length=1, max_length=255, description="Name of the company to invite"
    )
    email: EmailStr = Field(..., description="Email address to send invitation to")


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
# Email Template Management Schemas
# ============================================================================


class EmailTemplateCreate(BaseModel):
    """Create email template request"""

    template_type: str = Field(
        ..., min_length=1, max_length=50, description="Template type identifier"
    )
    name: str = Field(..., min_length=1, max_length=255, description="Template name")
    description: Optional[str] = Field(None, description="Template description")
    subject: str = Field(
        ..., min_length=1, max_length=500, description="Email subject line"
    )
    body: str = Field(..., description="Email body HTML")
    available_variables: Optional[Dict[str, str]] = Field(
        None, description="Available variables for this template"
    )
    is_active: bool = Field(True, description="Whether template is active")


class EmailTemplateUpdate(BaseModel):
    """Update email template request"""

    name: Optional[str] = Field(
        None, min_length=1, max_length=255, description="Template name"
    )
    description: Optional[str] = Field(None, description="Template description")
    subject: Optional[str] = Field(
        None, min_length=1, max_length=500, description="Email subject line"
    )
    body: Optional[str] = Field(None, description="Email body HTML")
    available_variables: Optional[Dict[str, str]] = Field(
        None, description="Available variables for this template"
    )
    is_active: Optional[bool] = Field(None, description="Whether template is active")


class EmailTemplateResponse(BaseModel):
    """Email template response"""

    id: int
    template_type: str
    name: str
    description: Optional[str]
    subject: str
    body: str
    available_variables: Optional[Dict[str, str]]
    is_active: bool
    times_sent: int
    last_sent_at: Optional[str]


class EmailTestRequest(BaseModel):
    """Test email request"""

    to_email: str = Field(..., description="Email address to send test to")
    template_type: str = Field(..., description="Template type to test")
    context: Optional[Dict[str, Any]] = Field(
        default_factory=dict, description="Template context variables"
    )


# ============================================================================
# Product Management Schemas
# ============================================================================


class ProductCreate(BaseModel):
    """Create product request - matches Chair model"""

    # Basic Information
    name: str = Field(..., min_length=1, max_length=255, description="Product name")
    model_number: str = Field(
        ..., min_length=1, max_length=100, description="Model number"
    )
    model_suffix: Optional[str] = Field(
        None, max_length=50, description="Model suffix (e.g., 'WB.P', 'P')"
    )
    suffix_description: Optional[str] = Field(
        None, max_length=255, description="Suffix description"
    )
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
    seat_height: Optional[float] = Field(
        None, ge=0, description="Seat height in inches"
    )
    arm_height: Optional[float] = Field(None, ge=0, description="Arm height in inches")
    back_height: Optional[float] = Field(
        None, ge=0, description="Back height in inches"
    )
    additional_dimensions: Optional[Dict[str, Any]] = Field(
        None, description="Additional dimensions JSON"
    )

    # Weight (pounds)
    weight: Optional[float] = Field(None, ge=0, description="Weight in pounds")
    shipping_weight: Optional[float] = Field(
        None, ge=0, description="Shipping weight in pounds"
    )

    # Materials & Construction
    frame_material: Optional[str] = Field(
        None, max_length=100, description="Frame material"
    )
    construction_details: Optional[str] = Field(
        None, description="Construction details"
    )
    features: Optional[List[Any]] = Field(
        None, description="Product features (JSON array)"
    )

    # Available Options
    available_finishes: Optional[List[Any]] = Field(
        None, description="Available finish IDs (JSON array)"
    )
    available_upholsteries: Optional[List[Any]] = Field(
        None, description="Available upholstery IDs (JSON array)"
    )
    available_colors: Optional[List[Any]] = Field(
        None, description="Available color IDs (JSON array)"
    )

    # Images
    images: Optional[List[Any]] = Field(None, description="Images JSON array")
    primary_image_url: Optional[str] = Field(
        None, max_length=500, description="Primary image URL"
    )
    hover_image_url: Optional[str] = Field(
        None, max_length=500, description="Hover image URL"
    )
    thumbnail: Optional[str] = Field(None, max_length=500, description="Thumbnail URL")
    dimensional_drawing_url: Optional[str] = Field(
        None, max_length=500, description="Dimensional drawing URL"
    )
    cad_file_url: Optional[str] = Field(
        None, max_length=500, description="CAD file URL"
    )
    spec_sheet_url: Optional[str] = Field(
        None, max_length=500, description="Spec sheet URL"
    )

    # Inventory & Availability
    stock_status: str = Field("instock", max_length=50, description="Stock status")
    lead_time_days: Optional[int] = Field(None, ge=0, description="Lead time in days")
    minimum_order_quantity: int = Field(1, ge=1, description="Minimum order quantity")

    # Certifications & Standards
    flame_certifications: Optional[List[Any]] = Field(
        None, description="Flame certifications (JSON array)"
    )
    green_certifications: Optional[List[Any]] = Field(
        None, description="Green certifications (JSON array)"
    )
    ada_compliant: bool = Field(False, description="ADA compliant")

    # Usage & Application
    recommended_use: Optional[str] = Field(
        None, max_length=255, description="Recommended use"
    )
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

    # Related Products
    related_product_ids: Optional[List[int]] = Field(
        None, description="Related product IDs"
    )


class ProductUpdate(BaseModel):
    """Update product request - all fields optional for PATCH"""

    # Basic Information
    name: Optional[str] = Field(
        None, min_length=1, max_length=255, description="Product name"
    )
    model_number: Optional[str] = Field(
        None, min_length=1, max_length=100, description="Model number"
    )
    model_suffix: Optional[str] = Field(
        None, max_length=50, description="Model suffix (e.g., 'WB.P', 'P')"
    )
    suffix_description: Optional[str] = Field(
        None, max_length=255, description="Suffix description"
    )
    slug: Optional[str] = Field(
        None, min_length=1, max_length=255, description="URL slug"
    )
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
    seat_height: Optional[float] = Field(
        None, ge=0, description="Seat height in inches"
    )
    arm_height: Optional[float] = Field(None, ge=0, description="Arm height in inches")
    back_height: Optional[float] = Field(
        None, ge=0, description="Back height in inches"
    )
    additional_dimensions: Optional[Dict[str, Any]] = Field(
        None, description="Additional dimensions JSON"
    )

    # Weight (pounds)
    weight: Optional[float] = Field(None, ge=0, description="Weight in pounds")
    shipping_weight: Optional[float] = Field(
        None, ge=0, description="Shipping weight in pounds"
    )

    # Materials & Construction
    frame_material: Optional[str] = Field(
        None, max_length=100, description="Frame material"
    )
    construction_details: Optional[str] = Field(
        None, description="Construction details"
    )
    features: Optional[List[Any]] = Field(
        None, description="Product features (JSON array)"
    )

    # Available Options
    available_finishes: Optional[List[Any]] = Field(
        None, description="Available finish IDs (JSON array)"
    )
    available_upholsteries: Optional[List[Any]] = Field(
        None, description="Available upholstery IDs (JSON array)"
    )
    available_colors: Optional[List[Any]] = Field(
        None, description="Available color IDs (JSON array)"
    )

    # Images
    images: Optional[List[Any]] = Field(None, description="Images JSON array")
    primary_image_url: Optional[str] = Field(
        None, max_length=500, description="Primary image URL"
    )
    hover_image_url: Optional[str] = Field(
        None, max_length=500, description="Hover image URL"
    )
    thumbnail: Optional[str] = Field(None, max_length=500, description="Thumbnail URL")
    dimensional_drawing_url: Optional[str] = Field(
        None, max_length=500, description="Dimensional drawing URL"
    )
    cad_file_url: Optional[str] = Field(
        None, max_length=500, description="CAD file URL"
    )
    spec_sheet_url: Optional[str] = Field(
        None, max_length=500, description="Spec sheet URL"
    )

    # Inventory & Availability
    stock_status: Optional[str] = Field(None, max_length=50, description="Stock status")
    lead_time_days: Optional[int] = Field(None, ge=0, description="Lead time in days")
    minimum_order_quantity: Optional[int] = Field(
        None, ge=1, description="Minimum order quantity"
    )

    # Certifications & Standards
    flame_certifications: Optional[List[Any]] = Field(
        None, description="Flame certifications (JSON array)"
    )
    green_certifications: Optional[List[Any]] = Field(
        None, description="Green certifications (JSON array)"
    )
    ada_compliant: Optional[bool] = Field(None, description="ADA compliant")

    # Usage & Application
    recommended_use: Optional[str] = Field(
        None, max_length=255, description="Recommended use"
    )
    is_outdoor_suitable: Optional[bool] = Field(None, description="Outdoor suitable")
    warranty_info: Optional[str] = Field(None, description="Warranty information")
    care_instructions: Optional[str] = Field(None, description="Care instructions")

    # SEO & Marketing
    meta_title: Optional[str] = Field(None, max_length=255, description="Meta title")
    meta_description: Optional[str] = Field(None, description="Meta description")
    keywords: Optional[List[Any]] = Field(None, description="Keywords (JSON array)")

    # Variations
    variations: Optional[List[Dict[str, Any]]] = Field(
        None, description="Product variations (list of variation objects)"
    )

    # Product Status
    is_active: Optional[bool] = Field(None, description="Is active")
    is_featured: Optional[bool] = Field(None, description="Is featured")
    is_new: Optional[bool] = Field(None, description="Is new")
    is_custom_only: Optional[bool] = Field(None, description="Custom only")

    # Display
    display_order: Optional[int] = Field(None, ge=0, description="Display order")

    # Related Products
    related_product_ids: Optional[List[int]] = Field(
        None, description="Related product IDs"
    )


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
    family_image: Optional[str] = Field(
        None, max_length=500, description="Family image URL"
    )
    banner_image_url: Optional[str] = Field(
        None, max_length=500, description="Banner image URL"
    )
    catalog_pdf_url: Optional[str] = Field(
        None, max_length=500, description="Product family catalog PDF URL"
    )
    overview_text: Optional[str] = Field(None, description="Overview text")
    display_order: int = Field(0, ge=0, description="Display order")
    is_active: bool = Field(True, description="Is active")
    is_featured: bool = Field(False, description="Is featured")


class FamilyUpdate(BaseModel):
    """Update product family request"""

    name: Optional[str] = Field(
        None, min_length=1, max_length=255, description="Family name"
    )
    slug: Optional[str] = Field(
        None, min_length=1, max_length=255, description="URL slug"
    )
    description: Optional[str] = Field(None, description="Family description")
    category_id: Optional[int] = Field(None, description="Category ID")
    subcategory_id: Optional[int] = Field(None, description="Subcategory ID")
    family_image: Optional[str] = Field(
        None, max_length=500, description="Family image URL"
    )
    banner_image_url: Optional[str] = Field(
        None, max_length=500, description="Banner image URL"
    )
    catalog_pdf_url: Optional[str] = Field(
        None, max_length=500, description="Product family catalog PDF URL"
    )
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

    name: Optional[str] = Field(
        None, min_length=1, max_length=255, description="Subcategory name"
    )
    slug: Optional[str] = Field(
        None, min_length=1, max_length=255, description="URL slug"
    )
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
    finish_type: Optional[str] = Field(
        None, max_length=50, description="Finish type (e.g., Wood Stain, Paint)"
    )
    color_id: Optional[int] = Field(None, description="Color reference ID")
    color_hex: Optional[str] = Field(None, max_length=7, description="Hex color code")
    image_url: Optional[str] = Field(
        None, max_length=500, description="Finish sample image URL"
    )
    additional_cost: int = Field(0, ge=0, description="Additional cost in cents")
    display_order: int = Field(0, ge=0, description="Display order")
    is_active: bool = Field(True, description="Is active")
    is_custom: bool = Field(False, description="Is custom finish")
    is_to_match: bool = Field(False, description="Is to-match finish")


class FinishUpdate(BaseModel):
    """Update finish request"""

    name: Optional[str] = Field(
        None, min_length=1, max_length=100, description="Finish name"
    )
    finish_code: Optional[str] = Field(None, max_length=50, description="Finish code")
    description: Optional[str] = Field(None, description="Finish description")
    finish_type: Optional[str] = Field(None, max_length=50, description="Finish type")
    color_id: Optional[int] = Field(None, description="Color reference ID")
    color_hex: Optional[str] = Field(None, max_length=7, description="Hex color code")
    image_url: Optional[str] = Field(
        None, max_length=500, description="Finish sample image URL"
    )
    additional_cost: Optional[int] = Field(
        None, ge=0, description="Additional cost in cents"
    )
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
    material_code: Optional[str] = Field(
        None, max_length=50, description="Material code"
    )
    material_type: str = Field(
        ..., max_length=50, description="Material type (e.g., Vinyl, Fabric, Leather)"
    )
    description: Optional[str] = Field(None, description="Upholstery description")
    grade: Optional[str] = Field(
        None, max_length=20, description="Grade (A, B, C, Premium, Luxury)"
    )
    color_id: Optional[int] = Field(None, description="Color reference ID")
    pattern: Optional[str] = Field(None, max_length=100, description="Pattern name")
    texture_description: Optional[str] = Field(None, description="Texture description")
    is_seat_option_only: bool = Field(
        False, description="Seat option only (for P suffix products)"
    )
    color: Optional[str] = Field(None, max_length=50, description="Color name (legacy)")
    color_hex: Optional[str] = Field(None, max_length=7, description="Hex color code")
    image_url: Optional[str] = Field(None, max_length=500, description="Image URL")
    swatch_image_url: Optional[str] = Field(
        None, max_length=500, description="Swatch image URL"
    )
    is_com: bool = Field(False, description="Customer's Own Material")
    com_requirements: Optional[str] = Field(
        None, description="COM yardage requirements"
    )
    durability_rating: Optional[str] = Field(
        None, max_length=50, description="Durability rating"
    )
    flame_rating: Optional[str] = Field(None, max_length=50, description="Flame rating")
    cleanability: Optional[str] = Field(
        None, max_length=50, description="Cleanability rating"
    )
    is_active: bool = Field(True, description="Is active")
    additional_cost: int = Field(0, ge=0, description="Base additional cost in cents")
    grade_a_cost: int = Field(0, ge=0, description="Grade A cost in cents")
    grade_b_cost: int = Field(0, ge=0, description="Grade B cost in cents")
    grade_c_cost: int = Field(0, ge=0, description="Grade C cost in cents")
    premium_cost: int = Field(0, ge=0, description="Premium cost in cents")
    display_order: int = Field(0, ge=0, description="Display order")


class UpholsteryUpdate(BaseModel):
    """Update upholstery request"""

    name: Optional[str] = Field(
        None, min_length=1, max_length=100, description="Upholstery name"
    )
    material_code: Optional[str] = Field(
        None, max_length=50, description="Material code"
    )
    material_type: Optional[str] = Field(
        None, max_length=50, description="Material type"
    )
    description: Optional[str] = Field(None, description="Upholstery description")
    grade: Optional[str] = Field(None, max_length=20, description="Grade")
    color_id: Optional[int] = Field(None, description="Color reference ID")
    pattern: Optional[str] = Field(None, max_length=100, description="Pattern name")
    texture_description: Optional[str] = Field(None, description="Texture description")
    is_seat_option_only: Optional[bool] = Field(None, description="Seat option only")
    color: Optional[str] = Field(None, max_length=50, description="Color name")
    color_hex: Optional[str] = Field(None, max_length=7, description="Hex color code")
    image_url: Optional[str] = Field(None, max_length=500, description="Image URL")
    swatch_image_url: Optional[str] = Field(
        None, max_length=500, description="Swatch image URL"
    )
    is_com: Optional[bool] = Field(None, description="Customer's Own Material")
    com_requirements: Optional[str] = Field(
        None, description="COM yardage requirements"
    )
    durability_rating: Optional[str] = Field(
        None, max_length=50, description="Durability rating"
    )
    flame_rating: Optional[str] = Field(None, max_length=50, description="Flame rating")
    cleanability: Optional[str] = Field(
        None, max_length=50, description="Cleanability rating"
    )
    is_active: Optional[bool] = Field(None, description="Is active")
    additional_cost: Optional[int] = Field(
        None, ge=0, description="Base additional cost in cents"
    )
    grade_a_cost: Optional[int] = Field(None, ge=0, description="Grade A cost in cents")
    grade_b_cost: Optional[int] = Field(None, ge=0, description="Grade B cost in cents")
    grade_c_cost: Optional[int] = Field(None, ge=0, description="Grade C cost in cents")
    premium_cost: Optional[int] = Field(None, ge=0, description="Premium cost in cents")
    display_order: Optional[int] = Field(None, ge=0, description="Display order")


# ============================================================================
# Laminate Management Schemas
# ============================================================================


class LaminateCreate(BaseModel):
    """Create laminate request - matches Laminate model"""

    brand: str = Field(..., min_length=1, max_length=255, description="Laminate brand")
    pattern_name: str = Field(
        ..., min_length=1, max_length=255, description="Pattern name"
    )
    pattern_code: Optional[str] = Field(
        None, max_length=100, description="Manufacturer pattern code"
    )
    description: Optional[str] = Field(None, description="Description")
    color_family: Optional[str] = Field(
        None, max_length=100, description="Color family"
    )
    finish_type: Optional[str] = Field(None, max_length=100, description="Finish type")
    thickness: Optional[str] = Field(None, max_length=50, description="Thickness")
    grade: Optional[str] = Field(None, max_length=50, description="Grade")
    supplier_name: Optional[str] = Field(
        None, max_length=255, description="Supplier name"
    )
    supplier_website: Optional[str] = Field(
        None, max_length=500, description="Supplier website"
    )
    supplier_contact: Optional[str] = Field(
        None, max_length=255, description="Supplier contact"
    )
    swatch_image_url: Optional[str] = Field(
        None, max_length=500, description="Swatch image URL"
    )
    full_image_url: Optional[str] = Field(
        None, max_length=500, description="Full image URL"
    )
    additional_images: Optional[dict] = Field(
        None, description="Additional images (JSON)"
    )
    is_in_stock: bool = Field(True, description="Is in stock")
    lead_time_days: Optional[int] = Field(None, ge=0, description="Lead time in days")
    minimum_order: Optional[str] = Field(
        None, max_length=100, description="Minimum order"
    )
    price_per_sheet: Optional[int] = Field(
        None, ge=0, description="Price per sheet in cents"
    )
    recommended_for: Optional[str] = Field(None, description="Recommended for")
    care_instructions: Optional[str] = Field(None, description="Care instructions")
    display_order: int = Field(0, ge=0, description="Display order")
    is_active: bool = Field(True, description="Is active")
    is_featured: bool = Field(False, description="Is featured")
    is_popular: bool = Field(False, description="Is popular")


class LaminateUpdate(BaseModel):
    """Update laminate request - all fields optional for PATCH"""

    brand: Optional[str] = Field(
        None, min_length=1, max_length=255, description="Laminate brand"
    )
    pattern_name: Optional[str] = Field(
        None, min_length=1, max_length=255, description="Pattern name"
    )
    pattern_code: Optional[str] = Field(
        None, max_length=100, description="Manufacturer pattern code"
    )
    description: Optional[str] = Field(None, description="Description")
    color_family: Optional[str] = Field(
        None, max_length=100, description="Color family"
    )
    finish_type: Optional[str] = Field(None, max_length=100, description="Finish type")
    thickness: Optional[str] = Field(None, max_length=50, description="Thickness")
    grade: Optional[str] = Field(None, max_length=50, description="Grade")
    supplier_name: Optional[str] = Field(
        None, max_length=255, description="Supplier name"
    )
    supplier_website: Optional[str] = Field(
        None, max_length=500, description="Supplier website"
    )
    supplier_contact: Optional[str] = Field(
        None, max_length=255, description="Supplier contact"
    )
    swatch_image_url: Optional[str] = Field(
        None, max_length=500, description="Swatch image URL"
    )
    full_image_url: Optional[str] = Field(
        None, max_length=500, description="Full image URL"
    )
    additional_images: Optional[dict] = Field(
        None, description="Additional images (JSON)"
    )
    is_in_stock: Optional[bool] = Field(None, description="Is in stock")
    lead_time_days: Optional[int] = Field(None, ge=0, description="Lead time in days")
    minimum_order: Optional[str] = Field(
        None, max_length=100, description="Minimum order"
    )
    price_per_sheet: Optional[int] = Field(
        None, ge=0, description="Price per sheet in cents"
    )
    recommended_for: Optional[str] = Field(None, description="Recommended for")
    care_instructions: Optional[str] = Field(None, description="Care instructions")
    display_order: Optional[int] = Field(None, ge=0, description="Display order")
    is_active: Optional[bool] = Field(None, description="Is active")
    is_featured: Optional[bool] = Field(None, description="Is featured")
    is_popular: Optional[bool] = Field(None, description="Is popular")


# ============================================================================
# Hardware Management Schemas
# ============================================================================


class HardwareCreate(BaseModel):
    """Create hardware request - matches Hardware model"""

    name: str = Field(..., min_length=1, max_length=255, description="Hardware name")
    category: Optional[str] = Field(None, max_length=100, description="Category")
    description: Optional[str] = Field(None, description="Description")
    material: Optional[str] = Field(None, max_length=100, description="Material")
    finish: Optional[str] = Field(None, max_length=100, description="Finish")
    dimensions: Optional[str] = Field(None, max_length=255, description="Dimensions")
    weight_capacity: Optional[str] = Field(
        None, max_length=100, description="Weight capacity"
    )
    model_number: Optional[str] = Field(
        None, max_length=100, description="Model number"
    )
    sku: Optional[str] = Field(None, max_length=100, description="SKU")
    image_url: Optional[str] = Field(None, max_length=500, description="Image URL")
    thumbnail_url: Optional[str] = Field(
        None, max_length=500, description="Thumbnail URL"
    )
    additional_images: Optional[dict] = Field(
        None, description="Additional images (JSON)"
    )
    compatible_with: Optional[str] = Field(None, description="Compatible with")
    installation_notes: Optional[str] = Field(None, description="Installation notes")
    list_price: Optional[int] = Field(None, ge=0, description="List price in cents")
    display_order: int = Field(0, ge=0, description="Display order")
    is_active: bool = Field(True, description="Is active")
    is_featured: bool = Field(False, description="Is featured")


class HardwareUpdate(BaseModel):
    """Update hardware request - all fields optional for PATCH"""

    name: Optional[str] = Field(
        None, min_length=1, max_length=255, description="Hardware name"
    )
    category: Optional[str] = Field(None, max_length=100, description="Category")
    description: Optional[str] = Field(None, description="Description")
    material: Optional[str] = Field(None, max_length=100, description="Material")
    finish: Optional[str] = Field(None, max_length=100, description="Finish")
    dimensions: Optional[str] = Field(None, max_length=255, description="Dimensions")
    weight_capacity: Optional[str] = Field(
        None, max_length=100, description="Weight capacity"
    )
    model_number: Optional[str] = Field(
        None, max_length=100, description="Model number"
    )
    sku: Optional[str] = Field(None, max_length=100, description="SKU")
    image_url: Optional[str] = Field(None, max_length=500, description="Image URL")
    thumbnail_url: Optional[str] = Field(
        None, max_length=500, description="Thumbnail URL"
    )
    additional_images: Optional[dict] = Field(
        None, description="Additional images (JSON)"
    )
    compatible_with: Optional[str] = Field(None, description="Compatible with")
    installation_notes: Optional[str] = Field(None, description="Installation notes")
    list_price: Optional[int] = Field(None, ge=0, description="List price in cents")
    display_order: Optional[int] = Field(None, ge=0, description="Display order")
    is_active: Optional[bool] = Field(None, description="Is active")
    is_featured: Optional[bool] = Field(None, description="Is featured")
