/**
 * Simple logger utility for Frappe MCP Server
 * Provides consistent logging with environment-based controls
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

class Logger {
  private level: LogLevel;

  constructor() {
    // Default to INFO in production, DEBUG in development
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    const isProd = process.env.NODE_ENV === 'production';
    
    switch (envLevel) {
      case 'ERROR': this.level = LogLevel.ERROR; break;
      case 'WARN': this.level = LogLevel.WARN; break;
      case 'INFO': this.level = LogLevel.INFO; break;
      case 'DEBUG': this.level = LogLevel.DEBUG; break;
      default: this.level = isProd ? LogLevel.INFO : LogLevel.DEBUG;
    }
  }

  error(message: string, ...args: any[]) {
    if (this.level >= LogLevel.ERROR) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]) {
    if (this.level >= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]) {
    if (this.level >= LogLevel.INFO) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  debug(message: string, ...args: any[]) {
    if (this.level >= LogLevel.DEBUG) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  // Special methods for startup/server logs
  startup(message: string, ...args: any[]) {
    console.log(`🚀 ${message}`, ...args);
  }

  server(message: string, ...args: any[]) {
    console.log(`☕ ${message}`, ...args);
  }
}

export const logger = new Logger();
export default logger;