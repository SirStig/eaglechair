"""
Auth hardening tests (service level):

- Admin session/admin token digests (HMAC, legacy bcrypt upgrade)
- WebAuthn challenges stored server-side, single use, bound to the admin
- Failed-login throttling per (identifier, IP) and admin account lockout
- Token versioning (password reset) and the token_version column migration
"""

import time

import bcrypt
import pytest
from sqlalchemy import select
from starlette.requests import Request
from webauthn.helpers import bytes_to_base64url

import backend.models  # noqa: F401 - register all tables before test_engine's create_all
from backend.api.dependencies import verify_admin_session_tokens
from backend.core.ephemeral_store import KEY_PREFIX, ephemeral_store
from backend.core.exceptions import (
    AccountSuspendedError,
    AuthenticationError,
    InvalidCredentialsError,
    InvalidInputError,
    RateLimitExceededError,
)
from backend.core.security import SecurityManager
from backend.models.company import AdminUser, Company, CompanyStatus
from backend.models.passkey import AdminPasskeyCredential
from backend.services import passkey_service
from backend.services.auth_service import AuthService, LoginAttemptLimiter
from backend.services.passkey_service import PasskeyService
from tests.factories import create_admin, create_company

PASSWORD = "TestPassword123!"


def _request(headers: dict) -> Request:
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/",
            "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
        }
    )


# ============================================================================
# Task 4: admin token digests
# ============================================================================


@pytest.mark.unit
@pytest.mark.auth
class TestAdminTokenDigests:
    @pytest.mark.asyncio
    async def test_login_stores_hmac_digests(self, db_session):
        admin = await create_admin(db_session)
        _, tokens = await AuthService.authenticate_admin(
            db_session, admin.username, PASSWORD, ip_address="10.0.0.1"
        )
        assert admin.session_token == SecurityManager.hash_token(tokens["session_token"])
        assert admin.admin_token == SecurityManager.hash_token(tokens["admin_token"])
        assert not admin.session_token.startswith("$2")
        assert len(admin.session_token) == 64

    @pytest.mark.asyncio
    async def test_verification_does_not_use_bcrypt(self, db_session, monkeypatch):
        admin = await create_admin(db_session)
        _, tokens = await AuthService.authenticate_admin(db_session, admin.username, PASSWORD)

        def _fail(*args, **kwargs):
            raise AssertionError("bcrypt must not run for HMAC digests")

        monkeypatch.setattr(bcrypt, "checkpw", _fail)
        request = _request(
            {"X-Session-Token": tokens["session_token"], "X-Admin-Token": tokens["admin_token"]}
        )
        await verify_admin_session_tokens(request, admin, db_session)

    @pytest.mark.asyncio
    async def test_cookie_tokens_accepted(self, db_session):
        admin = await create_admin(db_session)
        _, tokens = await AuthService.authenticate_admin(db_session, admin.username, PASSWORD)
        request = _request(
            {"Cookie": f"session_token={tokens['session_token']}; admin_token={tokens['admin_token']}"}
        )
        await verify_admin_session_tokens(request, admin, db_session)

    @pytest.mark.asyncio
    async def test_wrong_token_rejected(self, db_session):
        admin = await create_admin(db_session)
        _, tokens = await AuthService.authenticate_admin(db_session, admin.username, PASSWORD)
        request = _request({"X-Session-Token": tokens["session_token"], "X-Admin-Token": "wrong"})
        with pytest.raises(AuthenticationError):
            await verify_admin_session_tokens(request, admin, db_session)

    @pytest.mark.asyncio
    async def test_legacy_bcrypt_values_verified_and_upgraded(self, db_session):
        session_token, admin_token = "legacy-session-token", "legacy-admin-token"
        admin = await create_admin(
            db_session,
            session_token=SecurityManager.hash_password(session_token),
            admin_token=SecurityManager.hash_password(admin_token),
        )
        assert SecurityManager.is_legacy_bcrypt_hash(admin.session_token)

        request = _request({"X-Session-Token": session_token, "X-Admin-Token": admin_token})
        await verify_admin_session_tokens(request, admin, db_session)

        await db_session.refresh(admin)
        assert admin.session_token == SecurityManager.hash_token(session_token)
        assert admin.admin_token == SecurityManager.hash_token(admin_token)
        # Still valid after the upgrade
        await verify_admin_session_tokens(request, admin, db_session)


