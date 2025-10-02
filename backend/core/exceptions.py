"""
EagleChair Exception Handling System

Standardized exceptions with human-readable messages and proper HTTP status codes
"""

from typing import Optional, Dict, Any
from fastapi import status


class EagleChairException(Exception):
    """
    Base exception for all EagleChair application errors
    
    Provides:
    - Human-readable error messages
    - Proper HTTP status codes
    - Error codes for client handling
    - Additional context data
    """
    
    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code or self.__class__.__name__
        self.details = details or {}
        super().__init__(self.message)
    
    def to_dict(self) -> dict:
        """Convert exception to dictionary for JSON response"""
        response = {
            "error": self.error_code,
            "message": self.message,
            "status_code": self.status_code
        }
        
        if self.details:
            response["details"] = self.details
        
        return response


# ============================================================================
# Authentication & Authorization Exceptions
# ============================================================================

class AuthenticationError(EagleChairException):
    """User authentication failed"""
    def __init__(self, message: str = "Authentication failed. Please check your credentials and try again.", **kwargs):
        super().__init__(
            message=message,
            status_code=status.HTTP_401_UNAUTHORIZED,
            error_code="AUTHENTICATION_ERROR",
            **kwargs
        )


class InvalidCredentialsError(AuthenticationError):
    """Invalid email or password"""
    def __init__(self, message: str = "The email or password you entered is incorrect. Please try again.", **kwargs):
        super().__init__(message=message, error_code="INVALID_CREDENTIALS", **kwargs)


class TokenExpiredError(AuthenticationError):
    """Authentication token has expired"""
    def __init__(self, message: str = "Your session has expired. Please log in again.", **kwargs):
        super().__init__(message=message, error_code="TOKEN_EXPIRED", **kwargs)


class InvalidTokenError(AuthenticationError):
    """Invalid or malformed token"""
    def __init__(self, message: str = "Invalid authentication token. Please log in again.", **kwargs):
        super().__init__(message=message, error_code="INVALID_TOKEN", **kwargs)


class AuthorizationError(EagleChairException):
    """User doesn't have permission"""
    def __init__(self, message: str = "You don't have permission to access this resource.", **kwargs):
        super().__init__(
            message=message,
            status_code=status.HTTP_403_FORBIDDEN,
            error_code="AUTHORIZATION_ERROR",
            **kwargs
        )


class InsufficientPermissionsError(AuthorizationError):
    """User lacks required permissions"""
    def __init__(self, required_role: str = None, **kwargs):
        message = f"This action requires {required_role} permissions." if required_role else \
                  "You don't have sufficient permissions for this action."
        super().__init__(message=message, error_code="INSUFFICIENT_PERMISSIONS", **kwargs)


# ============================================================================
# Resource Exceptions
# ============================================================================

class ResourceNotFoundError(EagleChairException):
    """Requested resource not found"""
    def __init__(self, resource_type: str = "Resource", resource_id: Any = None, **kwargs):
        if resource_id:
            message = f"{resource_type} with ID '{resource_id}' was not found."
        else:
            message = f"The requested {resource_type.lower()} could not be found."
        
        super().__init__(
            message=message,
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="RESOURCE_NOT_FOUND",
            details={"resource_type": resource_type, "resource_id": resource_id},
            **kwargs
        )


class ResourceAlreadyExistsError(EagleChairException):
    """Resource already exists (duplicate)"""
    def __init__(self, resource_type: str = "Resource", field: str = None, **kwargs):
        if field:
            message = f"A {resource_type.lower()} with this {field} already exists. Please use a different {field}."
        else:
            message = f"This {resource_type.lower()} already exists in the system."
        
        super().__init__(
            message=message,
            status_code=status.HTTP_409_CONFLICT,
            error_code="RESOURCE_ALREADY_EXISTS",
            details={"resource_type": resource_type, "field": field},
            **kwargs
        )


