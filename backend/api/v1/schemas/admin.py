"""
Admin Schemas

Pydantic schemas for admin operations
"""

from datetime import datetime
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
    """Create product request"""
    
    name: str = Field(..., min_length=1, max_length=255, description="Product name")
    description: Optional[str] = Field(None, description="Product description")
    model_number: str = Field(..., min_length=1, max_length=100, description="Model number")
    category_id: Optional[int] = Field(None, description="Category ID")
    base_price: int = Field(..., ge=0, description="Base price in cents")
    minimum_order_quantity: int = Field(1, ge=1, description="Minimum order quantity")
    is_active: bool = Field(True, description="Is product active")
    specifications: Optional[Dict[str, Any]] = Field(None, description="Product specifications")
    features: Optional[List[str]] = Field(None, description="Product features")
    dimensions: Optional[Dict[str, Any]] = Field(None, description="Product dimensions")
    weight: Optional[float] = Field(None, ge=0, description="Product weight")
    materials: Optional[List[str]] = Field(None, description="Materials used")
    colors: Optional[List[str]] = Field(None, description="Available colors")
    images: Optional[List[str]] = Field(None, description="Product images")
    certifications: Optional[Dict[str, Any]] = Field(None, description="Certifications")


class ProductUpdate(BaseModel):
    """Update product request"""
    
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Product name")
    description: Optional[str] = Field(None, description="Product description")
    model_number: Optional[str] = Field(None, min_length=1, max_length=100, description="Model number")
    category_id: Optional[int] = Field(None, description="Category ID")
    base_price: Optional[int] = Field(None, ge=0, description="Base price in cents")
    minimum_order_quantity: Optional[int] = Field(None, ge=1, description="Minimum order quantity")
    is_active: Optional[bool] = Field(None, description="Is product active")
    specifications: Optional[Dict[str, Any]] = Field(None, description="Product specifications")
    features: Optional[List[str]] = Field(None, description="Product features")
    dimensions: Optional[Dict[str, Any]] = Field(None, description="Product dimensions")
    weight: Optional[float] = Field(None, ge=0, description="Product weight")
    materials: Optional[List[str]] = Field(None, description="Materials used")
    colors: Optional[List[str]] = Field(None, description="Available colors")
    images: Optional[List[str]] = Field(None, description="Product images")
    certifications: Optional[Dict[str, Any]] = Field(None, description="Certifications")


class ProductListResponse(BaseModel):
    """Product list response"""
    
    items: List[Dict[str, Any]] = Field(..., description="List of products")
    total: int = Field(..., description="Total number of products")
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Items per page")
    pages: int = Field(..., description="Total number of pages")
