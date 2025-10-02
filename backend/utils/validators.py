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

