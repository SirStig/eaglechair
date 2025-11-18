"""
Content Schemas - Version 1

Schemas for About Us, FAQ, Catalogs, Guides, Installations, Contact Info
"""

from enum import Enum
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, EmailStr, Field, field_validator

from backend.api.v1.schemas.common import TimestampSchema

# ============================================================================
# Enums
# ============================================================================

class CatalogTypeEnum(str, Enum):
    """Catalog type enumeration"""
    FULL_CATALOG = "full_catalog"
    PRODUCT_LINE = "product_line"
    PRICE_LIST = "price_list"
    FINISH_GUIDE = "finish_guide"
    UPHOLSTERY_GUIDE = "upholstery_guide"
    CARE_GUIDE = "care_guide"
    INSTALLATION_GUIDE = "installation_guide"
    SPECIFICATION_SHEET = "specification_sheet"
    OTHER = "other"


# ============================================================================
# Team Member Schemas
# ============================================================================

class TeamMemberBase(BaseModel):
    """Base team member schema"""
    name: str = Field(..., max_length=255)
    title: str = Field(..., max_length=255)
    bio: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    photo_url: Optional[str] = Field(None, max_length=500)
    linkedin_url: Optional[str] = Field(None, max_length=500)
    display_order: int = 0
    is_active: bool = True
    is_featured: bool = False


class TeamMemberCreate(TeamMemberBase):
    """Schema for creating team member"""
    pass


class TeamMemberUpdate(BaseModel):
    """Schema for updating team member"""
    name: Optional[str] = Field(None, max_length=255)
    title: Optional[str] = Field(None, max_length=255)
    bio: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    photo_url: Optional[str] = Field(None, max_length=500)
    linkedin_url: Optional[str] = Field(None, max_length=500)
    display_order: Optional[int] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None


class TeamMemberResponse(TeamMemberBase, TimestampSchema):
    """Schema for team member response"""
    id: int
    
    class Config:
        from_attributes = True


# ============================================================================
# Company Info Schemas
# ============================================================================

class CompanyInfoBase(BaseModel):
    """Base company info schema"""
    section_key: str = Field(..., max_length=100)
    title: str = Field(..., max_length=255)
    content: str
    image_url: Optional[str] = Field(None, max_length=500)
    display_order: int = 0
    is_active: bool = True


class CompanyInfoCreate(CompanyInfoBase):
    """Schema for creating company info"""
    pass


class CompanyInfoUpdate(BaseModel):
    """Schema for updating company info"""
    title: Optional[str] = Field(None, max_length=255)
    content: Optional[str] = None
    image_url: Optional[str] = Field(None, max_length=500)
    display_order: Optional[int] = None
    is_active: Optional[bool] = None


class CompanyInfoResponse(CompanyInfoBase, TimestampSchema):
    """Schema for company info response"""
    id: int
    
    class Config:
        from_attributes = True


# ============================================================================
# FAQ Category Schemas
# ============================================================================

class FAQCategoryBase(BaseModel):
    """Base FAQ category schema"""
    name: str = Field(..., max_length=255)
    slug: str = Field(..., max_length=255)
    description: Optional[str] = None
    icon: Optional[str] = Field(None, max_length=100)
    parent_id: Optional[int] = None
    display_order: int = 0
    is_active: bool = True


class FAQCategoryCreate(FAQCategoryBase):
    """Schema for creating FAQ category"""
    pass


class FAQCategoryUpdate(BaseModel):
    """Schema for updating FAQ category"""
    name: Optional[str] = Field(None, max_length=255)
    slug: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    icon: Optional[str] = Field(None, max_length=100)
    parent_id: Optional[int] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None


class FAQCategoryResponse(FAQCategoryBase, TimestampSchema):
    """Schema for FAQ category response"""
    id: int
    
    class Config:
        from_attributes = True


# ============================================================================
# FAQ Schemas
# ============================================================================

