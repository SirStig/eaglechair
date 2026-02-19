"""
EagleChair Core Configuration Module

Manages application settings using Pydantic BaseSettings for .env file integration
"""

import json
import os
from functools import lru_cache
from typing import Optional

from dotenv import load_dotenv
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def load_environment_file():
    """
    Load environment-specific .env file based on ENVIRONMENT variable

    If FILL_SCRIPT_ENV_FILE is set (by fill_products_from_catalog --env-file), only
    that file is loaded so production values are not overridden by backend/.env.local.

    Otherwise priority order:
    1. backend/.env.local (highest priority - for local overrides)
    2. backend/.env.{ENVIRONMENT} (e.g., .env.development, .env.production)
    3. backend/.env (fallback)
    """
    fill_env = os.environ.get("FILL_SCRIPT_ENV_FILE")
    if fill_env and os.path.isfile(fill_env):
        load_dotenv(fill_env, override=True)
        return

    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    environment = os.getenv("ENVIRONMENT", "development")
    env_files = [
        os.path.join(backend_dir, ".env.local"),
        os.path.join(backend_dir, f".env.{environment}"),
        os.path.join(backend_dir, ".env"),
    ]
    for env_file in reversed(env_files):
        if os.path.exists(env_file):
            load_dotenv(env_file, override=True)
            print(f"Loaded environment file: {env_file}")


# Load environment files before creating Settings
load_environment_file()


