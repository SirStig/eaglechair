"""
Step-up confirmation for dangerous admin actions

Before adding or editing admins (and permanently deleting rows) an admin
re-confirms who they are with a passkey, or their password plus a 2FA code
when 2FA is on. A confirmation lasts CONFIRM_TTL_SECONDS and is tied to the
admin's token_version, so signing out or a password reset ends it.

Routes opt in with Depends(require_recent_confirmation); without a fresh
confirmation they answer 403 with error code REAUTH_REQUIRED, which the
admin UI catches to show the confirm dialog and retry.
"""

import logging
import time
from typing import Optional

from fastapi import Depends

from backend.api.dependencies import get_current_admin
from backend.core.ephemeral_store import ephemeral_store
from backend.core.exceptions import AuthorizationError, InvalidCredentialsError, RateLimitExceededError
from backend.core.security import SecurityManager
from backend.models.company import AdminUser
from backend.services.mfa_service import MFAService

logger = logging.getLogger(__name__)

CONFIRM_TTL_SECONDS = 5 * 60
MAX_FAILED_CONFIRMATIONS = 5
FAILED_WINDOW_SECONDS = 15 * 60


class ConfirmationRequiredError(AuthorizationError):
    def __init__(self):
        super().__init__(
            message="Confirm it's you to continue.",
            error_code="REAUTH_REQUIRED",
        )


def _key(admin: AdminUser) -> str:
    return f"admin-confirm:{admin.id}:{admin.token_version or 0}"


def _fail_key(admin: AdminUser) -> str:
    return f"admin-confirm-fail:{admin.id}"


async def _check_not_throttled(admin: AdminUser) -> None:
    failures = await ephemeral_store.get(_fail_key(admin))
    if failures and int(failures) >= MAX_FAILED_CONFIRMATIONS:
        raise RateLimitExceededError(retry_after=FAILED_WINDOW_SECONDS)


async def _failed(admin: AdminUser, reason: str) -> None:
    await ephemeral_store.incr(_fail_key(admin), FAILED_WINDOW_SECONDS)
    logger.warning(f"Failed identity confirmation for admin {admin.id}: {reason}")
    raise InvalidCredentialsError(reason)


async def _confirmed(admin: AdminUser) -> int:
    expires_at = int(time.time()) + CONFIRM_TTL_SECONDS
    await ephemeral_store.set(_key(admin), str(expires_at), CONFIRM_TTL_SECONDS)
    await ephemeral_store.delete(_fail_key(admin))
    return expires_at


async def confirm_with_password(admin: AdminUser, password: str, two_factor_code: Optional[str]) -> int:
    """Returns the unix time the confirmation expires"""
    await _check_not_throttled(admin)
    if not password or not SecurityManager.verify_password(password, admin.hashed_password):
        await _failed(admin, "Incorrect password")
    if admin.is_2fa_enabled:
        if not two_factor_code:
            raise InvalidCredentialsError("Enter the code from your authenticator app")
        if not MFAService.verify_totp(admin.two_factor_secret, two_factor_code):
            await _failed(admin, "Invalid two-factor authentication code")
    return await _confirmed(admin)


async def confirm_with_passkey(admin: AdminUser, verified: AdminUser) -> int:
    """`verified` is the admin PasskeyService.verify_authentication returned"""
    await _check_not_throttled(admin)
    if verified.id != admin.id:
        await _failed(admin, "That passkey belongs to a different admin")
    return await _confirmed(admin)


async def confirmation_expires_at(admin: AdminUser) -> Optional[int]:
    value = await ephemeral_store.get(_key(admin))
    if not value:
        return None
    expires_at = int(value)
    return expires_at if expires_at > time.time() else None


async def require_recent_confirmation(
    admin: AdminUser = Depends(get_current_admin),
) -> AdminUser:
    if await confirmation_expires_at(admin) is None:
        raise ConfirmationRequiredError()
    return admin
