"""
Unit Tests for Validators

Tests all validation utility functionality
"""

import pytest
from backend.utils.validators import validate_email, validate_phone
from backend.core.security import SecurityManager

security_manager = SecurityManager()


@pytest.mark.unit
class TestValidators:
    """Test cases for validation utilities"""
    
    def test_validate_email_success(self):
        """Test valid email addresses."""
        valid_emails = [
            "user@example.com",
            "test.user@example.com",
            "user+tag@example.co.uk",
            "user123@test-domain.com"
        ]
        
        for email in valid_emails:
            assert validate_email(email) is True
    
    def test_validate_email_failure(self):
        """Test invalid email addresses."""
        invalid_emails = [
            "notanemail",
            "@example.com",
            "user@",
            "user @example.com",
            "user@.com",
            ""
        ]
        
        for email in invalid_emails:
            assert validate_email(email) is False
    
    def test_validate_phone_success(self):
        """Test valid phone numbers."""
        valid_phones = [
            "+1234567890",
            "+1-234-567-8900",
            "(123) 456-7890",
            "123-456-7890",
            "1234567890"
        ]
        
        for phone in valid_phones:
            assert validate_phone(phone) is True
    
    def test_validate_phone_failure(self):
        """Test invalid phone numbers."""
        invalid_phones = [
            "123",
            "abc-def-ghij",
            "+1",
            ""
        ]
        
        for phone in invalid_phones:
            assert validate_phone(phone) is False
    
    def test_validate_password_success(self):
        """Test valid passwords."""
        valid_passwords = [
            "Password123",
            "TestPass1",
            "SecurePass9",
            "MyPassw0rd"
        ]
        
        for password in valid_passwords:
            is_valid, error = security_manager.validate_password_strength(password)
            assert is_valid is True
            assert error is None
    
    def test_validate_password_too_short(self):
        """Test password too short."""
        is_valid, error = security_manager.validate_password_strength("Pass1")
        
        assert is_valid is False
        assert "at least" in error.lower()
    
    def test_validate_password_no_uppercase(self):
        """Test password without uppercase."""
        is_valid, error = security_manager.validate_password_strength("password123")
        
        assert is_valid is False
        assert "uppercase" in error.lower()
    
    def test_validate_password_no_lowercase(self):
        """Test password without lowercase."""
        is_valid, error = security_manager.validate_password_strength("PASSWORD123")
        
        assert is_valid is False
        assert "lowercase" in error.lower()
    
    def test_validate_password_no_digit(self):
        """Test password without digit."""
        is_valid, error = security_manager.validate_password_strength("Password")
        
        assert is_valid is False
        assert "digit" in error.lower()

