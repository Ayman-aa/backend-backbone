import { logger } from '../utils/logger';

export interface SystemMetrics {
  timestamp: string;
  uptime: number;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
  activeConnections: number;
  requestCount: number;
  errorCount: number;
  avgResponseTime: number;
}

export interface ChatMetrics {
  totalMessages: number;
  messagesLast24h: number;
  activeUsers: number;
  blockedUsers: number;
  friendRequests: number;
  rateLimitHits: number;
}

export interface SecurityMetrics {
  failedLogins: number;
  unauthorizedAccess: number;
  rateLimitViolations: number;
  blockedIPs: Set<string>;
  suspiciousActivity: number;
}

class MonitoringService {
  private startTime: number = Date.now();
  private requestCount: number = 0;
  private errorCount: number = 0;
  private responseTimes: number[] = [];
  private activeConnections: number = 0;
  private rateLimitHits: number = 0;
  private securityEvents: SecurityMetrics = {
    failedLogins: 0,
    unauthorizedAccess: 0,
    rateLimitViolations: 0,
    blockedIPs: new Set(),
    suspiciousActivity: 0
  };
  
  private metrics: SystemMetrics[] = [];
  private metricsRetentionHours: number = 24;
  private cleanupInterval: NodeJS.Timeout | undefined;

  constructor() {
    this.startMetricsCollection();
    this.setupCleanup();
  }

  private startMetricsCollection(): void {
    // Collect metrics every 30 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);

    // Log summary metrics every 5 minutes
    setInterval(() => {
      this.logMetricsSummary();
    }, 5 * 60 * 1000);
  }

  private setupCleanup(): void {
    // Clean old metrics every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, 60 * 60 * 1000);
  }

