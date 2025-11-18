"""
EagleChair Exception Handling System

Standardized exceptions with human-readable messages and proper HTTP status codes
"""

from typing import Any, Dict, Optional

from fastapi import status


class BaseAppException(Exception):
    """Base exception (alias for backward compatibility)"""
    pass


class EagleChairException(BaseAppException):
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
        kwargs.setdefault("status_code", status.HTTP_401_UNAUTHORIZED)
        kwargs.setdefault("error_code", "AUTHENTICATION_ERROR")
        super().__init__(message=message, **kwargs)


class InvalidCredentialsError(AuthenticationError):
    """Invalid email or password"""

    def __init__(self, message: str = "The email or password you entered is incorrect. Please try again.", **kwargs):
        super().__init__(message=message, **kwargs)


class TokenExpiredError(AuthenticationError):
    """Authentication token has expired"""

    def __init__(self, message: str = "Your session has expired. Please log in again.", **kwargs):
        kwargs.setdefault("error_code", "TOKEN_EXPIRED")
        super().__init__(message=message, **kwargs)


class InvalidTokenError(AuthenticationError):
    """Invalid or malformed token"""

    def __init__(self, message: str = "Invalid authentication token. Please log in again.", **kwargs):
        kwargs.setdefault("error_code", "INVALID_TOKEN")
        super().__init__(message=message, **kwargs)


class AuthorizationError(EagleChairException):
    """User doesn't have permission"""

    def __init__(self, message: str = "You don't have permission to access this resource.", **kwargs):
        kwargs.setdefault("status_code", status.HTTP_403_FORBIDDEN)
        kwargs.setdefault("error_code", "AUTHORIZATION_ERROR")
        super().__init__(message=message, **kwargs)


class InsufficientPermissionsError(AuthorizationError):
    """User lacks required permissions"""

    def __init__(self, required_role: str = None, **kwargs):
        message = (
            f"This action requires {required_role} permissions."
            if required_role
            else "You don't have sufficient permissions for this action."
        )
        kwargs.setdefault("error_code", "INSUFFICIENT_PERMISSIONS")
        super().__init__(message=message, **kwargs)


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

        details = {"resource_type": resource_type, "resource_id": resource_id}
        extra_details = kwargs.pop("details", None)
        if extra_details:
            details.update(extra_details)

        kwargs.setdefault("status_code", status.HTTP_404_NOT_FOUND)
        kwargs.setdefault("error_code", "RESOURCE_NOT_FOUND")
        super().__init__(message=message, details=details, **kwargs)


class ResourceAlreadyExistsError(EagleChairException):
    """Resource already exists (duplicate)"""

    def __init__(self, resource_type: str = "Resource", field: str = None, **kwargs):
        if field:
            message = (
                f"A {resource_type.lower()} with this {field} already exists. Please use a different {field}."
            )
        else:
            message = f"This {resource_type.lower()} already exists in the system."

        details = {"resource_type": resource_type, "field": field}
        extra_details = kwargs.pop("details", None)
        if extra_details:
            details.update(extra_details)

        kwargs.setdefault("status_code", status.HTTP_409_CONFLICT)
        kwargs.setdefault("error_code", "RESOURCE_ALREADY_EXISTS")
        super().__init__(message=message, details=details, **kwargs)


class ResourceConflictError(EagleChairException):
    """Resource state conflict"""

    def __init__(self, message: str = "The requested operation conflicts with the current state of the resource.", **kwargs):
        kwargs.setdefault("status_code", status.HTTP_409_CONFLICT)
        kwargs.setdefault("error_code", "RESOURCE_CONFLICT")
        super().__init__(message=message, **kwargs)


# ============================================================================
# Validation Exceptions
# ============================================================================

class ValidationError(EagleChairException):
    """Data validation failed"""

    def __init__(self, message: str = "The data you provided is invalid. Please check and try again.", **kwargs):
        kwargs.setdefault("status_code", status.HTTP_422_UNPROCESSABLE_ENTITY)
        kwargs.setdefault("error_code", "VALIDATION_ERROR")
        super().__init__(message=message, **kwargs)


class InvalidInputError(ValidationError):
    """Invalid input data"""

    def __init__(self, field: str = None, reason: str = None, **kwargs):
        if field and reason:
            message = f"Invalid value for '{field}': {reason}"
        elif field:
            message = f"The value provided for '{field}' is invalid."
        else:
            message = "Invalid input data provided. Please check your request and try again."

        details = {"field": field, "reason": reason}
        extra_details = kwargs.pop("details", None)
        if extra_details:
            details.update(extra_details)

        kwargs.setdefault("error_code", "INVALID_INPUT")
        super().__init__(message=message, details=details, **kwargs)


