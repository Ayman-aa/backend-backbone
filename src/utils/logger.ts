import fs from 'fs';
import path from 'path';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  AUDIT = 4
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  userId?: number;
  ip?: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  duration?: number;
  error?: Error;
  metadata?: Record<string, any>;
}

export interface AuditEntry {
  timestamp: string;
  userId: number;
  action: string;
  resource: string;
  resourceId?: string | number;
  oldValue?: any;
  newValue?: any;
  ip?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

class Logger {
  private logLevel: LogLevel = LogLevel.INFO;
  private logDir: string = path.join(process.cwd(), 'logs');
  private auditDir: string = path.join(this.logDir, 'audit');
  private errorDir: string = path.join(this.logDir, 'errors');

  constructor() {
    this.ensureLogDirectories();
  }

  private ensureLogDirectories(): void {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
      if (!fs.existsSync(this.auditDir)) {
        fs.mkdirSync(this.auditDir, { recursive: true });
      }
      if (!fs.existsSync(this.errorDir)) {
        fs.mkdirSync(this.errorDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create log directories:', error);
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    const levelName = LogLevel[entry.level];
    const base = `[${entry.timestamp}] ${levelName}: ${entry.message}`;
    
    const metadata: string[] = [];
    if (entry.userId) metadata.push(`userId=${entry.userId}`);
    if (entry.ip) metadata.push(`ip=${entry.ip}`);
    if (entry.endpoint) metadata.push(`endpoint=${entry.method} ${entry.endpoint}`);
    if (entry.statusCode) metadata.push(`status=${entry.statusCode}`);
    if (entry.duration) metadata.push(`duration=${entry.duration}ms`);
    
    const metadataStr = metadata.length > 0 ? ` | ${metadata.join(', ')}` : '';
    
    let result = base + metadataStr;
    
    if (entry.error) {
      result += `\nError: ${entry.error.message}\nStack: ${entry.error.stack}`;
    }
    
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      result += `\nMetadata: ${JSON.stringify(entry.metadata, null, 2)}`;
    }
    
    return result;
  }

  private writeToFile(fileName: string, content: string): void {
    try {
      const filePath = path.join(this.logDir, fileName);
      fs.appendFileSync(filePath, content + '\n');
    } catch (error) {
      console.error(`Failed to write to log file ${fileName}:`, error);
    }
  }

  private writeAuditToFile(fileName: string, content: string): void {
    try {
      const filePath = path.join(this.auditDir, fileName);
      fs.appendFileSync(filePath, content + '\n');
    } catch (error) {
      console.error(`Failed to write to audit file ${fileName}:`, error);
    }
  }

  private writeErrorToFile(fileName: string, content: string): void {
    try {
      const filePath = path.join(this.errorDir, fileName);
      fs.appendFileSync(filePath, content + '\n');
    } catch (error) {
      console.error(`Failed to write to error file ${fileName}:`, error);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.logLevel;
  }

  private getCurrentDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  private log(level: LogLevel, message: string, metadata?: Partial<LogEntry>): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...metadata
    };

    // Console output with colors
    const levelName = LogLevel[level];
    const coloredMessage = this.colorizeLevel(levelName, this.formatLogEntry(entry));
    console.log(coloredMessage);

    // File output
    const fileName = `app-${this.getCurrentDate()}.log`;
    this.writeToFile(fileName, this.formatLogEntry(entry));

    // Separate error file for errors
    if (level === LogLevel.ERROR) {
      const errorFileName = `errors-${this.getCurrentDate()}.log`;
      this.writeErrorToFile(errorFileName, this.formatLogEntry(entry));
    }
  }

