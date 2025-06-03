import { FastifyInstance } from "fastify";
import { prisma } from "../../utils/prisma";
import { 
  friendRequestRateLimiter, 
  generalApiRateLimiter 
} from "../../middlewares/rateLimiting.middleware";

export default async function friendsRoutes(app: FastifyInstance) {
  
  /* <-- /friends/request route --> */
  app.post("/request", { 
    preHandler: [
      app.authenticate, 
      friendRequestRateLimiter.createMiddleware()
    ] 
  }, async (req, reply) => {
    const { toUserId } = req.body as { toUserId: number };
    const user: any = req.user;
    const userId = user.id;
  
    try {  
      if (userId === toUserId)
        return reply.status(409).send({ error: "Cannot send request to yourself" });
  
      const existingFriendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { requesterId: userId, recipientId: toUserId },
            { requesterId: toUserId, recipientId: userId },
          ],
        },
      });
  
      if (existingFriendship)
        return reply.status(409).send({ error: "Friend request already exists" });
  
      const friendship = await prisma.friendship.create({
        data: {
          requesterId: userId,
          recipientId: toUserId,
          status: "pending",
        },
      });
  
      return reply.send({ message: "Friend request sent", friendship });
  
    } catch (err) {
      console.error("❌ Friend request error:", err);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  });
  /* <-- /friends/request route --> */

  /* <-- /friends/accept route --> */
  app.post("/accept", { 
    preHandler: [
      app.authenticate, 
      generalApiRateLimiter.createMiddleware()
    ] 
  }, async (req, reply) => {
    const user: any = req.user;
    const { friendshipId }  = req.body as { friendshipId: number };
    
    try {      
      const friendship = await prisma.friendship.findUnique({ where: { id: friendshipId } });
      if (!friendship)
        return reply.status(404).send({ error: "Friend request not found" });
      if (friendship.recipientId !== user.id)
        return reply.status(403).send({ error: "You're not allowed to accept this request" });
      if (friendship.status !== 'pending')
        return reply.status(400).send({ error: "Request already handled" });
      
      const updated = await prisma.friendship.update({
        where: { id: friendshipId },
        data: { status: "accepted" },
      });
      
      return reply.send({ message: "Friend request accepted", friendship: updated });
    } catch (err) {
      console.error("❌ Friend request error:", err);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  })
  /* <-- /friends/accept route --> */
  
  /* <-- /friends/decline route --> */
  app.post("/decline", { 
    preHandler: [
      app.authenticate, 
      generalApiRateLimiter.createMiddleware()
    ] 
  }, async (req, reply) => {
    const user: any = req.user;
    const { friendshipId } = req.body as { friendshipId: number };
    
    try {
      const friendship = await prisma.friendship.findUnique({ where: { id: friendshipId } });
      if (!friendship)
        return reply.status(404).send({ error: "Friend request not found" });
      if (friendship.recipientId !== user.id)
        return reply.status(403).send({ error: "You're not allowed to accept this request" });
      if (friendship.status !== 'pending')
        return reply.status(400).send({ error: "Request already handled" });
        
      const declined = await prisma.friendship.update({
        where: { id:  friendshipId  },
        data: { status: "declined" },
      })
      
      return reply.send({ message: "Friend request declined", friendship: declined });
    } catch (err) {
      console.error("❌ Friend request error:", err);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  })
  /* <-- /friends/decline route --> */
  
  /* <-- /friends/list route --> */
  app.get("/list", { 
    preHandler: [
      app.authenticate, 
      generalApiRateLimiter.createMiddleware()
    ] 
  }, async (req, reply) => {
    const user: any = req.user;
    
    try {
      const friendships = await prisma.friendship.findMany({
        where: {
          status: "accepted",
          OR: [
            { requesterId: user.id },
            { recipientId: user.id },
          ]
        },
        include: {
          requester: {
            select: {
              id: true,
              avatar: true,
              username: true,
              email: true,
            }
          },
          recipient: {
            select: {
              id: true,
              avatar: true,
              username: true,
              email: true,
            }
          }
        }
      });
      
      //@ts-ignore
      const friends = friendships.map(f => {
        if (f.requesterId === user.id) return f.recipient;
        else return f.requester;
      });
      console.log(JSON.stringify(friends));
      
      return reply.send({ friends });
    } catch (err) {
      console.error("❌ Friend request error:", err);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  })
  /* <-- /friends/list route --> */
  
  /* <-- /friends/pending route --> */
  app.get("/pending", { 
    preHandler: [
      app.authenticate, 
      generalApiRateLimiter.createMiddleware()
    ] 
  }, async (req, reply) => {
    const user: any = req.user;
      
    try {
      const friendships = await prisma.friendship.findMany({
        where: {
          status: "pending",
          recipientId: user.id
        },
        include: {
          requester: {
            select: {
              id: true,
              avatar: true,
              username: true,
              email: true,
            }
          }
        }
      });
        
      //@ts-ignore
      const friends = friendships.map(f => f.requester);
      console.log(JSON.stringify(friends));
        
      return reply.send({ friends, friendships });
    } catch (err) {
      console.error("❌ Friend request error:", err);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  })
  /* <-- /friends/pending route --> */
  
  /* <-- /friends/sent route --> */
  app.get("/sent", { 
    preHandler: [
      app.authenticate, 
      generalApiRateLimiter.createMiddleware()
    ] 
  }, async (req, reply) => {
    const user: any = req.user;
      
    try {
      const friendships = await prisma.friendship.findMany({
        where: {
          status: "pending",
          requesterId: user.id
        },
        include: {
          recipient: {
            select: {
              id: true,
              avatar: true,
              username: true,
              email: true,
            }
          }
        }
      });
        
      //@ts-ignore
      const friends = friendships.map(f => f.recipient);
      console.log(JSON.stringify(friends));
        
      return reply.send({ friends });
    } catch (err) {
      console.error("❌ Friend request error:", err);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  })
  /* <-- /friends/sent route --> */
}

/*
| Method | Route              | Description                           |
| ------ | ------------------ | ------------------------------------- |
| POST   | `/friends/request` | Send friend request                   |
| POST   | `/friends/accept`  | Accept request (needs `friendshipId`) |
| POST   | `/friends/decline` | Decline request                       |
| GET    | `/friends/list`    | Get accepted friends                  |
| GET    | `/friends/pending` | Get requests I received               |
| GET    | `/friends/sent`    | Get requests I sent                   |
*/