# ============================================================================
# Task 3: WebAuthn challenges
# ============================================================================


async def _add_passkey(db_session, admin, credential_id: bytes):
    passkey = AdminPasskeyCredential(
        admin_user_id=admin.id,
        credential_id=credential_id,
        public_key=b"public-key",
        sign_count=0,
    )
    db_session.add(passkey)
    await db_session.commit()
    return passkey


@pytest.mark.unit
@pytest.mark.auth
class TestPasskeyChallenges:
    @pytest.mark.asyncio
    async def test_options_list_only_that_admins_credentials(self, db_session):
        admin_a = await create_admin(db_session)
        admin_b = await create_admin(db_session)
        await _add_passkey(db_session, admin_a, b"cred-a-" + b"x" * 16)
        await _add_passkey(db_session, admin_b, b"cred-b-" + b"x" * 16)

        options = await PasskeyService.get_authentication_options(db_session, admin_a.username)
        ids = [c["id"] for c in options["allowCredentials"]]
        assert ids == [bytes_to_base64url(b"cred-a-" + b"x" * 16)]
        assert options["challengeId"]

    @pytest.mark.asyncio
    async def test_unknown_user_gets_same_shape(self, db_session):
        admin = await create_admin(db_session)
        await _add_passkey(db_session, admin, b"cred-real-" + b"y" * 16)

        known = await PasskeyService.get_authentication_options(db_session, admin.email)
        unknown = await PasskeyService.get_authentication_options(db_session, "nobody-here")
        assert set(known) == set(unknown)
        assert len(unknown["allowCredentials"]) == 1
        assert set(known["allowCredentials"][0]) == set(unknown["allowCredentials"][0])
        # Deterministic decoy so repeated probes look stable
        again = await PasskeyService.get_authentication_options(db_session, "nobody-here")
        assert again["allowCredentials"][0]["id"] == unknown["allowCredentials"][0]["id"]

    @pytest.mark.asyncio
    async def test_options_endpoint_requires_username(self, async_client):
        response = await async_client.post("/api/v1/auth/admin/passkey/options", json={})
        assert 400 <= response.status_code < 500
        response = await async_client.post(
            "/api/v1/auth/admin/passkey/options", json={"username": "nobody"}
        )
        assert response.status_code == 200
        assert "challengeId" in response.json()

    @pytest.mark.asyncio
    async def test_challenge_is_single_use(self):
        challenge_id = await passkey_service._store_challenge("auth", b"challenge-bytes", 7)
        record = await passkey_service._consume_challenge("auth", challenge_id)
        assert record == {"challenge": b"challenge-bytes", "admin_id": 7}
        assert await passkey_service._consume_challenge("auth", challenge_id) is None

    @pytest.mark.asyncio
    async def test_challenge_expires(self):
        challenge_id = await passkey_service._store_challenge("auth", b"c", 1)
        key = f"{KEY_PREFIX}webauthn:auth:{challenge_id}"
        value, _ = ephemeral_store._memory[key]
        ephemeral_store._memory[key] = (value, time.monotonic() - 1)
        assert await passkey_service._consume_challenge("auth", challenge_id) is None

    @pytest.mark.asyncio
    async def test_challenge_ttl_is_120s(self):
        before = time.monotonic()
        challenge_id = await passkey_service._store_challenge("register", b"c", 1)
        _, expires_at = ephemeral_store._memory[f"{KEY_PREFIX}webauthn:register:{challenge_id}"]
        assert 119 <= expires_at - before <= 121

    @pytest.mark.asyncio
    async def test_client_supplied_challenge_is_ignored(self, db_session):
        # Old payload shape: challenge taken from client-sent options
        with pytest.raises(InvalidCredentialsError):
            await PasskeyService.verify_authentication(
                db_session,
                {"options": {"challenge": "AAAA"}, "credential": {"id": "AAAA", "rawId": "AAAA"}},
            )

    @pytest.mark.asyncio
    async def test_passkey_must_belong_to_challenge_admin(self, db_session):
        admin_a = await create_admin(db_session)
        admin_b = await create_admin(db_session)
        await _add_passkey(db_session, admin_a, b"cred-a2-" + b"z" * 16)
        await _add_passkey(db_session, admin_b, b"cred-b2-" + b"z" * 16)

        options = await PasskeyService.get_authentication_options(db_session, admin_a.username)
        b_id = bytes_to_base64url(b"cred-b2-" + b"z" * 16)
        with pytest.raises(InvalidCredentialsError, match="not recognized"):
            await PasskeyService.verify_authentication(
                db_session,
                {"challengeId": options["challengeId"], "credential": {"id": b_id, "rawId": b_id}},
            )
        # The challenge was consumed by the failed attempt
        assert await passkey_service._consume_challenge("auth", options["challengeId"]) is None

    @pytest.mark.asyncio
    async def test_registration_challenge_bound_to_admin(self, db_session):
        admin_a = await create_admin(db_session)
        admin_b = await create_admin(db_session)
        options = await PasskeyService.get_registration_options(db_session, admin_a)
        assert options["challengeId"]
        with pytest.raises(InvalidInputError):
            await PasskeyService.verify_registration(
                db_session, admin_b, {"challengeId": options["challengeId"], "credential": {}}
            )
        with pytest.raises(InvalidInputError):
            await PasskeyService.verify_registration(
                db_session, admin_a, {"options": {"challenge": "AAAA"}, "credential": {}}
            )


