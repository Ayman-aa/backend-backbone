import { FastifyInstance } from 'fastify/types/instance'
import { z } from "zod"
import { prisma } from "../../utils/prisma"
import { profile } from 'node:console';

const userSchema = z.object({
  username: z.string().min(3).optional(),
})

export default async function protectedRoutes(app: FastifyInstance) {
  
  /* <-- me route --> */
  app.get("/me", { preHandler: [app.authenticate] }, async (req, reply) => {
    return reply.send({
      message: "You are in",
      user: req.user
    });
    });
  /* <-- me route --> */
  
  /* <-- update username route --> */
  app.patch("/username", {preHandler: [app.authenticate] }, async (request, reply) => {
    const user: any = request.user;
    const body = userSchema.safeParse(request.body);
    if (!body.success)
      return reply.status(400).send({ error: "invalide data" });
    
    const newUsername = body.data.username;
    
    try {
      const updateUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          username: newUsername,
        },
      });
      return reply.send({ user: updateUser });
    } catch (err: any) {
      console.log(err.meta); /* 4er bash nshuf wa7ed l9adia */
        if ( err.code === "P2002" && err.meta?.target?.includes("username"))
          return reply.status(409).send({ error: "Username already taken" })
        return reply.status(500).send({ error: "Server error, (Brother is it from here)" })
      }
  })
  /* <-- update username route --> */
  
  /* <-- update avatar route --> */
  /* <-- update avatar route --> */
}
