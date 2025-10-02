"""
Slug generation utilities
"""

import re
import unicodedata


def slugify(text: str, max_length: int = 255) -> str:
    """
    Convert text to a URL-friendly slug
    
    Args:
        text: Text to slugify
        max_length: Maximum length of slug
        
    Returns:
        Slugified string
        
    Examples:
        slugify("Hello World!") -> "hello-world"
        slugify("Café & Bar") -> "cafe-bar"
        slugify("Model#123") -> "model-123"
    """
    if not text:
        return ""
    
    # Normalize unicode characters
    text = unicodedata.normalize('NFKD', text)
    text = text.encode('ascii', 'ignore').decode('ascii')
    
    # Convert to lowercase
    text = text.lower()
    
    # Replace spaces and underscores with hyphens
    text = re.sub(r'[\s_]+', '-', text)
    
    # Remove non-alphanumeric characters except hyphens
    text = re.sub(r'[^\w\-]', '', text)
    
    # Remove multiple consecutive hyphens
    text = re.sub(r'\-+', '-', text)
    
    # Remove leading/trailing hyphens
    text = text.strip('-')
    
    # Truncate to max length
    if len(text) > max_length:
        text = text[:max_length].rstrip('-')
    
    return text


def ensure_unique_slug(slug: str, existing_slugs: list[str]) -> str:
    """
    Ensure a slug is unique by appending a number if necessary
    
    Args:
        slug: Base slug
        existing_slugs: List of existing slugs to check against
        
    Returns:
        Unique slug
        
    Examples:
        ensure_unique_slug("chair", ["chair", "chair-1"]) -> "chair-2"
    """
    if slug not in existing_slugs:
        return slug
    
    counter = 1
    while f"{slug}-{counter}" in existing_slugs:
        counter += 1
    
    return f"{slug}-{counter}"