class Settings(BaseSettings):
    """
    Application Settings

    All configuration values can be set via environment variables or .env file
    """

    # Application Info
    APP_NAME: str = "EagleChair API"
    APP_VERSION: str = "1.0.0"
    APP_DESCRIPTION: str = "Premium Chair Company Backend API"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # API Configuration
    API_V1_PREFIX: str = "/api/v1"
    API_V2_PREFIX: str = "/api/v2"

    # Server Configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    RELOAD: bool = True

    # CORS Configuration
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://eaglechair.com",
        "https://joshua.eaglechair.com",
        "https://www.eaglechair.com",
    ]
    CORS_ALLOW_CREDENTIALS: bool = True
    # Restricted methods for security - only allow necessary HTTP methods
    CORS_ALLOW_METHODS: list[str] = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    # Restricted headers - only allow necessary headers
    CORS_ALLOW_HEADERS: list[str] = [
        "Authorization",
        "Content-Type",
        "X-Session-Token",
        "X-Admin-Token",
        "X-Request-ID",
    ]

    @field_validator(
        "CORS_ORIGINS", "CORS_ALLOW_METHODS", "CORS_ALLOW_HEADERS", mode="before"
    )
    @classmethod
    def parse_json_list(cls, v):
        """Parse JSON string from .env file into Python list"""
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                # If it's not valid JSON, treat it as a single item list
                return [v]
        return v

    # Database Configuration
    DATABASE_URL: str = "postgresql://postgres:postgres@postgres:5432/eaglechair"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10
    DATABASE_ECHO: bool = False

    # Redis Configuration (for caching)
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_CACHE_TTL: int = 300  # 5 minutes default

    # Security Configuration
    SECRET_KEY: str = "your-secret-key-change-this-in-production"
    ALGORITHM: str = "HS256"

    # Token Expiration - Company Users (longer sessions for business users)
    COMPANY_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60  # 1 hour
    COMPANY_REFRESH_TOKEN_EXPIRE_DAYS: int = 30  # 30 days

    # Token Expiration - Admin Users (shorter sessions for security)
    ADMIN_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30  # 30 minutes
    ADMIN_REFRESH_TOKEN_EXPIRE_DAYS: int = 1  # 1 day

    # Password Reset
    PASSWORD_RESET_TOKEN_EXPIRE_HOURS: int = 1  # 1 hour
    PASSWORD_MIN_LENGTH: int = 8

    # Rate Limiting (increased for normal website usage with multiple parallel requests)
    RATE_LIMIT_PER_MINUTE: int = (
        120  # Increased from 60 to accommodate page loads with multiple API calls
    )
    RATE_LIMIT_ENABLED: bool = True  # Can be overridden by TESTING mode

    # Email Configuration (SMTP)
    # REQUIRED for sending emails:
    # - SMTP_HOST: SMTP server hostname (e.g., "smtp.gmail.com", "mail.yourdomain.com")
    # - SMTP_USER: SMTP username/email for authentication (e.g., "noreply@yourdomain.com")
    # - SMTP_PASSWORD: SMTP password for authentication (app-specific password for Gmail, etc.)
    # Optional:
    # - SMTP_PORT: SMTP port (default: 587 for STARTTLS, 465 for SSL)
    # - SMTP_TLS: Use STARTTLS (True, default) or SSL/TLS (False)
    SMTP_HOST: Optional[str] = None  # REQUIRED: SMTP server hostname
    SMTP_PORT: int = 587  # SMTP port (587 for STARTTLS, 465 for SSL)
    SMTP_USER: Optional[str] = None  # REQUIRED: SMTP username/email for authentication
    SMTP_PASSWORD: Optional[str] = None  # REQUIRED: SMTP password for authentication
    SMTP_FROM_EMAIL: Optional[str] = "noreply@eaglechair.com"  # From email address
    SMTP_FROM_NAME: Optional[str] = "EagleChair"  # From name
    SMTP_TLS: bool = True  # Use STARTTLS (True, default for port 587) or SSL/TLS (False, for port 465)
    ADMIN_EMAIL: str = "admin@eaglechair.com"  # For admin notifications

    # AWS Configuration (for media storage)
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "us-east-1"
    AWS_S3_BUCKET: Optional[str] = None

    # Payment Configuration (Stripe)
    STRIPE_PUBLIC_KEY: Optional[str] = None
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None

    # DreamHost HTTPS Configuration
    HTTPS_REDIRECT: bool = False  # Disable - proxy handles HTTPS
    SECURE_SSL_REDIRECT: bool = False  # Disable - proxy handles HTTPS

    # Reverse Proxy Configuration (DreamHost VPS)
    # IMPORTANT: Set FORWARDED_ALLOW_IPS to your specific proxy IP(s) in production
    # Example: "127.0.0.1,::1" for local proxy, or "203.0.113.0/24" for CIDR notation
    # DO NOT use "*" in production - this trusts all proxies and is a security risk
    FORWARDED_ALLOW_IPS: str = (
        "*"  # Development default - MUST be overridden in production
    )
    ROOT_PATH: str = ""  # Set to "/api" if proxy strips path prefix
    ALLOWED_HOSTS: list[str] = ["*"]  # Or specify your domain
    PROXY_HEADERS: bool = True  # Enable proxy header support

    # Logging Configuration
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"

    # Fuzzy Search Configuration
    FUZZY_SEARCH_THRESHOLD: int = 80  # Match threshold (0-100)

    # Frontend Configuration
    # Path to frontend root directory for serving temporary files
    # Dev: frontend, Prod: /home/dh_wmujeb/joshua.eaglechair.com
    FRONTEND_PATH: str = "frontend"
    FRONTEND_URL: str = "http://localhost:5173"  # Frontend URL for email links

    # Image Configuration
    IMAGE_BASE_URL: str = "https://www.eaglechair.com"  # Base URL for product images

    # Performance Configuration
    ENABLE_CACHE: bool = True
    ENABLE_COMPRESSION: bool = True

    # Testing Configuration
    TESTING: bool = False
    TEST_DATABASE_URL: str = (
        "postgresql+asyncpg://user:password@localhost:5432/eaglechair_test"
    )

    model_config = SettingsConfigDict(
        env_file_encoding="utf-8", case_sensitive=True, extra="ignore"
    )

    @property
    def database_url_sync(self) -> str:
        """Get synchronous database URL for Alembic migrations"""
        return self.DATABASE_URL

    @property
    def database_url_async(self) -> str:
        """Get asynchronous database URL for async database operations"""
        # MySQL uses aiomysql for async operations
        if self.DATABASE_URL.startswith("mysql://"):
            return self.DATABASE_URL.replace("mysql://", "mysql+aiomysql://")
        elif self.DATABASE_URL.startswith("mysql+aiomysql://"):
            return self.DATABASE_URL
        # PostgreSQL uses asyncpg for async operations
        elif "+asyncpg" not in self.DATABASE_URL:
            return self.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
        return self.DATABASE_URL

    @property
    def is_production(self) -> bool:
        """Check if running in production mode"""
        return not self.DEBUG and not self.TESTING

    @model_validator(mode="after")
    def validate_production_settings(self):
        """
        Validate that production environment is properly configured.

        This validator runs after all fields are set and ensures that:
        - SECRET_KEY is not the default value
        - SECRET_KEY meets minimum length requirements
        - DATABASE_URL is not the default value
        - DEBUG is False
        - Required production variables are set
        """
        if not self.is_production:
            # Skip validation in development/testing
            return self

        errors = []

        # Validate SECRET_KEY
        default_secret = "your-secret-key-change-this-in-production"
        if self.SECRET_KEY == default_secret:
            errors.append(
                "SECRET_KEY must be set via environment variable in production. "
                "Default value is not allowed."
            )
        elif len(self.SECRET_KEY) < 32:
            errors.append(
                f"SECRET_KEY must be at least 32 characters in production. "
                f"Current length: {len(self.SECRET_KEY)}"
            )

        # Validate DATABASE_URL
        default_db_url = "postgresql://postgres:postgres@postgres:5432/eaglechair"
        if self.DATABASE_URL == default_db_url:
            errors.append(
                "DATABASE_URL must be set via environment variable in production. "
                "Default value is not allowed."
            )

        # Validate DEBUG is False
        if self.DEBUG:
            errors.append(
                "DEBUG must be False in production. Set DEBUG=false in environment variables."
            )

        # Validate required production variables
        required_vars = {
            "SMTP_HOST": self.SMTP_HOST,
            "SMTP_USER": self.SMTP_USER,
            "SMTP_PASSWORD": self.SMTP_PASSWORD,
        }

        missing_vars = [var for var, value in required_vars.items() if not value]
        if missing_vars:
            errors.append(
                f"Required production variables are missing: {', '.join(missing_vars)}. "
                "Please set these via environment variables."
            )

        # Validate FORWARDED_ALLOW_IPS is not wildcard
        if self.FORWARDED_ALLOW_IPS == "*":
            errors.append(
                "FORWARDED_ALLOW_IPS should be set to specific proxy IP addresses in production, "
                "not '*' (wildcard). Set FORWARDED_ALLOW_IPS to your proxy IP(s)."
            )

        if errors:
            error_message = "Production environment validation failed:\n" + "\n".join(
                f"  - {err}" for err in errors
            )
            raise ValueError(error_message)

        return self


@lru_cache()
def get_settings() -> Settings:
    """
    Get cached settings instance

    Returns:
        Settings: Application settings singleton
    """
    return Settings()


# Create a global settings instance
settings = get_settings()
