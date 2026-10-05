"""
Authentication Routes - API v1

Handles company and admin authentication
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Request, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import (
    authenticate_admin,
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
    CompanyUpdate,
    PasswordChangeRequest,
    PasswordReset,
    PasswordResetRequest,
    TokenResponse,
)
from backend.core.admin_permissions import admin_profile
from backend.core.exceptions import AccountSuspendedError, InvalidCredentialsError
from backend.core.security import tokens_for_response_body
from backend.database.base import get_db
from backend.models.company import AdminUser, Company
from backend.models.passkey import AdminPasskeyCredential
from backend.services import admin_session_service, audit_service
from backend.services.auth_service import AuthService, revoke_user_tokens

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Authentication"])
security = HTTPBearer()

# Profile fields a company may change on its own account (mirrors dashboard profile update).
# Privileged fields (status, is_verified, pricing tier, credit, notes, tax_id, email) are excluded.
COMPANY_SELF_EDITABLE_FIELDS = {
    "company_name", "legal_name", "industry", "website",
    "rep_first_name", "rep_last_name", "rep_title", "rep_phone",
    "billing_address_line1", "billing_address_line2",
    "billing_city", "billing_state", "billing_zip", "billing_country",
}


def _company_profile(company: Company) -> dict:
    """Serialize a company to the public profile shape (no secrets, tokens or admin notes)."""
    return {field: getattr(company, field, None) for field in CompanyResponse.model_fields}


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
    
    # Return success message - user must verify email before they can log in
    return {
        "message": "Registration successful! Please check your email to verify your account before logging in.",
        "email": company.rep_email,
        "verified": False
    }


@router.post(
    "/auth/login",
    summary="Unified login",
    description="Authenticate company or admin user automatically. Returns appropriate tokens based on user type."
)
async def unified_login(
    login_data: CompanyLoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """
    Unified login endpoint that automatically detects whether the user is an admin or company.
    
    - Tries admin authentication first (by email or username)
    - Falls back to company authentication if not an admin
    - Returns appropriate tokens based on user type
    - Sets httpOnly cookies for tokens (preferred) and also returns in response body (backward compatibility)
    """
    from backend.core.config import settings
    from backend.core.security import set_auth_cookies
    
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
        try:
            admin, tokens = await AuthService.authenticate_admin(
                db=db,
                username=admin_user.username,
                password=login_data.password,
                ip_address=client_ip,
                two_factor_code=login_data.two_factor_code,
                user_agent=request.headers.get("user-agent"),
            )
        except (InvalidCredentialsError, AccountSuspendedError) as e:
            await audit_service.record(
                db, admin_user.id, "login_failed", "admin_users", admin_user.id,
                {"method": "password", "reason": e.message}, request,
            )
            raise
        await audit_service.record(
            db, admin.id, "login", "admin_users", admin.id, {"method": "password"}, request
        )
        
        # Set cookies
        set_auth_cookies(
            response=response,
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
            session_token=tokens.get("session_token"),
            admin_token=tokens.get("admin_token"),
            is_production=settings.is_production
        )
        
        from backend.models.passkey import AdminPasskeyCredential
        result = await db.execute(
            select(AdminPasskeyCredential).where(
                AdminPasskeyCredential.admin_user_id == admin.id
            )
        )
        has_passkey = result.scalars().first() is not None
        requires_setup = not (has_passkey and admin.is_2fa_enabled)
        return {
            **tokens_for_response_body(request, tokens),
            "requiresSetup": requires_setup,
            "user": admin_profile(admin),
        }
    
    # Not an admin, try company authentication
    logger.info(f"Attempting company authentication for: {login_data.email}")
    company, tokens = await AuthService.authenticate_company(
        db=db,
        email=login_data.email,
        password=login_data.password,
        ip_address=client_ip
    )
    
    # Set cookies
    set_auth_cookies(
        response=response,
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        is_production=settings.is_production
    )
    
    # Include company user data in response. Browsers get tokens only via
    # httpOnly cookies; non-browser clients also get them in the body.
    return {
        **tokens_for_response_body(request, tokens),
        "user": {
            "id": company.id,
            "companyName": company.company_name,
            "email": company.rep_email,
            "firstName": company.rep_first_name,
            "lastName": company.rep_last_name,
            "role": "company",
            "type": "company",
            "status": company.status.value,
            "isVerified": company.is_verified  # Include verification status
        }
    }


@router.post(
    "/auth/refresh",
    summary="Refresh access token",
    description="Use refresh token to get new access token."
)
async def refresh_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer(auto_error=False))
):
    """
    Refresh access token using refresh token.
    
    Accepts refresh token from cookie (preferred) or Authorization header (fallback).
    Sets new tokens in httpOnly cookies.
    """
    from backend.core.config import settings
    from backend.core.security import set_auth_cookies
    
    # Get refresh token from cookie (preferred) or header (fallback)
    refresh_token_value = request.cookies.get("refresh_token")
    
    if not refresh_token_value and credentials:
        refresh_token_value = credentials.credentials
    
    if not refresh_token_value:
        from backend.core.exceptions import InvalidTokenError
        raise InvalidTokenError("No refresh token provided")
    
    # Decode token to get payload
    from backend.core.security import security_manager
    try:
        token_payload = security_manager.decode_token(refresh_token_value)
    except Exception:
        from backend.core.exceptions import InvalidTokenError
        raise InvalidTokenError("Invalid or expired refresh token")
    
    # Verify it's a refresh token
    if token_payload.get("token_type") != "refresh":
        from backend.core.exceptions import InvalidTokenError
        raise InvalidTokenError("Invalid token type. Refresh token required.")
    
    logger.info(f"Token refresh request for user: {token_payload.get('sub')}")
    
    # Generate new tokens (pass raw token for validation)
    tokens = await AuthService.refresh_access_token(
        db=db,
        token_payload=token_payload,
        provided_refresh_token=refresh_token_value
    )
    
    # Set new cookies
    set_auth_cookies(
        response=response,
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        is_production=settings.is_production
    )
    
    # Non-browser clients also get the tokens in the response body
    return tokens_for_response_body(request, tokens)


# ============================================================================
# Admin Authentication
# ============================================================================

@router.post(
    "/auth/admin/login",
    summary="Admin login",
    description="Authenticate admin with enhanced security (dual tokens + optional 2FA)."
)
async def login_admin(
    login_data: AdminLoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """
    Authenticate admin user.
    
    Returns access token, refresh token, session token, and admin token.
    Sets httpOnly cookies for all tokens.
    Admin requests can use cookies (preferred) or headers (backward compatibility):
    - Cookies: access_token, refresh_token, session_token, admin_token
    - Headers: `X-Session-Token`: Session token, `X-Admin-Token`: Admin token
    """
    from backend.core.config import settings
    from backend.core.security import set_auth_cookies
    
    client_ip = request.client.host if request.client else None
    
    logger.info(f"Admin login attempt: {login_data.username} from {client_ip}")
    
    # Authenticate admin
    try:
        admin, tokens = await AuthService.authenticate_admin(
            db=db,
            username=login_data.username,
            password=login_data.password,
            ip_address=client_ip,
            two_factor_code=login_data.two_factor_code,
            user_agent=request.headers.get("user-agent"),
        )
    except (InvalidCredentialsError, AccountSuspendedError) as e:
        result = await db.execute(
            select(AdminUser.id).where(AdminUser.username == login_data.username)
        )
        admin_id = result.scalar_one_or_none()
        if admin_id is not None:
            await audit_service.record(
                db, admin_id, "login_failed", "admin_users", admin_id,
                {"method": "password", "reason": e.message}, request,
            )
        raise
    await audit_service.record(
        db, admin.id, "login", "admin_users", admin.id, {"method": "password"}, request
    )
    
    # Set cookies
    set_auth_cookies(
        response=response,
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        session_token=tokens.get("session_token"),
        admin_token=tokens.get("admin_token"),
        is_production=settings.is_production
    )
    
    result = await db.execute(
        select(AdminPasskeyCredential).where(
            AdminPasskeyCredential.admin_user_id == admin.id
        )
    )
    has_passkey = result.scalars().first() is not None
    requires_setup = not (has_passkey and admin.is_2fa_enabled)

    return {
        **tokens_for_response_body(request, tokens),
        "requiresSetup": requires_setup,
        "user": admin_profile(admin),
    }


# ============================================================================
# Email Verification
# ============================================================================

@router.post(
    "/auth/verify-email",
    response_model=MessageResponse,
    summary="Verify email address",
    description="Verify email address using verification token from email."
)
async def verify_email(
    token_data: dict,
    db: AsyncSession = Depends(get_db)
):
    """
    Verify email address using token from verification email.
    
    **Public endpoint** - No authentication required.
    
    After successful verification, the account can be used for login.
    """
    token = token_data.get("token")
    if not token:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Token is required")
    
    logger.info("Email verification attempt")
    
    # Verify email
    await AuthService.verify_email(
        db=db,
        token=token
    )
    
    logger.info("Email verified successfully")
    
    return MessageResponse(
        message="Email verified successfully",
        detail="Your email has been verified. You can now log in to your account."
    )


@router.post(
    "/auth/resend-verification",
    response_model=MessageResponse,
    summary="Resend verification email",
    description="Resend email verification email to user."
)
async def resend_verification(
    email_data: dict,
    db: AsyncSession = Depends(get_db)
):
    """
    Resend email verification email.
    
    **Public endpoint** - No authentication required.
    
    For security, this always returns success even if email doesn't exist.
    """
    email = email_data.get("email")
    if not email:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Email is required")
    
    logger.info(f"Resend verification requested for: {email}")
    
    # Resend verification email
    await AuthService.resend_verification_email(
        db=db,
        email=email
    )
    
    return MessageResponse(
        message="Verification email sent",
        detail="If an account exists with this email and is not yet verified, you will receive a verification email."
    )


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
    request: Request,
    response: Response,
    token_payload: dict = Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db)
):
    """
    Change password for current user.

    Requires authentication. Works for both company and admin users.
    Revokes every existing session (token_version bump), then issues fresh
    cookies for the current session so the caller stays signed in.
    """
    from backend.core.config import settings
    from backend.core.security import set_auth_cookies

    user_id = int(token_payload.get("sub"))
    user_type = token_payload.get("type", "company")

    # Authenticate the caller fully (token version, admin session tokens)
    # before allowing the change
    if user_type == "admin":
        caller = await authenticate_admin(request, token_payload, db)
    else:
        caller = await get_current_company(request, token_payload, db)
    if caller.id != user_id:
        from backend.core.exceptions import AuthenticationError
        raise AuthenticationError("Invalid session for password change")
    
    logger.info(f"Password change request for {user_type} user: {user_id}")
    
    # Change password
    try:
        await AuthService.change_password(
            db=db,
            user_id=user_id,
            current_password=password_data.current_password,
            new_password=password_data.new_password,
            user_type=user_type
        )
    except InvalidCredentialsError as e:
        if user_type == "admin":
            await audit_service.record(
                db, user_id, "password_change_failed", "admin_users", user_id, {"reason": e.message}, request
            )
        raise
    if user_type == "admin":
        await audit_service.record(db, user_id, "password_changed", "admin_users", user_id, conn=request)

    logger.info(f"Password changed successfully for {user_type} user: {user_id}")

    # Re-issue tokens for this session (all other sessions stay revoked)
    await db.refresh(caller)
    if user_type == "admin":
        # Every device is signed out; this one gets a fresh session
        await admin_session_service.revoke_all(db, caller.id, "password_changed")
        tokens = await AuthService.create_admin_tokens(
            db, caller,
            ip_address=request.client.host if request.client else None,
            strong_session=bool(caller.is_2fa_enabled),
            user_agent=request.headers.get("user-agent"),
            login_method="password",
        )
    else:
        tokens = await AuthService.create_company_tokens(db, caller)
    set_auth_cookies(
        response=response,
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        session_token=tokens.get("session_token"),
        admin_token=tokens.get("admin_token"),
        is_production=settings.is_production,
    )

    return MessageResponse(
        message="Password changed successfully",
        detail="Your password has been updated. Other sessions have been signed out."
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
    
    if reset_token:
        from sqlalchemy import select

        from backend.core.config import settings
        from backend.services.email_service import EmailService

        result = await db.execute(
            select(Company).where(Company.rep_email == reset_request.email)
        )
        company = result.scalar_one_or_none()
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"
        try:
            await EmailService.send_password_reset_email(
                db=db,
                to_email=reset_request.email,
                company_name=company.company_name if company else "",
                reset_link=reset_url
            )
        except Exception as e:
            logger.error(f"Failed to send password reset email: {e}")
    
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
    summary="Get current user profile",
    description="Get profile information for currently authenticated user (company or admin)."
)
async def get_current_user_profile(
    request: Request,
    token_payload: dict = Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db)
):
    """
    Get current authenticated user profile.
    
    Returns different formats based on token type:
    - Admin token: Returns admin user format with type='admin'
    - Company token: Returns company format with type='company'
    """
    token_type = token_payload.get("type")
    
    # Handle admin token
    if token_type == "admin":
        try:
            admin = await authenticate_admin(request, token_payload, db)
            logger.info(f"Profile retrieved for admin: {admin.username}")
            return admin_profile(admin)
        except Exception as e:
            logger.warning(f"Failed to get admin profile: {str(e)}")
            raise
    
    # Handle company token (default)
    company = await get_current_company(request, token_payload, db)
    logger.info(f"Profile retrieved for company: {company.id}")
    return _company_profile(company)


@router.patch(
    "/auth/me",
    response_model=CompanyResponse,
    summary="Update current user profile",
    description="Update profile information for currently authenticated company."
)
async def update_current_user_profile(
    update_data: CompanyUpdate,
    company: Company = Depends(get_current_company),
    db: AsyncSession = Depends(get_db)
):
    """
    Update current company profile.
    
    Requires company authentication.
    """
    logger.info(f"Profile update request for company: {company.id}")
    
    # Only allow self-editable profile fields; unknown/privileged fields are ignored
    changes = update_data.model_dump(exclude_unset=True)
    for key, value in changes.items():
        if key not in COMPANY_SELF_EDITABLE_FIELDS:
            continue
        if value is None and not Company.__table__.c[key].nullable:
            continue
        setattr(company, key, value)
    
    await db.commit()
    await db.refresh(company)
    
    logger.info(f"Profile updated for company: {company.id}")
    
    return company


@router.post(
    "/auth/logout",
    response_model=MessageResponse,
    summary="Logout",
    description="Logout current user (revokes all issued tokens and clears auth cookies)."
)
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
):
    """
    Logout user.

    Identifies the user from the access token (cookie or Authorization header)
    or, if that has expired, the refresh token cookie. Bumps the user's
    token_version so every previously issued access/refresh token stops
    working, clears admin session/admin tokens, and always clears the
    authentication cookies (even if the tokens were already invalid).
    """
    from backend.core.security import clear_auth_cookies, security_manager
    from backend.core.config import settings

    candidates = [
        request.cookies.get("access_token"),
        credentials.credentials if credentials else None,
        request.cookies.get("refresh_token"),
    ]
    token_payload = None
    for candidate in candidates:
        if not candidate:
            continue
        try:
            token_payload = security_manager.decode_token(candidate)
            break
        except Exception:
            continue

    user_type = None
    user_id = None
    if token_payload and token_payload.get("token_type") in ("access", "refresh"):
        user_type = token_payload.get("type", "company")
        try:
            user_id = int(token_payload.get("sub"))
        except (TypeError, ValueError):
            user_id = None

    if user_id is not None:
        model = AdminUser if user_type == "admin" else Company
        result = await db.execute(select(model).where(model.id == user_id))
        user = result.scalar_one_or_none()

        # Only a current (non-revoked) token can revoke the user's sessions
        if user and security_manager.token_version_matches(token_payload, user):
            session = None
            if user_type == "admin":
                session = await admin_session_service.get_session(db, token_payload.get("sid"))
                if session is not None and session.admin_id != user.id:
                    session = None
            if session is not None:
                # Device session: sign out this device only
                admin_session_service.revoke(session, "logout")
                logger.info(f"Admin {user_id} signed out session {session.id}")
            else:
                revoke_user_tokens(user)
                if user_type == "admin":
                    user.session_token = None
                    user.admin_token = None
                logger.info(f"All tokens revoked for {user_type} user: {user_id}")
            if user_type == "admin":
                db.add(audit_service.build_entry(user.id, "logout", "admin_users", user.id, conn=request))
            await db.commit()

    # Clear all authentication cookies
    clear_auth_cookies(response, is_production=settings.is_production)

    logger.info(f"Logout successful for {user_type or 'unknown'} user: {user_id}")
    
    return MessageResponse(
        message="Logged out successfully",
        detail="Your session has been terminated. Please login again to continue."
    )

