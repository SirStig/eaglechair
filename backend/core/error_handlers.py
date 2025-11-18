"""
Global Error Handlers for FastAPI

Centralized error handling with standardized responses
"""

import logging

from fastapi import Request, status
from fastapi.exceptions import HTTPException, RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend.core.config import settings
from backend.core.exceptions import EagleChairException

logger = logging.getLogger(__name__)


async def eaglechair_exception_handler(request: Request, exc: EagleChairException) -> JSONResponse:
    """
    Handle all EagleChair custom exceptions
    
    Returns standardized, human-readable error responses
    """
    logger.warning(
        f"Application error: {exc.error_code}",
        extra={
            "error_code": exc.error_code,
            "error_message": exc.message,  # Changed from 'message' to avoid LogRecord conflict
            "path": request.url.path,
            "method": request.method,
            "status_code": exc.status_code
        }
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict()
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """
    Handle Pydantic validation errors
    
    Converts technical validation errors to human-readable messages
    """
    errors = []
    
    for error in exc.errors():
        field = " -> ".join(str(loc) for loc in error["loc"][1:])  # Skip 'body'
        error_type = error["type"]
        message = error["msg"]
        
        # Make error messages more user-friendly
        if error_type == "value_error.missing":
            human_message = f"The field '{field}' is required. Please provide this information."
        elif error_type == "type_error":
            human_message = f"The field '{field}' has an invalid format. {message}"
        elif error_type == "value_error.any_str.min_length":
            human_message = f"The field '{field}' is too short. {message}"
        elif error_type == "value_error.any_str.max_length":
            human_message = f"The field '{field}' is too long. {message}"
        elif error_type == "value_error.email":
            human_message = f"Please provide a valid email address for '{field}'."
        else:
            human_message = f"Invalid value for '{field}': {message}"
        
        errors.append({
            "field": field,
            "message": human_message,
            "type": error_type
        })
    
    logger.warning(
        f"Validation error on {request.url.path}",
        extra={"errors": errors, "path": request.url.path}
    )
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "VALIDATION_ERROR",
            "message": "The data you provided is invalid. Please check the errors below and try again.",
            "status_code": status.HTTP_422_UNPROCESSABLE_ENTITY,
            "errors": errors
        }
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """
    Handle FastAPI HTTPException
    
    Converts to standardized format
    """
    # Map common status codes to user-friendly messages
    messages = {
        status.HTTP_401_UNAUTHORIZED: "Authentication required. Please log in to continue.",
        status.HTTP_403_FORBIDDEN: "You don't have permission to access this resource.",
        status.HTTP_404_NOT_FOUND: "The requested resource was not found.",
        status.HTTP_405_METHOD_NOT_ALLOWED: "This operation is not allowed.",
        status.HTTP_500_INTERNAL_SERVER_ERROR: "An internal server error occurred. Please try again later.",
    }
    
    message = messages.get(exc.status_code, exc.detail)
    
    logger.warning(
        f"HTTP {exc.status_code}: {message}",
        extra={"status_code": exc.status_code, "path": request.url.path, "detail": exc.detail}
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": f"HTTP_{exc.status_code}",
            "message": message,
            "status_code": exc.status_code
        }
    )


async def starlette_http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """
    Handle Starlette HTTPException
    """
    return await http_exception_handler(request, HTTPException(status_code=exc.status_code, detail=exc.detail))


async def database_exception_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    """
    Handle database errors
    
    Prevents leaking database details to users
    """
    # Log full error for debugging
    logger.error(
        f"Database error: {str(exc)}",
        exc_info=True,
        extra={"path": request.url.path, "method": request.method}
    )
    
    # Check if it's an integrity error (duplicate, foreign key, etc.)
    if isinstance(exc, IntegrityError):
        # Try to extract meaningful information
        error_msg = str(exc.orig) if hasattr(exc, 'orig') else str(exc)
        
        if "duplicate" in error_msg.lower() or "unique" in error_msg.lower():
            message = "This record already exists in the system. Please use different values."
            error_code = "DUPLICATE_ENTRY"
        elif "foreign key" in error_msg.lower():
            message = "This operation cannot be completed due to related records. Please remove related items first."
            error_code = "FOREIGN_KEY_VIOLATION"
        else:
            message = "A database constraint was violated. Please check your data and try again."
            error_code = "INTEGRITY_ERROR"
    else:
        message = "A database error occurred. Please try again later. If the problem persists, contact support."
        error_code = "DATABASE_ERROR"
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": error_code,
            "message": message,
            "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR
        }
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Catch-all handler for unexpected exceptions
    
    Logs full error details but returns safe message to user
    Only logs if not already logged by middleware
    """
    # Safely get exception message (str() can fail on some exceptions)
    try:
        exc_msg = str(exc)
    except:
        exc_msg = f"<{type(exc).__name__} - str() failed>"
    
    # Only log full traceback if not already logged (to prevent duplicates)
    if not hasattr(request.state, "error_logged"):
        logger.error(
            f"Unexpected error: {type(exc).__name__}: {exc_msg}",
            exc_info=True,
            extra={
                "path": request.url.path,
                "method": request.method,
                "exception_type": type(exc).__name__
            }
        )
        request.state.error_logged = True
    else:
        # Just log a summary if already logged
        logger.warning(
            f"Error handled: {type(exc).__name__}: {exc_msg}",
            extra={
                "path": request.url.path,
                "method": request.method,
            }
        )
    
    # In development, return more details
    if settings.DEBUG:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred.",
                "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
                "debug_info": {
                    "exception_type": type(exc).__name__,
                    "exception_message": str(exc),
                }
            }
        )
    
    # In production, return generic message
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "INTERNAL_SERVER_ERROR",
            "message": "An unexpected error occurred. Our team has been notified and is working on it. Please try again later.",
            "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR
        }
    )


def register_exception_handlers(app):
    """
    Register all exception handlers with FastAPI app
    
    Args:
        app: FastAPI application instance
    """
    # Custom EagleChair exceptions
    app.add_exception_handler(EagleChairException, eaglechair_exception_handler)
    
    # FastAPI/Pydantic validation errors
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    
    # HTTP exceptions
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(StarletteHTTPException, starlette_http_exception_handler)
    
    # Database errors
    app.add_exception_handler(SQLAlchemyError, database_exception_handler)
    
    # Generic catch-all
    app.add_exception_handler(Exception, generic_exception_handler)
    
    logger.info("[OK] Exception handlers registered")

