import Fastify from 'fastify';
import fastifyMultipart from "@fastify/multipart";
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { env } from './config/env';
import fs from 'fs';


import jwtPlugin from './plugins/jwt';
import oauth2Plugin from './plugins/oauth2';

import userRoutes from './modules/users/profile.routes';
import authRoutes from './modules/auth/auth.routes';
import friendsRoutes from './modules/friends/friends.routes';
import chatRoutes from './modules/chats/chats.routes';

import { fastifyStatic } from "@fastify/static";
import path from "path";

import { Server } from "http";
import { setupSocketIO } from "./modules/socket/socket";

const app = Fastify();

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

// Register routes
app.register(userRoutes, { prefix: '/profile' });
app.register(authRoutes, { prefix: '/auth' });
app.register(friendsRoutes, { prefix: '/friends' });
app.register(chatRoutes, { prefix: '/chats' });

const start = async () => {
  try {
    await app.ready();

    const httpsServer: Server = app.server;
    setupSocketIO(httpsServer);

    await app.listen({ 
      port: 3000, 
      host: '0.0.0.0' // This allows external connections
    });

    console.log("✅ HTTPS + WebSocket server is running on http://localhost:3000");
    console.log(app.printRoutes());

  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
