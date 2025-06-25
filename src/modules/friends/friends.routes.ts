import { FastifyInstance } from "fastify";
import { prisma } from "../../utils/prisma"

export default async function friendsRoutes(app: FastifyInstance) {
  
  /* <-- /friends/request route --> */
  app.post("/request", { preHandler: [app.authenticate], 
    schema: {
      body: {
        type: 'object',
        properties: {
          toUserId: { type: 'integer', minimum: 1 }
        },
        required: ['toUserId'],
        additionalProperties: false
      }
    } 
   }, async (req, reply) => {
    const { toUserId } = req.body as { toUserId: number };
    const user: any = req.user;
    const userId = user.id;
  
    try {  
      if (userId === toUserId)
        return reply.status(400).send({ statusCode: 400, error: "Cannot send request to yourself" });
      
        const isBlocked = await prisma.block.findFirst({
          where: {
            OR: [
              { blockerId: userId, blockedId: toUserId },
              { blockerId: toUserId, blockedId: userId },
            ]
          }
        });
        
        if (isBlocked)
          return reply.status(403).send({ error: "Blocked users cannot interact" });

  
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
  app.post("/accept", { preHandler: [app.authenticate] }, async (req, reply) => {
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
  app.post("/decline", { preHandler: [app.authenticate] }, async (req, reply) => {
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
  app.get("/list", { preHandler: [app.authenticate] }, async (req, reply) => {
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
  app.get("/pending", { preHandler: [app.authenticate] }, async (req, reply) => {
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
  app.get("/sent", { preHandler: [app.authenticate] }, async (req, reply) => {
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
  
  /* <-- /friends/block route --> */
  app.post("/block", {preHandler: [app.authenticate] }, async (req, reply) => {
    const user: any = req.user;
    const { blockedUserId } = req.body as { blockedUserId: number };
    
    if (user.id == blockedUserId)
      return reply.status(400).send({ error: "Cannot block yourself" });
    
    try {
      const existing = await prisma.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: user.id,
            blockedId: blockedUserId,
          },
        },
      });
    
      if (existing)
        return reply.status(409).send({ error: "User is already blocked" });
      
      const block = await prisma.block.create({
        data: {
          blockerId: user.id,
          blockedId: blockedUserId,
        },
      });
      
      return reply.send({ message: "User blocked", block });
    } catch (err) {
        console.error("❌ Block error:", err);
        return reply.status(500).send({ error: "Internal Server Error" });
    }
  })
  /* <-- /friends/block route --> */
  
  /* <-- /friends/unblock route --> */
  app.post("/unblock", { preHandler: [app.authenticate] }, async (req, reply) => {
    const user: any = req.user;
    const { blockedUserId } = req.body as { blockedUserId: number };
  
    if (user.id === blockedUserId)
      return reply.status(400).send({ error: "You can't unblock yourself" });
  
    try {
      const block = await prisma.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: user.id,
            blockedId: blockedUserId,
          },
        },
      });
  
      if (!block)
        return reply.status(404).send({ error: "Block not found" });
  
      await prisma.block.delete({
        where: {
          blockerId_blockedId: {
            blockerId: user.id,
            blockedId: blockedUserId,
          },
        },
      });
  
      return reply.send({ message: "User unblocked" });
    } catch (err) {
      console.error("❌ Unblock error:", err);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  });
  /* <-- /friends/unblock route --> */

  /* <-- /friends/blocked route --> */  
  app.get("/blocked", { preHandler: [app.authenticate] }, async (req, reply) => {
    const user: any = req.user;
  
    try {
      const blockedUsers = await prisma.block.findMany({
        where: { blockerId: user.id },
        include: {
          blocked: {
            select: {
              id: true,
              username: true,
              avatar: true,
              email: true,
            },
          },
        },
      });
      //@ts-ignore
      const result = blockedUsers.map(entry => entry.blocked);
      return reply.send({ blocked: result });
    } catch (err) {
      console.error("❌ Error fetching blocked users:", err);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  });
  /* <-- /friends/blocked route --> */

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
| POST   | `/friends/block`   | Block a User                          |
| POST   | `/friends/unblock` | Unblock a User                        |
| POST   | `/friends/blocked` | Get list of users I blocked           |
*/