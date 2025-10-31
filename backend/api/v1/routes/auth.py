"""
Authentication Routes - API v1

Handles company and admin authentication
"""

import logging

from fastapi import APIRouter, Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import (
    get_current_company,
    get_current_token_and_payload,
    get_current_token_payload,
)
from backend.api.v1.schemas.common import MessageResponse
from backend.api.v1.schemas.company import (
    AdminLoginRequest,
    AdminTokenResponse,
    CompanyLoginRequest,
    CompanyRegistration,
    CompanyResponse,
    PasswordChangeRequest,
    PasswordReset,
    PasswordResetRequest,
    TokenResponse,
)
from backend.database.base import get_db
from backend.models.company import AdminUser, Company
from backend.services.auth_service import AuthService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Authentication"])
security = HTTPBearer()


# ============================================================================
# Company Authentication
# ============================================================================

@router.post(
    "/auth/register",
    status_code=201,
    summary="Register new company account",
    description="Register a new B2B company account and automatically log in. Returns auth tokens."
)
async def register_company(
    registration_data: CompanyRegistration,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Register a new company account and automatically authenticate.
    
    **Note**: The account status will be 'pending' until approved by an administrator.
    
    Returns the same response format as login:
    - access_token: JWT access token
    - refresh_token: JWT refresh token  
    - user: User information object
    """
    logger.info(f"New company registration request: {registration_data.company_name}")
    
    client_ip = request.client.host if request.client else None
    
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
    
    # Automatically authenticate the newly registered company
    logger.info(f"Auto-authenticating newly registered company: {company.id}")
    company_auth, tokens = await AuthService.authenticate_company(
        db=db,
        email=registration_data.rep_email,
        password=registration_data.password,
        ip_address=client_ip
    )
    
    # Return same format as login endpoint
    return {
        **tokens,
        "user": {
            "id": company.id,
            "companyName": company.company_name,
            "email": company.rep_email,
            "firstName": company.rep_first_name,
            "lastName": company.rep_last_name,
            "phone": company.rep_phone,
            "status": company.status.value,
            "type": "company"
        }
    }


@router.post(
    "/auth/login",
    summary="Unified login",
    description="Authenticate company or admin user automatically. Returns appropriate tokens based on user type."
)
async def unified_login(
    login_data: CompanyLoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Unified login endpoint that automatically detects whether the user is an admin or company.
    
    - Tries admin authentication first (by email or username)
    - Falls back to company authentication if not an admin
    - Returns appropriate tokens based on user type
    """
    client_ip = request.client.host if request.client else None
    
    logger.info(f"Login attempt: {login_data.email}")
    
    # First, try to authenticate as admin (check both email and username)
    from sqlalchemy import or_, select

    from backend.models.company import AdminUser
    
    result = await db.execute(
        select(AdminUser).where(
            or_(
                AdminUser.email == login_data.email,
                AdminUser.username == login_data.email  # Allow login with username in email field
            )
        )
    )
    admin_user = result.scalar_one_or_none()
    
    if admin_user:
        # User is an admin, authenticate as admin
        logger.info(f"Detected admin user: {admin_user.username}")
        admin, tokens = await AuthService.authenticate_admin(
            db=db,
            username=admin_user.username,  # Use actual username
            password=login_data.password,
            ip_address=client_ip,
            two_factor_code=None
        )
        # Include admin user data in response
        return {
            **tokens,
            "user": {
                "id": admin.id,
                "username": admin.username,
                "email": admin.email,
                "firstName": admin.first_name,
                "lastName": admin.last_name,
                "role": admin.role.value,
                "type": "admin"
            }
        }
    
    # Not an admin, try company authentication
    logger.info(f"Attempting company authentication for: {login_data.email}")
    company, tokens = await AuthService.authenticate_company(
        db=db,
        email=login_data.email,
        password=login_data.password,
        ip_address=client_ip
    )
    
    # Include company user data in response
    return {
        **tokens,
        "user": {
            "id": company.id,
            "companyName": company.company_name,
            "email": company.rep_email,
            "firstName": company.rep_first_name,
            "lastName": company.rep_last_name,
            "role": "company",
            "type": "company",
            "status": company.status.value
        }
    }


@router.post(
    "/auth/refresh",
    response_model=TokenResponse,
    summary="Refresh access token",
    description="Use refresh token to get new access token."
)
async def refresh_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """
    Refresh access token using refresh token.
    
    Send refresh token in Authorization header.
    """
    # Get both token and payload
    raw_token, token_payload = await get_current_token_and_payload(credentials)
    
    # Verify it's a refresh token
    if token_payload.get("token_type") != "refresh":
        from backend.core.exceptions import InvalidTokenError
        raise InvalidTokenError("Invalid token type. Refresh token required.")
    
    logger.info(f"Token refresh request for user: {token_payload.get('sub')}")
    
    # Generate new tokens (pass raw token for validation)
    tokens = await AuthService.refresh_access_token(
        db=db,
        token_payload=token_payload,
        provided_refresh_token=raw_token
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


@router.post(
    "/auth/password/reset-request",
    response_model=MessageResponse,
    summary="Request password reset",
    description="Request password reset link for company accounts (not admin)."
)
async def request_password_reset(
    reset_request: PasswordResetRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Request password reset for company account.
    
    **Public endpoint** - No authentication required.
    **Company accounts only** - Admins cannot reset passwords via this endpoint.
    
    An email with a reset link will be sent if the email exists.
    For security, we don't reveal whether an email is registered.
    """
    logger.info(f"Password reset requested for: {reset_request.email}")
    
    # Generate reset token
    reset_token = await AuthService.request_password_reset(
        db=db,
        email=reset_request.email
    )
    
    # TODO: Send email with reset link
    # For now, we'll log it (in production, send via email service)
    if reset_token:
        reset_url = f"http://localhost:5173/reset-password?token={reset_token}"
        logger.info(f"Password reset link: {reset_url}")
        # await EmailService.send_password_reset_email(
        #     db=db,
        #     to_email=reset_request.email,
        #     reset_link=reset_url
        # )
    
    return MessageResponse(
        message="Password reset requested",
        detail="If an account exists with this email, you will receive a password reset link."
    )


@router.post(
    "/auth/password/reset",
    response_model=MessageResponse,
    summary="Reset password",
    description="Reset password using reset token."
)
async def reset_password(
    reset_data: PasswordReset,
    db: AsyncSession = Depends(get_db)
):
    """
    Reset password using token from reset email.
    
    **Public endpoint** - No authentication required.
    **Company accounts only**.
    """
    logger.info("Password reset attempt with token")
    
    # Reset password
    await AuthService.reset_password(
        db=db,
        token=reset_data.token,
        new_password=reset_data.new_password
    )
    
    logger.info("Password reset successful")
    
    return MessageResponse(
        message="Password reset successful",
        detail="Your password has been reset. You can now log in with your new password."
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