class MissingRequiredFieldError(ValidationError):
    """Required field is missing"""

    def __init__(self, field: str, **kwargs):
        details = {"field": field}
        extra_details = kwargs.pop("details", None)
        if extra_details:
            details.update(extra_details)

        kwargs.setdefault("error_code", "MISSING_REQUIRED_FIELD")
        super().__init__(
            message=f"The required field '{field}' is missing. Please provide this information.",
            details=details,
            **kwargs
        )


# ============================================================================
# Business Logic Exceptions
# ============================================================================

class BusinessLogicError(EagleChairException):
    """Business logic validation failed"""

    def __init__(self, message: str = "This operation cannot be completed due to business rules.", **kwargs):
        kwargs.setdefault("status_code", status.HTTP_400_BAD_REQUEST)
        kwargs.setdefault("error_code", "BUSINESS_LOGIC_ERROR")
        super().__init__(message=message, **kwargs)


class InsufficientInventoryError(BusinessLogicError):
    """Not enough inventory"""

    def __init__(self, product_name: str, requested: int, available: int, **kwargs):
        details = {"product": product_name, "requested": requested, "available": available}
        extra_details = kwargs.pop("details", None)
        if extra_details:
            details.update(extra_details)

        kwargs.setdefault("error_code", "INSUFFICIENT_INVENTORY")
        super().__init__(
            message=(
                f"Insufficient inventory for '{product_name}'. You requested {requested}, but only {available} are available."
            ),
            details=details,
            **kwargs
        )


class QuoteExpiredError(BusinessLogicError):
    """Quote has expired"""

    def __init__(self, quote_number: str, **kwargs):
        details = {"quote_number": quote_number}
        extra_details = kwargs.pop("details", None)
        if extra_details:
            details.update(extra_details)

        kwargs.setdefault("error_code", "QUOTE_EXPIRED")
        super().__init__(
            message=f"Quote #{quote_number} has expired. Please request a new quote.",
            details=details,
            **kwargs
        )


class AccountSuspendedError(BusinessLogicError):
    """Account is suspended"""

    def __init__(self, **kwargs):
        kwargs.setdefault("status_code", status.HTTP_403_FORBIDDEN)
        kwargs.setdefault("error_code", "ACCOUNT_SUSPENDED")
        super().__init__(
            message="Your account has been suspended. Please contact support for assistance.",
            **kwargs
        )


class AccountNotVerifiedError(BusinessLogicError):
    """Account not verified"""

    def __init__(self, **kwargs):
        kwargs.setdefault("status_code", status.HTTP_403_FORBIDDEN)
        kwargs.setdefault("error_code", "ACCOUNT_NOT_VERIFIED")
        super().__init__(
            message="Your account needs to be verified before you can perform this action. Please check your email or contact support.",
            **kwargs
        )


# ============================================================================
# Rate Limiting & Security Exceptions
# ============================================================================

class RateLimitExceededError(EagleChairException):
    """Rate limit exceeded"""

    def __init__(self, retry_after: int = None, **kwargs):
        message = (
            f"Too many requests. Please wait {retry_after} seconds and try again."
            if retry_after
            else "Too many requests. Please slow down and try again later."
        )

        details = {"retry_after": retry_after}
        extra_details = kwargs.pop("details", None)
        if extra_details:
            details.update(extra_details)

        kwargs.setdefault("status_code", status.HTTP_429_TOO_MANY_REQUESTS)
        kwargs.setdefault("error_code", "RATE_LIMIT_EXCEEDED")
        super().__init__(message=message, details=details, **kwargs)


class IPBannedError(EagleChairException):
    """IP address is banned"""

    def __init__(self, reason: str = "suspicious activity", **kwargs):
        details = {"reason": reason}
        extra_details = kwargs.pop("details", None)
        if extra_details:
            details.update(extra_details)

        kwargs.setdefault("status_code", status.HTTP_403_FORBIDDEN)
        kwargs.setdefault("error_code", "IP_BANNED")
        super().__init__(
            message=f"Your IP address has been temporarily blocked due to {reason}. Please try again later or contact support.",
            details=details,
            **kwargs
        )


class SuspiciousActivityError(EagleChairException):
    """Suspicious activity detected"""

    def __init__(self, **kwargs):
        kwargs.setdefault("status_code", status.HTTP_403_FORBIDDEN)
        kwargs.setdefault("error_code", "SUSPICIOUS_ACTIVITY")
        super().__init__(
            message="Suspicious activity detected. This request has been blocked for security reasons.",
            **kwargs
        )


