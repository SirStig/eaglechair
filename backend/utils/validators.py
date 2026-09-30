"""
Validation utilities
"""

import re
from typing import Optional


def validate_email(email: str) -> bool:
    """
    Validate email format
    
    Args:
        email: Email address to validate
        
    Returns:
        True if valid, False otherwise
    """
    if not email:
        return False
    
    # Basic email regex
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def validate_phone(phone: str) -> bool:
    """
    Validate phone number (US format)
    
    Args:
        phone: Phone number to validate
        
    Returns:
        True if valid, False otherwise
    """
    if not phone:
        return False
    
    # Remove common separators
    digits = re.sub(r'[^\d]', '', phone)
    
    # Check for 10 or 11 digits (with country code)
    return len(digits) in [10, 11]


def normalize_phone(phone: str) -> Optional[str]:
    """
    Normalize phone number to consistent format
    
    Args:
        phone: Phone number to normalize
        
    Returns:
        Normalized phone number (XXX-XXX-XXXX) or None if invalid
    """
    if not phone:
        return None
    
    # Extract digits
    digits = re.sub(r'[^\d]', '', phone)
    
    # Remove leading 1 if present (US country code)
    if len(digits) == 11 and digits.startswith('1'):
        digits = digits[1:]
    
    # Validate
    if len(digits) != 10:
        return None
    
    # Format as XXX-XXX-XXXX
    return f"{digits[:3]}-{digits[3:6]}-{digits[6:]}"



# ============================================================================
# CMS URL validation
# ============================================================================

_WEB_SCHEMES = ("http://", "https://")
_LINK_ONLY_SCHEMES = ("mailto:", "tel:")


def _has_control_chars(value: str) -> bool:
    # Browsers strip tabs/newlines inside URLs, so "java\tscript:" would still
    # run as javascript:. Reject control characters outright.
    return any(ord(c) < 32 or ord(c) == 127 for c in value)


def _is_web_url(value: str) -> bool:
    from urllib.parse import urlparse

    if not value.lower().startswith(_WEB_SCHEMES):
        return False
    try:
        return bool(urlparse(value).netloc)
    except ValueError:
        return False


def _is_site_relative_path(value: str) -> bool:
    # "/path" but not protocol-relative "//host" (browsers treat "/\\host" the same)
    return value.startswith("/") and not value.startswith(("//", "/\\"))


def validate_cms_link(value: Optional[str]) -> Optional[str]:
    """
    Validate a CMS link (CTA links, social URLs, website URLs).

    Allowed: empty, http(s)://host..., mailto:..., tel:..., or a site-relative
    path starting with a single "/". Everything else (javascript:, data:,
    protocol-relative //host, bare words) is rejected.

    Returns:
        The value with surrounding whitespace removed

    Raises:
        ValueError: If the value is not an allowed link
    """
    if value is None:
        return None
    v = value.strip()
    if not v:
        return v
    if not _has_control_chars(v):
        lower = v.lower()
        if _is_web_url(v) or _is_site_relative_path(v):
            return v
        if lower.startswith(_LINK_ONLY_SCHEMES) and len(v) > lower.index(":") + 1:
            return v
    raise ValueError(
        "must be an http(s), mailto: or tel: URL, or a path starting with a single /"
    )


def validate_cms_image_url(value: Optional[str]) -> Optional[str]:
    """
    Validate a CMS image URL.

    Allowed: empty, http(s)://host..., a site-relative path ("/uploads/...",
    "/assets/..."), or a scheme-less relative path ("uploads/..."), which is
    how uploaded and bundled images are stored. Rejects any other scheme
    (javascript:, data:, ...) and protocol-relative URLs.

    Returns:
        The value with surrounding whitespace removed

    Raises:
        ValueError: If the value is not an allowed image URL
    """
    if value is None:
        return None
    v = value.strip()
    if not v:
        return v
    if not _has_control_chars(v):
        if _is_web_url(v) or _is_site_relative_path(v):
            return v
        first_segment = v.split("/", 1)[0]
        if not v.startswith(("/", "\\")) and ":" not in first_segment:
            return v
    raise ValueError(
        "must be an http(s) URL or a relative path such as /uploads/images/..."
    )
