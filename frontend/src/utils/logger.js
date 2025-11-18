/**
 * Frontend Logging Utility
 * Provides consistent, configurable logging across the application
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4
};

class Logger {
  constructor() {
    // Get log level from environment variable
    const envLevel = import.meta.env.VITE_LOG_LEVEL || 'INFO';
    this.logLevel = LOG_LEVELS[envLevel.toUpperCase()] ?? LOG_LEVELS.INFO;
    
    // Disable logs in production unless explicitly enabled
    this.isProduction = import.meta.env.PROD;
    this.enabled = import.meta.env.VITE_ENABLE_LOGS === 'true' || !this.isProduction;
    
    // Store logs for debugging
    this.logHistory = [];
    this.maxHistorySize = 100;
  }

  /**
   * Format log message with metadata
   */
  formatMessage(level, context, message, data) {
    const timestamp = new Date().toISOString();
    const formattedMessage = {
      timestamp,
      level,
      context,
      message,
      ...(data && { data })
    };
    
    // Add to history
    this.logHistory.push(formattedMessage);
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory.shift();
    }
    
    return formattedMessage;
  }

  /**
   * Format for console output
   */
  formatConsoleMessage(formattedMessage) {
    const { timestamp, level, context, message } = formattedMessage;
    const time = new Date(timestamp).toLocaleTimeString();
    
    // Use browser-friendly formatting (no ANSI codes for browsers)
    return `[${time}] [${level}] [${context}] ${message}`;
  }
  
  /**
   * Get console styles for browser
   */
  getConsoleStyle(level) {
    const styles = {
      ERROR: 'color: #ef4444; font-weight: bold',
      WARN: 'color: #f59e0b; font-weight: bold',
      INFO: 'color: #3b82f6; font-weight: bold',
      DEBUG: 'color: #8b5cf6',
      TRACE: 'color: #6b7280'
    };
    return styles[level] || '';
  }

  /**
   * Core logging method
   */
  log(level, context, message, data = null) {
    if (!this.enabled) return;
    if (LOG_LEVELS[level] > this.logLevel) return;

    const formattedMessage = this.formatMessage(level, context, message, data);
    const consoleMessage = this.formatConsoleMessage(formattedMessage);
    const style = this.getConsoleStyle(level);

    // Map to appropriate console method
    const consoleMethod = {
      ERROR: console.error,
      WARN: console.warn,
      INFO: console.info,
      DEBUG: console.log,
      TRACE: console.log
    }[level] || console.log;

    // Use styled output for browsers
    if (data !== null && data !== undefined) {
      consoleMethod(`%c${consoleMessage}`, style, data);
    } else {
      consoleMethod(`%c${consoleMessage}`, style);
    }
  }

  /**
   * Convenience methods
   */
  error(context, message, data) {
    this.log('ERROR', context, message, data);
  }

  warn(context, message, data) {
    this.log('WARN', context, message, data);
  }

  info(context, message, data) {
    this.log('INFO', context, message, data);
  }

  debug(context, message, data) {
    this.log('DEBUG', context, message, data);
  }

  trace(context, message, data) {
    this.log('TRACE', context, message, data);
  }

  /**
   * Group related logs
   */
  group(context, label) {
    if (!this.enabled) return;
    console.group(`[${context}] ${label}`);
  }

  groupEnd() {
    if (!this.enabled) return;
    console.groupEnd();
  }

  /**
   * Performance timing
   */
  time(label) {
    if (!this.enabled) return;
    console.time(label);
  }

  timeEnd(label) {
    if (!this.enabled) return;
    console.timeEnd(label);
  }

  /**
   * Get log history for debugging
   */
  getHistory(level = null) {
    if (level) {
      return this.logHistory.filter(log => log.level === level);
    }
    return this.logHistory;
  }

  /**
   * Clear log history
   */
  clearHistory() {
    this.logHistory = [];
  }

  /**
   * Export logs (useful for bug reports)
   */
  exportLogs() {
    return JSON.stringify(this.logHistory, null, 2);
  }
}

// Create singleton instance
const logger = new Logger();

// Expose to window for debugging in console
if (typeof window !== 'undefined') {
  window.logger = logger;
}

export default logger;

