import logging

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import get_current_admin
from backend.api.v1.schemas.common import MessageResponse
from backend.database.base import get_db
from backend.models.company import AdminUser
from backend.models.passkey import AdminPasskeyCredential
from backend.services.auth_service import AuthService
from backend.services.mfa_service import MFAService
from backend.services.passkey_service import PasskeyService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth/admin", tags=["Admin Auth"])


@router.post(
    "/passkey/options",
    summary="Get passkey authentication options",
    description="Public endpoint. Returns WebAuthn options for passkey sign-in.",
)
async def passkey_auth_options(db: AsyncSession = Depends(get_db)):
    options = await PasskeyService.get_authentication_options(db)
    return options


@router.post(
    "/passkey/authenticate",
    summary="Authenticate with passkey",
    description="Public endpoint. Returns tokens on successful passkey verification.",
)
async def passkey_authenticate(
    request: Request,
    response: Response,
    credential: dict,
    db: AsyncSession = Depends(get_db),
):
    from backend.core.config import settings
    from backend.core.security import set_auth_cookies

    admin = await PasskeyService.verify_authentication(db, credential)
    tokens = await AuthService.create_admin_tokens(
        db, admin,
        ip_address=request.client.host if request.client else None,
        strong_session=True,
    )
    set_auth_cookies(
        response=response,
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        session_token=tokens.get("session_token"),
        admin_token=tokens.get("admin_token"),
        is_production=settings.is_production,
    )
    result = await db.execute(
        select(AdminPasskeyCredential).where(
            AdminPasskeyCredential.admin_user_id == admin.id
        )
    )
    has_passkey = result.scalars().first() is not None
    requires_setup = not (has_passkey and admin.is_2fa_enabled)
    return {
        **tokens,
        "requiresSetup": requires_setup,
        "user": {
            "id": admin.id,
            "username": admin.username,
            "email": admin.email,
            "firstName": admin.first_name,
            "lastName": admin.last_name,
            "role": admin.role.value,
            "type": "admin",
        },
    }


@router.post(
    "/passkey/register/options",
    summary="Get passkey registration options",
    description="Requires admin auth. Returns WebAuthn options for registering a passkey.",
)
async def passkey_register_options(
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    options = await PasskeyService.get_registration_options(db, admin)
    return options


@router.post(
    "/passkey/register",
    summary="Register passkey",
    description="Requires admin auth. Completes passkey registration.",
)
async def passkey_register(
    credential: dict,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    await PasskeyService.verify_registration(
        db, admin, credential,
        device_name=credential.get("device_name"),
    )
    return MessageResponse(
        message="Passkey registered successfully",
        detail="You can now sign in with your passkey.",
    )


@router.get(
    "/mfa/setup",
    summary="Get MFA setup options",
    description="Requires admin auth. Returns 2FA secret and provisioning URI.",
)
async def mfa_setup_options(
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    if admin.is_2fa_enabled:
        return {"enabled": True, "message": "2FA is already enabled"}
    secret = MFAService.generate_secret()
    admin.two_factor_secret = secret
    await db.commit()
    provisioning_uri = MFAService.get_provisioning_uri(secret, admin.username)
    return {
        "enabled": False,
        "secret": secret,
        "provisioningUri": provisioning_uri,
    }


@router.post(
    "/mfa/setup",
    summary="Enable MFA",
    description="Requires admin auth. Verifies code and enables 2FA.",
)
async def mfa_setup_verify(
    code_data: dict,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    code = code_data.get("code")
    if not code:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Verification code required")
    await MFAService.setup_2fa(db, admin, code)
    return MessageResponse(
        message="Two-factor authentication enabled",
        detail="You will need to enter a code from your authenticator app when signing in.",
    )


@router.get(
    "/setup-status",
    summary="Get security setup status",
    description="Requires admin auth. Returns whether passkey and/or MFA setup is required.",
)
async def admin_setup_status(
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AdminPasskeyCredential).where(
            AdminPasskeyCredential.admin_user_id == admin.id
        )
    )
    has_passkey = result.scalars().first() is not None
    return {
        "hasPasskey": has_passkey,
        "hasMfa": admin.is_2fa_enabled,
        "requiresSetup": not (has_passkey and admin.is_2fa_enabled),
        "needsPasskey": not has_passkey,
        "needsMfa": not admin.is_2fa_enabled,
    }
