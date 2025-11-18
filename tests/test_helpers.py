"""
Test Helpers and Utilities

Helper functions and utilities for testing
"""

import random
import string
from typing import Dict, Any
from datetime import datetime, timedelta


def generate_random_string(length: int = 10) -> str:
    """Generate a random string of specified length."""
    letters = string.ascii_letters + string.digits
    return ''.join(random.choice(letters) for _ in range(length))


def generate_random_email() -> str:
    """Generate a random email address."""
    username = generate_random_string(8)
    domain = generate_random_string(6)
    return f"{username}@{domain}.com"


def generate_random_phone() -> str:
    """Generate a random phone number."""
    area_code = random.randint(100, 999)
    prefix = random.randint(100, 999)
    line = random.randint(1000, 9999)
    return f"+1{area_code}{prefix}{line}"


def generate_company_data() -> Dict[str, Any]:
    """Generate random company registration data."""
    return {
        "company_name": f"Test Company {generate_random_string(5)}",
        "contact_name": f"John {generate_random_string(5)}",
        "contact_email": generate_random_email(),
        "contact_phone": generate_random_phone(),
        "address_line1": f"{random.randint(100, 9999)} Main St",
        "city": f"City {generate_random_string(5)}",
        "state": "TS",
        "zip_code": f"{random.randint(10000, 99999)}",
        "country": "USA",
        "password": "TestPassword123!"
    }


def generate_product_data(category_id: int) -> Dict[str, Any]:
    """Generate random product data."""
    return {
        "name": f"Product {generate_random_string(5)}",
        "description": f"Description for product {generate_random_string(10)}",
        "model_number": f"PRD-{random.randint(1000, 9999)}",
        "category_id": category_id,
        "base_price": random.randint(10000, 100000),
        "minimum_order_quantity": random.randint(1, 10),
        "is_active": True,
        "specifications": {
            "seat_height": f"{random.randint(16, 24)} inches",
            "weight_capacity": f"{random.randint(200, 400)} lbs"
        },
        "features": ["Lumbar support", "Adjustable height"],
        "dimensions": {
            "width": random.randint(20, 30),
            "depth": random.randint(20, 30),
            "height": random.randint(35, 50)
        },
        "weight": random.uniform(20.0, 80.0),
        "materials": ["Leather", "Steel"],
        "colors": ["Black", "Brown"]
    }


def generate_quote_data() -> Dict[str, Any]:
    """Generate random quote data."""
    return {
        "contact_name": f"John {generate_random_string(5)}",
        "contact_email": generate_random_email(),
        "contact_phone": generate_random_phone(),
        "shipping_address_line1": f"{random.randint(100, 9999)} Oak Ave",
        "shipping_city": f"City {generate_random_string(5)}",
        "shipping_state": "TS",
        "shipping_zip": f"{random.randint(10000, 99999)}",
        "shipping_country": "USA"
    }


def generate_admin_data() -> Dict[str, Any]:
    """Generate random admin user data."""
    return {
        "username": f"admin{generate_random_string(5)}",
        "email": generate_random_email(),
        "password": "AdminPassword123!",
        "first_name": "Admin",
        "last_name": generate_random_string(8),
        "role": "admin"
    }


def assert_valid_timestamp(timestamp_str: str) -> None:
    """Assert that a string is a valid ISO timestamp."""
    try:
        datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
    except (ValueError, AttributeError):
        raise AssertionError(f"Invalid timestamp: {timestamp_str}")


def assert_response_has_pagination(response_data: Dict[str, Any]) -> None:
    """Assert that response has valid pagination structure."""
    assert "items" in response_data
    assert "total" in response_data
    assert "page" in response_data
    assert "page_size" in response_data
    assert "pages" in response_data
    assert isinstance(response_data["items"], list)
    assert isinstance(response_data["total"], int)
    assert isinstance(response_data["page"], int)
    assert isinstance(response_data["page_size"], int)
    assert isinstance(response_data["pages"], int)


def assert_response_has_error(response_data: Dict[str, Any]) -> None:
    """Assert that response has error structure."""
    assert "error" in response_data or "detail" in response_data


def calculate_expected_total(subtotal: int, tax_rate: float = 0.1, shipping: int = 0) -> int:
    """Calculate expected total for quote/order."""
    tax = int(subtotal * tax_rate)
    return subtotal + tax + shipping


def is_valid_quote_number(quote_number: str) -> bool:
    """Check if quote number has valid format."""
    # Example: Q-001234
    if not quote_number:
        return False
    
    parts = quote_number.split('-')
    if len(parts) != 2:
        return False
    
    prefix, number = parts
    return prefix == 'Q' and number.isdigit()


def create_mock_quote_item(chair_id: int, quantity: int = 1, unit_price: int = 10000) -> Dict[str, Any]:
    """Create mock quote item data."""
    return {
        "chair_id": chair_id,
        "quantity": quantity,
        "unit_price": unit_price,
        "custom_notes": f"Custom notes {generate_random_string(10)}"
    }


def get_future_date(days: int = 30) -> str:
    """Get a future date as ISO string."""
    future = datetime.now() + timedelta(days=days)
    return future.date().isoformat()


def get_past_date(days: int = 30) -> str:
    """Get a past date as ISO string."""
    past = datetime.now() - timedelta(days=days)
    return past.date().isoformat()

