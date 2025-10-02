"""
Authentication Service

Handles user authentication, token generation, and password management
"""

import logging
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.models.company import Company, AdminUser
from backend.core.security import security_manager
from backend.core.exceptions import (
    InvalidCredentialsError,
    AccountSuspendedError,
    AccountNotVerifiedError,
    ResourceAlreadyExistsError,
    ResourceNotFoundError,
    InvalidInputError,
)
from backend.core.logging_config import security_logger


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
        
        # Create company
        new_company = Company(
            rep_email=email,
            hashed_password=hashed_password,
            **company_data
        )
        
        db.add(new_company)
        await db.commit()
        await db.refresh(new_company)
        
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
        
        # In production, you might want to require verification
        # if not company.is_verified:
        #     raise AccountNotVerifiedError()
        
        # Generate tokens
        token_data = {
            "sub": str(company.id),
            "email": company.rep_email,
            "type": "company",
            "company_name": company.company_name
        }
        
        access_token = security_manager.create_access_token(token_data)
        refresh_token = security_manager.create_refresh_token(token_data)
        
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
        import uuid
        session_token = str(uuid.uuid4())
        admin_token = str(uuid.uuid4())
        
        # Store tokens in database
        admin.session_token = session_token
        admin.admin_token = admin_token
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
        token_payload: dict
    ) -> dict:
        """
        Refresh access token using refresh token payload
        
        Args:
            db: Database session
            token_payload: Decoded refresh token payload
            
        Returns:
            New tokens dictionary
            
        Raises:
            ResourceNotFoundError: If user not found
            AccountSuspendedError: If account is inactive
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