# ============================================================================
# Task 6: failed-login throttling
# ============================================================================


@pytest.mark.unit
@pytest.mark.auth
class TestLoginThrottling:
    @pytest.mark.asyncio
    async def test_company_backoff_per_email_and_ip(self, db_session):
        company = await create_company(db_session, status=CompanyStatus.ACTIVE)
        for _ in range(LoginAttemptLimiter.PAIR_MAX_FAILURES):
            with pytest.raises(InvalidCredentialsError):
                await AuthService.authenticate_company(
                    db_session, company.rep_email, "WrongPassword1", ip_address="1.1.1.1"
                )
        # Same email + IP is now blocked, even with the right password
        with pytest.raises(RateLimitExceededError):
            await AuthService.authenticate_company(
                db_session, company.rep_email, PASSWORD, ip_address="1.1.1.1"
            )
        # The real user from another IP is unaffected
        _, tokens = await AuthService.authenticate_company(
            db_session, company.rep_email, PASSWORD, ip_address="2.2.2.2"
        )
        assert tokens["access_token"]

    @pytest.mark.asyncio
    async def test_company_success_resets_counter(self, db_session):
        company = await create_company(db_session, status=CompanyStatus.ACTIVE)
        for _ in range(LoginAttemptLimiter.PAIR_MAX_FAILURES - 1):
            with pytest.raises(InvalidCredentialsError):
                await AuthService.authenticate_company(
                    db_session, company.rep_email, "WrongPassword1", ip_address="1.1.1.1"
                )
        await AuthService.authenticate_company(
            db_session, company.rep_email, PASSWORD, ip_address="1.1.1.1"
        )
        with pytest.raises(InvalidCredentialsError):
            await AuthService.authenticate_company(
                db_session, company.rep_email, "WrongPassword1", ip_address="1.1.1.1"
            )

    @pytest.mark.asyncio
    async def test_attacker_cannot_lock_out_admin(self, db_session):
        admin = await create_admin(db_session)
        for _ in range(LoginAttemptLimiter.PAIR_MAX_FAILURES):
            with pytest.raises(InvalidCredentialsError):
                await AuthService.authenticate_admin(
                    db_session, admin.username, "WrongPassword1", ip_address="6.6.6.6"
                )
        with pytest.raises(RateLimitExceededError):
            await AuthService.authenticate_admin(
                db_session, admin.username, PASSWORD, ip_address="6.6.6.6"
            )
        assert admin.locked_until is None
        # Real admin from their own IP still gets in
        logged_in, tokens = await AuthService.authenticate_admin(
            db_session, admin.username, PASSWORD, ip_address="10.0.0.5"
        )
        assert logged_in.id == admin.id and tokens["session_token"]

    @pytest.mark.asyncio
    async def test_admin_account_locks_at_global_threshold(self, db_session, monkeypatch):
        monkeypatch.setattr(LoginAttemptLimiter, "ADMIN_GLOBAL_MAX_FAILURES", 7)
        admin = await create_admin(db_session)
        # Distributed attempts: 7 IPs x 1 failure each (no per-IP lock)
        for i in range(7):
            with pytest.raises(InvalidCredentialsError):
                await AuthService.authenticate_admin(
                    db_session, admin.username, "WrongPassword1", ip_address=f"7.7.7.{i}"
                )
        assert admin.locked_until is not None
        with pytest.raises(AccountSuspendedError):
            await AuthService.authenticate_admin(
                db_session, admin.username, PASSWORD, ip_address="10.0.0.5"
            )

    def test_default_thresholds(self):
        assert LoginAttemptLimiter.PAIR_MAX_FAILURES == 5
        assert LoginAttemptLimiter.ADMIN_GLOBAL_MAX_FAILURES >= 50
        assert LoginAttemptLimiter.GLOBAL_WINDOW_SECONDS == 3600


