import json
import logging
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import base64url_to_bytes, options_to_json
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from backend.core.config import settings
from backend.core.exceptions import InvalidCredentialsError, InvalidInputError
from backend.models.company import AdminUser
from backend.models.passkey import AdminPasskeyCredential

logger = logging.getLogger(__name__)


def _get_rp_id() -> str:
    url = settings.FRONTEND_URL or "http://localhost:5173"
    if url.startswith("http://"):
        url = url[7:]
    elif url.startswith("https://"):
        url = url[8:]
    return url.split("/")[0].split(":")[0]


def _get_origin() -> str:
    url = (settings.FRONTEND_URL or "http://localhost:5173").rstrip("/")
    if not url.startswith("http"):
        url = f"https://{url}"
    return url


class PasskeyService:
    @staticmethod
    async def get_registration_options(
        db: AsyncSession,
        admin_user: AdminUser,
        device_name: Optional[str] = None,
    ) -> dict:
        result = await db.execute(
            select(AdminPasskeyCredential)
            .where(AdminPasskeyCredential.admin_user_id == admin_user.id)
        )
        existing = result.scalars().all()
        exclude_credentials = [
            PublicKeyCredentialDescriptor(id=c.credential_id, transports=None)
            for c in existing
        ]
        options = generate_registration_options(
            rp_id=_get_rp_id(),
            rp_name="Eagle Chair Admin",
            user_id=str(admin_user.id).encode("utf-8"),
            user_name=admin_user.username,
            user_display_name=f"{admin_user.first_name} {admin_user.last_name}",
            exclude_credentials=exclude_credentials if exclude_credentials else None,
            authenticator_selection=AuthenticatorSelectionCriteria(
                resident_key=ResidentKeyRequirement.PREFERRED,
                user_verification=UserVerificationRequirement.PREFERRED,
            ),
            timeout=60000,
        )
        return json.loads(options_to_json(options))

    @staticmethod
    async def verify_registration(
        db: AsyncSession,
        admin_user: AdminUser,
        credential: dict,
        device_name: Optional[str] = None,
    ) -> AdminPasskeyCredential:
        options_json = credential.get("options")
        if not options_json:
            raise InvalidInputError(field="options", reason="Registration options required")
        challenge = options_json.get("challenge")
        if not challenge:
            raise InvalidInputError(field="challenge", reason="Challenge required")
        try:
            challenge_bytes = base64url_to_bytes(challenge)
        except Exception as e:
            raise InvalidInputError(field="challenge", reason=f"Invalid challenge: {e}")
        cred = credential.get("credential")
        if not cred:
            raise InvalidInputError(field="credential", reason="Registration credential required")
        verification = verify_registration_response(
            credential=cred,
            expected_challenge=challenge_bytes,
            expected_origin=_get_origin(),
            expected_rp_id=_get_rp_id(),
            require_user_verification=True,
        )
        existing = await db.execute(
            select(AdminPasskeyCredential).where(
                AdminPasskeyCredential.credential_id == verification.credential_id
            )
        )
        if existing.scalar_one_or_none():
            raise InvalidInputError(
                field="credential",
                reason="This passkey is already registered",
            )
        passkey = AdminPasskeyCredential(
            admin_user_id=admin_user.id,
            credential_id=verification.credential_id,
            public_key=verification.credential_public_key,
            sign_count=verification.sign_count,
            device_name=device_name,
        )
        db.add(passkey)
        await db.commit()
        await db.refresh(passkey)
        logger.info(f"Passkey registered for admin {admin_user.username}")
        return passkey

    @staticmethod
    async def get_authentication_options(db: AsyncSession) -> dict:
        result = await db.execute(select(AdminPasskeyCredential))
        credentials = result.scalars().all()
        allow_credentials = [
            PublicKeyCredentialDescriptor(id=c.credential_id, transports=None)
            for c in credentials
        ]
        options = generate_authentication_options(
            rp_id=_get_rp_id(),
            allow_credentials=allow_credentials if allow_credentials else None,
            user_verification=UserVerificationRequirement.REQUIRED,
            timeout=60000,
        )
        return json.loads(options_to_json(options))

    @staticmethod
    async def verify_authentication(
        db: AsyncSession,
        credential: dict,
    ) -> AdminUser:
        options_json = credential.get("options")
        if not options_json:
            raise InvalidCredentialsError("Authentication options required")
        challenge = options_json.get("challenge")
        if not challenge:
            raise InvalidCredentialsError("Challenge required")
        try:
            challenge_bytes = base64url_to_bytes(challenge)
        except Exception:
            raise InvalidCredentialsError("Invalid challenge")
        cred = credential.get("credential")
        if not cred:
            raise InvalidCredentialsError("Authentication credential required")
        raw_id = cred.get("rawId") or cred.get("id")
        if not raw_id:
            raise InvalidCredentialsError("Credential ID required")
        try:
            credential_id = base64url_to_bytes(raw_id) if isinstance(raw_id, str) else raw_id
        except Exception:
            raise InvalidCredentialsError("Invalid credential ID")
        result = await db.execute(
            select(AdminPasskeyCredential).where(
                AdminPasskeyCredential.credential_id == credential_id
            )
        )
        passkey = result.scalar_one_or_none()
        if not passkey:
            raise InvalidCredentialsError("Passkey not found")
        verification = verify_authentication_response(
            credential=cred,
            expected_challenge=challenge_bytes,
            expected_origin=_get_origin(),
            expected_rp_id=_get_rp_id(),
            credential_public_key=passkey.public_key,
            credential_current_sign_count=passkey.sign_count,
            require_user_verification=True,
        )
        passkey.sign_count = verification.new_sign_count
        await db.commit()
        result = await db.execute(
            select(AdminUser).where(AdminUser.id == passkey.admin_user_id)
        )
        admin = result.scalar_one()
        if not admin.is_active:
            raise InvalidCredentialsError("Account is inactive")
        logger.info(f"Passkey authentication successful for admin {admin.username}")
        return admin