class FAQBase(BaseModel):
    """Base FAQ schema"""
    category_id: int
    question: str
    answer: str
    helpful_links: Optional[str] = None
    related_products: Optional[str] = None
    display_order: int = 0
    is_active: bool = True
    is_featured: bool = False


class FAQCreate(FAQBase):
    """Schema for creating FAQ"""
    pass


class FAQUpdate(BaseModel):
    """Schema for updating FAQ"""
    category_id: Optional[int] = None
    question: Optional[str] = None
    answer: Optional[str] = None
    helpful_links: Optional[str] = None
    related_products: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None


class FAQResponse(FAQBase, TimestampSchema):
    """Schema for FAQ response"""
    id: int
    view_count: int
    helpful_count: int
    
    class Config:
        from_attributes = True


# ============================================================================
# Catalog Schemas
# ============================================================================

class CatalogBase(BaseModel):
    """Base catalog schema"""
    title: str = Field(..., max_length=255)
    description: Optional[str] = None
    catalog_type: CatalogTypeEnum
    file_type: str = Field(..., max_length=20)
    file_url: str = Field(..., max_length=500)
    file_size: Optional[int] = None
    thumbnail_url: Optional[str] = Field(None, max_length=500)
    version: Optional[str] = Field(None, max_length=20)
    year: Optional[str] = Field(None, max_length=4)
    category_id: Optional[int] = None
    display_order: int = 0
    is_active: bool = True
    is_featured: bool = False


class CatalogCreate(CatalogBase):
    """Schema for creating catalog"""
    pass


class CatalogUpdate(BaseModel):
    """Schema for updating catalog"""
    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    catalog_type: Optional[CatalogTypeEnum] = None
    file_type: Optional[str] = Field(None, max_length=20)
    file_url: Optional[str] = Field(None, max_length=500)
    file_size: Optional[int] = None
    thumbnail_url: Optional[str] = Field(None, max_length=500)
    version: Optional[str] = Field(None, max_length=20)
    year: Optional[str] = Field(None, max_length=4)
    category_id: Optional[int] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None


class CatalogResponse(CatalogBase, TimestampSchema):
    """Schema for catalog response"""
    id: int
    download_count: int
    
    class Config:
        from_attributes = True


# ============================================================================
# Installation Schemas
# ============================================================================

class InstallationBase(BaseModel):
    """Base installation schema"""
    project_name: str = Field(..., max_length=255)
    client_name: Optional[str] = Field(None, max_length=255)
    location: Optional[str] = Field(None, max_length=255)
    project_type: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    # Images can be list of URLs or structured items with metadata
    class InstallationImageItem(BaseModel):
        url: str
        title: Optional[str] = None
        description: Optional[str] = None
        order: Optional[int] = None

    images: Union[List[str], List[InstallationImageItem]]
    primary_image: Optional[str] = Field(None, max_length=500)
    products_used: Optional[list[int]] = None
    completion_date: Optional[str] = Field(None, max_length=50)
    display_order: int = 0
    is_active: bool = True
    is_featured: bool = False
    
    model_config = {"from_attributes": True}
    
    @field_validator('images', mode='before')
    @classmethod
    def validate_images(cls, v):
        """Ensure images is always a list, even if it's an empty string or None"""
        if v is None or v == '' or v == '[]':
            return []
        if isinstance(v, list):
            return v
        # If it's a string like '[]' or JSON, return empty list
        return []


class InstallationCreate(InstallationBase):
    """Schema for creating installation"""
    pass


class InstallationUpdate(BaseModel):
    """Schema for updating installation"""
    project_name: Optional[str] = Field(None, max_length=255)
    client_name: Optional[str] = Field(None, max_length=255)
    location: Optional[str] = Field(None, max_length=255)
    project_type: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    images: Optional[Union[List[str], List[InstallationBase.InstallationImageItem]]] = None
    primary_image: Optional[str] = Field(None, max_length=500)
    products_used: Optional[list[int]] = None
    completion_date: Optional[str] = Field(None, max_length=50)
    display_order: Optional[int] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None


