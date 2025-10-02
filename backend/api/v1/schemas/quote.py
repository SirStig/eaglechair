"""
Quote and Cart Schemas - Version 1

Schemas for quotes, cart, and saved configurations
"""

from typing import Optional
from pydantic import BaseModel, EmailStr, Field
from enum import Enum

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
    """Schema for updating quote (admin only)"""
    status: Optional[QuoteStatusEnum] = None
    quoted_price: Optional[int] = None
    quoted_lead_time: Optional[str] = Field(None, max_length=100)
    quote_notes: Optional[str] = None
    quote_valid_until: Optional[str] = Field(None, max_length=50)
    quote_pdf_url: Optional[str] = Field(None, max_length=500)
    assigned_to_admin_id: Optional[int] = None
    admin_notes: Optional[str] = None


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
    
    class Config:
        from_attributes = True


# ============================================================================
# Cart Item Schemas
# ============================================================================

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

