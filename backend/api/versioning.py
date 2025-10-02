"""
API Versioning Routes

Endpoints for API version information
"""

from fastapi import APIRouter
from typing import Dict

from backend.core.versioning import (
    get_api_version_info,
    get_all_versions,
    get_latest_version,
    get_deprecation_info,
    APIVersionInfo
)


router = APIRouter(tags=["API Versioning"])


@router.get("/versions", response_model=Dict[str, APIVersionInfo])
async def list_api_versions():
    """
    List all available API versions
    
    Returns information about all API versions including:
    - Version number
    - Status (stable, deprecated, beta, alpha)
    - Release and deprecation dates
    - Changelog
    - Breaking changes
    - Documentation URLs
    """
    return get_all_versions()


@router.get("/versions/latest")
async def get_latest_api_version():
    """
    Get the latest stable API version
    
    Returns the identifier of the latest stable API version
    """
    latest = get_latest_version()
    version_info = get_api_version_info(latest)
    
    return {
        "latest_version": latest,
        "version_info": version_info,
        "recommended_base_url": f"/api/{latest}"
    }


@router.get("/versions/{version}", response_model=APIVersionInfo)
async def get_version_info(version: str):
    """
    Get detailed information about a specific API version
    
    Args:
        version: API version identifier (e.g., "v1", "v2")
        
    Returns detailed version information including:
    - Version number and status
    - Release date
    - Deprecation status
    - Changelog
    - Breaking changes
    - Endpoints count
    - Documentation URL
    """
    version_info = get_api_version_info(version)
    
    if not version_info:
        return {
            "error": f"API version '{version}' not found",
            "available_versions": list(get_all_versions().keys())
        }
    
    return version_info


@router.get("/versions/{version}/deprecation")
async def check_version_deprecation(version: str):
    """
    Check if an API version is deprecated and get deprecation details
    
    Args:
        version: API version identifier
        
    Returns deprecation information if the version is deprecated,
    or a message indicating the version is still supported
    """
    deprecation_info = get_deprecation_info(version)
    
    if deprecation_info:
        return deprecation_info
    
    version_info = get_api_version_info(version)
    if not version_info:
        return {
            "error": f"API version '{version}' not found",
            "available_versions": list(get_all_versions().keys())
        }
    
    return {
        "version": version,
        "status": version_info.status,
        "message": f"API {version} is currently {version_info.status.value}",
        "documentation_url": version_info.documentation_url
    }


@router.get("/changelog")
async def get_api_changelog():
    """
    Get complete API changelog across all versions
    
    Returns a comprehensive changelog of all API versions with:
    - Version-specific changes
    - Breaking changes
    - New features
    - Release dates
    """
    changelog = {}
    
    for version_key, version_info in get_all_versions().items():
        changelog[version_key] = {
            "version": version_info.version,
            "status": version_info.status,
            "release_date": version_info.release_date,
            "description": version_info.description,
            "changes": version_info.changelog,
            "breaking_changes": version_info.breaking_changes
        }
    
    return {
        "changelog": changelog,
        "latest_version": get_latest_version()
    }

