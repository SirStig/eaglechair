"""
EagleChair Logging System

Comprehensive logging with environment-specific configurations
"""

import logging
import logging.handlers
import sys
import os
import platform
from datetime import datetime
from pathlib import Path
from typing import Optional
import json

from backend.core.config import settings


class ColoredFormatter(logging.Formatter):
    """
    Enhanced colored formatter for console output (development mode)
    """
    
    # Enhanced ANSI color codes with better visibility
    COLORS = {
        'DEBUG': '\033[96m',      # Bright Cyan
        'INFO': '\033[92m',       # Bright Green
        'WARNING': '\033[93m',    # Bright Yellow
        'ERROR': '\033[91m',      # Bright Red
        'CRITICAL': '\033[95m',   # Bright Magenta
        'RESET': '\033[0m',       # Reset
        'BOLD': '\033[1m',        # Bold
        'DIM': '\033[2m',         # Dim
        'TIMESTAMP': '\033[37m',  # Light Gray
        'LOGGER': '\033[94m',     # Blue
        'MESSAGE': '\033[97m',    # White
    }
    
    # Level icons for better visual distinction (platform-aware)
    LEVEL_ICONS = {
        'DEBUG': '🔍' if platform.system() != 'Windows' else '[DEBUG]',
        'INFO': 'ℹ️' if platform.system() != 'Windows' else '[INFO]',
        'WARNING': '⚠️' if platform.system() != 'Windows' else '[WARN]',
        'ERROR': '❌' if platform.system() != 'Windows' else '[ERROR]',
        'CRITICAL': '🚨' if platform.system() != 'Windows' else '[CRITICAL]',
    }
    
    def format(self, record):
        # Store original values
        original_levelname = record.levelname
        original_name = record.name
        original_message = record.getMessage()
        
        # Add color and icon to level name
        if record.levelname in self.COLORS:
            icon = self.LEVEL_ICONS.get(record.levelname, '')
            colored_level = f"{self.COLORS[record.levelname]}{self.COLORS['BOLD']}{icon} {record.levelname}{self.COLORS['RESET']}"
            record.levelname = colored_level
        
        # Color the logger name
        if record.name:
            record.name = f"{self.COLORS['LOGGER']}{record.name}{self.COLORS['RESET']}"
        
        # Format the message with enhanced structure
        formatted = super().format(record)
        
        # Add request context if available
        context_parts = []
        if hasattr(record, 'request_id'):
            context_parts.append(f"req:{record.request_id}")
        if hasattr(record, 'user_id'):
            context_parts.append(f"user:{record.user_id}")
        if hasattr(record, 'ip_address'):
            context_parts.append(f"ip:{record.ip_address}")
        
        if context_parts:
            context_str = f" [{self.COLORS['DIM']}{' | '.join(context_parts)}{self.COLORS['RESET']}]"
            formatted = formatted.replace(original_message, f"{original_message}{context_str}")
        
        # Restore original values
        record.levelname = original_levelname
        record.name = original_name
        
        return formatted


