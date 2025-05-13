import fp from 'fastify-plugin';
import oauth2 from '@fastify/oauth2';
import { FastifyInstance } from 'fastify'
import { env } from '../config/env'

export default fp(async function (fastify: FastifyInstance) {
  fastify.register(oauth2, {
    name: 'googleOAuth2',
    scope: ['profile', 'email'],
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
})