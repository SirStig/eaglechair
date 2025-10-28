"""
Company and Admin Schemas - Version 1

Schemas for company accounts and admin users
"""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, validator

from backend.api.v1.schemas.common import TimestampSchema

# ============================================================================
# Enums
# ============================================================================

class CompanyStatusEnum(str, Enum):
    """Company status enumeration"""
    PENDING = "pending"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    INACTIVE = "inactive"


class AdminRoleEnum(str, Enum):
    """Admin role enumeration"""
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"


# ============================================================================
# Company Schemas
# ============================================================================

class CompanyBase(BaseModel):
    """Base company schema"""
    company_name: str = Field(..., max_length=255)
    legal_name: Optional[str] = Field(None, max_length=255)
    tax_id: Optional[str] = Field(None, max_length=50)
    industry: Optional[str] = Field(None, max_length=100)
    website: Optional[str] = Field(None, max_length=255)
    rep_first_name: str = Field(..., max_length=100)
    rep_last_name: str = Field(..., max_length=100)
    rep_title: Optional[str] = Field(None, max_length=100)
    rep_email: EmailStr
    rep_phone: str = Field(..., max_length=20)


class CompanyRegistration(CompanyBase):
    """Schema for company registration"""
    password: str = Field(..., min_length=8)
    
    # Billing Address
    billing_address_line1: str = Field(..., max_length=255)
    billing_address_line2: Optional[str] = Field(None, max_length=255)
    billing_city: str = Field(..., max_length=100)
    billing_state: str = Field(..., max_length=50)
    billing_zip: str = Field(..., max_length=20)
    billing_country: str = Field("USA", max_length=100)
    
    # Shipping Address (optional, can differ from billing)
    shipping_address_line1: Optional[str] = Field(None, max_length=255)
    shipping_address_line2: Optional[str] = Field(None, max_length=255)
    shipping_city: Optional[str] = Field(None, max_length=100)
    shipping_state: Optional[str] = Field(None, max_length=50)
    shipping_zip: Optional[str] = Field(None, max_length=20)
    shipping_country: Optional[str] = Field(None, max_length=100)
    
    @validator('password')
    def password_strength(cls, v):
        """Validate password strength"""
        if not any(char.isdigit() for char in v):
            raise ValueError('Password must contain at least one digit')
        if not any(char.isupper() for char in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(char.islower() for char in v):
            raise ValueError('Password must contain at least one lowercase letter')
        return v


class CompanyUpdate(BaseModel):
    """Schema for updating company information"""
    company_name: Optional[str] = Field(None, max_length=255)
    legal_name: Optional[str] = Field(None, max_length=255)
    tax_id: Optional[str] = Field(None, max_length=50)
    industry: Optional[str] = Field(None, max_length=100)
    website: Optional[str] = Field(None, max_length=255)
    rep_first_name: Optional[str] = Field(None, max_length=100)
    rep_last_name: Optional[str] = Field(None, max_length=100)
    rep_title: Optional[str] = Field(None, max_length=100)
    rep_phone: Optional[str] = Field(None, max_length=20)
    billing_address_line1: Optional[str] = Field(None, max_length=255)
    billing_address_line2: Optional[str] = Field(None, max_length=255)
    billing_city: Optional[str] = Field(None, max_length=100)
    billing_state: Optional[str] = Field(None, max_length=50)
    billing_zip: Optional[str] = Field(None, max_length=20)
    billing_country: Optional[str] = Field(None, max_length=100)
    shipping_address_line1: Optional[str] = Field(None, max_length=255)
    shipping_address_line2: Optional[str] = Field(None, max_length=255)
    shipping_city: Optional[str] = Field(None, max_length=100)
    shipping_state: Optional[str] = Field(None, max_length=50)
    shipping_zip: Optional[str] = Field(None, max_length=20)
    shipping_country: Optional[str] = Field(None, max_length=100)


class CompanyResponse(CompanyBase, TimestampSchema):
    """Schema for company response"""
    id: int
    status: CompanyStatusEnum
    is_verified: bool
    is_active: bool
    billing_address_line1: str
    billing_address_line2: Optional[str]
    billing_city: str
    billing_state: str
    billing_zip: str
    billing_country: str
    shipping_address_line1: Optional[str]
    shipping_address_line2: Optional[str]
    shipping_city: Optional[str]
    shipping_state: Optional[str]
    shipping_zip: Optional[str]
    shipping_country: Optional[str]
    resale_certificate: Optional[str]
    credit_limit: Optional[int]
    payment_terms: Optional[str]
    additional_contacts: Optional[dict]
    
    class Config:
        from_attributes = True


class CompanyLoginRequest(BaseModel):
    """Schema for company login"""
    email: EmailStr
    password: str


# ============================================================================
# Admin User Schemas
# ============================================================================

class AdminUserBase(BaseModel):
    """Base admin user schema"""
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    role: AdminRoleEnum = AdminRoleEnum.EDITOR


class AdminUserCreate(AdminUserBase):
    """Schema for creating admin user"""
    password: str = Field(..., min_length=8)
    whitelisted_ips: Optional[list[str]] = None
    
    @validator('password')
    def password_strength(cls, v):
        """Validate password strength"""
        if not any(char.isdigit() for char in v):
            raise ValueError('Password must contain at least one digit')
        if not any(char.isupper() for char in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(char.islower() for char in v):
            raise ValueError('Password must contain at least one lowercase letter')
        return v


class AdminUserUpdate(BaseModel):
    """Schema for updating admin user"""
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    role: Optional[AdminRoleEnum] = None
    is_active: Optional[bool] = None
    is_2fa_enabled: Optional[bool] = None
    whitelisted_ips: Optional[list[str]] = None


class AdminUserResponse(AdminUserBase, TimestampSchema):
    """Schema for admin user response"""
    id: int
    is_active: bool
    is_2fa_enabled: bool
    whitelisted_ips: Optional[list[str]]
    last_login: Optional[str]
    last_login_ip: Optional[str]
    last_activity: Optional[str]
    
    class Config:
        from_attributes = True


class AdminLoginRequest(BaseModel):
    """Schema for admin login"""
    username: str
    password: str
    two_factor_code: Optional[str] = None


class AdminTokenResponse(BaseModel):
    """Schema for admin token response"""
    access_token: str
    refresh_token: str
    admin_token: str
    session_token: str
    token_type: str = "bearer"


# ============================================================================
# Auth Schemas
# ============================================================================

class TokenResponse(BaseModel):
    """Schema for authentication token response"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class PasswordChangeRequest(BaseModel):
    """Schema for password change"""
    current_password: str
    new_password: str = Field(..., min_length=8)
    
    @validator('new_password')
    def password_strength(cls, v):
        """Validate password strength"""
        if not any(char.isdigit() for char in v):
            raise ValueError('Password must contain at least one digit')
        if not any(char.isupper() for char in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(char.islower() for char in v):
            raise ValueError('Password must contain at least one lowercase letter')
        return v


class PasswordResetRequest(BaseModel):
    """Schema for password reset request"""
    email: EmailStr


class PasswordReset(BaseModel):
    """Schema for password reset (with token)"""
    token: str
    new_password: str = Field(..., min_length=8)
    
    @validator('new_password')
    def password_strength(cls, v):
        """Validate password strength"""
        if not any(char.isdigit() for char in v):
            raise ValueError('Password must contain at least one digit')
        if not any(char.isupper() for char in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(char.islower() for char in v):
            raise ValueError('Password must contain at least one lowercase letter')
        return v


# ============================================================================
# Audit Log Schemas
# ============================================================================

class AdminAuditLogBase(BaseModel):
    """Base admin audit log schema"""
    action: str = Field(..., max_length=255)
    resource_type: str = Field(..., max_length=100)
    resource_id: Optional[int] = None
    details: Optional[dict] = None
    ip_address: Optional[str] = Field(None, max_length=50)
    user_agent: Optional[str] = Field(None, max_length=500)


class AdminAuditLogResponse(AdminAuditLogBase):
    """Schema for admin audit log response"""
    id: int
    admin_id: int
    timestamp: str
    
    class Config:
        from_attributes = True


# ============================================================================
# List Response Schemas
# ============================================================================

class CompanyListResponse(BaseModel):
    """Schema for paginated company list"""
    items: list[CompanyResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class AdminUserListResponse(BaseModel):
    """Schema for paginated admin user list"""
    items: list[AdminUserResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

