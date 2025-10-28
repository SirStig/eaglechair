"""
EagleChair Core Configuration Module

Manages application settings using Pydantic BaseSettings for .env file integration
"""

import os
from functools import lru_cache
from typing import Optional

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict


def load_environment_file():
    """
    Load environment-specific .env file based on ENVIRONMENT variable
    
    Priority order:
    1. .env.local (highest priority - for local overrides)
    2. .env.{ENVIRONMENT} (e.g., .env.development, .env.production)
    3. .env (fallback)
    """
    # Get current environment, default to 'development'
    environment = os.getenv("ENVIRONMENT", "development")
    
    # Define file paths in priority order
    env_files = [
        ".env.local",  # Local overrides (highest priority)
        f".env.{environment}",  # Environment-specific file
        ".env",  # Fallback file
    ]
    
    # Load files in reverse order so higher priority files override lower ones
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
    ]
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: list[str] = ["*"]
    CORS_ALLOW_HEADERS: list[str] = ["*"]
    
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
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_ENABLED: bool = True
    
    # Email Configuration
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: Optional[str] = "noreply@eaglechair.com"
    SMTP_FROM_NAME: Optional[str] = "EagleChair"
    SMTP_TLS: bool = True  # Use STARTTLS (True) or SSL (False)
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
    HTTPS_REDIRECT: bool = True
    SECURE_SSL_REDIRECT: bool = True
    
    # Logging Configuration
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"
    
    # Fuzzy Search Configuration
    FUZZY_SEARCH_THRESHOLD: int = 80  # Match threshold (0-100)
    
    # Performance Configuration
    ENABLE_CACHE: bool = True
    ENABLE_COMPRESSION: bool = True
    
    # Testing Configuration
    TESTING: bool = False
    TEST_DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/eaglechair_test"
    
    model_config = SettingsConfigDict(
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )
    
    @property
    def database_url_sync(self) -> str:
        """Get synchronous database URL for Alembic migrations"""
        return self.DATABASE_URL
    
    @property
    def database_url_async(self) -> str:
        """Get asynchronous database URL for async database operations"""
        if "+asyncpg" not in self.DATABASE_URL:
            return self.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
        return self.DATABASE_URL
    
    @property
    def is_production(self) -> bool:
        """Check if running in production mode"""
        return not self.DEBUG and not self.TESTING


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

