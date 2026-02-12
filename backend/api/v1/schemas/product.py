"""
Product Schemas - Version 1

Schemas for chairs, categories, finishes, and upholsteries
"""

from datetime import datetime
from typing import Any, List, Optional, Union

from pydantic import BaseModel, Field, computed_field, field_validator

from backend.api.v1.schemas.common import TimestampSchema
from backend.core.config import settings

# ============================================================================
# Category Schemas
# ============================================================================


class CategoryBase(BaseModel):
    """Base category schema"""

    name: str = Field(..., max_length=255)
    slug: str = Field(..., max_length=255)
    description: Optional[str] = None
    parent_id: Optional[int] = None
    display_order: int = 0
    is_active: bool = True
    icon_url: Optional[str] = Field(None, max_length=500)
    banner_image_url: Optional[str] = Field(None, max_length=500)
    meta_title: Optional[str] = Field(None, max_length=255)
    meta_description: Optional[str] = None


class CategoryCreate(CategoryBase):
    """Schema for creating a category"""

    pass


class CategoryUpdate(BaseModel):
    """Schema for updating a category"""

    name: Optional[str] = Field(None, max_length=255)
    slug: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    parent_id: Optional[int] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None
    icon_url: Optional[str] = Field(None, max_length=500)
    banner_image_url: Optional[str] = Field(None, max_length=500)
    meta_title: Optional[str] = Field(None, max_length=255)
    meta_description: Optional[str] = None


class CategoryResponse(CategoryBase, TimestampSchema):
    """Schema for category response"""

    id: int
    parent_slug: Optional[str] = None  # Computed from parent relationship

    class Config:
        from_attributes = True


class CategoryWithSubcategories(CategoryResponse):
    """Category with subcategories"""

    subcategories: list[CategoryResponse] = []


# ============================================================================
# Product Subcategory Schemas
# ============================================================================


class ProductSubcategoryBase(BaseModel):
    """Base product subcategory schema"""

    name: str = Field(..., max_length=255)
    slug: str = Field(..., max_length=255)
    description: Optional[str] = None
    category_id: int
    display_order: int = 0
    is_active: bool = True


class ProductSubcategoryResponse(ProductSubcategoryBase, TimestampSchema):
    """Schema for product subcategory response"""

    id: int
    product_count: Optional[int] = 0  # Computed field for product count

    class Config:
        from_attributes = True


# ============================================================================
# Product Family Schemas
# ============================================================================


class ProductFamilyBase(BaseModel):
    """Base product family schema"""

    name: str = Field(..., max_length=255)
    slug: str = Field(..., max_length=255)
    description: Optional[str] = None
    category_id: Optional[int] = None
    subcategory_id: Optional[int] = None
    family_image: Optional[str] = Field(None, max_length=500)
    banner_image_url: Optional[str] = Field(None, max_length=500)
    catalog_pdf_url: Optional[str] = Field(None, max_length=500)
    overview_text: Optional[str] = None
    display_order: int = 0
    is_active: bool = True
    is_featured: bool = False


class ProductFamilyResponse(ProductFamilyBase, TimestampSchema):
    """Schema for product family response"""

    id: int
    product_count: Optional[int] = 0  # Computed field for product count

    class Config:
        from_attributes = True


# ============================================================================
# Color Schemas
# ============================================================================


class ColorBase(BaseModel):
    """Base color schema"""

    name: str = Field(..., max_length=100)
    color_code: Optional[str] = Field(None, max_length=50)
    hex_value: Optional[str] = Field(None, max_length=7)
    category: Optional[str] = Field(None, max_length=50)  # wood/metal/fabric/paint
    image_url: Optional[str] = Field(None, max_length=500)
    display_order: int = 0
    is_active: bool = True


class ColorResponse(ColorBase, TimestampSchema):
    """Schema for color response"""

    id: int

    class Config:
        from_attributes = True


# ============================================================================
# Finish Schemas
# ============================================================================


class FinishBase(BaseModel):
    """Base finish schema"""

    name: str = Field(..., max_length=100)
    finish_code: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    finish_type: Optional[str] = Field(None, max_length=50)
    color_hex: Optional[str] = Field(None, max_length=7)
    image_url: Optional[str] = Field(None, max_length=500)
    is_custom: bool = False
    is_to_match: bool = False
    is_active: bool = True
    additional_cost: int = 0  # In cents
    display_order: int = 0


class FinishCreate(FinishBase):
    """Schema for creating a finish"""

    pass


class FinishUpdate(BaseModel):
    """Schema for updating a finish"""

    name: Optional[str] = Field(None, max_length=100)
    finish_code: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    finish_type: Optional[str] = Field(None, max_length=50)
    color_hex: Optional[str] = Field(None, max_length=7)
    image_url: Optional[str] = Field(None, max_length=500)
    is_custom: Optional[bool] = None
    is_to_match: Optional[bool] = None
    is_active: Optional[bool] = None
    additional_cost: Optional[int] = None
    display_order: Optional[int] = None


