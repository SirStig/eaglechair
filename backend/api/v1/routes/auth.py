"""
Authentication Routes - API v1

Handles company and admin authentication
"""

import logging
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.base import get_db
from backend.services.auth_service import AuthService
from backend.api.v1.schemas.company import (
    CompanyRegistration,
    CompanyResponse,
    CompanyLoginRequest,
    TokenResponse,
    AdminLoginRequest,
    AdminTokenResponse,
    PasswordChangeRequest,
)
from backend.api.v1.schemas.common import MessageResponse
from backend.api.dependencies import get_current_token_payload, get_current_company, get_current_admin
from backend.models.company import Company, AdminUser
from backend.core.middleware.rate_limiter import RateLimitConfig


logger = logging.getLogger(__name__)

router = APIRouter(tags=["Authentication"])


# ============================================================================
# Company Authentication
# ============================================================================

@router.post(
    "/auth/register",
    response_model=CompanyResponse,
    status_code=201,
    summary="Register new company account",
    description="Register a new B2B company account. Account will be pending until approved by admin."
)
async def register_company(
    registration_data: CompanyRegistration,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Register a new company account.
    
    **Note**: The account status will be 'pending' until approved by an administrator.
    """
    logger.info(f"New company registration request: {registration_data.company_name}")
    
    # Extract company data
    company_data = registration_data.model_dump(exclude={"password"})
    
    # Register company
    company = await AuthService.register_company(
        db=db,
        email=registration_data.rep_email,
        password=registration_data.password,
        company_data=company_data
    )
    
    logger.info(f"Company registered successfully: {company.company_name} (ID: {company.id})")
    
    return company


@router.post(
    "/auth/login",
    response_model=TokenResponse,
    summary="Company login",
    description="Authenticate company and receive access tokens."
)
async def login_company(
    login_data: CompanyLoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Authenticate company and generate JWT tokens.
    
    Returns access token and refresh token. Use access token in Authorization header
    as `Bearer <token>` for protected endpoints.
    """
    client_ip = request.client.host if request.client else None
    
    logger.info(f"Company login attempt: {login_data.email}")
    
    # Authenticate company
    company, tokens = await AuthService.authenticate_company(
        db=db,
        email=login_data.email,
        password=login_data.password,
        ip_address=client_ip
    )
    
    return tokens


@router.post(
    "/auth/refresh",
    response_model=TokenResponse,
    summary="Refresh access token",
    description="Use refresh token to get new access token."
)
async def refresh_token(
    token_payload: dict = Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db)
):
    """
    Refresh access token using refresh token.
    
    Send refresh token in Authorization header.
    """
    # Verify it's a refresh token
    if token_payload.get("type") != "refresh":
        from backend.core.exceptions import InvalidTokenError
        raise InvalidTokenError("Invalid token type. Refresh token required.")
    
    logger.info(f"Token refresh request for user: {token_payload.get('sub')}")
    
    # Generate new tokens
    tokens = await AuthService.refresh_access_token(
        db=db,
        token_payload=token_payload
    )
    
    return tokens


# ============================================================================
# Admin Authentication
# ============================================================================

@router.post(
    "/auth/admin/login",
    response_model=AdminTokenResponse,
    summary="Admin login",
    description="Authenticate admin with enhanced security (dual tokens + optional 2FA)."
)
async def login_admin(
    login_data: AdminLoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Authenticate admin user.
    
    Returns access token, refresh token, session token, and admin token.
    Admin requests require both session token and admin token in headers:
    - `X-Session-Token`: Session token
    - `X-Admin-Token`: Admin token
    """
    client_ip = request.client.host if request.client else None
    
    logger.info(f"Admin login attempt: {login_data.username} from {client_ip}")
    
    # Authenticate admin
    admin, tokens = await AuthService.authenticate_admin(
        db=db,
        username=login_data.username,
        password=login_data.password,
        ip_address=client_ip,
        two_factor_code=login_data.two_factor_code
    )
    
    return tokens


# ============================================================================
# Password Management
# ============================================================================

@router.post(
    "/auth/password/change",
    response_model=MessageResponse,
    summary="Change password",
    description="Change password for authenticated user (company or admin)."
)
async def change_password(
    password_data: PasswordChangeRequest,
    token_payload: dict = Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db)
):
    """
    Change password for current user.
    
    Requires authentication. Works for both company and admin users.
    """
    user_id = int(token_payload.get("sub"))
    user_type = token_payload.get("type", "company")
    
    logger.info(f"Password change request for {user_type} user: {user_id}")
    
    # Change password
    await AuthService.change_password(
        db=db,
        user_id=user_id,
        current_password=password_data.current_password,
        new_password=password_data.new_password,
        user_type=user_type
    )
    
    logger.info(f"Password changed successfully for {user_type} user: {user_id}")
    
    return MessageResponse(
        message="Password changed successfully",
        detail="Your password has been updated. Please use your new password for future logins."
    )


# ============================================================================
# Profile Endpoints
# ============================================================================

@router.get(
    "/auth/me",
    response_model=CompanyResponse,
    summary="Get current user profile",
    description="Get profile information for currently authenticated company."
)
async def get_current_user_profile(
    company: Company = Depends(get_current_company)
):
    """
    Get current authenticated company profile.
    
    Requires company authentication.
    """
    logger.info(f"Profile retrieved for company: {company.id}")
    return company


@router.patch(
    "/auth/me",
    response_model=CompanyResponse,
    summary="Update current user profile",
    description="Update profile information for currently authenticated company."
)
async def update_current_user_profile(
    update_data: dict,  # TODO: Create proper update schema
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db)
):
    """
    Update current company profile.
    
    Requires company authentication.
    """
    logger.info(f"Profile update request for company: {company.id}")
    
    # Update company (simplified - add proper validation)
    for key, value in update_data.items():
        if hasattr(company, key) and key not in ['id', 'hashed_password', 'rep_email']:
            setattr(company, key, value)
    
    await db.commit()
    await db.refresh(company)
    
    logger.info(f"Profile updated for company: {company.id}")
    
    return company


@router.post(
    "/auth/logout",
    response_model=MessageResponse,
    summary="Logout",
    description="Logout current user (invalidate tokens)."
)
async def logout(
    token_payload: dict = Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db)
):
    """
    Logout user.
    
    For admin users, this invalidates session and admin tokens.
    For company users, client should discard tokens.
    """
    user_type = token_payload.get("type", "company")
    user_id = int(token_payload.get("sub"))
    
    # If admin, invalidate tokens in database
    if user_type == "admin":
        from sqlalchemy import select
        result = await db.execute(
            select(AdminUser).where(AdminUser.id == user_id)
        )
        admin = result.scalar_one_or_none()
        
        if admin:
            admin.session_token = None
            admin.admin_token = None
            await db.commit()
            logger.info(f"Admin tokens invalidated for user: {user_id}")
    
    logger.info(f"Logout successful for {user_type} user: {user_id}")
    
    return MessageResponse(
        message="Logged out successfully",
        detail="Your session has been terminated. Please login again to continue."
    )