class ResourceConflictError(EagleChairException):
    """Resource state conflict"""
    def __init__(self, message: str = "The requested operation conflicts with the current state of the resource.", **kwargs):
        super().__init__(
            message=message,
            status_code=status.HTTP_409_CONFLICT,
            error_code="RESOURCE_CONFLICT",
            **kwargs
        )


# ============================================================================
# Validation Exceptions
# ============================================================================

class ValidationError(EagleChairException):
    """Data validation failed"""
    def __init__(self, message: str = "The data you provided is invalid. Please check and try again.", **kwargs):
        super().__init__(
            message=message,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            error_code="VALIDATION_ERROR",
            **kwargs
        )


class InvalidInputError(ValidationError):
    """Invalid input data"""
    def __init__(self, field: str = None, reason: str = None, **kwargs):
        if field and reason:
            message = f"Invalid value for '{field}': {reason}"
        elif field:
            message = f"The value provided for '{field}' is invalid."
        else:
            message = "Invalid input data provided. Please check your request and try again."
        
        super().__init__(
            message=message,
            error_code="INVALID_INPUT",
            details={"field": field, "reason": reason},
            **kwargs
        )


class MissingRequiredFieldError(ValidationError):
    """Required field is missing"""
    def __init__(self, field: str, **kwargs):
        super().__init__(
            message=f"The required field '{field}' is missing. Please provide this information.",
            error_code="MISSING_REQUIRED_FIELD",
            details={"field": field},
            **kwargs
        )


# ============================================================================
# Business Logic Exceptions
# ============================================================================

class BusinessLogicError(EagleChairException):
    """Business logic validation failed"""
    def __init__(self, message: str = "This operation cannot be completed due to business rules.", **kwargs):
        super().__init__(
            message=message,
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="BUSINESS_LOGIC_ERROR",
            **kwargs
        )


class InsufficientInventoryError(BusinessLogicError):
    """Not enough inventory"""
    def __init__(self, product_name: str, requested: int, available: int, **kwargs):
        super().__init__(
            message=f"Insufficient inventory for '{product_name}'. You requested {requested}, but only {available} are available.",
            error_code="INSUFFICIENT_INVENTORY",
            details={"product": product_name, "requested": requested, "available": available},
            **kwargs
        )


class QuoteExpiredError(BusinessLogicError):
    """Quote has expired"""
    def __init__(self, quote_number: str, **kwargs):
        super().__init__(
            message=f"Quote #{quote_number} has expired. Please request a new quote.",
            error_code="QUOTE_EXPIRED",
            details={"quote_number": quote_number},
            **kwargs
        )


class AccountSuspendedError(BusinessLogicError):
    """Account is suspended"""
    def __init__(self, **kwargs):
        super().__init__(
            message="Your account has been suspended. Please contact support for assistance.",
            error_code="ACCOUNT_SUSPENDED",
            status_code=status.HTTP_403_FORBIDDEN,
            **kwargs
        )


class AccountNotVerifiedError(BusinessLogicError):
    """Account not verified"""
    def __init__(self, **kwargs):
        super().__init__(
            message="Your account needs to be verified before you can perform this action. Please check your email or contact support.",
            error_code="ACCOUNT_NOT_VERIFIED",
            status_code=status.HTTP_403_FORBIDDEN,
            **kwargs
        )


# ============================================================================
# Rate Limiting & Security Exceptions
# ============================================================================

class RateLimitExceededError(EagleChairException):
    """Rate limit exceeded"""
    def __init__(self, retry_after: int = None, **kwargs):
        message = f"Too many requests. Please wait {retry_after} seconds and try again." if retry_after else \
                  "Too many requests. Please slow down and try again later."
        
        super().__init__(
            message=message,
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            error_code="RATE_LIMIT_EXCEEDED",
            details={"retry_after": retry_after},
            **kwargs
        )


