"""
EagleChair Security Module

Handles authentication, password hashing, JWT tokens, and security utilities
"""

from datetime import datetime, timedelta
from typing import Any, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import bcrypt
from jose import JWTError, jwt

from backend.core.config import settings
import logging

logger = logging.getLogger(__name__)

# Password hashing context removed (using direct bcrypt)

# JWT Bearer token scheme
security = HTTPBearer()


class SecurityManager:
    """Manager for security operations"""

    @staticmethod
    def hash_password(password: str) -> str:
        """
        Hash a password using bcrypt

        Args:
            password: Plain text password

        Returns:
            str: Hashed password
        """
        return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """
        Verify a password against its hash

        Args:
            plain_password: Plain text password
            hashed_password: Hashed password

        Returns:
            bool: True if password matches
        """
        return bcrypt.checkpw(
            plain_password.encode("utf-8"), hashed_password.encode("utf-8")
        )

    @staticmethod
    def create_access_token(
        data: dict[str, Any], expires_delta: Optional[timedelta] = None
    ) -> str:
        """
        Create a JWT access token

        Args:
            data: Data to encode in the token
            expires_delta: Optional expiration time delta

        Returns:
            str: Encoded JWT token
        """
        to_encode = data.copy()

        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            # Use different expiration based on user type
            user_type = data.get("type", "company")
            if user_type == "admin":
                expire = datetime.utcnow() + timedelta(
                    minutes=settings.ADMIN_ACCESS_TOKEN_EXPIRE_MINUTES
                )
            else:
                expire = datetime.utcnow() + timedelta(
                    minutes=settings.COMPANY_ACCESS_TOKEN_EXPIRE_MINUTES
                )

        # Set expiration and token_type (keep user type from data)
        to_encode.update({"exp": expire, "token_type": "access"})
        encoded_jwt = jwt.encode(
            to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
        )
        return encoded_jwt

    @staticmethod
    def create_refresh_token(
        data: dict[str, Any], expires_delta: Optional[timedelta] = None
    ) -> str:
        """
        Create a JWT refresh token

        Args:
            data: Data to encode in the token
            expires_delta: Optional expiration time delta

        Returns:
            str: Encoded JWT token
        """
        to_encode = data.copy()

        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            # Use different expiration based on user type
            user_type = data.get("type", "company")
            if user_type == "admin":
                expire = datetime.utcnow() + timedelta(
                    days=settings.ADMIN_REFRESH_TOKEN_EXPIRE_DAYS
                )
            else:
                expire = datetime.utcnow() + timedelta(
                    days=settings.COMPANY_REFRESH_TOKEN_EXPIRE_DAYS
                )

        # Set expiration and token_type (keep user type from data)
        to_encode.update({"exp": expire, "token_type": "refresh"})
        encoded_jwt = jwt.encode(
            to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
        )
        return encoded_jwt

    @staticmethod
    def create_password_reset_token(email: str) -> str:
        """
        Create a password reset token

        Args:
            email: User email address

        Returns:
            str: Encoded JWT token
        """
        expire = datetime.utcnow() + timedelta(
            hours=settings.PASSWORD_RESET_TOKEN_EXPIRE_HOURS
        )

        to_encode = {"sub": email, "type": "password_reset", "exp": expire}

        encoded_jwt = jwt.encode(
            to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
        )
        return encoded_jwt

    @staticmethod
    def decode_token(token: str) -> dict[str, Any]:
        """
        Decode and verify a JWT token

        Args:
            token: JWT token to decode

        Returns:
            dict: Decoded token payload

        Raises:
            HTTPException: If token is invalid or expired
        """
        try:
            payload = jwt.decode(
                token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
            )
            return payload
        except JWTError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            ) from e

    @staticmethod
    def validate_password_strength(password: str) -> tuple[bool, Optional[str]]:
        """
        Validate password strength

        Args:
            password: Password to validate

        Returns:
            tuple: (is_valid, error_message)
        """
        if len(password) < settings.PASSWORD_MIN_LENGTH:
            return (
                False,
                f"Password must be at least {settings.PASSWORD_MIN_LENGTH} characters",
            )

        if not any(char.isdigit() for char in password):
            return False, "Password must contain at least one digit"

        if not any(char.isupper() for char in password):
            return False, "Password must contain at least one uppercase letter"

        if not any(char.islower() for char in password):
            return False, "Password must contain at least one lowercase letter"

        return True, None


