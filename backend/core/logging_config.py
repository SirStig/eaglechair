"""
EagleChair Logging System

Comprehensive logging with environment-specific configurations
"""

import logging
import logging.handlers
import sys
import os
from datetime import datetime
from pathlib import Path
from typing import Optional
import json

from backend.core.config import settings


class ColoredFormatter(logging.Formatter):
    """
    Colored formatter for console output (development mode)
    """
    
    # ANSI color codes
    COLORS = {
        'DEBUG': '\033[36m',      # Cyan
        'INFO': '\033[32m',       # Green
        'WARNING': '\033[33m',    # Yellow
        'ERROR': '\033[31m',      # Red
        'CRITICAL': '\033[35m',   # Magenta
        'RESET': '\033[0m'        # Reset
    }
    
    def format(self, record):
        # Add color to level name
        if record.levelname in self.COLORS:
            record.levelname = f"{self.COLORS[record.levelname]}{record.levelname}{self.COLORS['RESET']}"
        
        return super().format(record)


class JSONFormatter(logging.Formatter):
    """
    JSON formatter for production logs (easier to parse)
    """
    
    def format(self, record):
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        
        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        
        # Add extra fields if present
        if hasattr(record, "extra"):
            log_data.update(record.extra)
        
        # Add request context if available
        if hasattr(record, "request_id"):
            log_data["request_id"] = record.request_id
        
        if hasattr(record, "user_id"):
            log_data["user_id"] = record.user_id
        
        if hasattr(record, "ip_address"):
            log_data["ip_address"] = record.ip_address
        
        return json.dumps(log_data)