# ============================================================================
# Request Exceptions
# ============================================================================

class RequestTooLargeError(EagleChairException):
    """Request payload too large"""

    def __init__(self, max_size_mb: float, actual_size_mb: float = None, **kwargs):
        if actual_size_mb:
            message = (
                f"The request size ({actual_size_mb:.1f}MB) exceeds the maximum allowed size of {max_size_mb:.1f}MB."
            )
        else:
            message = f"The request size exceeds the maximum allowed size of {max_size_mb:.1f}MB."

        details = {"max_size_mb": max_size_mb, "actual_size_mb": actual_size_mb}
        extra_details = kwargs.pop("details", None)
        if extra_details:
            details.update(extra_details)

        kwargs.setdefault("status_code", status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)
        kwargs.setdefault("error_code", "REQUEST_TOO_LARGE")
        super().__init__(message=message, details=details, **kwargs)


class UnsupportedMediaTypeError(EagleChairException):
    """Unsupported content type"""

    def __init__(self, content_type: str, supported_types: list = None, **kwargs):
        if supported_types:
            message = (
                f"Content type '{content_type}' is not supported. Supported types: {', '.join(supported_types)}"
            )
        else:
            message = f"Content type '{content_type}' is not supported."

        details = {"content_type": content_type, "supported_types": supported_types}
        extra_details = kwargs.pop("details", None)
        if extra_details:
            details.update(extra_details)

        kwargs.setdefault("status_code", status.HTTP_415_UNSUPPORTED_MEDIA_TYPE)
        kwargs.setdefault("error_code", "UNSUPPORTED_MEDIA_TYPE")
        super().__init__(message=message, details=details, **kwargs)


# ============================================================================
# Database Exceptions
# ============================================================================

class DatabaseError(EagleChairException):
    """Database operation failed"""

    def __init__(self, message: str = "A database error occurred. Please try again later.", **kwargs):
        kwargs.setdefault("status_code", status.HTTP_500_INTERNAL_SERVER_ERROR)
        kwargs.setdefault("error_code", "DATABASE_ERROR")
        super().__init__(message=message, **kwargs)


class DatabaseConnectionError(DatabaseError):
    """Cannot connect to database"""

    def __init__(self, **kwargs):
        kwargs.setdefault("error_code", "DATABASE_CONNECTION_ERROR")
        super().__init__(
            message="Unable to connect to the database. Please try again later.",
            **kwargs
        )


# ============================================================================
# External Service Exceptions
# ============================================================================

class ExternalServiceError(EagleChairException):
    """External service error"""

    def __init__(self, service_name: str = "external service", **kwargs):
        details = {"service": service_name}
        extra_details = kwargs.pop("details", None)
        if extra_details:
            details.update(extra_details)

        kwargs.setdefault("status_code", status.HTTP_503_SERVICE_UNAVAILABLE)
        kwargs.setdefault("error_code", "EXTERNAL_SERVICE_ERROR")
        super().__init__(
            message=f"An error occurred while communicating with {service_name}. Please try again later.",
            details=details,
            **kwargs
        )


class PaymentProcessingError(ExternalServiceError):
    """Payment processing failed"""

    def __init__(self, reason: str = None, **kwargs):
        message = (
            f"Payment processing failed: {reason}"
            if reason
            else "Payment processing failed. Please check your payment information and try again."
        )

        details = {"reason": reason}
        extra_details = kwargs.pop("details", None)
        if extra_details:
            details.update(extra_details)

        kwargs.setdefault("error_code", "PAYMENT_PROCESSING_ERROR")
        super().__init__(
            message=message,
            details=details,
            service_name="payment processor",
            **kwargs
        )


# ============================================================================
# Admin Exceptions
# ============================================================================

class AdminAccessDeniedError(AuthorizationError):
    """Admin access denied"""

    def __init__(self, reason: str = "insufficient privileges", **kwargs):
        details = {"reason": reason}
        extra_details = kwargs.pop("details", None)
        if extra_details:
            details.update(extra_details)

        kwargs.setdefault("error_code", "ADMIN_ACCESS_DENIED")
        super().__init__(
            message=f"Admin access denied: {reason}",
            details=details,
            **kwargs
        )


class IPNotWhitelistedError(AdminAccessDeniedError):
    """IP not in admin whitelist"""

    def __init__(self, **kwargs):
        super().__init__(
            reason="your IP address is not whitelisted",
            **kwargs
        )

