import { OAuth2Namespace } from '@fastify/oauth2';
import { FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: any) => Promise<void>;
    googleOAuth2: OAuth2Namespace;
  }
}