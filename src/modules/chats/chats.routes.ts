import { FastifyInstance } from 'fastify/types/instance'
import { z } from "zod"
import { prisma } from "../../utils/prisma"

export default async function chatRoutes(app: FastifyInstance) {
  
  /* <-- send message route --> */
  app.post("/send", { preHandler: [app.authenticate] }, async (req, reply) => {
    const user: any = req.user;
    const { toUserId, content } = req.body as { toUserId: number, content: string };
    
    try {
      if (!content || content.trim().length === 0)
        return reply.status(400).send({ error: "Message cannot be empty" });
      
      const message = await prisma.message.create({
        data: {
          senderId: user.id,
          recipientId: toUserId,
          content,
        }
      });
      return reply.send({ message });
    } catch (err) {
      console.error("❌ Send message error:", err);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  })
  /* <-- send message route --> */
  
  /* <-- Get all user messages by id route --> */
  app.post("/thread", { preHandler: [app.authenticate] }, async (req, reply) => {
    const user: any = req.user;
    const userId = user.id;
    const { toUserId } = req.body as { toUserId: number };
    
    try {
      const messages = await prisma.message.findMany({
        where: {
          OR: [
            { senderId: userId, recipientId: toUserId },
            { senderId: toUserId, recipientId: userId },
          ],
        },
        orderBy: { createdAt: "asc" },
      });
      return reply.send({ messages });
    } catch (err) {
      console.error("❌ connot get all messages between two users:", err);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  });
  /* <-- Get all user messages by id route --> */
  
  /* <-- Get users chatted with route --> */
  app.get("/conversations", { preHandler: [app.authenticate] }, async (req, reply) => {
    const user: any = req.user;
    const userId = user.id;
    
    try {
      const conversationsNotFiltred = await prisma.message.findMany({
        where: {
          OR: [
            { senderId: userId },
            { recipientId: userId },
          ],
        },
        include: {
          sender: {
            select: {
              id: true,
              avatar: true,
              username: true,
              email: true,
            },
          },
          recipient: {
            select: {
              id: true,
              avatar: true,
              username: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });
      // @ts-ignore
      const conversations = conversationsNotFiltred.map(c => {
        return (c.senderId === userId) ? c.recipient : c.sender;
      });
      
      const uniqueMap = new Map();
      // @ts-ignore
      conversations.forEach(user => {
        if (!uniqueMap.has(user.id)) uniqueMap.set(user.id, user);
      });
      const uniqueConversations = Array.from(uniqueMap.values());
      return reply.send({ conversations: uniqueConversations });
    } 
    catch (err) {
      console.error("❌ Connot get users chatted with:", err);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  })
  /* <-- Get users chatted with route --> */

}