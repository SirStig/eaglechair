import logging
from typing import Optional

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import get_current_admin
from backend.api.v1.schemas.common import MessageResponse
from backend.database.base import get_db
from backend.core.admin_permissions import admin_profile
from backend.models.company import AdminUser
from backend.models.passkey import AdminPasskeyCredential
from backend.core.exceptions import InvalidCredentialsError
from backend.services import admin_confirmation, admin_session_service, audit_service
from backend.services.auth_service import AuthService
from backend.services.mfa_service import MFAService
from backend.services.passkey_service import PasskeyService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth/admin", tags=["Admin Auth"])


@router.post(
    "/passkey/options",
    summary="Get passkey authentication options",
    description=(
        "Public endpoint. Body: {} for usernameless sign-in, or "
        "{\"username\": \"<username or email>\"} to limit it to that admin. Returns "
        "WebAuthn options plus a single-use challengeId (valid 120s) that must be "
        "sent back to /passkey/authenticate."
    ),
)
async def passkey_auth_options(
    body: Optional[dict] = None,
    db: AsyncSession = Depends(get_db),
):
    username = body.get("username") if isinstance(body, dict) else None
    options = await PasskeyService.get_authentication_options(db, username)
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
    from backend.core.security import set_auth_cookies, tokens_for_response_body

    admin = await PasskeyService.verify_authentication(db, credential)
    tokens = await AuthService.create_admin_tokens(
        db, admin,
        ip_address=request.client.host if request.client else None,
        strong_session=True,
        user_agent=request.headers.get("user-agent"),
        login_method="passkey",
    )
    await audit_service.record(
        db, admin.id, "login", "admin_users", admin.id, {"method": "passkey"}, request
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
        **tokens_for_response_body(request, tokens),
        "requiresSetup": requires_setup,
        "user": admin_profile(admin),
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
    request: Request,
    credential: dict,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    await PasskeyService.verify_registration(
        db, admin, credential,
        device_name=credential.get("device_name"),
    )
    await audit_service.record(
        db, admin.id, "passkey_added", "admin_users", admin.id,
        {"device_name": credential.get("device_name")}, request,
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
    request: Request,
    code_data: dict,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    code = code_data.get("code")
    if not code:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Verification code required")
    await MFAService.setup_2fa(db, admin, code)
    await audit_service.record(db, admin.id, "2fa_enabled", "admin_users", admin.id, conn=request)
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


# ============================================================================
# Step-up confirmation (backend/services/admin_confirmation.py)
# ============================================================================

async def _has_passkey(db: AsyncSession, admin: AdminUser) -> bool:
    result = await db.execute(
        select(AdminPasskeyCredential.id).where(AdminPasskeyCredential.admin_user_id == admin.id)
    )
    return result.first() is not None


@router.get(
    "/confirm",
    summary="Identity confirmation status",
    description="Requires admin auth. Whether the admin recently confirmed it's them, and which methods they can use.",
)
async def confirmation_status(
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return {
        "confirmedUntil": await admin_confirmation.confirmation_expires_at(admin),
        "hasPasskey": await _has_passkey(db, admin),
        "hasMfa": admin.is_2fa_enabled,
    }


@router.post(
    "/confirm/options",
    summary="Passkey options for confirming identity",
    description="Requires admin auth. WebAuthn options limited to the signed-in admin's passkeys.",
)
async def confirmation_passkey_options(
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await PasskeyService.get_authentication_options(db, admin.username)


@router.post(
    "/confirm",
    summary="Confirm identity before a dangerous action",
    description=(
        "Requires admin auth. Body: {\"passkey\": {challengeId, credential}} or "
        "{\"password\": \"...\", \"two_factor_code\": \"123456\"}. "
        "Unlocks admin management and permanent deletes for 5 minutes."
    ),
)
async def confirm_identity(
    request: Request,
    body: dict,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    passkey = body.get("passkey") if isinstance(body, dict) else None
    method = "passkey" if passkey else "password"
    try:
        if passkey:
            verified = await PasskeyService.verify_authentication(db, passkey)
            expires_at = await admin_confirmation.confirm_with_passkey(admin, verified)
        else:
            expires_at = await admin_confirmation.confirm_with_password(
                admin, body.get("password") or "", body.get("two_factor_code")
            )
    except InvalidCredentialsError as e:
        await audit_service.record(
            db, admin.id, "confirm_failed", "admin_users", admin.id,
            {"method": method, "reason": e.message}, request,
        )
        raise
    await audit_service.record(
        db, admin.id, "confirm_identity", "admin_users", admin.id, {"method": method}, request
    )
    return {"confirmedUntil": expires_at}


# ============================================================================
# Device sessions (backend/services/admin_session_service.py)
# ============================================================================

@router.get(
    "/sessions",
    summary="Where you're signed in",
    description="Requires admin auth. The caller's device sessions (active first, plus ones signed out in the last 7 days).",
)
async def list_my_sessions(
    request: Request,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    current_id = getattr(request.state, "admin_session_id", None)
    sessions = await admin_session_service.list_sessions(db, admin.id)
    return {
        "items": [admin_session_service.serialize(s, current_id) for s in sessions],
        "current_session_id": current_id,
    }


@router.delete(
    "/sessions/{session_id}",
    summary="Sign out one device",
    description="Requires admin auth. Signs out one of the caller's own sessions.",
)
async def revoke_my_session(
    session_id: int,
    request: Request,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    from fastapi import HTTPException

    session = await admin_session_service.get_session(db, session_id)
    if session is None or session.admin_id != admin.id:
        raise HTTPException(status_code=404, detail="Session not found")
    admin_session_service.revoke(session, "signed_out_remotely")
    await db.commit()
    await audit_service.record(
        db, admin.id, "session_revoked", "admin_users", admin.id,
        {"session_id": session.id, "device": session.device_label, "ip": session.ip_address}, request,
    )
    is_current = session.id == getattr(request.state, "admin_session_id", None)
    return {"message": "Signed out that device.", "current": is_current}


@router.post(
    "/sessions/revoke-others",
    summary="Sign out all other devices",
    description="Requires admin auth. Signs out every session except the one making the request.",
)
async def revoke_other_sessions(
    request: Request,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    current_id = getattr(request.state, "admin_session_id", None)
    count = await admin_session_service.revoke_all(db, admin.id, "signed_out_remotely", except_id=current_id)
    await db.commit()
    await audit_service.record(
        db, admin.id, "sessions_revoked", "admin_users", admin.id, {"count": count}, request
    )
    return {"message": f"Signed out {count} other device{'s' if count != 1 else ''}.", "count": count}
