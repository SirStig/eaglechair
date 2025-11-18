"""
Base SQL Parser for WordPress Migrations

Shared utilities for parsing the eaglechair_com.sql file.
"""

import re
from pathlib import Path
from typing import Any

# SQL File Location
SQL_FILE_PATH = Path(__file__).parent.parent / "eaglechair_com.sql"


def get_sql_content() -> str:
    """Load and return the SQL file content."""
    if not SQL_FILE_PATH.exists():
        raise FileNotFoundError(
            f"SQL file not found: {SQL_FILE_PATH}\n"
            f"Please ensure eaglechair_com.sql is in backend/scripts/"
        )
    
    with open(SQL_FILE_PATH, 'r', encoding='utf-8', errors='ignore') as f:
        return f.read()


def extract_table_inserts(sql_content: str, table_name: str) -> list[str]:
    """
    Extract all INSERT statements for a specific table.
    
    Args:
        sql_content: Full SQL file content
        table_name: Table name (e.g., 'wp_posts', 'wp_postmeta')
    
    Returns:
        List of INSERT statement value strings
    """
    # Pattern to match INSERT INTO statements for the table
    pattern = rf"INSERT INTO `{table_name}`.*?VALUES\s*(.+?);"
    matches = re.findall(pattern, sql_content, re.DOTALL | re.IGNORECASE)
    return matches


def parse_insert_values(values_string: str) -> list[tuple]:
    """
    Parse VALUES string into list of tuples.
    
    Example:
        "(1, 'value1', 'value2'), (2, 'value3', 'value4')"
        Returns: [(1, 'value1', 'value2'), (2, 'value3', 'value4')]
    """
    # This is a simplified parser - WordPress SQL can be complex
    # For production, you might want a more robust parser
    
    results = []
    
    # Split by "),(" to get individual rows
    rows = values_string.split('),(')
    
    for row in rows:
        # Clean up the row
        row = row.strip()
        row = row.lstrip('(').rstrip(')')
        
        # TODO: Properly parse the row values (this is complex due to escaping)
        # For now, we'll use regex to extract the basic structure
        results.append(row)
    
    return results


def extract_wp_posts(sql_content: str, post_type: str = None) -> list[dict[str, Any]]:
    """
    Extract WordPress posts of a specific type.
    
    Args:
        sql_content: Full SQL content
        post_type: Filter by post_type (e.g., 'product', 'page', 'post')
    
    Returns:
        List of post dictionaries with basic fields
    """
    posts = []
    
    # Pattern for wp_posts INSERT statements
    # This is a simplified version - adjust based on actual SQL structure
    if post_type:
        pattern = rf"\((\d+),\s*\d+,\s*'[^']*',\s*'[^']*',\s*'([^']*)',\s*'([^']+)',\s*'([^']*)',\s*'publish'[^)]*'{post_type}'"
    else:
        pattern = r"\((\d+),\s*\d+,\s*'[^']*',\s*'[^']*',\s*'([^']*)',\s*'([^']+)',\s*'([^']*)',\s*'publish'"
    
    matches = re.findall(pattern, sql_content, re.IGNORECASE)
    
    for match in matches:
        post_id, excerpt, title, description = match
        posts.append({
            'id': post_id,
            'title': title,
            'excerpt': excerpt,
            'description': description,
        })
    
    return posts


def extract_wp_postmeta(sql_content: str, post_id: str = None, meta_key: str = None) -> list[dict]:
    """
    Extract WordPress post metadata.
    
    Args:
        sql_content: Full SQL content
        post_id: Filter by specific post ID
        meta_key: Filter by specific meta key (e.g., '_price', '_sku')
    
    Returns:
        List of metadata dictionaries
    """
    metadata = []
    
    # Pattern for wp_postmeta - simplified
    pattern = r"\((\d+),\s*(\d+),\s*'([^']+)',\s*'([^']*)'\)"
    matches = re.findall(pattern, sql_content, re.IGNORECASE)
    
    for match in matches:
        meta_id, post_id_val, key, value = match
        
        # Apply filters if provided
        if post_id and post_id_val != post_id:
            continue
        if meta_key and key != meta_key:
            continue
        
        metadata.append({
            'meta_id': meta_id,
            'post_id': post_id_val,
            'meta_key': key,
            'meta_value': value,
        })
    
    return metadata


def extract_wp_terms(sql_content: str) -> list[dict]:
    """
    Extract WordPress taxonomy terms (categories, tags, etc.).
    
    Returns:
        List of term dictionaries
    """
    terms = []
    
    # Pattern for wp_terms table
    pattern = r"INSERT INTO `wp_terms`.*?VALUES\s*(.+?);"
    matches = re.findall(pattern, sql_content, re.DOTALL | re.IGNORECASE)
    
    if matches:
        # Parse the values
        values = matches[0]
        # Simplified parsing - extract term data
        term_pattern = r"\((\d+),\s*'([^']+)',\s*'([^']+)'"
        term_matches = re.findall(term_pattern, values)
        
        for term_match in term_matches:
            term_id, name, slug = term_match
            terms.append({
                'term_id': term_id,
                'name': name,
                'slug': slug,
            })
    
    return terms
