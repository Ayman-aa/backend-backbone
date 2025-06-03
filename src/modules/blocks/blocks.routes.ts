import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../utils/prisma";
import { 
  validateBlockUser, 
  validateUnblockUser, 
  validateCheckBlockStatusParams,
  formatZodError,
  BlockUserInput,
  UnblockUserInput,
  CheckBlockStatusParamsInput
} from "./blocks.schemas";
import { 
  blockRateLimiter, 
  generalApiRateLimiter 
} from "../../middlewares/rateLimiting.middleware";

export default async function blocksRoutes(app: FastifyInstance) {
  
  /* <-- Block a user route --> */
  app.post("/block", { 
    preHandler: [
      app.authenticate, 
      blockRateLimiter.createMiddleware()
    ] 
  }, async (req, reply) => {
    const user: any = req.user;
    const blockerId = user.id;
    
    try {
      // Validate input with Zod schema
      let validatedInput: BlockUserInput;
      try {
        validatedInput = validateBlockUser(req.body);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: formatZodError(error) });
        }
        return reply.status(400).send({ error: "Invalid input data" });
      }

      const { userId } = validatedInput;
      
      // Prevent self-blocking
      if (blockerId === userId) {
        return reply.status(400).send({ error: "Cannot block yourself" });
      }
      
      // Check if user exists
      const userToBlock = await prisma.user.findUnique({
        where: { id: userId }
      });
      
      if (!userToBlock) {
        return reply.status(404).send({ error: "User not found" });
      }
      
      // Check if already blocked
      const existingBlock = await prisma.userBlock.findFirst({
        where: {
          blockerId,
          blockedId: userId
        }
      });
      
      if (existingBlock) {
        return reply.status(409).send({ error: "User already blocked" });
      }
      
      // Create block record
      const block = await prisma.userBlock.create({
        data: {
          blockerId,
          blockedId: userId
        },
        include: {
          blocked: {
            select: {
              id: true,
              username: true,
              avatar: true
            }
          }
        }
      });
      
      return reply.send({ 
        message: "User blocked successfully", 
        block 
      });
      
    } catch (err) {
      console.error("❌ Block user error:", err);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  });
  /* <-- Block a user route --> */
  
  /* <-- Unblock a user route --> */
  app.post("/unblock", { 
    preHandler: [
      app.authenticate, 
      blockRateLimiter.createMiddleware()
    ] 
  }, async (req, reply) => {
    const user: any = req.user;
    const blockerId = user.id;
    
    try {
      // Validate input with Zod schema
      let validatedInput: UnblockUserInput;
      try {
        validatedInput = validateUnblockUser(req.body);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: formatZodError(error) });
        }
        return reply.status(400).send({ error: "Invalid input data" });
      }

      const { userId } = validatedInput;
      
      // Find and delete block record
      const existingBlock = await prisma.userBlock.findFirst({
        where: {
          blockerId,
          blockedId: userId
        }
      });
      
      if (!existingBlock) {
        return reply.status(404).send({ error: "User is not blocked" });
      }
      
      await prisma.userBlock.delete({
        where: { id: existingBlock.id }
      });
      
      return reply.send({ 
        message: "User unblocked successfully" 
      });
      
    } catch (err) {
      console.error("❌ Unblock user error:", err);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  });
  /* <-- Unblock a user route --> */
  
  /* <-- Get blocked users list route --> */
  app.get("/list", { 
    preHandler: [
      app.authenticate, 
      generalApiRateLimiter.createMiddleware()
    ] 
  }, async (req, reply) => {
    const user: any = req.user;
    const blockerId = user.id;
    
    try {
      const blockedUsers = await prisma.userBlock.findMany({
        where: { blockerId },
        include: {
          blocked: {
            select: {
              id: true,
              username: true,
              avatar: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      
      const users = blockedUsers.map((block: any) => ({
        ...block.blocked,
        blockedAt: block.createdAt
      }));
      
      return reply.send({ blockedUsers: users });
      
    } catch (err) {
      console.error("❌ Get blocked users error:", err);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  });
  /* <-- Get blocked users list route --> */
  
  /* <-- Check if user is blocked route --> */
  app.get("/check/:userId", { 
    preHandler: [
      app.authenticate, 
      generalApiRateLimiter.createMiddleware()
    ] 
  }, async (req, reply) => {
    const user: any = req.user;
    const blockerId = user.id;
    
    try {
      // Validate params with Zod schema
      let validatedParams: CheckBlockStatusParamsInput;
      try {
        validatedParams = validateCheckBlockStatusParams(req.params);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: formatZodError(error) });
        }
        return reply.status(400).send({ error: "Invalid user ID parameter" });
      }

      const userIdNum = validatedParams.userId;
      
      const block = await prisma.userBlock.findFirst({
        where: {
          blockerId,
          blockedId: userIdNum
        }
      });
      
      return reply.send({ 
        isBlocked: !!block,
        blockedAt: block?.createdAt || null
      });
      
    } catch (err) {
      console.error("❌ Check block status error:", err);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  });
  /* <-- Check if user is blocked route --> */
  
  /* <-- Check if current user is blocked by another user route --> */
  app.get("/check-blocked-by/:userId", { 
    preHandler: [
      app.authenticate, 
      generalApiRateLimiter.createMiddleware()
    ] 
  }, async (req, reply) => {
    const user: any = req.user;
    const currentUserId = user.id;
    
    try {
      // Validate params with Zod schema
      let validatedParams: CheckBlockStatusParamsInput;
      try {
        validatedParams = validateCheckBlockStatusParams(req.params);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: formatZodError(error) });
        }
        return reply.status(400).send({ error: "Invalid user ID parameter" });
      }

      const userIdNum = validatedParams.userId;
      
      const block = await prisma.userBlock.findFirst({
        where: {
          blockerId: userIdNum,
          blockedId: currentUserId
        }
      });
      
      return reply.send({ 
        isBlockedBy: !!block,
        blockedAt: block?.createdAt || null
      });
      
    } catch (err) {
      console.error("❌ Check blocked by status error:", err);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  });
  /* <-- Check if current user is blocked by another user route --> */
}

/*
| Method | Route                        | Description                           |
| ------ | ---------------------------- | ------------------------------------- |
| POST   | `/blocks/block`              | Block a user                          |
| POST   | `/blocks/unblock`            | Unblock a user                        |
| GET    | `/blocks/list`               | Get list of blocked users             |
| GET    | `/blocks/check/:userId`      | Check if I blocked a user             |
| GET    | `/blocks/check-blocked-by/:userId` | Check if a user blocked me      |
*/