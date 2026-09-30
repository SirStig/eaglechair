import hashlib
import hmac
import json
import logging
import secrets
import time
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import base64url_to_bytes, bytes_to_base64url, options_to_json
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from backend.core.config import settings
from backend.core.ephemeral_store import ephemeral_store
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


# WebAuthn challenges are valid for this long and are single use
CHALLENGE_TTL_SECONDS = 120


def _sign(data: bytes) -> bytes:
    return hmac.new(
        settings.SECRET_KEY.encode("utf-8"), b"webauthn-challenge:" + data, hashlib.sha256
    ).digest()


async def _store_challenge(
    purpose: str, challenge: bytes, admin_id: Optional[int], discoverable: bool = False
) -> str:
    """
    Issue a signed, expiring challenge id for `challenge`.

    The id carries the challenge itself and is HMAC-signed with SECRET_KEY, so
    any Gunicorn worker can verify it without shared storage (Redis is
    optional). `discoverable` marks a usernameless sign-in challenge: it is
    not bound to an admin, and the returned credential identifies the admin.
    """
    record = {
        "p": purpose,
        "c": bytes_to_base64url(challenge),
        "a": admin_id,
        "exp": int(time.time()) + CHALLENGE_TTL_SECONDS,
        "n": secrets.token_urlsafe(8),
    }
    if discoverable:
        record["d"] = True
    payload = json.dumps(record, separators=(",", ":")).encode("utf-8")
    return f"{bytes_to_base64url(payload)}.{bytes_to_base64url(_sign(payload))}"


async def _consume_challenge(purpose: str, challenge_id) -> Optional[dict]:
    """Verify a challenge id and mark it used; None if invalid, expired or reused"""
    if not isinstance(challenge_id, str) or not challenge_id or len(challenge_id) > 1024:
        return None
    try:
        payload_b64, sig_b64 = challenge_id.split(".", 1)
        payload = base64url_to_bytes(payload_b64)
        if not hmac.compare_digest(base64url_to_bytes(sig_b64), _sign(payload)):
            return None
        record = json.loads(payload)
        if record.get("p") != purpose or int(record["exp"]) < time.time():
            return None
        challenge = base64url_to_bytes(record["c"])
    except Exception:
        return None
    # Single use. Shared across workers when Redis is up, per worker otherwise.
    uses = await ephemeral_store.incr(f"webauthn:used:{sig_b64}", CHALLENGE_TTL_SECONDS)
    if uses > 1:
        return None
    result = {"challenge": challenge, "admin_id": record.get("a")}
    if record.get("d"):
        result["discoverable"] = True
    return result