class JSONFormatter(logging.Formatter):
    """
    Enhanced JSON formatter for production logs with comprehensive metadata
    """
    
    def format(self, record):
        # Base log data with enhanced metadata
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "timestamp_unix": record.created,
            "level": record.levelname,
            "levelno": record.levelno,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
            "process_id": record.process,
            "thread_id": record.thread,
            "thread_name": record.threadName,
        }
        
        # Add environment context
        log_data["environment"] = settings.ENVIRONMENT
        log_data["debug_mode"] = settings.DEBUG
        
        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                "message": str(record.exc_info[1]) if record.exc_info[1] else None,
                "traceback": self.formatException(record.exc_info)
            }
        
        # Add request context if available
        request_context = {}
        if hasattr(record, "request_id"):
            request_context["request_id"] = record.request_id
        if hasattr(record, "user_id"):
            request_context["user_id"] = record.user_id
        if hasattr(record, "ip_address"):
            request_context["ip_address"] = record.ip_address
        if hasattr(record, "user_agent"):
            request_context["user_agent"] = record.user_agent
        if hasattr(record, "method"):
            request_context["method"] = record.method
        if hasattr(record, "path"):
            request_context["path"] = record.path
        if hasattr(record, "status_code"):
            request_context["status_code"] = record.status_code
        if hasattr(record, "duration_ms"):
            request_context["duration_ms"] = record.duration_ms
        
        if request_context:
            log_data["request_context"] = request_context
        
        # Add performance metrics if available
        performance_metrics = {}
        if hasattr(record, "cpu_usage"):
            performance_metrics["cpu_usage"] = record.cpu_usage
        if hasattr(record, "memory_usage"):
            performance_metrics["memory_usage"] = record.memory_usage
        if hasattr(record, "db_query_time"):
            performance_metrics["db_query_time"] = record.db_query_time
        if hasattr(record, "cache_hit_rate"):
            performance_metrics["cache_hit_rate"] = record.cache_hit_rate
        
        if performance_metrics:
            log_data["performance_metrics"] = performance_metrics
        
        # Add security context if available
        security_context = {}
        if hasattr(record, "event"):
            security_context["event"] = record.event
        if hasattr(record, "risk_level"):
            security_context["risk_level"] = record.risk_level
        if hasattr(record, "threat_type"):
            security_context["threat_type"] = record.threat_type
        
        if security_context:
            log_data["security_context"] = security_context
        
        # Add extra fields if present
        if hasattr(record, "extra"):
            log_data.update(record.extra)
        
        # Add custom fields from record attributes
        custom_fields = {}
        for key, value in record.__dict__.items():
            if key.startswith('custom_'):
                custom_fields[key[7:]] = value  # Remove 'custom_' prefix
        
        if custom_fields:
            log_data["custom_fields"] = custom_fields
        
        return json.dumps(log_data, ensure_ascii=False, separators=(',', ':'))


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
        file_handler.addFilter(lambda record: not hasattr(record, 'no_file_log') or not record.no_file_log)
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
    Enhanced helper class for logging HTTP requests with comprehensive context
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
        user_agent: str = None,
        query_params: dict = None,
        request_size: int = None,
        response_size: int = None,
        db_queries: int = None,
        cache_hits: int = None,
        cache_misses: int = None,
        **kwargs
    ):
        """Log HTTP request with comprehensive context and performance metrics"""
        
        # Calculate performance metrics
        duration_ms = round(duration * 1000, 2)
        cache_hit_rate = None
        if cache_hits is not None and cache_misses is not None:
            total_cache_requests = cache_hits + cache_misses
            if total_cache_requests > 0:
                cache_hit_rate = round((cache_hits / total_cache_requests) * 100, 2)
        
        # Build comprehensive context
        extra_data = {
            "method": method,
            "path": path,
            "status_code": status_code,
            "duration_ms": duration_ms,
            "ip_address": ip_address,
            "user_id": user_id,
            "request_id": request_id,
            "user_agent": user_agent,
            "query_params": query_params,
            "request_size": request_size,
            "response_size": response_size,
            "db_queries": db_queries,
            "cache_hits": cache_hits,
            "cache_misses": cache_misses,
            "cache_hit_rate": cache_hit_rate,
        }
        
        # Add any additional kwargs
        extra_data.update(kwargs)
        
        # Determine log level and message based on status code and performance
        if platform.system() != 'Windows':
            # Linux/Unix with emojis
            if status_code >= 500:
                level = logging.ERROR
                message = f"❌ {method} {path} - {status_code} - {duration_ms}ms"
            elif status_code >= 400:
                level = logging.WARNING
                message = f"⚠️ {method} {path} - {status_code} - {duration_ms}ms"
            elif duration_ms > 1000:  # Slow requests
                level = logging.WARNING
                message = f"🐌 {method} {path} - {status_code} - {duration_ms}ms (SLOW)"
            else:
                level = logging.INFO
                message = f"[OK] {method} {path} - {status_code} - {duration_ms}ms"
        else:
            # Windows with text indicators
            if status_code >= 500:
                level = logging.ERROR
                message = f"[ERROR] {method} {path} - {status_code} - {duration_ms}ms"
            elif status_code >= 400:
                level = logging.WARNING
                message = f"[WARN] {method} {path} - {status_code} - {duration_ms}ms"
            elif duration_ms > 1000:  # Slow requests
                level = logging.WARNING
                message = f"[SLOW] {method} {path} - {status_code} - {duration_ms}ms (SLOW)"
            else:
                level = logging.INFO
                message = f"[OK] {method} {path} - {status_code} - {duration_ms}ms"
        
        # Add performance indicators to message
        if db_queries and db_queries > 10:
            message += f" ({db_queries} queries)"
        if cache_hit_rate is not None:
            message += f" (cache: {cache_hit_rate}%)"
        
        self.logger.log(level, message, extra=extra_data)
    
    def log_slow_query(self, query: str, duration: float, params: dict = None):
        """Log slow database queries"""
        duration_ms = round(duration * 1000, 2)
        icon = "🐌" if platform.system() != 'Windows' else "[SLOW]"
        self.logger.warning(
            f"{icon} Slow DB query: {duration_ms}ms",
            extra={
                "event": "slow_query",
                "query": query[:200] + "..." if len(query) > 200 else query,
                "duration_ms": duration_ms,
                "params": params,
                "db_query_time": duration_ms
            }
        )
    
    def log_cache_miss(self, key: str, operation: str = "get"):
        """Log cache misses for monitoring"""
        icon = "💾" if platform.system() != 'Windows' else "[CACHE]"
        self.logger.debug(
            f"{icon} Cache miss: {operation} {key}",
            extra={
                "event": "cache_miss",
                "cache_key": key,
                "operation": operation
            }
        )
    
    def log_cache_hit(self, key: str, operation: str = "get"):
        """Log cache hits for monitoring"""
        icon = "💾" if platform.system() != 'Windows' else "[CACHE]"
        self.logger.debug(
            f"{icon} Cache hit: {operation} {key}",
            extra={
                "event": "cache_hit",
                "cache_key": key,
                "operation": operation
            }
        )


