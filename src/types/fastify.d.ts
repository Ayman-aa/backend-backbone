import { OAuth2Namespace } from '@fastify/oauth2';
import { FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: any) => Promise<void>;
    googleOAuth2: OAuth2Namespace;
  }
}

/*
| Declaration    | Description                                                     |
|----------------|-----------------------------------------------------------------|
| FastifyInstance| Extends Fastify with custom properties                          |
| authenticate   | Middleware function to verify JWT token                         |
| googleOAuth2   | Instance of registered Google OAuth2 provider via fastify-oauth2|
*/
