import { FastifyInstance } from 'fastify/types/instance'

export default async function protectedRoutes(app: FastifyInstance) {
  app.get("/me", { preHandler: [app.authenticate] }, async (req, reply) => {
    return reply.send({
      message: "You are in",
      user: req.user
    });
  });
}