class InstallationResponse(InstallationBase, TimestampSchema):
    """Schema for installation response"""
    id: int
    view_count: int
    
    model_config = {"from_attributes": True}


# Custom installation response for CMS content endpoints
class InstallationListItemResponse(BaseModel):
    """Schema for installation in CMS content list response"""
    id: int
    projectName: str
    title: str
    projectType: Optional[str]
    category: Optional[str]
    location: Optional[str]
    description: Optional[str]
    completionDate: Optional[str]
    images: Union[List[str], List[Dict[str, Any]]]
    primaryImage: Optional[str]
    url: Optional[str]
    clientName: Optional[str]
    displayOrder: int


# ============================================================================
# Contact Location Schemas
# ============================================================================

class ContactLocationBase(BaseModel):
    """Base contact location schema"""
    location_name: str = Field(..., max_length=255)
    description: Optional[str] = None
    address_line1: str = Field(..., max_length=255)
    address_line2: Optional[str] = Field(None, max_length=255)
    city: str = Field(..., max_length=100)
    state: str = Field(..., max_length=50)
    zip_code: str = Field(..., max_length=20)
    country: str = Field("USA", max_length=100)
    phone: str = Field(..., max_length=20)
    fax: Optional[str] = Field(None, max_length=20)
    email: EmailStr
    toll_free: Optional[str] = Field(None, max_length=20)
    business_hours: Optional[str] = None
    image_url: Optional[str] = Field(None, max_length=500)
    map_embed_url: Optional[str] = None
    location_type: str = Field("office", max_length=50)
    display_order: int = 0
    is_active: bool = True
    is_primary: bool = False


class ContactLocationCreate(ContactLocationBase):
    """Schema for creating contact location"""
    pass


class ContactLocationUpdate(BaseModel):
    """Schema for updating contact location"""
    location_name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    address_line1: Optional[str] = Field(None, max_length=255)
    address_line2: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=50)
    zip_code: Optional[str] = Field(None, max_length=20)
    country: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    fax: Optional[str] = Field(None, max_length=20)
    email: Optional[EmailStr] = None
    toll_free: Optional[str] = Field(None, max_length=20)
    business_hours: Optional[str] = None
    image_url: Optional[str] = Field(None, max_length=500)
    map_embed_url: Optional[str] = None
    location_type: Optional[str] = Field(None, max_length=50)
    display_order: Optional[int] = None
    is_active: Optional[bool] = None
    is_primary: Optional[bool] = None


class ContactLocationResponse(ContactLocationBase, TimestampSchema):
    """Schema for contact location response"""
    id: int
    
    class Config:
        from_attributes = True


# ============================================================================
# Feedback Schemas
# ============================================================================

class FeedbackBase(BaseModel):
    """Base feedback schema"""
    name: str = Field(..., max_length=255)
    email: EmailStr
    phone: Optional[str] = Field(None, max_length=20)
    company_name: Optional[str] = Field(None, max_length=255)
    subject: Optional[str] = Field(None, max_length=255)
    message: str
    feedback_type: str = Field("general", max_length=50)


class FeedbackCreate(FeedbackBase):
    """Schema for creating feedback"""
    pass


class FeedbackResponse(FeedbackBase, TimestampSchema):
    """Schema for feedback response"""
    id: int
    is_read: bool
    is_responded: bool
    admin_notes: Optional[str]
    ip_address: Optional[str]
    
    class Config:
        from_attributes = True


class FeedbackUpdate(BaseModel):
    """Schema for updating feedback (admin only)"""
    is_read: Optional[bool] = None
    is_responded: Optional[bool] = None
    admin_notes: Optional[str] = None


# ============================================================================
# Page Content Schemas
# ============================================================================

