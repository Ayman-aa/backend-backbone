import Fastify, { fastify } from 'fastify';
import authRoutes from './routes/auth';
const dotenv = require("dotenv");
import cookie from '@fastify/cookie'
const cors = require('@fastify/cors');


dotenv.config();

import jwtPlugin from './plugins/jwt';
import oauth2Plugin from './plugins/oauth2';
import protectedRoutes from './routes/protected';

const app = Fastify();

// Register the CORS plugin
app.register(cors, {
  // Allow all origins (not recommended for production)
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});

app.register(jwtPlugin);
app.register(cookie, { secret: process.env.COOKIE_SECRE });
app.register(oauth2Plugin);
app.register(protectedRoutes, { prefix: '/protected' });
app.register(authRoutes, { prefix: '/auth' });

app.listen({ port: 3000 }, err => {
  console.log(`
    \x1b[38;2;255;100;100m╔══════════════════════════╗
    \x1b[38;2;255;150;100m║ \x1b[1mSERVER STARTED SUCCESSFULLY \x1b[0m\x1b[38;2;255;150;100m║
    \x1b[38;2;255;200;100m╚══════════════════════════╝
    \x1b[0m➤ Access URL: \x1b[4m\x1b[36mhttp://localhost:3000\x1b[0m
  `);
  console.log(app.printRoutes())
  if (err) throw err;
})