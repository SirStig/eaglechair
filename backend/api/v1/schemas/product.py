"""
Product Schemas - Version 1

Schemas for chairs, categories, finishes, and upholsteries
"""

import json
from datetime import datetime
from typing import Any, List, Optional, Union

from pydantic import BaseModel, Field, computed_field, field_validator, model_validator

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


class CategoryChildAdminResponse(CategoryResponse):
    """
    A child of a category in the admin UI.

    ``type`` says which table the row lives in: "subcategory" for
    ``product_subcategories`` rows, "category" for nested categories. The
    admin UI needs it to know which endpoint to edit/delete the row through.
    """

    type: str = "subcategory"
    subcategories: list["CategoryChildAdminResponse"] = []


class CategoryWithSubcategories(CategoryResponse):
    """Category with subcategories"""

    type: str = "category"
    subcategories: list[CategoryChildAdminResponse] = []


class CategoryChildResponse(BaseModel):
    """
    A child of a category, as presented to the storefront.

    A category can have children in two ways: rows in ``product_subcategories``
    (``type == "subcategory"``) and nested categories, i.e. categories with a
    ``parent_id`` (``type == "category"``). Both are rendered as children of
    their parent; neither may be listed as a primary category.
    """

    id: int
    name: str
    slug: str
    description: Optional[str] = None
    category_id: int  # Parent category ID
    display_order: int = 0
    is_active: bool = True
    type: str = "subcategory"  # "subcategory" | "category"
    product_count: Optional[int] = 0
    icon_url: Optional[str] = None
    banner_image_url: Optional[str] = None

    class Config:
        from_attributes = True


class CategoryWithChildren(CategoryResponse):
    """Top-level category with its children (subcategories + nested categories)"""

    subcategories: list[CategoryChildResponse] = []


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
    product_count: Optional[int] = 0
    category_name: Optional[str] = None
    subcategory_name: Optional[str] = None

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
    grade: str = Field("Standard", max_length=20)
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
    grade: Optional[str] = Field(None, max_length=20)
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
    model_suffix: Optional[str] = Field(None, max_length=50)
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
    upholstery_amount: Optional[float] = None  # Yards of upholstery used when product uses it

    # Images (accepts either list of URLs or list of structured items)
    images: Union[List[str], List[ProductImageItem]]
    primary_image: Optional[str] = Field(None, max_length=500)
    primary_image_url: Optional[str] = Field(None, max_length=500)
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
        if v is None or v == "" or v == "[]":
            return []
        if isinstance(v, list):
            return v
        return []

    @field_validator("hover_images", mode="before")
    @classmethod
    def validate_hover_images(cls, v):
        if v is None or v == "" or v == "[]":
            return []
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, list) else []
            except (ValueError, TypeError):
                return []
        return []

    @model_validator(mode="after")
    def set_primary_image_from_url(self):
        if self.primary_image is None and self.primary_image_url:
            return self.model_copy(update={"primary_image": self.primary_image_url})
        return self


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
    upholstery_amount: Optional[float] = None
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
    # Every category / subcategory the product is listed under, primary first
    categories: Optional[list[CategoryResponse]] = None
    subcategories: Optional[list[ProductSubcategoryResponse]] = None
    category_ids: Optional[list[int]] = None
    subcategory_ids: Optional[list[int]] = None
    family_id: Optional[int] = None
    variation_id: Optional[int] = None
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

    @model_validator(mode="after")
    def populate_category_ids(self):
        """
        Derive the flat ID lists from the loaded relationships, keeping the
        primary category / subcategory first.
        """
        category_ids = [c.id for c in (self.categories or [])]
        if self.category_id is not None:
            category_ids = [self.category_id] + [
                cid for cid in category_ids if cid != self.category_id
            ]
        self.category_ids = category_ids

        subcategory_ids = [s.id for s in (self.subcategories or [])]
        if self.subcategory_id is not None:
            subcategory_ids = [self.subcategory_id] + [
                sid for sid in subcategory_ids if sid != self.subcategory_id
            ]
        self.subcategory_ids = subcategory_ids

        return self

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
