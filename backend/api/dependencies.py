"""
FastAPI Dependencies

Reusable dependencies for authentication, authorization, and database access
"""

import logging
from typing import Optional

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.exceptions import (
    AuthenticationError,
    AuthorizationError,
    InsufficientPermissionsError,
    InvalidTokenError,
    TokenExpiredError,
)
from backend.core.security import security_manager
from backend.database.base import get_db
from backend.models.company import AdminRole, AdminUser, Company, CompanyStatus
from backend.models.content import SiteSettings

logger = logging.getLogger(__name__)

# HTTP Bearer token scheme
security = HTTPBearer()


async def get_current_token_payload(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
) -> dict:
    """
    Extract and validate JWT token from cookie (preferred) or Authorization header (fallback)
    
    Returns:
        Decoded token payload
        
    Raises:
        InvalidTokenError: If token is invalid
        TokenExpiredError: If token has expired
    """
    # Try cookie first (new preferred method)
    token = request.cookies.get("access_token")
    
    # Fallback to Authorization header (backward compatibility)
    if not token and credentials:
        token = credentials.credentials
    
    if not token:
        raise InvalidTokenError("No authentication token provided")
    
    try:
        payload = security_manager.decode_token(token)
        return payload
    except Exception as e:
        logger.warning(f"Token validation failed: {str(e)}")
        if "expired" in str(e).lower():
            raise TokenExpiredError()
        raise InvalidTokenError()


async def get_current_token_and_payload(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
) -> tuple[str, dict]:
    """
    Extract JWT token and its decoded payload from cookie (preferred) or Authorization header (fallback)
    
    Returns:
        Tuple of (raw_token, decoded_payload)
        
    Raises:
        InvalidTokenError: If token is invalid
        TokenExpiredError: If token has expired
    """
    # Try cookie first (new preferred method)
    token = request.cookies.get("access_token")
    
    # Fallback to Authorization header (backward compatibility)
    if not token and credentials:
        token = credentials.credentials
    
    if not token:
        raise InvalidTokenError("No authentication token provided")
    
    try:
        payload = security_manager.decode_token(token)
        return token, payload
    except Exception as e:
        logger.warning(f"Token validation failed: {str(e)}")
        if "expired" in str(e).lower():
            raise TokenExpiredError()
        raise InvalidTokenError()