  private collectSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const metrics: SystemMetrics = {
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      memoryUsage: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers
      },
      cpuUsage: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      activeConnections: this.activeConnections,
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      avgResponseTime: this.calculateAverageResponseTime()
    };

    this.metrics.push(metrics);
    
    // Check for alerts
    this.checkAlerts(metrics);
  }

  private calculateAverageResponseTime(): number {
    if (this.responseTimes.length === 0) return 0;
    const sum = this.responseTimes.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.responseTimes.length);
  }

  private checkAlerts(metrics: SystemMetrics): void {
    // High memory usage alert
    const memoryUsagePercent = (metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal) * 100;
    if (memoryUsagePercent > 85) {
      logger.warn(`High memory usage detected: ${memoryUsagePercent.toFixed(2)}%`, {
        heapUsed: metrics.memoryUsage.heapUsed,
        heapTotal: metrics.memoryUsage.heapTotal
      });
    }

    // High response time alert
    if (metrics.avgResponseTime > 5000) {
      logger.warn(`High average response time: ${metrics.avgResponseTime}ms`);
    }

    // High error rate alert
    const errorRate = this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;
    if (errorRate > 10) {
      logger.warn(`High error rate detected: ${errorRate.toFixed(2)}%`, {
        errorCount: this.errorCount,
        requestCount: this.requestCount
      });
    }
  }

  private logMetricsSummary(): void {
    const latestMetrics = this.getLatestMetrics();
    if (!latestMetrics) return;

    const memoryUsageMB = Math.round(latestMetrics.memoryUsage.heapUsed / 1024 / 1024);
    const errorRate = this.requestCount > 0 ? ((this.errorCount / this.requestCount) * 100).toFixed(2) : '0';

    logger.info('System Health Summary', {
      uptime: `${Math.floor(latestMetrics.uptime / 3600)}h ${Math.floor((latestMetrics.uptime % 3600) / 60)}m`,
      memoryUsage: `${memoryUsageMB}MB`,
      activeConnections: latestMetrics.activeConnections,
      requestCount: this.requestCount,
      errorRate: `${errorRate}%`,
      avgResponseTime: `${latestMetrics.avgResponseTime}ms`,
      rateLimitHits: this.rateLimitHits
    });
  }

  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - (this.metricsRetentionHours * 60 * 60 * 1000);
    this.metrics = this.metrics.filter(m => new Date(m.timestamp).getTime() > cutoffTime);
    
    // Reset counters daily
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0) {
      this.resetDailyCounters();
    }
  }

  private resetDailyCounters(): void {
    this.requestCount = 0;
    this.errorCount = 0;
    this.responseTimes = [];
    this.rateLimitHits = 0;
    this.securityEvents = {
      failedLogins: 0,
      unauthorizedAccess: 0,
      rateLimitViolations: 0,
      blockedIPs: new Set(),
      suspiciousActivity: 0
    };
    
    logger.info('Daily counters reset');
  }

  // Public methods for updating metrics
  incrementRequestCount(): void {
    this.requestCount++;
  }

  incrementErrorCount(): void {
    this.errorCount++;
  }

  addResponseTime(duration: number): void {
    this.responseTimes.push(duration);
    // Keep only last 1000 response times for memory efficiency
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-1000);
    }
  }

  setActiveConnections(count: number): void {
    this.activeConnections = count;
  }

  incrementRateLimitHits(): void {
    this.rateLimitHits++;
    this.securityEvents.rateLimitViolations++;
  }

  recordSecurityEvent(event: 'FAILED_LOGIN' | 'UNAUTHORIZED_ACCESS' | 'SUSPICIOUS_ACTIVITY', ip?: string): void {
    switch (event) {
      case 'FAILED_LOGIN':
        this.securityEvents.failedLogins++;
        break;
      case 'UNAUTHORIZED_ACCESS':
        this.securityEvents.unauthorizedAccess++;
        break;
      case 'SUSPICIOUS_ACTIVITY':
        this.securityEvents.suspiciousActivity++;
        break;
    }

    if (ip) {
      this.securityEvents.blockedIPs.add(ip);
    }

    logger.security(event, 'MEDIUM', undefined, ip, {
      totalFailedLogins: this.securityEvents.failedLogins,
      totalUnauthorizedAccess: this.securityEvents.unauthorizedAccess,
      totalSuspiciousActivity: this.securityEvents.suspiciousActivity
    });
  }

  // Getters for metrics
  getLatestMetrics(): SystemMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  getMetricsHistory(hours: number = 1): SystemMetrics[] {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    return this.metrics.filter(m => new Date(m.timestamp).getTime() > cutoffTime);
  }

  getSecurityMetrics(): SecurityMetrics {
    return {
      ...this.securityEvents,
      blockedIPs: new Set(this.securityEvents.blockedIPs) // Return a copy
    };
  }

  getChatMetrics(): Promise<ChatMetrics> {
    // This would typically query the database
    // For now, return mock data that would be implemented with Prisma
    return Promise.resolve({
      totalMessages: 0,
      messagesLast24h: 0,
      activeUsers: this.activeConnections,
      blockedUsers: 0,
      friendRequests: 0,
      rateLimitHits: this.rateLimitHits
    });
  }

  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    checks: Record<string, { status: 'pass' | 'fail'; message?: string }>;
  } {
    const latest = this.getLatestMetrics();
    const checks: Record<string, { status: 'pass' | 'fail'; message?: string }> = {};

    // Memory check
    if (latest) {
      const memoryUsagePercent = (latest.memoryUsage.heapUsed / latest.memoryUsage.heapTotal) * 100;
      checks.memory = {
        status: memoryUsagePercent < 85 ? 'pass' : 'fail',
        message: `${memoryUsagePercent.toFixed(2)}% used`
      };

      // Response time check
      checks.responseTime = {
        status: latest.avgResponseTime < 5000 ? 'pass' : 'fail',
        message: `${latest.avgResponseTime}ms average`
      };

      // Error rate check
      const errorRate = this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;
      checks.errorRate = {
        status: errorRate < 10 ? 'pass' : 'fail',
        message: `${errorRate.toFixed(2)}% error rate`
      };
    }

    // Determine overall status
    const hasFailures = Object.values(checks).some(check => check.status === 'fail');
    const status = hasFailures ? 'critical' : 'healthy';

    return { status, checks };
  }

  // Performance tracking for specific operations
  trackOperation<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    return fn()
      .then(result => {
        const duration = Date.now() - startTime;
        logger.performance(operation, duration, true);
        this.addResponseTime(duration);
        return result;
      })
      .catch(error => {
        const duration = Date.now() - startTime;
        logger.performance(operation, duration, false, { error: error.message });
        this.incrementErrorCount();
        throw error;
      });
  }

  // Database operation tracking
  trackDatabaseOperation<T>(operation: string, table: string, fn: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    return fn()
      .then(result => {
        const duration = Date.now() - startTime;
        logger.database(operation, table, duration, true);
        return result;
      })
      .catch(error => {
        const duration = Date.now() - startTime;
        logger.database(operation, table, duration, false, error);
        throw error;
      });
  }

  // Graceful shutdown
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    
    logger.info('Monitoring service shutting down', {
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      totalRequests: this.requestCount,
      totalErrors: this.errorCount
    });
  }
}

export const monitoringService = new MonitoringService();
export default monitoringService;