class SecurityLogger:
    """
    Enhanced helper class for logging security events with comprehensive context
    """
    
    def __init__(self):
        self.logger = logging.getLogger("security")
    
    def log_failed_login(self, email: str, ip_address: str, reason: str = None, user_agent: str = None, attempt_count: int = None):
        """Log failed login attempt with enhanced context"""
        risk_level = "high" if attempt_count and attempt_count > 5 else "medium" if attempt_count and attempt_count > 2 else "low"
        
        icon = "🔒" if platform.system() != 'Windows' else "[SECURITY]"
        self.logger.warning(
            f"{icon} Failed login attempt for {email} from {ip_address}",
            extra={
                "event": "failed_login",
                "email": email,
                "ip_address": ip_address,
                "reason": reason,
                "user_agent": user_agent,
                "attempt_count": attempt_count,
                "risk_level": risk_level,
                "threat_type": "authentication_failure"
            }
        )
    
    def log_suspicious_activity(self, ip_address: str, reason: str, details: dict = None, risk_level: str = "medium", threat_type: str = "suspicious_behavior"):
        """Log suspicious activity with risk assessment"""
        icon = "🚨" if platform.system() != 'Windows' else "[SECURITY]"
        self.logger.warning(
            f"{icon} Suspicious activity from {ip_address}: {reason}",
            extra={
                "event": "suspicious_activity",
                "ip_address": ip_address,
                "reason": reason,
                "details": details,
                "risk_level": risk_level,
                "threat_type": threat_type
            }
        )
    
    def log_admin_action(self, admin_id: int, action: str, resource: str, ip_address: str, user_agent: str = None, changes: dict = None):
        """Log admin action with comprehensive audit trail"""
        icon = "👤" if platform.system() != 'Windows' else "[ADMIN]"
        self.logger.info(
            f"{icon} Admin {admin_id} performed {action} on {resource}",
            extra={
                "event": "admin_action",
                "admin_id": admin_id,
                "action": action,
                "resource": resource,
                "ip_address": ip_address,
                "user_agent": user_agent,
                "changes": changes,
                "risk_level": "low",
                "threat_type": "admin_activity"
            }
        )
    
    def log_ip_banned(self, ip_address: str, reason: str, duration: int, ban_type: str = "temporary"):
        """Log IP ban with comprehensive details"""
        icon = "🚫" if platform.system() != 'Windows' else "[SECURITY]"
        self.logger.warning(
            f"{icon} IP {ip_address} banned for {duration}s: {reason}",
            extra={
                "event": "ip_banned",
                "ip_address": ip_address,
                "reason": reason,
                "duration": duration,
                "ban_type": ban_type,
                "risk_level": "high",
                "threat_type": "ip_ban"
            }
        )
    
    def log_rate_limit_exceeded(self, ip_address: str, endpoint: str, limit: int, window: int):
        """Log rate limit violations"""
        icon = "⏱️" if platform.system() != 'Windows' else "[SECURITY]"
        self.logger.warning(
            f"{icon} Rate limit exceeded: {ip_address} -> {endpoint}",
            extra={
                "event": "rate_limit_exceeded",
                "ip_address": ip_address,
                "endpoint": endpoint,
                "limit": limit,
                "window": window,
                "risk_level": "medium",
                "threat_type": "rate_limit_violation"
            }
        )
    
    def log_authentication_success(self, user_id: int, email: str, ip_address: str, user_agent: str = None):
        """Log successful authentication"""
        icon = "[OK]" if platform.system() != 'Windows' else "[SECURITY]"
        self.logger.info(
            f"{icon} Successful login: {email} from {ip_address}",
            extra={
                "event": "authentication_success",
                "user_id": user_id,
                "email": email,
                "ip_address": ip_address,
                "user_agent": user_agent,
                "risk_level": "low",
                "threat_type": "authentication_success"
            }
        )
    
    def log_permission_denied(self, user_id: int, resource: str, action: str, ip_address: str, reason: str = None):
        """Log permission denied events"""
        icon = "🚫" if platform.system() != 'Windows' else "[SECURITY]"
        self.logger.warning(
            f"{icon} Permission denied: User {user_id} attempted {action} on {resource}",
            extra={
                "event": "permission_denied",
                "user_id": user_id,
                "resource": resource,
                "action": action,
                "ip_address": ip_address,
                "reason": reason,
                "risk_level": "medium",
                "threat_type": "authorization_failure"
            }
        )
    
    def log_data_breach_attempt(self, ip_address: str, target: str, method: str, details: dict = None):
        """Log potential data breach attempts"""
        icon = "🔥" if platform.system() != 'Windows' else "[CRITICAL]"
        self.logger.critical(
            f"{icon} Potential data breach attempt from {ip_address} targeting {target}",
            extra={
                "event": "data_breach_attempt",
                "ip_address": ip_address,
                "target": target,
                "method": method,
                "details": details,
                "risk_level": "critical",
                "threat_type": "data_breach"
            }
        )


