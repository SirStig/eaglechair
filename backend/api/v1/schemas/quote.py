"""
Quote and Cart Schemas - Version 1

Schemas for quotes, cart, and saved configurations
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from backend.api.v1.schemas.common import TimestampSchema

# ============================================================================
# Enums
# ============================================================================

class QuoteStatusEnum(str, Enum):
    """Quote status enumeration"""
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    QUOTED = "quoted"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    EXPIRED = "expired"


# ============================================================================
# Quote Schemas
# ============================================================================

class QuoteBase(BaseModel):
    """Base quote schema"""
    contact_name: str = Field(..., max_length=255)
    contact_email: EmailStr
    contact_phone: str = Field(..., max_length=20)
    project_name: Optional[str] = Field(None, max_length=255)
    project_description: Optional[str] = None
    project_type: Optional[str] = Field(None, max_length=100)
    estimated_quantity: Optional[int] = None
    target_budget: Optional[int] = None  # In cents
    desired_delivery_date: Optional[str] = Field(None, max_length=50)
    shipping_address_line1: str = Field(..., max_length=255)
    shipping_address_line2: Optional[str] = Field(None, max_length=255)
    shipping_city: str = Field(..., max_length=100)
    shipping_state: str = Field(..., max_length=50)
    shipping_zip: str = Field(..., max_length=20)
    shipping_country: str = Field("USA", max_length=100)
    special_instructions: Optional[str] = None
    requires_com: bool = False
    rush_order: bool = False


class QuoteCreate(QuoteBase):
    """Schema for creating a quote"""
    pass


class QuoteUpdate(BaseModel):
    """Schema for updating quote (company)"""
    contact_name: Optional[str] = Field(None, max_length=255)
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = Field(None, max_length=20)
    project_name: Optional[str] = Field(None, max_length=255)
    project_description: Optional[str] = None
    project_type: Optional[str] = Field(None, max_length=100)
    estimated_quantity: Optional[int] = None
    target_budget: Optional[int] = None
    desired_delivery_date: Optional[str] = Field(None, max_length=50)
    shipping_address_line1: Optional[str] = Field(None, max_length=255)
    shipping_address_line2: Optional[str] = Field(None, max_length=255)
    shipping_city: Optional[str] = Field(None, max_length=100)
    shipping_state: Optional[str] = Field(None, max_length=50)
    shipping_zip: Optional[str] = Field(None, max_length=20)
    shipping_country: Optional[str] = Field(None, max_length=100)
    special_instructions: Optional[str] = None
    requires_com: Optional[bool] = None
    rush_order: Optional[bool] = None


class QuoteAdminUpdate(BaseModel):
    """Schema for updating quote (admin only) - full control over all fields"""
    # Status and pricing
    status: Optional[QuoteStatusEnum] = None
    quoted_price: Optional[int] = None
    quoted_lead_time: Optional[str] = Field(None, max_length=100)
    quote_notes: Optional[str] = None
    quote_valid_until: Optional[str] = Field(None, max_length=50)
    quote_pdf_url: Optional[str] = Field(None, max_length=500)
    assigned_to_admin_id: Optional[int] = None
    admin_notes: Optional[str] = None
    
    # Contact Information
    contact_name: Optional[str] = Field(None, max_length=255)
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = Field(None, max_length=20)
    
    # Project Information
    project_name: Optional[str] = Field(None, max_length=255)
    project_description: Optional[str] = None
    project_type: Optional[str] = Field(None, max_length=100)
    estimated_quantity: Optional[int] = None
    target_budget: Optional[int] = None  # In cents
    desired_delivery_date: Optional[str] = Field(None, max_length=50)
    
    # Shipping Information
    shipping_address_line1: Optional[str] = Field(None, max_length=255)
    shipping_address_line2: Optional[str] = Field(None, max_length=255)
    shipping_city: Optional[str] = Field(None, max_length=100)
    shipping_state: Optional[str] = Field(None, max_length=50)
    shipping_zip: Optional[str] = Field(None, max_length=20)
    shipping_country: Optional[str] = Field(None, max_length=100)
    
    # Special Requests
    special_instructions: Optional[str] = None
    requires_com: Optional[bool] = None
    rush_order: Optional[bool] = None
    
    # Totals (can be manually adjusted by admin)
    subtotal: Optional[int] = None  # In cents
    tax_amount: Optional[int] = None  # In cents
    shipping_cost: Optional[int] = None  # In cents
    discount_amount: Optional[int] = None  # In cents
    total_amount: Optional[int] = None  # In cents


class QuoteResponse(QuoteBase, TimestampSchema):
    """Schema for quote response"""
    id: int
    quote_number: str
    company_id: int
    status: QuoteStatusEnum
    subtotal: int
    tax_amount: int
    shipping_cost: int
    discount_amount: int
    total_amount: int
    quoted_price: Optional[int]
    quoted_lead_time: Optional[str]
    quote_notes: Optional[str]
    quote_valid_until: Optional[str]
    quote_pdf_url: Optional[str]
    assigned_to_admin_id: Optional[int]
    submitted_at: Optional[str]
    quoted_at: Optional[str]
    accepted_at: Optional[str]
    expires_at: Optional[str]
    
    class Config:
        from_attributes = True


# ============================================================================
# Quote Item Schemas
# ============================================================================

class QuoteItemBase(BaseModel):
    """Base quote item schema"""
    product_id: int
    quantity: int = Field(..., gt=0)
    selected_finish_id: Optional[int] = None
    selected_upholstery_id: Optional[int] = None
    custom_options: Optional[dict] = None
    item_notes: Optional[str] = None


class QuoteItemCreate(QuoteItemBase):
    """Schema for creating quote item"""
    pass


class QuoteItemResponse(QuoteItemBase):
    """Schema for quote item response"""
    id: int
    quote_id: int
    product_model_number: str
    product_name: str
    unit_price: int
    customization_cost: int
    line_total: int
    
    class Config:
        from_attributes = True


class QuoteItemAdminUpdate(BaseModel):
    """Schema for updating quote item (admin only)"""
    quantity: Optional[int] = Field(None, gt=0)
    unit_price: Optional[int] = Field(None, ge=0)  # In cents
    customization_cost: Optional[int] = Field(None, ge=0)  # In cents
    line_total: Optional[int] = Field(None, ge=0)  # In cents - auto-calculated if not provided
    selected_finish_id: Optional[int] = None
    selected_upholstery_id: Optional[int] = None
    custom_options: Optional[dict] = None
    item_notes: Optional[str] = None


class QuoteItemAdminCreate(BaseModel):
    """Schema for creating quote item (admin only)"""
    product_id: int
    quantity: int = Field(..., gt=0)
    unit_price: int = Field(..., ge=0)  # In cents
    customization_cost: int = Field(0, ge=0)  # In cents
    selected_finish_id: Optional[int] = None
    selected_upholstery_id: Optional[int] = None
    custom_options: Optional[dict] = None
    item_notes: Optional[str] = None


class QuoteWithItems(QuoteResponse):
    """Quote response with items"""
    items: list[QuoteItemResponse] = []


# ============================================================================
# Cart Schemas
# ============================================================================

class CartResponse(TimestampSchema):
    """Schema for cart response"""
    id: int
    company_id: int
    subtotal: int
    estimated_tax: int
    estimated_shipping: int
    estimated_total: int
    is_active: bool
    last_updated: Optional[str]
    items: list[CartItemResponse] = []  # Include cart items
    
    class Config:
        from_attributes = True


# ============================================================================
# Cart Item Schemas
# ============================================================================

class CartItemProductInfo(BaseModel):
    """Product information embedded in cart item - comprehensive for display"""
    id: int
    name: str
    model_number: Optional[str] = None
    slug: Optional[str] = None
    
    # Images - multiple options for flexibility
    image_url: Optional[str] = None  # Alias for primary_image_url
    primary_image_url: Optional[str] = None
    hover_image_url: Optional[str] = None
    thumbnail: Optional[str] = None
    images: Optional[list] = None  # JSON array of image objects
    
    # Descriptions
    short_description: Optional[str] = None
    full_description: Optional[str] = None
    
    # Category
    category: Optional[str] = None
    subcategory: Optional[str] = None
    family: Optional[str] = None
    
    # Pricing
    base_price: int
    msrp: Optional[int] = None
    
    # Dimensions (for display/reference)
    width: Optional[float] = None
    depth: Optional[float] = None
    height: Optional[float] = None
    seat_width: Optional[float] = None
    seat_depth: Optional[float] = None
    seat_height: Optional[float] = None
    
    # Features & Materials
    features: Optional[list] = None  # JSON array
    frame_material: Optional[str] = None
    
    # Availability
    stock_status: Optional[str] = None
    lead_time_days: Optional[int] = None
    minimum_order_quantity: Optional[int] = None
    
    # Additional useful info
    dimensional_drawing_url: Optional[str] = None
    spec_sheet_url: Optional[str] = None
    
    @field_validator('category', mode='before')
    @classmethod
    def extract_category_name(cls, value):
        """Extract name from Category object if present"""
        if value is None:
            return None
        if isinstance(value, str):
            return value
        # If it's an object, extract the name attribute
        return getattr(value, 'name', None)
    
    @field_validator('subcategory', mode='before')
    @classmethod
    def extract_subcategory_name(cls, value):
        """Extract name from ProductSubcategory object if present"""
        if value is None:
            return None
        if isinstance(value, str):
            return value
        # If it's an object, extract the name attribute
        return getattr(value, 'name', None)
    
    @field_validator('family', mode='before')
    @classmethod
    def extract_family_name(cls, value):
        """Extract name from ProductFamily object if present"""
        if value is None:
            return None
        if isinstance(value, str):
            return value
        # If it's an object, extract the name attribute
        return getattr(value, 'name', None)
    
    @field_validator('image_url', mode='before')
    @classmethod
    def set_image_url(cls, value, info):
        """If image_url is not set, use primary_image_url as fallback"""
        if value:
            return value
        # Get primary_image_url from the data dict if available
        if hasattr(info, 'data') and 'primary_image_url' in info.data:
            return info.data.get('primary_image_url')
        return None
    
    class Config:
        from_attributes = True


class CartItemBase(BaseModel):
    """Base cart item schema"""
    product_id: int
    quantity: int = Field(..., gt=0)
    selected_finish_id: Optional[int] = None
    selected_upholstery_id: Optional[int] = None
    custom_options: Optional[dict] = None
    item_notes: Optional[str] = None


class CartItemCreate(CartItemBase):
    """Schema for creating cart item"""
    pass


class CartItemUpdate(BaseModel):
    """Schema for updating cart item"""
    quantity: Optional[int] = Field(None, gt=0)
    selected_finish_id: Optional[int] = None
    selected_upholstery_id: Optional[int] = None
    custom_options: Optional[dict] = None
    item_notes: Optional[str] = None


class CartItemResponse(CartItemBase):
    """Schema for cart item response"""
    id: int
    cart_id: int
    unit_price: int
    customization_cost: int
    line_total: int
    added_at: Optional[str]
    updated_at: Optional[str]
    product: Optional[CartItemProductInfo] = None  # Full product details
    
    class Config:
        from_attributes = True


class CartWithItems(CartResponse):
    """Cart response with items"""
    items: list[CartItemResponse] = []


# ============================================================================
# Saved Configuration Schemas
# ============================================================================

class SavedConfigurationBase(BaseModel):
    """Base saved configuration schema"""
    product_id: int
    configuration_name: str = Field(..., max_length=255)
    description: Optional[str] = None
    configuration_data: dict
    estimated_price: int
    is_favorite: bool = False


class SavedConfigurationCreate(SavedConfigurationBase):
    """Schema for creating saved configuration"""
    pass


class SavedConfigurationUpdate(BaseModel):
    """Schema for updating saved configuration"""
    configuration_name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    configuration_data: Optional[dict] = None
    estimated_price: Optional[int] = None
    is_favorite: Optional[bool] = None


class SavedConfigurationResponse(SavedConfigurationBase, TimestampSchema):
    """Schema for saved configuration response"""
    id: int
    company_id: int
    
    class Config:
        from_attributes = True


# ============================================================================
# Convert Cart to Quote
# ============================================================================

class ConvertCartToQuoteRequest(QuoteBase):
    """Schema for converting cart to quote"""
    pass


# ============================================================================
# List Response Schemas
# ============================================================================

class QuoteListResponse(BaseModel):
    """Schema for paginated quote list"""
    items: list[QuoteResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class SavedConfigurationListResponse(BaseModel):
    """Schema for paginated saved configuration list"""
    items: list[SavedConfigurationResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ============================================================================
# Dashboard Schemas
# ============================================================================

class DashboardStatsResponse(BaseModel):
    """Schema for dashboard statistics"""
    totalQuotes: int
    pendingQuotes: int
    activeOrders: int


class RecentQuoteResponse(BaseModel):
    """Schema for recent quote in dashboard"""
    id: int
    quoteNumber: str
    createdAt: Optional[str]
    status: str
    itemCount: int
    totalAmount: int
    projectName: Optional[str]


class DashboardOverviewResponse(BaseModel):
    """Schema for dashboard overview response"""
    stats: DashboardStatsResponse
    recentQuotes: list[RecentQuoteResponse]


class DashboardQuoteResponse(BaseModel):
    """Schema for quote in dashboard quotes list"""
    id: int
    quoteNumber: str
    createdAt: Optional[str]
    updatedAt: Optional[str]
    status: str
    itemCount: int
    totalAmount: int
    projectName: Optional[str]
    projectType: Optional[str]
    contactName: Optional[str]


class DashboardQuotesResponse(BaseModel):
    """Schema for dashboard quotes list response"""
    quotes: list[DashboardQuoteResponse]
    count: int