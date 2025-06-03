import { FastifyInstance } from "fastify";
import { logger } from "../../utils/logger";
import { monitoringService } from "../../services/monitoring.service";
import { healthCheck } from "../../middlewares/errorHandling.middleware";

export default async function healthRoutes(app: FastifyInstance) {
  
  /* <-- Basic health check route --> */
  app.get("/", async (req, reply) => {
    try {
      const health = monitoringService.getHealthStatus();
      const status = health.status === 'healthy' ? 200 : health.status === 'warning' ? 200 : 503;
      
      return reply.status(status).send({
        status: health.status,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        service: "ft_transcendence_chat",
        version: "1.0.0",
        checks: health.checks
      });
    } catch (error) {
      logger.error('Health check failed', error as Error);
      return reply.status(503).send({
        status: 'critical',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      });
    }
  });
  
  /* <-- Detailed metrics route --> */
  app.get("/metrics", async (req, reply) => {
    try {
      const latest = monitoringService.getLatestMetrics();
      const security = monitoringService.getSecurityMetrics();
      const chat = await monitoringService.getChatMetrics();
      
      return reply.send({
        timestamp: new Date().toISOString(),
        system: latest,
        security: {
          ...security,
          blockedIPs: Array.from(security.blockedIPs)
        },
        chat,
        errorHandling: healthCheck.errorHandling(),
        logging: healthCheck.logging()
      });
    } catch (error) {
      logger.error('Metrics retrieval failed', error as Error);
      return reply.status(500).send({
        error: 'Failed to retrieve metrics'
      });
    }
  });
  
  /* <-- System info route --> */
  app.get("/info", async (req, reply) => {
    try {
      return reply.send({
        service: "ft_transcendence_chat",
        version: "1.0.0",
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        memory: process.memoryUsage(),
        pid: process.pid
      });
    } catch (error) {
      logger.error('System info retrieval failed', error as Error);
      return reply.status(500).send({
        error: 'Failed to retrieve system info'
      });
    }
  });
  
  /* <-- Logs endpoint (last 100 entries) --> */
  app.get("/logs", { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const user: any = req.user;
      
      // Only allow admins to view logs (basic security check)
      if (user.email !== 'admin@example.com') {
        return reply.status(403).send({ error: 'Unauthorized' });
      }
      
      // In a real implementation, you'd read from log files
      // For now, return a simple response
      return reply.send({
        message: "Log viewing not implemented in this demo",
        suggestion: "Check log files in the logs/ directory"
      });
    } catch (error) {
      logger.error('Log retrieval failed', error as Error);
      return reply.status(500).send({
        error: 'Failed to retrieve logs'
      });
    }
  });
}