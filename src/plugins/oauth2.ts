import fp from "fastify-plugin";
import oauth2 from "@fastify/oauth2";
import { FastifyInstance } from "fastify";
import { env } from "../config/env";

export default fp(async function (fastify: FastifyInstance) {
  fastify.register(oauth2, {
    name: "googleOAuth2",
    scope: ["profile", "email"],
    credentials: {
      client: {
        id: env.GOOGLE_CLIENT_ID as string,
        secret: env.GOOGLE_CLIENT_SECRET as string,
      },
      auth: oauth2.GOOGLE_CONFIGURATION,
    },
    startRedirectPath: '/auth/google',
    callbackUri: 'http://localhost:3000/auth/google/callback'
  });
});

/*
| Plugin         | Description                                                        |
|----------------|--------------------------------------------------------------------|
| fastify-oauth2 | Registers Google OAuth2 provider for login                         |
| Name           | googleOAuth2 (used as `fastify.googleOAuth2` internally)           |
| Scope          | Requests access to user profile and email                          |
| Redirect Path  | /auth/google (initiates OAuth flow)                                |
| Callback URI   | http://localhost:3000/auth/google/callback (handles OAuth response)|
*/