class FinishResponse(FinishBase, TimestampSchema):
    """Schema for finish response"""

    id: int

    class Config:
        from_attributes = True


# ============================================================================
# Upholstery Schemas
# ============================================================================


class UpholsteryBase(BaseModel):
    """Base upholstery schema"""

    name: str = Field(..., max_length=100)
    material_code: Optional[str] = Field(None, max_length=50)
    material_type: str = Field(..., max_length=50)
    description: Optional[str] = None
    color: Optional[str] = Field(None, max_length=50)
    color_hex: Optional[str] = Field(None, max_length=7)
    pattern: Optional[str] = Field(None, max_length=100)
    grade: Optional[str] = Field(None, max_length=20)
    image_url: Optional[str] = Field(None, max_length=500)
    swatch_image_url: Optional[str] = Field(None, max_length=500)
    is_com: bool = False
    com_requirements: Optional[str] = None
    durability_rating: Optional[str] = Field(None, max_length=50)
    flame_rating: Optional[str] = Field(None, max_length=50)
    cleanability: Optional[str] = Field(None, max_length=50)
    is_active: bool = True
    additional_cost: int = 0  # In cents
    display_order: int = 0


class UpholsteryCreate(UpholsteryBase):
    """Schema for creating upholstery"""

    pass


class UpholsteryUpdate(BaseModel):
    """Schema for updating upholstery"""

    name: Optional[str] = Field(None, max_length=100)
    material_code: Optional[str] = Field(None, max_length=50)
    material_type: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    color: Optional[str] = Field(None, max_length=50)
    color_hex: Optional[str] = Field(None, max_length=7)
    pattern: Optional[str] = Field(None, max_length=100)
    grade: Optional[str] = Field(None, max_length=20)
    image_url: Optional[str] = Field(None, max_length=500)
    swatch_image_url: Optional[str] = Field(None, max_length=500)
    is_com: Optional[bool] = None
    com_requirements: Optional[str] = None
    durability_rating: Optional[str] = Field(None, max_length=50)
    flame_rating: Optional[str] = Field(None, max_length=50)
    cleanability: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None
    additional_cost: Optional[int] = None
    display_order: Optional[int] = None


class UpholsteryResponse(UpholsteryBase, TimestampSchema):
    """Schema for upholstery response"""

    id: int

    class Config:
        from_attributes = True


# ============================================================================
# Chair/Product Schemas
# ============================================================================


class ProductImageItem(BaseModel):
    """Structured product image item"""

    url: str
    type: Optional[str] = None  # side|front|gallery|primary|hover|detail
    order: Optional[int] = None
    alt: Optional[str] = None


class ChairBase(BaseModel):
    """Base chair schema"""

    model_number: str = Field(..., max_length=100)
    name: str = Field(..., max_length=255)
    slug: str = Field(..., max_length=255)
    short_description: Optional[str] = None
    full_description: Optional[str] = None
    category_id: int
    subcategory_id: Optional[int] = None
    base_price: int  # In cents
    msrp: Optional[int] = None  # In cents

    # Dimensions (inches)
    width: Optional[float] = None
    depth: Optional[float] = None
    height: Optional[float] = None
    seat_width: Optional[float] = None
    seat_depth: Optional[float] = None
    seat_height: Optional[float] = None
    arm_height: Optional[float] = None
    back_height: Optional[float] = None
    additional_dimensions: Optional[dict] = None

    # Weight (pounds)
    weight: Optional[float] = None
    shipping_weight: Optional[float] = None

    # Materials & Construction
    frame_material: Optional[str] = Field(None, max_length=100)
    construction_details: Optional[str] = None

    # Features & Options
    features: Optional[list[str]] = None
    available_finishes: Optional[list[int]] = None
    available_upholsteries: Optional[list[int]] = None
    available_colors: Optional[list[int]] = None  # Array of color IDs

    # Images (accepts either list of URLs or list of structured items)
    images: Union[List[str], List[ProductImageItem]]
    primary_image: Optional[str] = Field(None, max_length=500)
    hover_images: Optional[List[str]] = []
    thumbnail: Optional[str] = Field(None, max_length=500)

    # Additional Media
    dimensional_drawing_url: Optional[str] = Field(None, max_length=500)
    cad_file_url: Optional[str] = Field(None, max_length=500)
    spec_sheet_url: Optional[str] = Field(None, max_length=500)

    # Inventory
    stock_status: str = Field("In Stock", max_length=50)
    lead_time_days: Optional[int] = None
    minimum_order_quantity: int = 1

    # Certifications
    flame_certifications: Optional[list[str]] = None
    green_certifications: Optional[list[str]] = None
    ada_compliant: bool = False

    # Usage
    recommended_use: Optional[str] = Field(None, max_length=255)
    is_outdoor_suitable: bool = False
    warranty_info: Optional[str] = None
    care_instructions: Optional[str] = None

    # SEO
    meta_title: Optional[str] = Field(None, max_length=255)
    meta_description: Optional[str] = None
    keywords: Optional[list[str]] = None

    # Status
    is_active: bool = True
    is_featured: bool = False
    is_new: bool = False
    is_custom_only: bool = False
    display_order: int = 0

    model_config = {"from_attributes": True}

    @field_validator("images", mode="before")
    @classmethod
    def validate_images(cls, v):
        """Ensure images is always a list, even if it's an empty string or None"""
        if v is None or v == "" or v == "[]":
            return []
        if isinstance(v, list):
            return v
        # If it's a string like '[]' or JSON, return empty list
        return []


