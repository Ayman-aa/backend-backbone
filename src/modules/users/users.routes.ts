import { FastifyInstance } from "fastify";
import { prisma } from "../../utils/prisma"

export default async function usersRoutes(app: FastifyInstance) {
  
  /* <-- /users route --> */
  app.get("/", { preHandler: [app.authenticate] }, async (req, reply) => {
    const user: any = req.user;
    
    try {
      const users = await prisma.user.findMany({
        where: {
          id: {
            not: user.id // Exclude current user
          }
        },
        select: {
          id: true,
          username: true,
          email: true,
          avatar: true,
        },
        orderBy: {
          username: 'asc'
        }
      });
      
      return reply.send({ users });
    } catch (err) {
      console.error("❌ Users fetch error:", err);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  });
  /* <-- /users route --> */

  /* <-- /users/search route --> */
  app.get("/search", { preHandler: [app.authenticate] }, async (req, reply) => {
    const user: any = req.user;
    const { query } = req.query as { query?: string };
    
    if (!query || query.trim().length < 2) {
      return reply.status(400).send({ error: "Search query must be at least 2 characters" });
    }
    
    try {
      const users = await prisma.user.findMany({
        where: {
          AND: [
            {
              id: {
                not: user.id // Exclude current user
              }
            },
            {
              OR: [
                {
                  username: {
                    contains: query.trim(),
                    mode: 'insensitive'
                  }
                },
                {
                  email: {
                    contains: query.trim(),
                    mode: 'insensitive'
                  }
                }
              ]
            }
          ]
        },
        select: {
          id: true,
          username: true,
          email: true,
          avatar: true,
        },
        orderBy: {
          username: 'asc'
        },
        take: 50 // Limit results
      });
      
      return reply.send({ users });
    } catch (err) {
      console.error("❌ Users search error:", err);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  });
  /* <-- /users/search route --> */
}

/*
| Method | Route           | Description                           |
| ------ | --------------- | ------------------------------------- |
| GET    | `/users`        | Get all users (excluding current)     |
| GET    | `/users/search` | Search users by username or email     |
*/