class LoggingConfig:
    """
    Centralized logging configuration
    """
    
    # Log levels by environment
    ENVIRONMENT_LEVELS = {
        "production": logging.WARNING,  # Minimal logging
        "staging": logging.INFO,
        "development": logging.DEBUG,   # Verbose logging
        "testing": logging.ERROR,       # Minimal during tests
    }
    
    # Log format by environment
    FORMATS = {
        "production": "json",           # Structured JSON for parsing
        "staging": "json",
        "development": "colored",       # Human-readable with colors
        "testing": "simple",
    }
    
    @staticmethod
    def get_log_level() -> int:
        """Get log level based on environment"""
        env = "production" if not settings.DEBUG else "development"
        if settings.TESTING:
            env = "testing"
        
        return LoggingConfig.ENVIRONMENT_LEVELS.get(env, logging.INFO)
    
    @staticmethod
    def get_log_format() -> str:
        """Get log format based on environment"""
        env = "production" if not settings.DEBUG else "development"
        if settings.TESTING:
            env = "testing"
        
        return LoggingConfig.FORMATS.get(env, "json")
    
    @staticmethod
    def get_formatter() -> logging.Formatter:
        """Get appropriate formatter"""
        log_format = LoggingConfig.get_log_format()
        
        if log_format == "json":
            return JSONFormatter()
        
        elif log_format == "colored":
            return ColoredFormatter(
                fmt="%(asctime)s | %(levelname)-8s | %(name)-30s | %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S"
            )
        
        else:  # simple
            return logging.Formatter(
                fmt="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S"
            )
    
    @staticmethod
    def setup_file_handler(logger: logging.Logger, log_dir: Path):
        """Setup file handler with rotation"""
        # Create logs directory if it doesn't exist
        log_dir.mkdir(parents=True, exist_ok=True)
        
        # General application log
        app_log = log_dir / "eaglechair.log"
        file_handler = logging.handlers.RotatingFileHandler(
            app_log,
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=5,
            encoding='utf-8'
        )
        file_handler.setLevel(logging.DEBUG)  # Capture all levels to file
        file_handler.setFormatter(JSONFormatter())  # Always use JSON for files
        logger.addHandler(file_handler)
        
        # Error log (errors only)
        error_log = log_dir / "errors.log"
        error_handler = logging.handlers.RotatingFileHandler(
            error_log,
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=5,
            encoding='utf-8'
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(JSONFormatter())
        logger.addHandler(error_handler)
        
        # Access log (for requests)
        access_log = log_dir / "access.log"
        access_handler = logging.handlers.RotatingFileHandler(
            access_log,
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=10,  # More backups for access logs
            encoding='utf-8'
        )
        access_handler.setLevel(logging.INFO)
        access_handler.setFormatter(JSONFormatter())
        
        # Create access logger
        access_logger = logging.getLogger("access")
        access_logger.addHandler(access_handler)
        access_logger.setLevel(logging.INFO)
    
    @staticmethod
    def setup_console_handler(logger: logging.Logger):
        """Setup console handler"""
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(LoggingConfig.get_log_level())
        console_handler.setFormatter(LoggingConfig.get_formatter())
        logger.addHandler(console_handler)
    
    @staticmethod
    def configure_logging(log_dir: Optional[Path] = None):
        """
        Configure application-wide logging
        
        Args:
            log_dir: Directory for log files (default: ./logs)
        """
        # Determine log directory
        if log_dir is None:
            log_dir = Path("logs")
        
        # Get root logger
        logger = logging.getLogger()
        logger.setLevel(logging.DEBUG)  # Capture all levels
        
        # Remove existing handlers
        logger.handlers.clear()
        
        # Setup console handler
        LoggingConfig.setup_console_handler(logger)
        
        # Setup file handlers (not in testing)
        if not settings.TESTING:
            LoggingConfig.setup_file_handler(logger, log_dir)
        
        # Configure third-party loggers
        LoggingConfig.configure_third_party_loggers()
        
        # Log configuration summary
        logger.info("=" * 70)
        logger.info(f"Logging configured: Level={logging.getLevelName(LoggingConfig.get_log_level())}, "
                   f"Format={LoggingConfig.get_log_format()}, "
                   f"Environment={'Testing' if settings.TESTING else ('Production' if not settings.DEBUG else 'Development')}")
        logger.info("=" * 70)
    
    @staticmethod
    def configure_third_party_loggers():
        """Configure third-party library loggers"""
        # Reduce noise from third-party libraries
        logging.getLogger("uvicorn").setLevel(logging.WARNING if not settings.DEBUG else logging.INFO)
        logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
        logging.getLogger("uvicorn.error").setLevel(logging.INFO)
        logging.getLogger("fastapi").setLevel(logging.INFO)
        logging.getLogger("sqlalchemy").setLevel(logging.WARNING)
        logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
        
        # In production, be even more restrictive
        if not settings.DEBUG:
            logging.getLogger("uvicorn").setLevel(logging.ERROR)
            logging.getLogger("fastapi").setLevel(logging.WARNING)


class RequestLogger:
    """
    Helper class for logging HTTP requests with context
    """
    
    def __init__(self):
        self.logger = logging.getLogger("access")
    
    def log_request(
        self,
        method: str,
        path: str,
        status_code: int,
        duration: float,
        ip_address: str = None,
        user_id: str = None,
        request_id: str = None,
        **kwargs
    ):
        """Log HTTP request with full context"""
        extra_data = {
            "method": method,
            "path": path,
            "status_code": status_code,
            "duration_ms": round(duration * 1000, 2),
            "ip_address": ip_address,
            "user_id": user_id,
            "request_id": request_id,
        }
        
        # Add any additional kwargs
        extra_data.update(kwargs)
        
        # Determine log level based on status code
        if status_code >= 500:
            level = logging.ERROR
        elif status_code >= 400:
            level = logging.WARNING
        else:
            level = logging.INFO
        
        self.logger.log(
            level,
            f"{method} {path} - {status_code} - {duration*1000:.2f}ms",
            extra=extra_data
        )


class SecurityLogger:
    """
    Helper class for logging security events
    """
    
    def __init__(self):
        self.logger = logging.getLogger("security")
    
    def log_failed_login(self, email: str, ip_address: str, reason: str = None):
        """Log failed login attempt"""
        self.logger.warning(
            f"Failed login attempt for {email} from {ip_address}",
            extra={"event": "failed_login", "email": email, "ip": ip_address, "reason": reason}
        )
    
    def log_suspicious_activity(self, ip_address: str, reason: str, details: dict = None):
        """Log suspicious activity"""
        self.logger.warning(
            f"Suspicious activity from {ip_address}: {reason}",
            extra={"event": "suspicious_activity", "ip": ip_address, "reason": reason, "details": details}
        )
    
    def log_admin_action(self, admin_id: int, action: str, resource: str, ip_address: str):
        """Log admin action"""
        self.logger.info(
            f"Admin {admin_id} performed {action} on {resource}",
            extra={"event": "admin_action", "admin_id": admin_id, "action": action, 
                   "resource": resource, "ip": ip_address}
        )
    
    def log_ip_banned(self, ip_address: str, reason: str, duration: int):
        """Log IP ban"""
        self.logger.warning(
            f"IP {ip_address} banned for {duration}s: {reason}",
            extra={"event": "ip_banned", "ip": ip_address, "reason": reason, "duration": duration}
        )


# Create singleton instances
request_logger = RequestLogger()
security_logger = SecurityLogger()


# Initialize logging on module import
def init_logging():
    """Initialize logging system"""
    LoggingConfig.configure_logging()


# Export key functions and classes
__all__ = [
    "LoggingConfig",
    "RequestLogger",
    "SecurityLogger",
    "request_logger",
    "security_logger",
    "init_logging",
]