class PageContentBase(BaseModel):
    """Base page content schema"""
    page_slug: str = Field(..., max_length=100)
    section_key: str = Field(..., max_length=100)
    title: Optional[str] = Field(None, max_length=500)
    subtitle: Optional[str] = Field(None, max_length=500)
    content: Optional[str] = None
    image_url: Optional[str] = Field(None, max_length=500)
    video_url: Optional[str] = Field(None, max_length=500)
    cta_text: Optional[str] = Field(None, max_length=100)
    cta_link: Optional[str] = Field(None, max_length=500)
    cta_style: Optional[str] = Field(None, max_length=50)
    extra_data: Optional[dict] = None
    display_order: int = 0
    is_active: bool = True


class PageContentCreate(PageContentBase):
    """Schema for creating page content"""
    pass


class PageContentUpdate(BaseModel):
    """Schema for updating page content"""
    title: Optional[str] = Field(None, max_length=500)
    subtitle: Optional[str] = Field(None, max_length=500)
    content: Optional[str] = None
    image_url: Optional[str] = Field(None, max_length=500)
    video_url: Optional[str] = Field(None, max_length=500)
    cta_text: Optional[str] = Field(None, max_length=100)
    cta_link: Optional[str] = Field(None, max_length=500)
    cta_style: Optional[str] = Field(None, max_length=50)
    extra_data: Optional[dict] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None


class PageContentResponse(PageContentBase, TimestampSchema):
    """Schema for page content response"""
    id: int
    
    class Config:
        from_attributes = True


# ============================================================================
# List Response Schemas
# ============================================================================

class TeamMemberListResponse(BaseModel):
    """Schema for paginated team member list"""
    items: list[TeamMemberResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class FAQListResponse(BaseModel):
    """Schema for paginated FAQ list"""
    items: list[FAQResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class CatalogListResponse(BaseModel):
    """Schema for paginated catalog list"""
    items: list[CatalogResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class InstallationListResponse(BaseModel):
    """Schema for paginated installation list"""
    items: list[InstallationResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class FeedbackListResponse(BaseModel):
    """Schema for paginated feedback list"""
    items: list[FeedbackResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ============================================================================
# Hero Slide Schemas
# ============================================================================

class HeroSlideResponse(BaseModel):
    """Schema for hero slide response"""
    id: int
    title: str
    subtitle: Optional[str]
    image: str
    ctaText: Optional[str]
    ctaLink: Optional[str]
    displayOrder: int


# ============================================================================
# Feature Schemas
# ============================================================================

class FeatureResponse(BaseModel):
    """Schema for feature response"""
    id: int
    title: str
    description: str
    icon: Optional[str]
    featureType: str
    displayOrder: int


# ============================================================================
# Client Logo Schemas
# ============================================================================

class ClientLogoResponse(BaseModel):
    """Schema for client logo response"""
    id: int
    name: str
    logoUrl: Optional[str]
    websiteUrl: Optional[str]
    displayOrder: int


# ============================================================================
# Company Value Schemas
# ============================================================================

class CompanyValueResponse(BaseModel):
    """Schema for company value response"""
    id: int
    title: str
    description: str
    icon: Optional[str]
    displayOrder: int


# ============================================================================
# Company Milestone Schemas
# ============================================================================

class CompanyMilestoneResponse(BaseModel):
    """Schema for company milestone response"""
    id: int
    year: Optional[int]
    title: str
    description: Optional[str]
    displayOrder: int


# ============================================================================
# Sales Representative Schemas
# ============================================================================

class SalesRepresentativeResponse(BaseModel):
    """Schema for sales representative response"""
    id: int
    name: str
    territoryName: str
    territory: str
    statesCovered: list[str]
    states: list[str]
    email: Optional[str]
    phone: Optional[str]
    photoUrl: Optional[str]
    displayOrder: int


# ============================================================================
# Page Content Schemas
# ============================================================================

class PageContentItemResponse(BaseModel):
    """Schema for page content item"""
    id: int
    pageSlug: str
    sectionKey: str
    title: str
    content: str
    imageUrl: Optional[str]
    displayOrder: int