"""
Serialization Utilities

Helper functions to convert SQLAlchemy ORM objects to JSON-serializable dicts
"""

import json
from datetime import date, datetime
from enum import Enum
from typing import Any, List, Optional


def serialize_datetime(dt: Optional[datetime]) -> Optional[str]:
    """Convert datetime to ISO format string"""
    return dt.isoformat() if dt else None


def serialize_date(d: Optional[date]) -> Optional[str]:
    """Convert date to ISO format string"""
    return d.isoformat() if d else None


def serialize_enum(enum_val: Optional[Enum]) -> Optional[str]:
    """Convert enum to string value"""
    return enum_val.value if enum_val else None


def orm_to_dict(obj: Any, exclude: Optional[List[str]] = None) -> dict:
    """
    Convert SQLAlchemy ORM object to dict.
    
    Args:
        obj: SQLAlchemy model instance
        exclude: List of attribute names to exclude
        
    Returns:
        Dict representation of the object
    """
    if obj is None:
        return None
    
    exclude = exclude or []
    result = {}
    
    # Get all columns from the model
    mapper = obj.__class__.__mapper__
    
    for column in mapper.columns:
        attr_name = column.name
        if attr_name in exclude:
            continue
            
        value = getattr(obj, attr_name, None)
        
        # Handle different data types
        if isinstance(value, datetime):
            result[attr_name] = serialize_datetime(value)
        elif isinstance(value, date):
            result[attr_name] = serialize_date(value)
        elif isinstance(value, Enum):
            result[attr_name] = serialize_enum(value)
        else:
            result[attr_name] = value
    
    return result


def orm_list_to_dict_list(objects: List[Any], exclude: Optional[List[str]] = None) -> List[dict]:
    """
    Convert list of SQLAlchemy ORM objects to list of dicts.
    
    Args:
        objects: List of SQLAlchemy model instances
        exclude: List of attribute names to exclude
        
    Returns:
        List of dict representations
    """
    return [orm_to_dict(obj, exclude=exclude) for obj in objects]


def parse_json_list(value: Any) -> list:
    """
    Return a JSON-array value as a list.

    Older rows stored lists JSON-encoded a second time (a string such as
    '["/a.jpg"]' inside a JSON column); decode those instead of dropping them.
    """
    if value is None or value == "":
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            decoded = json.loads(value)
        except (TypeError, ValueError):
            return [value] if value.strip() else []
        if isinstance(decoded, str):
            return parse_json_list(decoded)
        return decoded if isinstance(decoded, list) else []
    return []