async def get_current_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict[str, Any]:
    """
    Dependency to extract and validate JWT token from request

    Args:
        credentials: HTTP Authorization credentials

    Returns:
        dict: Decoded token payload
    """
    token = credentials.credentials
    return SecurityManager.decode_token(token)


def require_token_type(token_type: str):
    """
    Decorator to require specific token type

    Args:
        token_type: Required token type ("access" or "refresh")
    """

    async def validator(token: dict = Depends(get_current_token)):
        if token.get("type") != token_type:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token type. Expected {token_type}",
            )
        return token

    return validator


# Create security manager instance
security_manager = SecurityManager()


def set_auth_cookies(
    response: Any,
    access_token: str,
    refresh_token: str,
    session_token: Optional[str] = None,
    admin_token: Optional[str] = None,
    is_production: bool = False,
) -> None:
    """
    Set httpOnly authentication cookies with proper expiration matching token expiration

    Args:
        response: FastAPI Response object (Response or JSONResponse)
        access_token: JWT access token
        refresh_token: JWT refresh token
        session_token: Optional admin session token
        admin_token: Optional admin token
        is_production: Whether running in production (enables Secure flag)
    """
    from backend.core.config import settings

    # Cookie settings - use "lax" instead of "strict" for better cross-tab/window persistence
    # "lax" allows cookies to be sent in same-site navigations while still providing CSRF protection
    cookie_kwargs = {
        "httponly": True,
        "samesite": "lax",  # Changed from "strict" - allows cross-tab persistence
        "path": "/",
    }

    # Secure flag in production (requires HTTPS)
    if is_production:
        cookie_kwargs["secure"] = True

    # Decode tokens to get actual expiration times (without verification, we trust our own tokens)
    try:
        from jose import jwt as jose_jwt

        access_payload = jose_jwt.decode(
            access_token, None, options={"verify_signature": False}
        )
        refresh_payload = jose_jwt.decode(
            refresh_token, None, options={"verify_signature": False}
        )

        # Calculate max_age from token expiration (exp is Unix timestamp)
        access_exp = access_payload.get("exp", 0)
        refresh_exp = refresh_payload.get("exp", 0)

        # Current time in seconds since epoch
        now = int(datetime.utcnow().timestamp())

        # Calculate max_age in seconds (time until expiration)
        access_max_age = (
            max(0, access_exp - now) if access_exp else (60 * 60)
        )  # Default 1 hour
        refresh_max_age = (
            max(0, refresh_exp - now) if refresh_exp else (60 * 60 * 24 * 30)
        )  # Default 30 days

    except Exception as e:
        # Fallback to defaults if token decoding fails
        logger.warning(f"Failed to decode token for cookie expiration: {e}")
        access_max_age = 60 * 60  # 1 hour default
        refresh_max_age = 60 * 60 * 24 * 30  # 30 days default

    # Set access token cookie with actual expiration
    response.set_cookie(
        key="access_token", value=access_token, max_age=access_max_age, **cookie_kwargs
    )

    # Set refresh token cookie with actual expiration
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=refresh_max_age,
        **cookie_kwargs,
    )

    # Set admin tokens if provided (24 hours for admin sessions)
    if session_token:
        response.set_cookie(
            key="session_token",
            value=session_token,
            max_age=60 * 60 * 24,  # 24 hours (1 day)
            **cookie_kwargs,
        )

    if admin_token:
        response.set_cookie(
            key="admin_token",
            value=admin_token,
            max_age=60 * 60 * 24,  # 24 hours (1 day)
            **cookie_kwargs,
        )


def clear_auth_cookies(response: Any) -> None:
    """
    Clear all authentication cookies

    Args:
        response: FastAPI Response object (Response or JSONResponse)
    """
    # Use same cookie settings as set_auth_cookies for proper clearing
    cookie_kwargs = {
        "httponly": True,
        "samesite": "lax",  # Match the setting used in set_auth_cookies
        "path": "/",
    }
    cookies_to_clear = ["access_token", "refresh_token", "session_token", "admin_token"]

    for cookie_name in cookies_to_clear:
        response.delete_cookie(
            key=cookie_name,
            path="/",
            samesite="lax",  # Match the setting used in set_auth_cookies
        )
