"""
FastAPI Dependencies

Reusable dependencies for authentication, authorization, and database access
"""

import logging
from typing import Optional

from fastapi import Depends
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
from backend.models.company import AdminRole, AdminUser, Company

logger = logging.getLogger(__name__)

# HTTP Bearer token scheme
security = HTTPBearer()


async def get_current_token_payload(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    Extract and validate JWT token from Authorization header
    
    Returns:
        Decoded token payload
        
    Raises:
        InvalidTokenError: If token is invalid
        TokenExpiredError: If token has expired
    """
    try:
        token = credentials.credentials
        payload = security_manager.decode_token(token)
        return payload
    except Exception as e:
        logger.warning(f"Token validation failed: {str(e)}")
        if "expired" in str(e).lower():
            raise TokenExpiredError()
        raise InvalidTokenError()


async def get_current_token_and_payload(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> tuple[str, dict]:
    """
    Extract JWT token and its decoded payload from Authorization header
    
    Returns:
        Tuple of (raw_token, decoded_payload)
        
    Raises:
        InvalidTokenError: If token is invalid
        TokenExpiredError: If token has expired
    """
    try:
        token = credentials.credentials
        payload = security_manager.decode_token(token)
        return token, payload
    except Exception as e:
        logger.warning(f"Token validation failed: {str(e)}")
        if "expired" in str(e).lower():
            raise TokenExpiredError()
        raise InvalidTokenError()


async def get_current_company(
    token_payload: dict = Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db)
) -> Company:
    """
    Get current authenticated company from token
    
    Returns:
        Current company account
        
    Raises:
        AuthenticationError: If company not found or inactive
    """
    # Verify it's a company token
    if token_payload.get("type") != "company":
        raise AuthenticationError("Invalid token type. Company authentication required.")
    
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


async def get_current_admin(
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
    
    # Note: Session and admin token validation removed from here
    # It should be done via middleware for admin routes
    # Individual routes can check if needed
    
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

