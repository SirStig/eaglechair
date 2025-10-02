"""
EagleChair Company and Admin User Models

Models for company accounts (B2B customers) and admin users with enhanced security
"""

from sqlalchemy import Column, Integer, String, Boolean, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy import Enum as SQLEnum
import enum

from backend.database.base import Base


class CompanyStatus(str, enum.Enum):
    """Company account status"""
    PENDING = "pending"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    INACTIVE = "inactive"


class Company(Base):
    """
    Company/Business account model (B2B customers)
    Only companies can create accounts and request quotes
    """
    __tablename__ = "companies"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Company Information
    company_name = Column(String(255), nullable=False, index=True)
    legal_name = Column(String(255), nullable=True)
    tax_id = Column(String(50), nullable=True)  # EIN or Tax ID
    industry = Column(String(100), nullable=True)
    website = Column(String(255), nullable=True)
    
    # Primary Contact/Representative
    rep_first_name = Column(String(100), nullable=False)
    rep_last_name = Column(String(100), nullable=False)
    rep_title = Column(String(100), nullable=True)  # e.g., "Purchasing Manager"
    rep_email = Column(String(255), unique=True, index=True, nullable=False)
    rep_phone = Column(String(20), nullable=False)
    
    # Authentication
    hashed_password = Column(String(255), nullable=False)
    
    # Business Address
    billing_address_line1 = Column(String(255), nullable=False)
    billing_address_line2 = Column(String(255), nullable=True)
    billing_city = Column(String(100), nullable=False)
    billing_state = Column(String(50), nullable=False)
    billing_zip = Column(String(20), nullable=False)
    billing_country = Column(String(100), default="USA", nullable=False)
    
    # Shipping Address (can be different from billing)
    shipping_address_line1 = Column(String(255), nullable=True)
    shipping_address_line2 = Column(String(255), nullable=True)
    shipping_city = Column(String(100), nullable=True)
    shipping_state = Column(String(50), nullable=True)
    shipping_zip = Column(String(20), nullable=True)
    shipping_country = Column(String(100), nullable=True)
    
    # Account Status
    status = Column(SQLEnum(CompanyStatus), default=CompanyStatus.PENDING, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Business Details
    resale_certificate = Column(String(100), nullable=True)
    credit_limit = Column(Integer, nullable=True)  # In cents
    payment_terms = Column(String(100), nullable=True)  # e.g., "Net 30"
    
    # Additional contacts (stored as JSON array)
    additional_contacts = Column(JSON, nullable=True)
    
    # Notes (admin use only)
    admin_notes = Column(Text, nullable=True)
    
    # Relationships
    quotes = relationship("Quote", back_populates="company")
    carts = relationship("Cart", back_populates="company")
    
    def __repr__(self) -> str:
        return f"<Company(id={self.id}, name={self.company_name}, status={self.status})>"


class AdminRole(str, enum.Enum):
    """Admin role enumeration"""
    SUPER_ADMIN = "super_admin"  # Full access
    ADMIN = "admin"  # Most access
    EDITOR = "editor"  # Can edit content
    VIEWER = "viewer"  # Read-only access


class AdminUser(Base):
    """
    Admin user model with enhanced security
    """
    __tablename__ = "admin_users"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Basic Info
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    
    # Role and Permissions
    role = Column(SQLEnum(AdminRole), default=AdminRole.EDITOR, nullable=False)
    
    # Security
    is_active = Column(Boolean, default=True, nullable=False)
    is_2fa_enabled = Column(Boolean, default=False, nullable=False)
    two_factor_secret = Column(String(255), nullable=True)
    
    # IP Whitelisting (optional, stored as JSON array of IPs)
    whitelisted_ips = Column(JSON, nullable=True)
    
    # Session Management
    session_token = Column(String(255), nullable=True, unique=True)
    admin_token = Column(String(255), nullable=True, unique=True)
    last_login = Column(String(50), nullable=True)
    last_login_ip = Column(String(50), nullable=True)
    
    # Password Reset
    password_reset_token = Column(String(255), nullable=True)
    password_reset_expires = Column(String(50), nullable=True)
    
    # Failed login tracking
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(String(50), nullable=True)
    
    # Audit Trail
    last_activity = Column(String(50), nullable=True)
    
    def __repr__(self) -> str:
        return f"<AdminUser(id={self.id}, username={self.username}, role={self.role})>"


class AdminAuditLog(Base):
    """
    Audit log for admin actions
    Tracks all admin activities for security and compliance
    """
    __tablename__ = "admin_audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey("admin_users.id"), nullable=False)
    action = Column(String(255), nullable=False)  # e.g., "UPDATE_PRODUCT", "DELETE_FAQ"
    resource_type = Column(String(100), nullable=False)  # e.g., "product", "faq", "legal_document"
    resource_id = Column(Integer, nullable=True)
    details = Column(JSON, nullable=True)  # Additional context
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)
    timestamp = Column(String(50), nullable=False)
    
    def __repr__(self) -> str:
        return f"<AdminAuditLog(id={self.id}, admin_id={self.admin_id}, action={self.action})>"

