import logging
import pyotp
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.exceptions import InvalidCredentialsError, InvalidInputError
from backend.models.company import AdminUser

logger = logging.getLogger(__name__)


class MFAService:
    @staticmethod
    def generate_secret() -> str:
        return pyotp.random_base32()

    @staticmethod
    def get_provisioning_uri(secret: str, username: str, issuer: str = "Eagle Chair Admin") -> str:
        return pyotp.totp.TOTP(secret).provisioning_uri(name=username, issuer_name=issuer)

    @staticmethod
    def verify_totp(secret: str, code: str) -> bool:
        if not secret or not code:
            return False
        totp = pyotp.TOTP(secret)
        return totp.verify(code, valid_window=1)

    @staticmethod
    async def setup_2fa(
        db: AsyncSession,
        admin_user: AdminUser,
        code: str,
    ) -> None:
        if not admin_user.two_factor_secret:
            raise InvalidInputError(
                field="secret",
                reason="2FA secret not initialized. Request registration options first.",
            )
        if not MFAService.verify_totp(admin_user.two_factor_secret, code):
            raise InvalidCredentialsError("Invalid verification code")
        admin_user.is_2fa_enabled = True
        await db.commit()
        logger.info(f"2FA enabled for admin {admin_user.username}")

    @staticmethod
    async def disable_2fa(
        db: AsyncSession,
        admin_user: AdminUser,
        code: str,
    ) -> None:
        if not admin_user.is_2fa_enabled or not admin_user.two_factor_secret:
            raise InvalidInputError(field="2fa", reason="2FA is not enabled")
        if not MFAService.verify_totp(admin_user.two_factor_secret, code):
            raise InvalidCredentialsError("Invalid verification code")
        admin_user.is_2fa_enabled = False
        admin_user.two_factor_secret = None
        await db.commit()
        logger.info(f"2FA disabled for admin {admin_user.username}")
