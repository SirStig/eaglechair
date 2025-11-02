"""
Authentication Service

Handles user authentication, token generation, and password management
"""

import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.exceptions import (
    AccountNotVerifiedError,
    AccountSuspendedError,
    InvalidCredentialsError,
    InvalidInputError,
    ResourceAlreadyExistsError,
    ResourceNotFoundError,
)
from backend.core.logging_config import security_logger
from backend.core.security import security_manager
from backend.core.config import settings
from backend.models.company import AdminUser, Company
from backend.services.email_service import EmailService

logger = logging.getLogger(__name__)


class AuthService:
    """Service for authentication operations"""
    
    @staticmethod
    async def register_company(
        db: AsyncSession,
        email: str,
        password: str,
        company_data: dict
    ) -> Company:
        """
        Register a new company account
        
        Args:
            db: Database session
            email: Company representative email
            password: Password for the account
            company_data: Additional company information
            
        Returns:
            Created company account
            
        Raises:
            ResourceAlreadyExistsError: If email or username already exists
        """
        logger.info(f"Attempting to register new company with email: {email}")
        
        # Check if email already exists
        result = await db.execute(
            select(Company).where(Company.rep_email == email)
        )
        existing_company = result.scalar_one_or_none()
        
        if existing_company:
            logger.warning(f"Registration failed: Email {email} already exists")
            raise ResourceAlreadyExistsError(
                resource_type="Company",
                field="email"
            )
        
        # Hash password
        hashed_password = security_manager.hash_password(password)
        
        # Remove rep_email from company_data if it exists to avoid duplicate keyword argument
        company_data_clean = {k: v for k, v in company_data.items() if k != 'rep_email'}
        
        # Generate email verification token
        verification_token = security_manager.create_password_reset_token(email)  # Reuse this method for verification
        
        # Create company (not verified initially)
        new_company = Company(
            rep_email=email,
            hashed_password=hashed_password,
            email_verification_token=verification_token,
            is_verified=False,  # Must verify email before account is activated
            **company_data_clean
        )
        
        db.add(new_company)
        await db.commit()
        await db.refresh(new_company)
        
        # Send verification email
        verification_url = f"{settings.FRONTEND_URL}/verify-email?token={verification_token}"
        try:
            await EmailService.send_email_verification(
                db=db,
                to_email=email,
                company_name=new_company.company_name,
                verification_url=verification_url
            )
            logger.info(f"Verification email sent to {email}")
        except Exception as e:
            logger.error(f"Failed to send verification email: {e}", exc_info=True)
            # Don't fail registration if email fails, but log it
        
        logger.info(f"Successfully registered company: {new_company.company_name} (ID: {new_company.id})")
        
        return new_company
    
    @staticmethod
    async def authenticate_company(
        db: AsyncSession,
        email: str,
        password: str,
        ip_address: Optional[str] = None
    ) -> tuple[Company, dict]:
        """
        Authenticate company and generate tokens
        
        Args:
            db: Database session
            email: Company email
            password: Password
            ip_address: Client IP address (for logging)
            
        Returns:
            Tuple of (company, tokens_dict)
            
        Raises:
            InvalidCredentialsError: If credentials are invalid
            AccountSuspendedError: If account is suspended
            AccountNotVerifiedError: If account needs verification
        """
        logger.info(f"Authentication attempt for company email: {email}")
        
        # Find company by email
        result = await db.execute(
            select(Company).where(Company.rep_email == email)
        )
        company = result.scalar_one_or_none()
        
        # Verify company exists and password is correct
        if not company or not security_manager.verify_password(password, company.hashed_password):
            logger.warning(f"Failed login attempt for {email} from {ip_address}")
            if ip_address:
                security_logger.log_failed_login(email, ip_address, "invalid credentials")
            raise InvalidCredentialsError()
        
        # Check account status
        if not company.is_active:
            logger.warning(f"Login attempt for inactive account: {email}")
            raise AccountSuspendedError()
        
        # Allow unverified accounts to log in, but restrict quote creation
        # Verification status will be returned in login response
        if not company.is_verified:
            logger.info(f"Login successful for unverified account: {email} - quote creation will be restricted")
        
        # Generate tokens
        token_data = {
            "sub": str(company.id),
            "email": company.rep_email,
            "type": "company",
            "company_name": company.company_name
        }
        
        access_token = security_manager.create_access_token(token_data)
        refresh_token = security_manager.create_refresh_token(token_data)
        
        # Store refresh token and expiration in database
        from backend.core.config import settings
        refresh_expires = datetime.utcnow() + timedelta(days=settings.COMPANY_REFRESH_TOKEN_EXPIRE_DAYS)
        company.refresh_token = refresh_token
        company.refresh_token_expires = refresh_expires.isoformat()
        await db.commit()
        
        logger.info(f"Successful login for company: {company.company_name} (ID: {company.id})")
        
        return company, {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer"
        }
    
    @staticmethod
    async def authenticate_admin(
        db: AsyncSession,
        username: str,
        password: str,
        ip_address: Optional[str] = None,
        two_factor_code: Optional[str] = None
    ) -> tuple[AdminUser, dict]:
        """
        Authenticate admin user with enhanced security
        
        Args:
            db: Database session
            username: Admin username
            password: Admin password
            ip_address: Client IP address
            two_factor_code: Optional 2FA code
            
        Returns:
            Tuple of (admin_user, tokens_dict)
            
        Raises:
            InvalidCredentialsError: If credentials are invalid
            AccountSuspendedError: If account is locked
        """
        logger.info(f"Admin authentication attempt for username: {username}")
        
        # Find admin by username
        result = await db.execute(
            select(AdminUser).where(AdminUser.username == username)
        )
        admin = result.scalar_one_or_none()
        
        # Check if account is locked
        if admin and admin.locked_until:
            locked_until = datetime.fromisoformat(admin.locked_until)
            if datetime.utcnow() < locked_until:
                logger.warning(f"Login attempt for locked admin account: {username}")
                raise AccountSuspendedError()
            else:
                # Unlock account
                admin.locked_until = None
                admin.failed_login_attempts = 0
        
        # Verify credentials
        if not admin or not security_manager.verify_password(password, admin.hashed_password):
            # Increment failed login attempts
            if admin:
                admin.failed_login_attempts += 1
                
                # Lock account after 5 failed attempts
                if admin.failed_login_attempts >= 5:
                    admin.locked_until = (datetime.utcnow() + timedelta(minutes=30)).isoformat()
                    await db.commit()
                    logger.warning(f"Admin account locked due to failed attempts: {username}")
                
                await db.commit()
            
            logger.warning(f"Failed admin login attempt for {username} from {ip_address}")
            if ip_address:
                security_logger.log_failed_login(username, ip_address, "invalid credentials")
            
            raise InvalidCredentialsError()
        
        # Check if account is active
        if not admin.is_active:
            logger.warning(f"Login attempt for inactive admin account: {username}")
            raise AccountSuspendedError()
        
        # Check 2FA if enabled
        if admin.is_2fa_enabled:
            if not two_factor_code:
                raise InvalidInputError(
                    field="two_factor_code",
                    reason="Two-factor authentication code is required"
                )
            # TODO: Implement actual 2FA verification
            # For now, we'll skip this check
        
        # Reset failed login attempts on successful login
        admin.failed_login_attempts = 0
        admin.last_login = datetime.utcnow().isoformat()
        admin.last_login_ip = ip_address
        await db.commit()
        
        # Generate tokens (including admin-specific tokens)
        token_data = {
            "sub": str(admin.id),
            "username": admin.username,
            "email": admin.email,
            "role": admin.role.value,
            "type": "admin"
        }
        
        access_token = security_manager.create_access_token(token_data)
        refresh_token = security_manager.create_refresh_token(token_data)
        
        # Generate session and admin tokens (for dual token security)
        import secrets
        session_token = secrets.token_urlsafe(32)
        admin_token = secrets.token_urlsafe(32)
        
        # Hash tokens before storing (like passwords) for security
        # Store hashed tokens - original tokens only returned in response
        hashed_session_token = security_manager.hash_password(session_token)
        hashed_admin_token = security_manager.hash_password(admin_token)
        
        # Store tokens in database (including refresh token)
        from backend.core.config import settings
        refresh_expires = datetime.utcnow() + timedelta(days=settings.ADMIN_REFRESH_TOKEN_EXPIRE_DAYS)
        admin.session_token = hashed_session_token
        admin.admin_token = hashed_admin_token
        admin.refresh_token = refresh_token
        admin.refresh_token_expires = refresh_expires.isoformat()
        await db.commit()
        
        logger.info(f"Successful admin login: {username} (ID: {admin.id}, Role: {admin.role.value})")
        security_logger.log_admin_action(
            admin_id=admin.id,
            action="LOGIN",
            resource="auth",
            ip_address=ip_address or "unknown"
        )
        
        return admin, {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "session_token": session_token,
            "admin_token": admin_token,
            "token_type": "bearer"
        }
    
    @staticmethod
    async def refresh_access_token(
        db: AsyncSession,
        token_payload: dict,
        provided_refresh_token: str
    ) -> dict:
        """
        Refresh access token using refresh token payload
        
        Args:
            db: Database session
            token_payload: Decoded refresh token payload
            provided_refresh_token: The actual refresh token string (for validation)
            
        Returns:
            New tokens dictionary
            
        Raises:
            ResourceNotFoundError: If user not found
            AccountSuspendedError: If account is inactive
            InvalidCredentialsError: If refresh token doesn't match stored token
        """
        user_id = int(token_payload.get("sub"))
        user_type = token_payload.get("type", "company")
        
        # Fetch user based on type
        if user_type == "admin":
            result = await db.execute(
                select(AdminUser).where(AdminUser.id == user_id)
            )
            user = result.scalar_one_or_none()
        else:
            result = await db.execute(
                select(Company).where(Company.id == user_id)
            )
            user = result.scalar_one_or_none()
        
        if not user:
            logger.warning(f"Token refresh failed: User {user_id} not found")
            raise ResourceNotFoundError(resource_type="User", resource_id=user_id)
        
        if not user.is_active:
            raise AccountSuspendedError()
        
        # Validate the refresh token matches the stored one
        if user.refresh_token != provided_refresh_token:
            logger.warning(f"Token refresh failed: Invalid refresh token for user {user_id}")
            raise InvalidCredentialsError("Invalid refresh token")
        
        # Check if refresh token has expired
        if user.refresh_token_expires:
            token_expires = datetime.fromisoformat(user.refresh_token_expires)
            if datetime.utcnow() > token_expires:
                logger.warning(f"Token refresh failed: Expired refresh token for user {user_id}")
                # Clear expired token
                user.refresh_token = None
                user.refresh_token_expires = None
                await db.commit()
                raise InvalidCredentialsError("Refresh token has expired. Please log in again.")
        
        # Generate new tokens with updated data
        if user_type == "admin":
            token_data = {
                "sub": str(user.id),
                "username": user.username,
                "email": user.email,
                "role": user.role.value,
                "type": "admin"
            }
        else:
            token_data = {
                "sub": str(user.id),
                "email": user.rep_email,
                "type": "company",
                "company_name": user.company_name
            }
        
        access_token = security_manager.create_access_token(token_data)
        refresh_token = security_manager.create_refresh_token(token_data)
        
        # Update stored refresh token
        from backend.core.config import settings
        if user_type == "admin":
            refresh_expires = datetime.utcnow() + timedelta(days=settings.ADMIN_REFRESH_TOKEN_EXPIRE_DAYS)
        else:
            refresh_expires = datetime.utcnow() + timedelta(days=settings.COMPANY_REFRESH_TOKEN_EXPIRE_DAYS)
        
        user.refresh_token = refresh_token
        user.refresh_token_expires = refresh_expires.isoformat()
        await db.commit()
        
        logger.info(f"Token refreshed for {user_type} user ID: {user_id}")
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer"
        }
    
    @staticmethod
    async def change_password(
        db: AsyncSession,
        user_id: int,
        current_password: str,
        new_password: str,
        user_type: str = "company"
    ) -> bool:
        """
        Change user password
        
        Args:
            db: Database session
            user_id: User ID
            current_password: Current password
            new_password: New password
            user_type: "company" or "admin"
            
        Returns:
            True if successful
            
        Raises:
            InvalidCredentialsError: If current password is wrong
            ResourceNotFoundError: If user not found
        """
        # Fetch user
        if user_type == "admin":
            result = await db.execute(
                select(AdminUser).where(AdminUser.id == user_id)
            )
            user = result.scalar_one_or_none()
        else:
            result = await db.execute(
                select(Company).where(Company.id == user_id)
            )
            user = result.scalar_one_or_none()
        
        if not user:
            raise ResourceNotFoundError(resource_type="User", resource_id=user_id)
        
        # Verify current password
        if not security_manager.verify_password(current_password, user.hashed_password):
            logger.warning(f"Password change failed: Invalid current password for user {user_id}")
            raise InvalidCredentialsError("Current password is incorrect")
        
        # Hash and set new password
        user.hashed_password = security_manager.hash_password(new_password)
        await db.commit()
        
        logger.info(f"Password changed successfully for {user_type} user ID: {user_id}")
        
        return True
    
    @staticmethod
    async def request_password_reset(
        db: AsyncSession,
        email: str
    ) -> str:
        """
        Generate password reset token for company user
        
        Args:
            db: Database session
            email: Company email address
            
        Returns:
            Password reset token
            
        Raises:
            ResourceNotFoundError: If company not found
        """
        logger.info(f"Password reset requested for email: {email}")
        
        # Find company by email
        result = await db.execute(
            select(Company).where(Company.rep_email == email)
        )
        company = result.scalar_one_or_none()
        
        if not company:
            # Don't reveal if email exists or not (security best practice)
            logger.warning(f"Password reset attempted for non-existent email: {email}")
            # Return success but don't actually do anything
            return ""
        
        # Generate password reset token
        reset_token = security_manager.create_password_reset_token(email)
        
        # Store token and expiration
        from backend.core.config import settings
        expires = datetime.utcnow() + timedelta(hours=settings.PASSWORD_RESET_TOKEN_EXPIRE_HOURS)
        company.password_reset_token = reset_token
        company.password_reset_expires = expires.isoformat()
        await db.commit()
        
        logger.info(f"Password reset token generated for company ID: {company.id}")
        
        return reset_token
    
    @staticmethod
    async def reset_password(
        db: AsyncSession,
        token: str,
        new_password: str
    ) -> bool:
        """
        Reset password using reset token
        
        Args:
            db: Database session
            token: Password reset token
            new_password: New password
            
        Returns:
            True if successful
            
        Raises:
            InvalidCredentialsError: If token is invalid or expired
            ResourceNotFoundError: If company not found
        """
        # Decode token to get email
        try:
            payload = security_manager.decode_token(token)
            if payload.get("type") != "password_reset":
                raise InvalidCredentialsError("Invalid reset token")
            email = payload.get("sub")
        except Exception as e:
            logger.warning(f"Invalid password reset token: {str(e)}")
            raise InvalidCredentialsError("Invalid or expired reset token")
        
        # Find company by email
        result = await db.execute(
            select(Company).where(Company.rep_email == email)
        )
        company = result.scalar_one_or_none()
        
        if not company:
            logger.warning(f"Password reset failed: Company not found for email {email}")
            raise ResourceNotFoundError(resource_type="Company", resource_id=email)
        
        # Verify token matches stored token
        if company.password_reset_token != token:
            logger.warning(f"Password reset failed: Token mismatch for company {company.id}")
            raise InvalidCredentialsError("Invalid reset token")
        
        # Check if token has expired
        if company.password_reset_expires:
            expires = datetime.fromisoformat(company.password_reset_expires)
            if datetime.utcnow() > expires:
                logger.warning(f"Password reset failed: Expired token for company {company.id}")
                # Clear expired token
                company.password_reset_token = None
                company.password_reset_expires = None
                await db.commit()
                raise InvalidCredentialsError("Reset token has expired. Please request a new one.")
        
        # Update password
        company.hashed_password = security_manager.hash_password(new_password)
        
        # Clear reset token
        company.password_reset_token = None
        company.password_reset_expires = None
        
        # Invalidate existing refresh tokens (force re-login)
        company.refresh_token = None
        company.refresh_token_expires = None
        
        await db.commit()
        
        logger.info(f"Password reset successful for company ID: {company.id}")
        
        return True
    
    @staticmethod
    async def verify_email(
        db: AsyncSession,
        token: str
    ) -> bool:
        """
        Verify company email address using verification token
        
        Args:
            db: Database session
            token: Email verification token
            
        Returns:
            True if successful
            
        Raises:
            InvalidCredentialsError: If token is invalid or expired
            ResourceNotFoundError: If company not found
        """
        # Decode token to get email
        try:
            payload = security_manager.decode_token(token)
            email = payload.get("sub")
        except Exception as e:
            logger.warning(f"Invalid email verification token: {str(e)}")
            raise InvalidCredentialsError("Invalid or expired verification token")
        
        # Find company by email
        result = await db.execute(
            select(Company).where(Company.rep_email == email)
        )
        company = result.scalar_one_or_none()
        
        if not company:
            logger.warning(f"Email verification failed: Company not found for email {email}")
            raise ResourceNotFoundError(resource_type="Company", resource_id=email)
        
        # Verify token matches stored token
        if company.email_verification_token != token:
            logger.warning(f"Email verification failed: Token mismatch for company {company.id}")
            raise InvalidCredentialsError("Invalid verification token")
        
        # Check if already verified
        if company.is_verified:
            logger.info(f"Email already verified for company {company.id}")
            return True
        
        # Mark email as verified
        company.is_verified = True
        company.email_verified_at = datetime.utcnow().isoformat()
        company.email_verification_token = None  # Clear token after verification
        
        await db.commit()
        
        logger.info(f"Email verified successfully for company ID: {company.id}")
        
        return True
    
    @staticmethod
    async def resend_verification_email(
        db: AsyncSession,
        email: str
    ) -> bool:
        """
        Resend email verification email
        
        Args:
            db: Database session
            email: Company email address
            
        Returns:
            True if email was sent (even if company doesn't exist, for security)
            
        Raises:
            ResourceNotFoundError: If company not found
        """
        logger.info(f"Resending verification email to: {email}")
        
        # Find company by email
        result = await db.execute(
            select(Company).where(Company.rep_email == email)
        )
        company = result.scalar_one_or_none()
        
        if not company:
            # Don't reveal if email exists or not (security best practice)
            logger.warning(f"Verification resend attempted for non-existent email: {email}")
            return True  # Return success anyway
        
        # Check if already verified
        if company.is_verified:
            logger.info(f"Email already verified for company {company.id}, skipping resend")
            return True
        
        # Generate new verification token
        verification_token = security_manager.create_password_reset_token(email)  # Reuse this method
        
        # Store token
        company.email_verification_token = verification_token
        await db.commit()
        
        # Send verification email
        verification_url = f"{settings.FRONTEND_URL}/verify-email?token={verification_token}"
        try:
            await EmailService.send_email_verification(
                db=db,
                to_email=email,
                company_name=company.company_name,
                verification_url=verification_url
            )
            logger.info(f"Verification email resent to {email}")
            return True
        except Exception as e:
            logger.error(f"Failed to resend verification email: {e}", exc_info=True)
            return False

