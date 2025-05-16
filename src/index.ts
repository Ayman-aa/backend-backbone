import Fastify, { fastify } from 'fastify';
import fastifyMultipart from "@fastify/multipart";

import cookie from '@fastify/cookie'
const cors = require('@fastify/cors');
import { env } from './config/env';


import jwtPlugin from './plugins/jwt';
import oauth2Plugin from './plugins/oauth2';

import userRoutes from './modules/users/profile.routes';
import authRoutes from './modules/auth/auth';
import friendsRoutes from './modules/friends/friends.routes'
import chatRoutes from './modules/chats/chats.routes';


import {fastifyStatic} from "@fastify/static";
import path from "path";


const app = Fastify();

app.register(cors, {
    origin: 'http://localhost:8080', // <-- Double-check this value!
    credentials: true
});

app.register(fastifyStatic, {
  root: path.join(__dirname, "../uploads"),
  prefix: "/uploads"
})

app.register(fastifyMultipart);
app.register(jwtPlugin);
app.register(cookie, { secret: env.COOKIE_SECRET, parseOptions: {} });
app.register(oauth2Plugin);


app.register(userRoutes, { prefix: '/profile' });
app.register(authRoutes, { prefix: '/auth' });
app.register(friendsRoutes, { prefix: '/friends' });
app.register(chatRoutes, { prefix: '/messages' });


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