def _decoy_credential_id(identifier: str) -> bytes:
    """
    Deterministic fake credential id for unknown usernames (or admins without
    passkeys) so /passkey/options has the same shape either way.
    """
    return hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        f"webauthn-decoy:{identifier.strip().lower()}".encode("utf-8"),
        hashlib.sha256,
    ).digest()


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
        challenge_id = await _store_challenge("register", options.challenge, admin_user.id)
        return {**json.loads(options_to_json(options)), "challengeId": challenge_id}

    @staticmethod
    async def verify_registration(
        db: AsyncSession,
        admin_user: AdminUser,
        credential: dict,
        device_name: Optional[str] = None,
    ) -> AdminPasskeyCredential:
        # The challenge comes from server-side storage (never from the client)
        record = await _consume_challenge("register", credential.get("challengeId"))
        if not record or record.get("admin_id") != admin_user.id:
            raise InvalidInputError(
                field="challengeId",
                reason="Registration challenge is invalid or has expired. Please try again.",
            )
        cred = credential.get("credential")
        if not cred:
            raise InvalidInputError(field="credential", reason="Registration credential required")
        try:
            verification = verify_registration_response(
                credential=cred,
                expected_challenge=record["challenge"],
                expected_origin=_get_origin(),
                expected_rp_id=_get_rp_id(),
                require_user_verification=True,
            )
        except Exception as e:
            logger.warning(f"Passkey registration verification failed for {admin_user.username}: {e}")
            raise InvalidInputError(field="credential", reason="Passkey registration could not be verified")
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
    async def get_authentication_options(db: AsyncSession, username: Optional[str] = None) -> dict:
        """
        Options for signing in with a passkey.

        Without `username`: usernameless (discoverable credential) sign-in. No
        credential ids are listed, the browser offers the passkeys it holds for
        this site, and the returned credential identifies the admin.

        With `username` (username or email): only that admin's credential ids
        are listed. Unknown users (and admins without passkeys) get a
        deterministic decoy credential id so the response has the same shape
        and does not reveal whether they exist.
        """
        identifier = (username or "").strip() if isinstance(username, str) else ""
        if not identifier:
            options = generate_authentication_options(
                rp_id=_get_rp_id(),
                user_verification=UserVerificationRequirement.REQUIRED,
                timeout=60000,
            )
            challenge_id = await _store_challenge("auth", options.challenge, None, discoverable=True)
            return {**json.loads(options_to_json(options)), "challengeId": challenge_id}

        result = await db.execute(
            select(AdminUser).where(
                or_(
                    AdminUser.username == identifier,
                    func.lower(AdminUser.email) == identifier.lower(),
                )
            )
        )
        admin = result.scalars().first()

        credentials = []
        if admin and admin.is_active:
            result = await db.execute(
                select(AdminPasskeyCredential).where(
                    AdminPasskeyCredential.admin_user_id == admin.id
                )
            )
            credentials = result.scalars().all()

        if credentials:
            allow_credentials = [
                PublicKeyCredentialDescriptor(id=c.credential_id, transports=None)
                for c in credentials
            ]
            bound_admin_id = admin.id
        else:
            allow_credentials = [
                PublicKeyCredentialDescriptor(id=_decoy_credential_id(identifier), transports=None)
            ]
            bound_admin_id = None

        options = generate_authentication_options(
            rp_id=_get_rp_id(),
            allow_credentials=allow_credentials,
            user_verification=UserVerificationRequirement.REQUIRED,
            timeout=60000,
        )
        challenge_id = await _store_challenge("auth", options.challenge, bound_admin_id)
        return {**json.loads(options_to_json(options)), "challengeId": challenge_id}

    @staticmethod
    async def verify_authentication(
        db: AsyncSession,
        credential: dict,
    ) -> AdminUser:
        # The challenge comes from server-side storage (never from the client)
        record = await _consume_challenge("auth", credential.get("challengeId"))
        if not record:
            raise InvalidCredentialsError("Passkey challenge is invalid or has expired. Please try again.")
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
            raise InvalidCredentialsError("Passkey not recognized")
        if record.get("discoverable"):
            # Usernameless sign-in: the credential identifies the admin. If the
            # authenticator returned a user handle it must match that admin.
            user_handle = (cred.get("response") or {}).get("userHandle")
            if user_handle:
                try:
                    handle_ok = base64url_to_bytes(user_handle) == str(passkey.admin_user_id).encode("utf-8")
                except Exception:
                    handle_ok = False
                if not handle_ok:
                    raise InvalidCredentialsError("Passkey not recognized")
        elif record.get("admin_id") is None or passkey.admin_user_id != record["admin_id"]:
            # The passkey must belong to the admin the challenge was issued for
            raise InvalidCredentialsError("Passkey not recognized")
        try:
            verification = verify_authentication_response(
                credential=cred,
                expected_challenge=record["challenge"],
                expected_origin=_get_origin(),
                expected_rp_id=_get_rp_id(),
                credential_public_key=passkey.public_key,
                credential_current_sign_count=passkey.sign_count,
                require_user_verification=True,
            )
        except Exception as e:
            logger.warning(f"Passkey authentication verification failed: {e}")
            raise InvalidCredentialsError("Passkey could not be verified")
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
