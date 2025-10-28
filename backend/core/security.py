"""
EagleChair Security Module

Handles authentication, password hashing, JWT tokens, and security utilities
"""

from datetime import datetime, timedelta
from typing import Any, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from backend.core.config import settings

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

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
        return pwd_context.hash(password)
    
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
        return pwd_context.verify(plain_password, hashed_password)
    
    @staticmethod
    def create_access_token(
        data: dict[str, Any],
        expires_delta: Optional[timedelta] = None
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
            to_encode,
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM
        )
        return encoded_jwt
    
    @staticmethod
    def create_refresh_token(
        data: dict[str, Any],
        expires_delta: Optional[timedelta] = None
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
            to_encode,
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM
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
        
        to_encode = {
            "sub": email,
            "type": "password_reset",
            "exp": expire
        }
        
        encoded_jwt = jwt.encode(
            to_encode,
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM
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
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM]
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
            return False, f"Password must be at least {settings.PASSWORD_MIN_LENGTH} characters"
        
        if not any(char.isdigit() for char in password):
            return False, "Password must contain at least one digit"
        
        if not any(char.isupper() for char in password):
            return False, "Password must contain at least one uppercase letter"
        
        if not any(char.islower() for char in password):
            return False, "Password must contain at least one lowercase letter"
        
        return True, None


async def get_current_token(
    credentials: HTTPAuthorizationCredentials = Depends(security)
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

