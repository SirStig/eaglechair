"""
EagleChair API Versioning System

Manages API versions, deprecation, and version information
"""

from enum import Enum
from typing import Optional
from pydantic import BaseModel
from datetime import datetime


class APIVersionStatus(str, Enum):
    """API version status"""
    STABLE = "stable"
    DEPRECATED = "deprecated"
    BETA = "beta"
    ALPHA = "alpha"


class APIVersionInfo(BaseModel):
    """API Version Information"""
    version: str
    status: APIVersionStatus
    release_date: str
    deprecation_date: Optional[str] = None
    sunset_date: Optional[str] = None
    description: str
    changelog: list[str] = []
    breaking_changes: list[str] = []
    endpoints_count: int
    documentation_url: str


# ============================================================================
# Version Registry
# ============================================================================

API_VERSIONS = {
    "v1": APIVersionInfo(
        version="1.0.0",
        status=APIVersionStatus.STABLE,
        release_date="2025-10-02",
        description="Initial stable release with full B2B functionality",
        changelog=[
            "Company account management",
            "Admin panel with enhanced security",
            "Comprehensive product catalog (chairs, booths, tables, bar stools)",
            "Quote request system",
            "Shopping cart (quote-only, no purchasing)",
            "Legal documents management",
            "FAQ system",
            "Catalogs and guides",
            "Installation gallery",
            "Contact information",
            "Feedback system",
        ],
        breaking_changes=[],
        endpoints_count=50,  # Update this as endpoints are added
        documentation_url="/api/v1/docs"
    ),
    "v2": APIVersionInfo(
        version="2.0.0",
        status=APIVersionStatus.ALPHA,
        release_date="TBD",
        description="Future version with enhanced features (in development)",
        changelog=[
            "To be determined"
        ],
        breaking_changes=[
            "To be determined"
        ],
        endpoints_count=0,
        documentation_url="/api/v2/docs"
    )
}


def get_api_version_info(version: str) -> Optional[APIVersionInfo]:
    """
    Get API version information
    
    Args:
        version: API version (e.g., "v1")
        
    Returns:
        APIVersionInfo or None if version not found
    """
    return API_VERSIONS.get(version)


def get_all_versions() -> dict[str, APIVersionInfo]:
    """
    Get all API versions
    
    Returns:
        Dictionary of all API versions
    """
    return API_VERSIONS


def get_latest_version() -> str:
    """
    Get the latest stable API version
    
    Returns:
        Latest version identifier
    """
    return "v1"  # Update as new versions are released


def is_version_deprecated(version: str) -> bool:
    """
    Check if an API version is deprecated
    
    Args:
        version: API version to check
        
    Returns:
        True if deprecated, False otherwise
    """
    version_info = get_api_version_info(version)
    if not version_info:
        return False
    return version_info.status == APIVersionStatus.DEPRECATED


def get_deprecation_info(version: str) -> Optional[dict]:
    """
    Get deprecation information for a version
    
    Args:
        version: API version
        
    Returns:
        Deprecation info or None
    """
    version_info = get_api_version_info(version)
    if not version_info or not is_version_deprecated(version):
        return None
    
    return {
        "version": version,
        "status": version_info.status,
        "deprecation_date": version_info.deprecation_date,
        "sunset_date": version_info.sunset_date,
        "message": f"API {version} is deprecated and will be sunset on {version_info.sunset_date}",
        "migration_guide": f"Please migrate to the latest version: {get_latest_version()}",
        "documentation_url": version_info.documentation_url
    }

