import { FastifyInstance } from "fastify";
import { prisma } from "../../utils/prisma"

export default async function usersRoutes(app: FastifyInstance) {
  
  /* <-- /users route --> */
  app.get("/", { preHandler: [app.authenticate] }, async (req, reply) => {
    const user: any = req.user;
    
    try {
      // Use raw query for better SQLite compatibility
      const users = await prisma.$queryRaw`
        SELECT id, username, email, avatar
        FROM User 
        WHERE id != ${user.id}
        ORDER BY username ASC
      ` as Array<{ id: number; username: string; email: string; avatar: string | null }>;

      // Get friendship status for each user
      const usersWithStatus = await Promise.all(
        users.map(async (targetUser: any) => {
          const friendship = await prisma.friendship.findFirst({
            where: {
              OR: [
                { requesterId: user.id, recipientId: targetUser.id },
                { requesterId: targetUser.id, recipientId: user.id },
              ],
            },
          });

          let friendshipStatus = null;
          if (friendship) {
            if (friendship.status === 'accepted') {
              friendshipStatus = 'accepted';
            } else if (friendship.status === 'pending') {
              if (friendship.requesterId === user.id) {
                friendshipStatus = 'pending_sent';
              } else {
                friendshipStatus = 'pending_received';
              }
            }
          }

          return {
            ...targetUser,
            friendshipStatus,
            friendshipId: friendship?.id || null
          };
        })
      );
      
      return reply.send({ users: usersWithStatus });
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
      const searchTerm = `%${query.trim().toLowerCase()}%`;
      
      // Use raw query for case-insensitive search in SQLite
      const users = await prisma.$queryRaw`
        SELECT id, username, email, avatar
        FROM User 
        WHERE id != ${user.id}
        AND (
          LOWER(username) LIKE ${searchTerm}
          OR LOWER(email) LIKE ${searchTerm}
        )
        ORDER BY username ASC
        LIMIT 50
      ` as Array<{ id: number; username: string; email: string; avatar: string | null }>;

      // Get friendship status for each user
      const usersWithStatus = await Promise.all(
        users.map(async (targetUser: any) => {
          const friendship = await prisma.friendship.findFirst({
            where: {
              OR: [
                { requesterId: user.id, recipientId: targetUser.id },
                { requesterId: targetUser.id, recipientId: user.id },
              ],
            },
          });

          let friendshipStatus = null;
          if (friendship) {
            if (friendship.status === 'accepted') {
              friendshipStatus = 'accepted';
            } else if (friendship.status === 'pending') {
              if (friendship.requesterId === user.id) {
                friendshipStatus = 'pending_sent';
              } else {
                friendshipStatus = 'pending_received';
              }
            }
          }

          return {
            ...targetUser,
            friendshipStatus,
            friendshipId: friendship?.id || null
          };
        })
      );
      
      return reply.send({ users: usersWithStatus });
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