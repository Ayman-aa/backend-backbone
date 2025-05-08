import fp from 'fastify-plugin'
import jwt from '@fastify/jwt'
import { FastifyInstance } from 'fastify'

export default fp(async function (fastify: FastifyInstance) {
  fastify.register(jwt, {
    secret: process.env.JWT_SECRET as string,
  });
  fastify.decorate("authenticate", async function (req: any, reply: any) { / *Added type annotation  because of alerts */
    try {
      await req.jwtVerify();
      // reply.code(201).send();
    } catch (err) {
      reply.code(401).send({ error: "Unauthorized" });
    }
  });
})