async def get_current_company(
    request: Request,
    token_payload: dict = Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db)
) -> Company:
    """
    Get current authenticated company from token
    
    Also accepts admin tokens if X-Session-Token and X-Admin-Token headers are present.
    For admin tokens, returns a special admin company context.
    
    Returns:
        Current company account (or admin company proxy)
        
    Raises:
        AuthenticationError: If company not found or inactive, or admin tokens invalid
    """
    token_type = token_payload.get("type")
    
    # Handle company token (normal flow)
    if token_type == "company":
        company_id = int(token_payload.get("sub"))
        
        # Fetch company
        result = await db.execute(
            select(Company).where(Company.id == company_id)
        )
        company = result.scalar_one_or_none()
        
        if not company:
            logger.warning(f"Company not found for token: {company_id}")
            raise AuthenticationError("Company account not found")
        
        if not company.is_active:
            logger.warning(f"Inactive company attempted access: {company_id}")
            raise AuthenticationError("Company account is inactive")
        
        return company
    
    # Handle admin token - check for admin tokens in cookies (preferred) or headers (fallback)
    elif token_type == "admin":
        session_token = request.cookies.get("session_token") or request.headers.get("X-Session-Token")
        admin_token = request.cookies.get("admin_token") or request.headers.get("X-Admin-Token")
        
        if not session_token or not admin_token:
            raise AuthenticationError(
                "Admin access requires both session token and admin token (from cookies or headers)."
            )
        
        admin_id = int(token_payload.get("sub"))
        
        # Fetch and validate admin
        result = await db.execute(
            select(AdminUser).where(AdminUser.id == admin_id)
        )
        admin = result.scalar_one_or_none()
        
        if not admin:
            logger.warning(f"Admin not found for token: {admin_id}")
            raise AuthenticationError("Admin account not found")
        
        if not admin.is_active:
            logger.warning(f"Inactive admin attempted access: {admin_id}")
            raise AuthenticationError("Admin account is inactive")
        
        # Validate session and admin tokens (compare hashed stored tokens with provided tokens)
        from backend.core.security import security_manager
        
        # Verify provided tokens against hashed stored tokens
        session_valid = security_manager.verify_password(session_token, admin.session_token) if admin.session_token else False
        admin_token_valid = security_manager.verify_password(admin_token, admin.admin_token) if admin.admin_token else False
        
        if not session_valid or not admin_token_valid:
            logger.warning(
                f"Invalid admin tokens for admin {admin_id}. "
                f"Token validation failed."
            )
            raise AuthenticationError("Invalid admin tokens")
        
        # Check for optional company_id query param for admin access (highest priority)
        company_id_param = request.query_params.get("company_id")
        if company_id_param:
            try:
                company_id = int(company_id_param)
                result = await db.execute(
                    select(Company).where(Company.id == company_id)
                )
                company = result.scalar_one_or_none()
                
                if not company:
                    logger.warning(f"Admin {admin.username} attempted to access non-existent company: {company_id}")
                    raise AuthenticationError("Company not found")
                
                logger.info(f"Admin {admin.username} accessing company route for company {company_id}")
                return company
            except ValueError:
                raise AuthenticationError("Invalid company_id parameter")
        
        # Try to find company by admin's email (seed script creates companies for admins)
        result = await db.execute(
            select(Company).where(Company.rep_email == admin.email)
        )
        company = result.scalar_one_or_none()
        
        if company:
            logger.info(f"Admin {admin.username} using associated company (email match): {company.id}")
            return company
        
        # No company found - fallback to SiteSettings
        # Create a Company proxy from SiteSettings data
        logger.info(
            f"Admin {admin.username} (ID: {admin_id}) has no associated company. "
            "Creating company context from SiteSettings."
        )
        
        result = await db.execute(select(SiteSettings).limit(1))
        site_settings = result.scalar_one_or_none()
        
        if not site_settings:
            logger.error("SiteSettings not found - cannot create admin company context")
            raise AuthenticationError(
                "No company found for admin and SiteSettings not configured. "
                "Please contact support."
            )
        
        # Create a Company instance from SiteSettings (not saved to DB)
        # Map SiteSettings fields to Company fields
        admin_company = Company(
            id=0,  # Special ID to indicate admin company
            company_name=site_settings.company_name or "Admin Company",
            legal_name=site_settings.company_name or "Admin Company",
            rep_email=admin.email,
            rep_first_name=admin.first_name,
            rep_last_name=admin.last_name,
            rep_phone=admin.phone or site_settings.primary_phone or "",
            rep_title="Administrator",
            website=site_settings.facebook_url or "",  # Use available URL field
            industry="Administration",
            billing_address_line1=site_settings.address_line1 or "",
            billing_address_line2=site_settings.address_line2 or "",
            billing_city=site_settings.city or "",
            billing_state=site_settings.state or "",
            billing_zip=site_settings.zip_code or "",
            billing_country=site_settings.country or "USA",
            shipping_address_line1=site_settings.address_line1 or "",
            shipping_address_line2=site_settings.address_line2 or "",
            shipping_city=site_settings.city or "",
            shipping_state=site_settings.state or "",
            shipping_zip=site_settings.zip_code or "",
            shipping_country=site_settings.country or "USA",
            status=CompanyStatus.ACTIVE,
            is_verified=True,
            is_active=True,
            hashed_password="",  # Not needed for admin access
        )
        
        logger.info(f"Created admin company context from SiteSettings for admin {admin.username}")
        return admin_company
    
    # Unknown token type
    else:
        raise AuthenticationError("Invalid token type. Company or admin authentication required.")