class PerformanceLogger:
    """
    Helper class for logging performance metrics and system health
    """
    
    def __init__(self):
        self.logger = logging.getLogger("performance")
    
    def log_system_metrics(self, cpu_usage: float, memory_usage: float, disk_usage: float = None, network_io: dict = None):
        """Log system performance metrics"""
        icon = "📊" if platform.system() != 'Windows' else "[SYSTEM]"
        self.logger.info(
            f"{icon} System metrics: CPU {cpu_usage}%, Memory {memory_usage}%",
            extra={
                "event": "system_metrics",
                "cpu_usage": cpu_usage,
                "memory_usage": memory_usage,
                "disk_usage": disk_usage,
                "network_io": network_io,
                "custom_metrics_type": "system"
            }
        )
    
    def log_database_performance(self, query_count: int, avg_query_time: float, slow_queries: int = 0, connection_pool_size: int = None):
        """Log database performance metrics"""
        icon = "🗄️" if platform.system() != 'Windows' else "[DATABASE]"
        self.logger.info(
            f"{icon} Database performance: {query_count} queries, avg {avg_query_time:.2f}ms",
            extra={
                "event": "database_performance",
                "query_count": query_count,
                "avg_query_time": avg_query_time,
                "slow_queries": slow_queries,
                "connection_pool_size": connection_pool_size,
                "custom_metrics_type": "database"
            }
        )
    
    def log_cache_performance(self, hit_rate: float, total_requests: int, memory_usage: float = None):
        """Log cache performance metrics"""
        icon = "💾" if platform.system() != 'Windows' else "[CACHE]"
        self.logger.info(
            f"{icon} Cache performance: {hit_rate:.2f}% hit rate, {total_requests} requests",
            extra={
                "event": "cache_performance",
                "hit_rate": hit_rate,
                "total_requests": total_requests,
                "memory_usage": memory_usage,
                "custom_metrics_type": "cache"
            }
        )
    
    def log_api_performance(self, endpoint: str, avg_response_time: float, request_count: int, error_rate: float = 0.0):
        """Log API endpoint performance"""
        icon = "🚀" if platform.system() != 'Windows' else "[API]"
        self.logger.info(
            f"{icon} API performance: {endpoint} - {avg_response_time:.2f}ms avg, {request_count} requests",
            extra={
                "event": "api_performance",
                "endpoint": endpoint,
                "avg_response_time": avg_response_time,
                "request_count": request_count,
                "error_rate": error_rate,
                "custom_metrics_type": "api"
            }
        )
    
    def log_memory_leak_detected(self, process_name: str, memory_growth: float, time_period: int):
        """Log potential memory leak detection"""
        icon = "🧠" if platform.system() != 'Windows' else "[MEMORY]"
        self.logger.warning(
            f"{icon} Potential memory leak in {process_name}: {memory_growth}MB growth in {time_period}s",
            extra={
                "event": "memory_leak_detected",
                "process_name": process_name,
                "memory_growth": memory_growth,
                "time_period": time_period,
                "custom_metrics_type": "memory"
            }
        )


# Create singleton instances
request_logger = RequestLogger()
security_logger = SecurityLogger()
performance_logger = PerformanceLogger()


# Initialize logging on module import
def init_logging():
    """Initialize logging system"""
    LoggingConfig.configure_logging()


# Export key functions and classes
__all__ = [
    "LoggingConfig",
    "RequestLogger",
    "SecurityLogger",
    "PerformanceLogger",
    "request_logger",
    "security_logger",
    "performance_logger",
    "init_logging",
]

