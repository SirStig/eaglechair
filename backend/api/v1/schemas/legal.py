"""
Legal Schemas - Version 1

Schemas for legal documents, warranties, and policies
"""

from typing import Optional
from pydantic import BaseModel, Field
from enum import Enum

from backend.api.v1.schemas.common import TimestampSchema


# ============================================================================
# Enums
# ============================================================================

class LegalDocumentTypeEnum(str, Enum):
    """Legal document type enumeration"""
    PRICE_LIST = "price_list"
    DIMENSIONS_SIZES = "dimensions_sizes"
    ORDERS = "orders"
    COM_COL_ORDERS = "com_col_orders"
    MINIMUM_ORDER = "minimum_order"
    PAYMENTS = "payments"
    TERMS = "terms"
    TAXES = "taxes"
    LEGAL_COSTS = "legal_costs"
    QUOTATIONS = "quotations"
    WARRANTY = "warranty"
    FLAMMABILITY = "flammability"
    CUSTOM_FINISHES = "custom_finishes"
    PARTIAL_SHIPMENTS = "partial_shipments"
    STORAGE = "storage"
    RETURNS = "returns"
    CANCELLATIONS = "cancellations"
    MAINTENANCE = "maintenance"
    SPECIAL_SERVICE = "special_service"
    SHIPMENTS_DAMAGE = "shipments_damage"
    FREIGHT_CLASSIFICATION = "freight_classification"
    IP_DISCLAIMER = "ip_disclaimer"
    IP_ASSIGNMENT = "ip_assignment"
    CONDITIONS_OF_SALE = "conditions_of_sale"
    PRIVACY_POLICY = "privacy_policy"
    OTHER = "other"


# ============================================================================
# Legal Document Schemas
# ============================================================================

class LegalDocumentBase(BaseModel):
    """Base legal document schema"""
    document_type: LegalDocumentTypeEnum
    title: str = Field(..., max_length=255)
    content: str
    short_description: Optional[str] = None
    is_active: bool = True
    display_order: int = 0
    version: str = Field("1.0", max_length=20)
    effective_date: Optional[str] = Field(None, max_length=50)
    slug: str = Field(..., max_length=255)
    meta_title: Optional[str] = Field(None, max_length=255)
    meta_description: Optional[str] = None


class LegalDocumentCreate(LegalDocumentBase):
    """Schema for creating a legal document"""
    pass


class LegalDocumentUpdate(BaseModel):
    """Schema for updating a legal document"""
    title: Optional[str] = Field(None, max_length=255)
    content: Optional[str] = None
    short_description: Optional[str] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None
    version: Optional[str] = Field(None, max_length=20)
    effective_date: Optional[str] = Field(None, max_length=50)
    meta_title: Optional[str] = Field(None, max_length=255)
    meta_description: Optional[str] = None


class LegalDocumentResponse(LegalDocumentBase, TimestampSchema):
    """Schema for legal document response"""
    id: int
    
    class Config:
        from_attributes = True


# ============================================================================
# Warranty Schemas
# ============================================================================

class WarrantyBase(BaseModel):
    """Base warranty schema"""
    warranty_type: str = Field(..., max_length=100)
    title: str = Field(..., max_length=255)
    description: str
    duration: Optional[str] = Field(None, max_length=100)
    coverage: Optional[str] = None
    exclusions: Optional[str] = None
    claim_process: Optional[str] = None
    is_active: bool = True
    display_order: int = 0


class WarrantyCreate(WarrantyBase):
    """Schema for creating warranty information"""
    pass


class WarrantyUpdate(BaseModel):
    """Schema for updating warranty information"""
    warranty_type: Optional[str] = Field(None, max_length=100)
    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    duration: Optional[str] = Field(None, max_length=100)
    coverage: Optional[str] = None
    exclusions: Optional[str] = None
    claim_process: Optional[str] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


class WarrantyResponse(WarrantyBase, TimestampSchema):
    """Schema for warranty response"""
    id: int
    
    class Config:
        from_attributes = True


# ============================================================================
# Shipping Policy Schemas
# ============================================================================

class ShippingPolicyBase(BaseModel):
    """Base shipping policy schema"""
    policy_name: str = Field(..., max_length=255)
    description: str
    freight_classification: Optional[str] = Field(None, max_length=100)
    shipping_timeframe: Optional[str] = Field(None, max_length=100)
    special_instructions: Optional[str] = None
    damage_claim_process: Optional[str] = None
    is_active: bool = True


class ShippingPolicyCreate(ShippingPolicyBase):
    """Schema for creating shipping policy"""
    pass


class ShippingPolicyUpdate(BaseModel):
    """Schema for updating shipping policy"""
    policy_name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    freight_classification: Optional[str] = Field(None, max_length=100)
    shipping_timeframe: Optional[str] = Field(None, max_length=100)
    special_instructions: Optional[str] = None
    damage_claim_process: Optional[str] = None
    is_active: Optional[bool] = None


class ShippingPolicyResponse(ShippingPolicyBase, TimestampSchema):
    """Schema for shipping policy response"""
    id: int
    
    class Config:
        from_attributes = True


# ============================================================================
# List Response Schemas
# ============================================================================

class LegalDocumentListResponse(BaseModel):
    """Schema for paginated legal document list"""
    items: list[LegalDocumentResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