async def get_current_admin(
    request: Request,
    token_payload: dict = Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db)
) -> AdminUser:
    """
    Get current authenticated admin from token
    
    Requires additional validation (session token, admin token)
    
    Returns:
        Current admin user
        
    Raises:
        AuthenticationError: If admin not found or tokens invalid
    """
    # Verify it's an admin token
    if token_payload.get("type") != "admin":
        raise AuthenticationError("Invalid token type. Admin authentication required.")
    
    admin_id = int(token_payload.get("sub"))
    
    # Fetch admin
    result = await db.execute(
        select(AdminUser).where(AdminUser.id == admin_id)
    )
    admin = result.scalar_one_or_none()
    
    if not admin:
        logger.warning(f"Admin not found for token: {admin_id}")
        raise AuthenticationError("Admin account not found")
    
    if not admin.is_active:
        logger.warning(f"Inactive admin attempted access: {admin_id}")
        raise AuthenticationError("Admin account is inactive")
    
    # Validate session_token and admin_token from cookies (preferred) or headers (fallback)
    session_token = request.cookies.get("session_token") or request.headers.get("X-Session-Token")
    admin_token = request.cookies.get("admin_token") or request.headers.get("X-Admin-Token")
    
    if not session_token or not admin_token:
        logger.warning(f"Missing admin tokens for admin {admin_id}")
        raise AuthenticationError("Admin session tokens required")
    
    # Validate tokens against hashed stored tokens
    from backend.core.security import security_manager
    
    session_valid = security_manager.verify_password(session_token, admin.session_token) if admin.session_token else False
    admin_token_valid = security_manager.verify_password(admin_token, admin.admin_token) if admin.admin_token else False
    
    if not session_valid or not admin_token_valid:
        logger.warning(
            f"Invalid admin tokens for admin {admin_id}. Token validation failed."
        )
        raise AuthenticationError("Invalid admin tokens")
    
    return admin


async def get_optional_company(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: AsyncSession = Depends(get_db)
) -> Optional[Company]:
    """
    Get current company if authenticated, None otherwise
    
    Useful for endpoints that work differently for authenticated vs anonymous users
    """
    if not credentials:
        return None
    
    try:
        payload = security_manager.decode_token(credentials.credentials)
        
        if payload.get("type") != "company":
            return None
        
        company_id = int(payload.get("sub"))
        result = await db.execute(
            select(Company).where(Company.id == company_id, Company.is_active)
        )
        return result.scalar_one_or_none()
    except Exception:
        return None


def require_role(required_role: AdminRole):
    """
    Dependency to require specific admin role
    
    Usage:
        @router.get("/admin-only")
        async def admin_endpoint(
            admin: AdminUser = Depends(require_role(AdminRole.ADMIN))
        ):
            ...
    """
    async def role_checker(
        admin: AdminUser = Depends(get_current_admin)
    ) -> AdminUser:
        # Role hierarchy check
        role_hierarchy = {
            AdminRole.VIEWER: 1,
            AdminRole.EDITOR: 2,
            AdminRole.ADMIN: 3,
            AdminRole.SUPER_ADMIN: 4,
        }
        
        admin_level = role_hierarchy.get(admin.role, 0)
        required_level = role_hierarchy.get(required_role, 999)
        
        if admin_level < required_level:
            logger.warning(
                f"Insufficient permissions: Admin {admin.id} ({admin.role.value}) "
                f"attempted to access {required_role.value} endpoint"
            )
            raise InsufficientPermissionsError(required_role=required_role.value)
        
        return admin
    
    return role_checker


async def get_company_from_id(
    company_id: int,
    db: AsyncSession = Depends(get_db)
) -> Company:
    """
    Get company by ID (admin use)
    
    Args:
        company_id: Company ID
        db: Database session
        
    Returns:
        Company account
        
    Raises:
        ResourceNotFoundError: If company not found
    """
    from backend.core.exceptions import ResourceNotFoundError
    
    result = await db.execute(
        select(Company).where(Company.id == company_id)
    )
    company = result.scalar_one_or_none()
    
    if not company:
        raise ResourceNotFoundError(resource_type="Company", resource_id=company_id)
    
    return company


class PermissionChecker:
    """
    Permission checker for custom permission logic
    
    Usage:
        can_edit_quote = PermissionChecker(
            lambda company, quote: quote.company_id == company.id
        )
        
        @router.patch("/quotes/{quote_id}")
        async def update_quote(
            quote: Quote,
            company: Company = Depends(get_current_company),
            _: bool = Depends(can_edit_quote)
        ):
            ...
    """
    
    def __init__(self, permission_func):
        self.permission_func = permission_func
    
    async def __call__(self, *args, **kwargs) -> bool:
        if not await self.permission_func(*args, **kwargs):
            raise AuthorizationError()
        return True

