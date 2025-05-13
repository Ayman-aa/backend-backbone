import { FastifyInstance } from 'fastify/types/instance'

export default async function protectedRoutes(app: FastifyInstance) {
  
  /* <-- me route --> */
  app.get("/me", { preHandler: [app.authenticate] }, async (req, reply) => {
    return reply.send({
      message: "You are in",
      user: req.user
    });
    });
  /* <-- Google Callback route --> */
  
  /* <-- update username route --> */
  
  /* <-- update username route --> */
  
  /* <-- update avatar route --> */
  /* <-- update avatar route --> */
}