class ChairCreate(ChairBase):
    """Schema for creating a chair"""

    pass


class ChairUpdate(BaseModel):
    """Schema for updating a chair"""

    model_number: Optional[str] = Field(None, max_length=100)
    name: Optional[str] = Field(None, max_length=255)
    slug: Optional[str] = Field(None, max_length=255)
    short_description: Optional[str] = None
    full_description: Optional[str] = None
    category_id: Optional[int] = None
    base_price: Optional[int] = None
    msrp: Optional[int] = None
    width: Optional[float] = None
    depth: Optional[float] = None
    height: Optional[float] = None
    seat_width: Optional[float] = None
    seat_depth: Optional[float] = None
    seat_height: Optional[float] = None
    arm_height: Optional[float] = None
    back_height: Optional[float] = None
    additional_dimensions: Optional[dict] = None
    weight: Optional[float] = None
    shipping_weight: Optional[float] = None
    frame_material: Optional[str] = Field(None, max_length=100)
    construction_details: Optional[str] = None
    features: Optional[list[str]] = None
    available_finishes: Optional[list[int]] = None
    available_upholsteries: Optional[list[int]] = None
    available_colors: Optional[list[int]] = None
    # Accept both URL lists and structured items when updating
    images: Optional[Union[List[str], List[ProductImageItem]]] = None
    primary_image: Optional[str] = Field(None, max_length=500)
    hover_images: Optional[List[str]] = None
    thumbnail: Optional[str] = Field(None, max_length=500)
    dimensional_drawing_url: Optional[str] = Field(None, max_length=500)
    cad_file_url: Optional[str] = Field(None, max_length=500)
    spec_sheet_url: Optional[str] = Field(None, max_length=500)
    stock_status: Optional[str] = Field(None, max_length=50)
    lead_time_days: Optional[int] = None
    minimum_order_quantity: Optional[int] = None
    flame_certifications: Optional[list[str]] = None
    green_certifications: Optional[list[str]] = None
    ada_compliant: Optional[bool] = None
    recommended_use: Optional[str] = Field(None, max_length=255)
    is_outdoor_suitable: Optional[bool] = None
    warranty_info: Optional[str] = None
    care_instructions: Optional[str] = None
    meta_title: Optional[str] = Field(None, max_length=255)
    meta_description: Optional[str] = None
    keywords: Optional[list[str]] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None
    is_new: Optional[bool] = None
    is_custom_only: Optional[bool] = None
    display_order: Optional[int] = None


class ChairResponse(ChairBase, TimestampSchema):
    """Schema for chair response"""

    id: int
    family_id: Optional[int] = None
    view_count: int
    quote_count: int
    # Optional pricing information (only included if company is authenticated)
    adjusted_price: Optional[int] = None  # Price after company tier adjustment
    pricing_tier_name: Optional[str] = None  # Name of applied pricing tier
    pricing_tier_adjustment: Optional[int] = None  # Percentage adjustment applied
    # Customizations object with names (computed from IDs)
    customizations: Optional[dict] = (
        None  # {finishes: [names], colors: [names], fabrics: [names]}
    )

    model_config = {"from_attributes": True}

    @computed_field
    @property
    def last_updated(self) -> datetime:
        """Alias for updated_at"""
        return self.updated_at

    @computed_field
    @property
    def image_base_url(self) -> str:
        """Get the configured base URL for images"""
        return settings.IMAGE_BASE_URL


class ChairDetailResponse(ChairResponse):
    """Detailed chair response with related data"""

    category: Optional[CategoryResponse] = None
    family: Optional[ProductFamilyResponse] = None
    related_products: Optional[list[ChairResponse]] = None


# ============================================================================
# Product Relation Schemas
# ============================================================================


class ProductRelationBase(BaseModel):
    """Base product relation schema"""

    product_id: int
    related_product_id: int
    relation_type: str = Field("related", max_length=50)
    display_order: int = 0


class ProductRelationCreate(ProductRelationBase):
    """Schema for creating product relation"""

    pass


class ProductRelationResponse(ProductRelationBase):
    """Schema for product relation response"""

    id: int

    class Config:
        from_attributes = True


# ============================================================================
# List Response Schemas
# ============================================================================


class CategoryListResponse(BaseModel):
    """Schema for paginated category list"""

    items: list[CategoryResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class FinishListResponse(BaseModel):
    """Schema for paginated finish list"""

    items: list[FinishResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class UpholsteryListResponse(BaseModel):
    """Schema for paginated upholstery list"""

    items: list[UpholsteryResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class ChairListResponse(BaseModel):
    """Schema for paginated chair list"""

    items: list[ChairResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
