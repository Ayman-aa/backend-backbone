import Fastify from 'fastify';
import fastifyMultipart from "@fastify/multipart";
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { env } from './config/env';
import fs from 'fs';


import jwtPlugin from './plugins/jwt';
import oauth2Plugin from './plugins/oauth2';

import userRoutes from './modules/users/profile.routes';
import usersRoutes from './modules/users/users.routes';
import authRoutes from './modules/auth/auth.routes';
import friendsRoutes from './modules/friends/friends.routes';
import chatRoutes from './modules/chats/chats.routes';
import blocksRoutes from './modules/blocks/blocks.routes';
import healthRoutes from './modules/health/health.routes';

import { fastifyStatic } from "@fastify/static";
import path from "path";

import { Server } from "http";
import { setupSocketIO } from "./modules/socket/socket";
import { errorHandler, notFoundHandler, requestLogger } from "./middlewares/errorHandling.middleware";
import { logger } from "./utils/logger";
import { monitoringService } from "./services/monitoring.service";

const app = Fastify({
  logger: false // Using custom logger
});

app.register(require('@fastify/cors'), {
  origin: ['http://localhost:8080','http://127.0.0.1:8080'],
  credentials: true,
});

app.register(fastifyStatic, {
  root: path.join(__dirname, "../uploads"),
  prefix: "/uploads"
});

app.register(fastifyMultipart);
app.register(cookie, { secret: env.COOKIE_SECRET });
app.register(jwtPlugin);
app.register(oauth2Plugin);

// Register error handling and logging
app.setErrorHandler(errorHandler);
app.setNotFoundHandler(notFoundHandler);

// Add request monitoring middleware
app.addHook('onRequest', async (request, reply) => {
  monitoringService.incrementRequestCount();
  await requestLogger(request, reply);
});

app.addHook('onResponse', async (request, reply) => {
  const startTime = (request as any).startTime || Date.now();
  const duration = Date.now() - startTime;
  monitoringService.addResponseTime(duration);
  
  if (reply.statusCode >= 400) {
    monitoringService.incrementErrorCount();
  }
});

app.addHook('onRequest', async (request, reply) => {
  (request as any).startTime = Date.now();
});

// Register routes
app.register(userRoutes, { prefix: '/profile' });
app.register(usersRoutes, { prefix: '/users' });
app.register(authRoutes, { prefix: '/auth' });
app.register(friendsRoutes, { prefix: '/friends' });
app.register(chatRoutes, { prefix: '/chats' });
app.register(blocksRoutes, { prefix: '/blocks' });
app.register(healthRoutes, { prefix: '/health' });

const start = async () => {
  try {
    await app.ready();

    const httpsServer: Server = app.server;
    setupSocketIO(httpsServer);

    await app.listen({ 
      port: 3000, 
      host: '0.0.0.0' // This allows external connections
    });

    logger.info("✅ HTTPS + WebSocket server is running on http://localhost:3000");
    console.log("✅ HTTPS + WebSocket server is running on http://localhost:3000");
    console.log(app.printRoutes());

    // Log system startup
    logger.info('Server started successfully', {
      port: 3000,
      environment: process.env.NODE_ENV || 'development',
      routes: app.printRoutes({ includeHooks: false, commonPrefix: false })
    });

  } catch (err) {
    logger.error('Failed to start server', err as Error);
    process.exit(1);
  }
};

start();

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  monitoringService.shutdown();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  monitoringService.shutdown();
  process.exit(0);
});
