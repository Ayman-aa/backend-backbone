import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import helmet from "@fastify/helmet";
import fastifyMultipart from "@fastify/multipart";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { env } from "./config/env";
import fs from "fs";

import jwtPlugin from "./plugins/jwt";
import oauth2Plugin from "./plugins/oauth2";

import userRoutes from "./modules/users/profile.routes";
import usersRoutes from "./modules/users/users.routes";
import authRoutes from "./modules/auth/auth.routes";
import friendsRoutes from "./modules/friends/friends.routes";
import chatRoutes from "./modules/chats/chats.routes";
import local_1v1 from "./modules/game/game.local-1v1.routes";
import remote from "./modules/game/game.remote-1v1.routes";

import { fastifyStatic } from "@fastify/static";
import path from "path";

import { Server } from "http";
import { setupSocketIO } from "./modules/socket/socket";

const app = Fastify();

app.register(require("@fastify/cors"), {
  origin: true,  // Allows all origins
  credentials: true,
  methods: ["GET", "POST", "PATCH", "OPTIONS", "PUT", "DELETE"],
});


app.register(fastifyStatic, {
  root: path.join(__dirname, "../uploads"),
  prefix: "/uploads",
  setHeaders: (res) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Access-Control-Allow-Origin", "*");
  },
});

app.register(rateLimit, {
  max: 10,
  timeWindow: "1 minute",
  addHeaders: {
    "x-ratelimit-limit": true,
    "x-ratelimit-remaining": true,
    "x-ratelimit-reset": true,
  },
  allowList: ["127.0.0.1", "localhost"],
});

app.register(helmet);

app.register(fastifyMultipart);
app.register(cookie, { secret: env.COOKIE_SECRET });
app.register(jwtPlugin);
app.register(oauth2Plugin);

// Register routes
app.register(userRoutes, { prefix: "/profile" });
app.register(usersRoutes, { prefix: "/users" });
app.register(authRoutes, { prefix: "/auth" });
app.register(friendsRoutes, { prefix: "/friends" });
app.register(chatRoutes, { prefix: "/chats" });
app.register(local_1v1, { prefix: "/game" });
app.register(remote, { prefix: "/game/remote" });

const start = async () => {
  try {
    await app.ready();

    const httpsServer: Server = app.server;
    setupSocketIO(httpsServer);

    await app.listen({
      port: 3000,
      host: "0.0.0.0", // This allows external connections
    });

    console.log(
      "✅ HTTPS + WebSocket server is running on http://localhost:3000",
    );
    console.log(app.printRoutes());
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

/*
| Section                     | Description                                                  |
|----------------------------|--------------------------------------------------------------|
| Imports                    | Loads plugins, route modules, env, static path, socket setup |
| Fastify instance           | Creates main Fastify app                                     |
| Middleware registration    | Sets up CORS, static files, multipart, cookies, JWT, OAuth2  |
| Route registration         | Mounts all feature modules with prefixes                     |
| start()                    | Prepares server, sets up Socket.IO, starts listening         |
*/