class IPBannedError(EagleChairException):
    """IP address is banned"""
    def __init__(self, reason: str = "suspicious activity", **kwargs):
        super().__init__(
            message=f"Your IP address has been temporarily blocked due to {reason}. Please try again later or contact support.",
            status_code=status.HTTP_403_FORBIDDEN,
            error_code="IP_BANNED",
            details={"reason": reason},
            **kwargs
        )


class SuspiciousActivityError(EagleChairException):
    """Suspicious activity detected"""
    def __init__(self, **kwargs):
        super().__init__(
            message="Suspicious activity detected. This request has been blocked for security reasons.",
            status_code=status.HTTP_403_FORBIDDEN,
            error_code="SUSPICIOUS_ACTIVITY",
            **kwargs
        )


# ============================================================================
# Request Exceptions
# ============================================================================

class RequestTooLargeError(EagleChairException):
    """Request payload too large"""
    def __init__(self, max_size_mb: float, actual_size_mb: float = None, **kwargs):
        if actual_size_mb:
            message = f"The request size ({actual_size_mb:.1f}MB) exceeds the maximum allowed size of {max_size_mb:.1f}MB."
        else:
            message = f"The request size exceeds the maximum allowed size of {max_size_mb:.1f}MB."
        
        super().__init__(
            message=message,
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            error_code="REQUEST_TOO_LARGE",
            details={"max_size_mb": max_size_mb, "actual_size_mb": actual_size_mb},
            **kwargs
        )


class UnsupportedMediaTypeError(EagleChairException):
    """Unsupported content type"""
    def __init__(self, content_type: str, supported_types: list = None, **kwargs):
        if supported_types:
            message = f"Content type '{content_type}' is not supported. Supported types: {', '.join(supported_types)}"
        else:
            message = f"Content type '{content_type}' is not supported."
        
        super().__init__(
            message=message,
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            error_code="UNSUPPORTED_MEDIA_TYPE",
            details={"content_type": content_type, "supported_types": supported_types},
            **kwargs
        )


# ============================================================================
# Database Exceptions
# ============================================================================

class DatabaseError(EagleChairException):
    """Database operation failed"""
    def __init__(self, message: str = "A database error occurred. Please try again later.", **kwargs):
        super().__init__(
            message=message,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            error_code="DATABASE_ERROR",
            **kwargs
        )


class DatabaseConnectionError(DatabaseError):
    """Cannot connect to database"""
    def __init__(self, **kwargs):
        super().__init__(
            message="Unable to connect to the database. Please try again later.",
            error_code="DATABASE_CONNECTION_ERROR",
            **kwargs
        )


# ============================================================================
# External Service Exceptions
# ============================================================================

class ExternalServiceError(EagleChairException):
    """External service error"""
    def __init__(self, service_name: str = "external service", **kwargs):
        super().__init__(
            message=f"An error occurred while communicating with {service_name}. Please try again later.",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            error_code="EXTERNAL_SERVICE_ERROR",
            details={"service": service_name},
            **kwargs
        )


class PaymentProcessingError(ExternalServiceError):
    """Payment processing failed"""
    def __init__(self, reason: str = None, **kwargs):
        message = f"Payment processing failed: {reason}" if reason else \
                  "Payment processing failed. Please check your payment information and try again."
        
        super().__init__(
            message=message,
            error_code="PAYMENT_PROCESSING_ERROR",
            details={"reason": reason},
            service_name="payment processor",
            **kwargs
        )


# ============================================================================
# Admin Exceptions
# ============================================================================

class AdminAccessDeniedError(AuthorizationError):
    """Admin access denied"""
    def __init__(self, reason: str = "insufficient privileges", **kwargs):
        super().__init__(
            message=f"Admin access denied: {reason}",
            error_code="ADMIN_ACCESS_DENIED",
            details={"reason": reason},
            **kwargs
        )


class IPNotWhitelistedError(AdminAccessDeniedError):
    """IP not in admin whitelist"""
    def __init__(self, **kwargs):
        super().__init__(
            reason="your IP address is not whitelisted",
            **kwargs
        )