  private colorizeLevel(level: string, message: string): string {
    const colors = {
      ERROR: '\x1b[31m', // Red
      WARN: '\x1b[33m',  // Yellow
      INFO: '\x1b[36m',  // Cyan
      DEBUG: '\x1b[35m', // Magenta
      AUDIT: '\x1b[32m'  // Green
    };
    const reset = '\x1b[0m';
    const color = colors[level as keyof typeof colors] || '';
    return `${color}${message}${reset}`;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, { error, metadata });
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, { metadata });
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, { metadata });
  }

  debug(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, { metadata });
  }

  // Request logging middleware helper
  logRequest(method: string, endpoint: string, statusCode: number, duration: number, userId?: number, ip?: string, userAgent?: string): void {
    const level = statusCode >= 500 ? LogLevel.ERROR : statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
    const message = `${method} ${endpoint} - ${statusCode}`;
    
    this.log(level, message, {
      method,
      endpoint,
      statusCode,
      duration,
      userId,
      ip,
      userAgent
    });
  }

  // Audit logging for security-critical operations
  audit(entry: Omit<AuditEntry, 'timestamp'>): void {
    const auditEntry: AuditEntry = {
      timestamp: new Date().toISOString(),
      ...entry
    };

    const auditMessage = `AUDIT: ${entry.action} on ${entry.resource}${entry.resourceId ? ` (ID: ${entry.resourceId})` : ''} by user ${entry.userId} - ${entry.success ? 'SUCCESS' : 'FAILED'}`;
    
    // Log to console and main log
    this.log(LogLevel.AUDIT, auditMessage, {
      userId: entry.userId,
      ip: entry.ip,
      userAgent: entry.userAgent,
      metadata: {
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
        success: entry.success,
        errorMessage: entry.errorMessage,
        ...entry.metadata
      }
    });

    // Write to separate audit file
    const auditFileName = `audit-${this.getCurrentDate()}.log`;
    const auditLogContent = `[${auditEntry.timestamp}] ${JSON.stringify(auditEntry)}`;
    this.writeAuditToFile(auditFileName, auditLogContent);
  }

  // Security event logging
  security(event: string, severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', userId?: number, ip?: string, details?: Record<string, any>): void {
    const message = `SECURITY [${severity}]: ${event}`;
    const level = severity === 'CRITICAL' || severity === 'HIGH' ? LogLevel.ERROR : LogLevel.WARN;
    
    this.log(level, message, {
      userId,
      ip,
      metadata: {
        securityEvent: true,
        severity,
        event,
        ...details
      }
    });

    // Write to separate security log
    const securityFileName = `security-${this.getCurrentDate()}.log`;
    const securityLogContent = `[${new Date().toISOString()}] [${severity}] ${event} | userId=${userId || 'N/A'} ip=${ip || 'N/A'} | ${JSON.stringify(details || {})}`;
    this.writeToFile(securityFileName, securityLogContent);
  }

  // Performance monitoring
  performance(operation: string, duration: number, success: boolean, metadata?: Record<string, any>): void {
    const message = `PERFORMANCE: ${operation} completed in ${duration}ms - ${success ? 'SUCCESS' : 'FAILED'}`;
    const level = !success ? LogLevel.WARN : duration > 5000 ? LogLevel.WARN : LogLevel.DEBUG;
    
    this.log(level, message, {
      duration,
      metadata: {
        performanceEvent: true,
        operation,
        success,
        ...metadata
      }
    });
  }

  // Database operation logging
  database(operation: string, table: string, duration: number, success: boolean, error?: Error): void {
    const message = `DB: ${operation} on ${table} - ${success ? 'SUCCESS' : 'FAILED'} (${duration}ms)`;
    const level = !success ? LogLevel.ERROR : duration > 1000 ? LogLevel.WARN : LogLevel.DEBUG;
    
    this.log(level, message, {
      duration,
      error,
      metadata: {
        databaseEvent: true,
        operation,
        table,
        success
      }
    });
  }

  // Chat-specific logging
  chatEvent(event: 'MESSAGE_SENT' | 'MESSAGE_RECEIVED' | 'USER_BLOCKED' | 'USER_UNBLOCKED' | 'FRIEND_REQUEST_SENT' | 'FRIEND_REQUEST_ACCEPTED' | 'FRIEND_REQUEST_DECLINED', userId: number, targetUserId?: number, messageId?: number, ip?: string): void {
    const message = `CHAT: ${event} by user ${userId}${targetUserId ? ` to user ${targetUserId}` : ''}${messageId ? ` (message ID: ${messageId})` : ''}`;
    
    this.log(LogLevel.INFO, message, {
      userId,
      ip,
      metadata: {
        chatEvent: true,
        event,
        targetUserId,
        messageId
      }
    });
  }

  // Rate limiting events
  rateLimitHit(endpoint: string, limit: number, window: string, userId?: number, ip?: string): void {
    const identifier = userId ? `user ${userId}` : `IP ${ip}`;
    const message = `RATE_LIMIT: ${identifier} hit limit for ${endpoint} (${limit} requests per ${window})`;
    
    this.security('RATE_LIMIT_EXCEEDED', 'MEDIUM', userId, ip, {
      endpoint,
      limit,
      window
    });
  }

  // Authentication events
  authEvent(event: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'LOGOUT' | 'TOKEN_REFRESH' | 'UNAUTHORIZED_ACCESS', userId?: number, email?: string, ip?: string, userAgent?: string, reason?: string): void {
    const message = `AUTH: ${event}${userId ? ` for user ${userId}` : ''}${email ? ` (${email})` : ''}${reason ? ` - ${reason}` : ''}`;
    const level = event === 'LOGIN_FAILED' || event === 'UNAUTHORIZED_ACCESS' ? LogLevel.WARN : LogLevel.INFO;
    const severity = event === 'UNAUTHORIZED_ACCESS' ? 'HIGH' : event === 'LOGIN_FAILED' ? 'MEDIUM' : 'LOW';
    
    if (event === 'LOGIN_FAILED' || event === 'UNAUTHORIZED_ACCESS') {
      this.security(event, severity, userId, ip, {
        email,
        userAgent,
        reason
      });
    } else {
      this.log(level, message, {
        userId,
        ip,
        userAgent,
        metadata: {
          authEvent: true,
          event,
          email,
          reason
        }
      });
    }
  }

  // Cleanup old log files (call this periodically)
  cleanupOldLogs(daysToKeep: number = 30): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const directories = [this.logDir, this.auditDir, this.errorDir];
    
    directories.forEach(dir => {
      try {
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir);
          files.forEach(file => {
            const filePath = path.join(dir, file);
            const stats = fs.statSync(filePath);
            if (stats.mtime < cutoffDate) {
              fs.unlinkSync(filePath);
              this.info(`Cleaned up old log file: ${file}`);
            }
          });
        }
      } catch (error) {
        this.error('Failed to cleanup old logs', error as Error);
      }
    });
  }
}

export const logger = new Logger();

// Set log level based on environment
if (process.env.NODE_ENV === 'development') {
  logger.setLogLevel(LogLevel.DEBUG);
} else if (process.env.NODE_ENV === 'production') {
  logger.setLogLevel(LogLevel.INFO);
}

export default logger;