# ============================================================================
# Task 5: token version (service level) + column migration
# ============================================================================


@pytest.mark.unit
@pytest.mark.auth
class TestTokenVersion:
    @pytest.mark.asyncio
    async def test_tokens_carry_tv_claim(self, db_session):
        company = await create_company(db_session, status=CompanyStatus.ACTIVE, token_version=3)
        _, tokens = await AuthService.authenticate_company(db_session, company.rep_email, PASSWORD)
        assert SecurityManager.decode_token(tokens["access_token"])["tv"] == 3
        assert SecurityManager.decode_token(tokens["refresh_token"])["tv"] == 3

    def test_missing_tv_claim_treated_as_zero(self):
        user = Company(token_version=0)
        assert SecurityManager.token_version_matches({"sub": "1"}, user)
        user.token_version = 1
        assert not SecurityManager.token_version_matches({"sub": "1"}, user)

    @pytest.mark.asyncio
    async def test_password_reset_bumps_version(self, db_session):
        company = await create_company(db_session, status=CompanyStatus.ACTIVE)
        _, tokens = await AuthService.authenticate_company(db_session, company.rep_email, PASSWORD)
        reset_token = await AuthService.request_password_reset(db_session, company.rep_email)
        await AuthService.reset_password(db_session, reset_token, "BrandNewPass123")
        assert company.token_version == 1
        payload = SecurityManager.decode_token(tokens["refresh_token"])
        with pytest.raises(InvalidCredentialsError):
            await AuthService.refresh_access_token(db_session, payload, tokens["refresh_token"])

    @pytest.mark.asyncio
    async def test_change_password_bumps_version(self, db_session):
        admin = await create_admin(db_session)
        await AuthService.change_password(
            db_session, admin.id, PASSWORD, "BrandNewPass123", user_type="admin"
        )
        assert admin.token_version == 1
        assert admin.refresh_token is None

    @pytest.mark.asyncio
    async def test_ensure_token_version_columns(self, tmp_path):
        from sqlalchemy import inspect, text
        from sqlalchemy.ext.asyncio import create_async_engine

        from backend.database.base import ensure_token_version_columns

        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'legacy.db'}")
        try:
            async with engine.begin() as conn:
                await conn.execute(text("CREATE TABLE companies (id INTEGER PRIMARY KEY)"))
                await conn.execute(text("CREATE TABLE admin_users (id INTEGER PRIMARY KEY)"))
                await conn.execute(text("INSERT INTO companies (id) VALUES (1)"))

            assert await ensure_token_version_columns(engine) == ["companies", "admin_users"]
            # Idempotent
            assert await ensure_token_version_columns(engine) == []

            async with engine.connect() as conn:
                columns = await conn.run_sync(
                    lambda c: {col["name"] for col in inspect(c).get_columns("companies")}
                )
                value = (await conn.execute(text("SELECT token_version FROM companies"))).scalar()
            assert "token_version" in columns
            assert value == 0
        finally:
            await engine.dispose()
