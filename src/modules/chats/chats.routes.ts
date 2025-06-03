import { FastifyInstance } from 'fastify/types/instance'
import { z } from "zod"
import { prisma } from "../../utils/prisma"
import { io } from "../socket/socket"

interface MessageWithRelations {
  id: number;
  senderId: number;
  recipientId: number;
  content: string;
  createdAt: Date;
  read: boolean;
  sender: {
    id: number;
    username: string;
    avatar: string | null;
    email: string;
  };
  recipient: {
    id: number;
    username: string;
    avatar: string | null;
    email: string;
  };
}

interface ConversationData {
  user: {
    id: number;
    username: string;
    avatar: string | null;
    email: string;
  };
  lastMessage: MessageWithRelations;
  unreadCount: number;
  messages: MessageWithRelations[];
}

export default async function chatRoutes(app: FastifyInstance) {
  
  /* <-- send message route --> */
  app.post("/send", { preHandler: [app.authenticate] }, async (req, reply) => {
    const user: any = req.user;
    const { toUserId, content } = req.body as { toUserId: number, content: string };
    
    try {
      const isBlocked = await prisma.block.findFirst({
        where: {
          OR: [
            { blockerId: user.id, blockedId: toUserId },
            { blockerId: toUserId, blockedId: user.id },
          ]
        }
      });
      
      if (isBlocked)
        return reply.status(403).send({ error: "Blocked users cannot interact" });

      if (!content || content.trim().length === 0)
        return reply.status(400).send({ error: "Message cannot be empty" });
      
      const message = await prisma.message.create({
        data: {
          senderId: user.id,
          recipientId: toUserId,
          content,
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              avatar: true,
            },
          },
          recipient: {
            select: {
              id: true,
              username: true,
              avatar: true,
            },
          },
        },
      });

      // Send real-time notification to recipient if they're online
      if (io) {
        io.to(`user_${toUserId}`).emit("private_message", {
          id: message.id,
          from: user.id,
          to: toUserId,
          sender: message.sender,
          message: message.content,
          timestamp: message.createdAt
        });
      }

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
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              avatar: true,
            },
          },
          recipient: {
            select: {
              id: true,
              username: true,
              avatar: true,
            },
          },
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
      // Get all messages involving the current user
      const allMessages = await prisma.message.findMany({
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
        orderBy: { createdAt: "desc" },
      });

      // Group messages by conversation partner
      const conversationMap = new Map<number, ConversationData>();
      
      allMessages.forEach((message: MessageWithRelations) => {
        const partnerId = message.senderId === userId ? message.recipientId : message.senderId;
        const partner = message.senderId === userId ? message.recipient : message.sender;
        
        if (!conversationMap.has(partnerId)) {
          conversationMap.set(partnerId, {
            user: partner,
            lastMessage: message,
            unreadCount: 0,
            messages: []
          });
        }
        
        const conversation = conversationMap.get(partnerId);
        if (conversation) {
          conversation.messages.push(message);
        }
      });

      // Calculate unread counts and prepare final conversations array
      const conversations = Array.from(conversationMap.values()).map(conv => {
        // Count unread messages (messages sent to current user that are not read)
        const unreadCount = conv.messages.filter((msg: MessageWithRelations) => 
          msg.recipientId === userId && !msg.read
        ).length;

        return {
          user: conv.user,
          lastMessage: conv.lastMessage,
          unreadCount: unreadCount
        };
      });

      // Sort by last message timestamp
      conversations.sort((a, b) => 
        new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
      );

      return reply.send({ conversations });
    } 
    catch (err) {
      console.error("❌ Cannot get users chatted with:", err);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  })
  /* <-- Get users chatted with route --> */
  
  /* <-- Mark messages as read route --> */
  app.post("/mark-read", { preHandler: [app.authenticate] }, async (req, reply) => {
    const user: any = req.user;
    const userId = user.id;
    const { fromUserId } = req.body as { fromUserId: number };
    
    try {
      await prisma.message.updateMany({
        where: {
          senderId: fromUserId,
          recipientId: userId,
          read: false,
        },
        data: {
          read: true,
        },
      });
      
      return reply.send({ success: true });
    } catch (err) {
      console.error("❌ Cannot mark messages as read:", err);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  });
  /* <-- Mark messages as read route --> */

}