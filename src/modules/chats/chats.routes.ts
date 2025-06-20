import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from "zod"
import { prisma } from "../../utils/prisma"
import { io } from "../socket/socket"
<<<<<<< HEAD
import { ChatService } from "./chats.service"
import { 
  validateSendMessage, 
  validateGetMessageThread, 
  validateMarkMessagesRead,
  formatZodError,
  SendMessageInput,
  GetMessageThreadInput,
  MarkMessagesReadInput
} from "./chats.schemas"
import { 
  chatRateLimiter, 
  generalApiRateLimiter 
} from "../../middlewares/rateLimiting.middleware"
import { logger } from "../../utils/logger"
import { monitoringService } from "../../services/monitoring.service"
import { 
  AppError, 
  ValidationError, 
  NotFoundError, 
  ForbiddenError,
  DatabaseError
} from "../../middlewares/errorHandling.middleware"
=======
>>>>>>> main

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
  app.post("/send", { 
    preHandler: [
      app.authenticate, 
      chatRateLimiter.createMiddleware()
    ] 
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const user: any = req.user;
    
<<<<<<< HEAD
    return monitoringService.trackOperation('send_message', async () => {
      try {
        // Validate input with Zod schema
        let validatedInput: SendMessageInput;
        try {
          validatedInput = validateSendMessage(req.body);
        } catch (error) {
          if (error instanceof z.ZodError) {
            logger.warn('Message validation failed', {
              userId: user.id,
              ip: req.ip,
              validationErrors: error.issues
            });
            throw new ValidationError(formatZodError(error as z.ZodError));
          }
          throw new ValidationError("Invalid input data");
        }

        const { toUserId, content } = validatedInput;

        // Validate if user can send message (friendship and blocking checks)
        const messageValidation = await ChatService.validateMessageSending(user.id, toUserId);
        if (!messageValidation.canSend) {
          logger.warn('Message sending blocked', {
            senderId: user.id,
            recipientId: toUserId,
            reason: messageValidation.reason,
            ip: req.ip
          });
          throw new ForbiddenError(messageValidation.reason);
        }

        // Sanitize message content
        const sanitizedContent = ChatService.sanitizeMessageContent(content);
        
        const message = await monitoringService.trackDatabaseOperation(
          'INSERT', 
          'message', 
          () => prisma.message.create({
            data: {
              senderId: user.id,
              recipientId: toUserId,
              content: sanitizedContent,
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
          })
        ) as any;

        // Log successful message sending
        logger.chatEvent('MESSAGE_SENT', user.id, toUserId, message.id, req.ip);
        
        // Audit log for security
        logger.audit({
          userId: user.id,
          action: 'MESSAGE_SENT',
          resource: 'message',
          resourceId: message.id,
          newValue: { content: sanitizedContent, recipientId: toUserId },
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          success: true
        });

        // Send real-time notification to recipient if they're online
        if (io) {
          try {
            io.to(`user_${toUserId}`).emit("private_message", {
              id: message.id,
              from: user.id,
              to: toUserId,
              sender: message.sender,
              message: message.content,
              timestamp: message.createdAt
            });
            
            logger.debug('Real-time message delivered', {
              messageId: message.id,
              senderId: user.id,
              recipientId: toUserId
            });
          } catch (socketError) {
            logger.warn('Failed to send real-time notification', {
              messageId: message.id,
              error: socketError
            });
          }
        }

        return reply.send({ message });
      } catch (error) {
        // Handle database errors
        if ((error as any).code === 'P2002') {
          throw new DatabaseError('Message creation failed - duplicate entry');
        }
        if ((error as any).code?.startsWith('P')) {
          throw new DatabaseError('Database operation failed');
        }
        
        // Re-throw known errors
        if (error instanceof AppError) {
          throw error;
        }
        
        // Log unexpected errors
        logger.error('Unexpected error in send message', error as Error, {
          userId: user.id,
          ip: req.ip,
          requestBody: req.body
        });
        
        throw new AppError('Failed to send message', 500);
      }
    });
=======
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
>>>>>>> main
  })
  /* <-- send message route --> */
  
  /* <-- Get all user messages by id route --> */
  app.post("/thread", { 
    preHandler: [
      app.authenticate, 
      generalApiRateLimiter.createMiddleware()
    ] 
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const user: any = req.user;
    const userId = user.id;
    
<<<<<<< HEAD
    return monitoringService.trackOperation('get_message_thread', async () => {
      try {
        // Validate input with Zod schema
        let validatedInput: GetMessageThreadInput;
        try {
          validatedInput = validateGetMessageThread(req.body);
        } catch (error) {
          if (error instanceof z.ZodError) {
            logger.warn('Thread request validation failed', {
              userId: user.id,
              ip: req.ip,
              validationErrors: error.issues
            });
            throw new ValidationError(formatZodError(error as z.ZodError));
          }
          throw new ValidationError("Invalid input data");
        }

        const { toUserId } = validatedInput;

        // Check if the other user exists and if current user can access this thread
        const messageValidation = await ChatService.validateMessageSending(userId, toUserId);
        if (!messageValidation.canSend) {
          logger.warn('Thread access denied', {
            userId: user.id,
            requestedUserId: toUserId,
            reason: messageValidation.reason,
            ip: req.ip
          });
          throw new ForbiddenError(messageValidation.reason);
        }

        const messages = await monitoringService.trackDatabaseOperation(
          'SELECT',
          'message',
          () => prisma.message.findMany({
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
          })
        ) as MessageWithRelations[];

        logger.info('Message thread retrieved', {
          userId: user.id,
          otherUserId: toUserId,
          messageCount: messages.length,
          ip: req.ip
        });

        return reply.send({ messages });
      } catch (error) {
        // Handle database errors
        if ((error as any).code?.startsWith('P')) {
          throw new DatabaseError('Failed to retrieve message thread');
        }
        
        // Re-throw known errors
        if (error instanceof AppError) {
          throw error;
        }
        
        // Log unexpected errors
        logger.error('Unexpected error in get message thread', error as Error, {
          userId: user.id,
          ip: req.ip,
          requestBody: req.body
        });
        
        throw new AppError('Failed to retrieve messages', 500);
      }
    });
=======
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
>>>>>>> main
  });
  /* <-- Get all user messages by id route --> */
  
  /* <-- Get users chatted with route --> */
  app.get("/conversations", { 
    preHandler: [
      app.authenticate, 
      generalApiRateLimiter.createMiddleware()
    ] 
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const user: any = req.user;
    const userId = user.id;
    
<<<<<<< HEAD
    return monitoringService.trackOperation('get_conversations', async () => {
      try {
        const allMessages = await monitoringService.trackDatabaseOperation(
          'SELECT',
          'message',
          () => prisma.message.findMany({
            where: {
              OR: [
                { senderId: userId },
                { recipientId: userId },
              ],
=======
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
>>>>>>> main
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
<<<<<<< HEAD
            orderBy: { createdAt: "desc" },
          })
        ) as MessageWithRelations[];

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

        logger.info('Conversations retrieved', {
          userId: user.id,
          conversationCount: conversations.length,
          totalMessages: allMessages.length,
          ip: req.ip
        });

        return reply.send({ conversations });
      } catch (error) {
        // Handle database errors
        if ((error as any).code?.startsWith('P')) {
          throw new DatabaseError('Failed to retrieve conversations');
        }
        
        // Log unexpected errors
        logger.error('Unexpected error in get conversations', error as Error, {
          userId: user.id,
          ip: req.ip
        });
        
        throw new AppError('Failed to retrieve conversations', 500);
      }
    });
=======
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
>>>>>>> main
  })
  /* <-- Get users chatted with route --> */
  
  /* <-- Mark messages as read route --> */
<<<<<<< HEAD
  app.post("/mark-read", { 
    preHandler: [
      app.authenticate, 
      generalApiRateLimiter.createMiddleware()
    ] 
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const user: any = req.user;
    const userId = user.id;
    
    return monitoringService.trackOperation('mark_messages_read', async () => {
      try {
        // Validate input with Zod schema
        let validatedInput: MarkMessagesReadInput;
        try {
          validatedInput = validateMarkMessagesRead(req.body);
        } catch (error) {
          if (error instanceof z.ZodError) {
            logger.warn('Mark read validation failed', {
              userId: user.id,
              ip: req.ip,
              validationErrors: error.issues
            });
            throw new ValidationError(formatZodError(error as z.ZodError));
          }
          throw new ValidationError("Invalid input data");
        }

        const { fromUserId } = validatedInput;

        // Verify that the fromUserId exists and that current user can interact with them
        const userExists = await monitoringService.trackDatabaseOperation(
          'SELECT',
          'user',
          () => prisma.user.findUnique({
            where: { id: fromUserId },
            select: { id: true }
          })
        );

        if (!userExists) {
          logger.warn('Mark read failed - user not found', {
            userId: user.id,
            fromUserId,
            ip: req.ip
          });
          throw new NotFoundError("User");
        }

        const updateResult = await monitoringService.trackDatabaseOperation(
          'UPDATE',
          'message',
          () => prisma.message.updateMany({
            where: {
              senderId: fromUserId,
              recipientId: userId,
              read: false,
            },
            data: {
              read: true,
            },
          })
        ) as { count: number };

        logger.info('Messages marked as read', {
          userId: user.id,
          fromUserId,
          updatedCount: updateResult.count,
          ip: req.ip
        });

        // Audit log
        logger.audit({
          userId: user.id,
          action: 'MESSAGES_MARKED_READ',
          resource: 'message',
          newValue: { fromUserId, readCount: updateResult.count },
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          success: true
        });
        
        return reply.send({ success: true, updatedCount: updateResult.count });
      } catch (error) {
        // Handle database errors
        if ((error as any).code?.startsWith('P')) {
          throw new DatabaseError('Failed to mark messages as read');
        }
        
        // Re-throw known errors
        if (error instanceof AppError) {
          throw error;
        }
        
        // Log unexpected errors
        logger.error('Unexpected error in mark messages as read', error as Error, {
          userId: user.id,
          ip: req.ip,
          requestBody: req.body
        });
        
        throw new AppError('Failed to mark messages as read', 500);
      }
    });
=======
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
>>>>>>> main
  });
  /* <-- Mark messages as read route --> */

}

/*
| Method | Route                | Description                                        |
|--------|---------------------|-----------------------------------------------------|
| POST   | `/send`             | Send a private message to a user                    |
| POST   | `/thread`           | Get all messages between current user and a user    |
| GET    | `/conversations`    | Get list of users I've chatted with and last message|
| POST   | `/mark-read`        | Mark messages from a user as read                   |
*/
