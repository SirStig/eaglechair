"""
Common Schemas - Version 1

Shared schemas used across multiple resources
"""

from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field, field_validator

from backend.utils.validators import validate_cms_image_url, validate_cms_link


# ============================================================================
# CMS URL Validation
# ============================================================================

# Link fields: http(s), mailto:, tel: or a site-relative "/path"
CMS_LINK_FIELDS = (
    "cta_link",
    "secondary_cta_link",
    "website_url",
    "linkedin_url",
    "facebook_url",
    "instagram_url",
    "twitter_url",
    "youtube_url",
    "video_url",
    "map_embed_url",
)

# Image fields: http(s) or a relative path such as "/uploads/images/..."
CMS_IMAGE_FIELDS = (
    "image_url",
    "photo_url",
    "logo_url",
    "logo_dark_url",
    "favicon_url",
    "background_image_url",
    "primary_image",
)


class CMSUrlValidationMixin(BaseModel):
    """
    Validates the CMS link/image fields a request schema declares.

    Only for request (create/update) schemas: response schemas must not
    reject URLs already stored in the database.
    """

    @field_validator(*CMS_LINK_FIELDS, check_fields=False)
    @classmethod
    def _validate_cms_link(cls, v: Any) -> Any:
        return validate_cms_link(v) if isinstance(v, str) else v

    @field_validator(*CMS_IMAGE_FIELDS, check_fields=False)
    @classmethod
    def _validate_cms_image(cls, v: Any) -> Any:
        return validate_cms_image_url(v) if isinstance(v, str) else v

    @field_validator("images", check_fields=False)
    @classmethod
    def _validate_cms_images(cls, v: Any) -> Any:
        if isinstance(v, list):
            for item in v:
                url = item if isinstance(item, str) else getattr(item, "url", None)
                if isinstance(url, str):
                    validate_cms_image_url(url)
        return v


# ============================================================================
# Base Schemas with Timestamps
# ============================================================================

class TimestampSchema(BaseModel):
    """Base schema with timestamps"""
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# ============================================================================
# Generic Response Schemas
# ============================================================================

class MessageResponse(BaseModel):
    """Generic message response"""
    message: str
    detail: Optional[str] = None


class CMSWriteResponse(MessageResponse):
    """
    Response for CMS admin writes.

    ``exported`` is False when the database write succeeded but publishing
    to the live site (contentData.json) failed.
    """
    exported: bool = True


class SuccessResponse(BaseModel):
    """Generic success response"""
    success: bool = True
    message: str
    data: Optional[dict] = None


class ErrorResponse(BaseModel):
    """Generic error response"""
    success: bool = False
    error: str
    detail: Optional[str] = None
    code: Optional[str] = None


class HealthCheckResponse(BaseModel):
    """Health check response"""
    status: str
    service: str
    version: str
    database: str = "connected"
    cache: str = "connected"


# ============================================================================
# Pagination Schemas
# ============================================================================

class PaginationParams(BaseModel):
    """Pagination query parameters"""
    page: int = Field(1, ge=1, description="Page number")
    page_size: int = Field(20, ge=1, le=100, description="Items per page")


class PaginatedResponse(BaseModel):
    """Base paginated response"""
    total: int
    page: int
    page_size: int
    total_pages: int
    
    @staticmethod
    def calculate_total_pages(total: int, page_size: int) -> int:
        """Calculate total pages"""
        return (total + page_size - 1) // page_size


# ============================================================================
# File/Media Schemas
# ============================================================================

class FileInfo(BaseModel):
    """File information schema"""
    filename: str
    url: str
    file_type: str
    file_size: Optional[int] = None  # In bytes
    uploaded_at: Optional[datetime] = None


class ImageInfo(BaseModel):
    """Image information schema"""
    url: str
    thumbnail_url: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    alt_text: Optional[str] = None


# ============================================================================
# Search & Filter Schemas
# ============================================================================

class SearchParams(BaseModel):
    """Search query parameters"""
    q: Optional[str] = Field(None, description="Search query")
    search_fields: Optional[list[str]] = Field(None, description="Fields to search")


class SortParams(BaseModel):
    """Sort query parameters"""
    sort_by: Optional[str] = Field(None, description="Field to sort by")
    sort_order: Optional[str] = Field("asc", description="Sort order: asc or desc")


# ============================================================================
# Address Schema
# ============================================================================

class AddressBase(BaseModel):
    """Base address schema"""
    address_line1: str = Field(..., max_length=255)
    address_line2: Optional[str] = Field(None, max_length=255)
    city: str = Field(..., max_length=100)
    state: str = Field(..., max_length=50)
    zip_code: str = Field(..., max_length=20)
    country: str = Field("USA", max_length=100)


class AddressResponse(AddressBase):
    """Address response schema"""
    pass

