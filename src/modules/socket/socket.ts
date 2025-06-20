<<<<<<< HEAD
import { Server as HttpServer } from 'http';
import { Socket, Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { prisma } from '../../utils/prisma';
import { socketMessageRateLimiter, socketEventRateLimiter } from '../../middlewares/rateLimiting.middleware';
=======
import { Server as HttpServer } from "http";
import { Socket, Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { prisma } from "../../utils/prisma";
import { RateLimiter } from "limiter";
import { setupRemoteGameEvents } from "./remote";
>>>>>>> main

export let io: SocketIOServer;

interface AuthenticatedSocket extends Socket {
  userId?: number;
  username?: string;
}

<<<<<<< HEAD
=======
// Store rate limiters for each connected user
const userLimiters = new Map<number, RateLimiter>();

>>>>>>> main
export function setupSocketIO(server: HttpServer) {
  io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      credentials: true,
    },
  });

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
<<<<<<< HEAD
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, env.JWT_SECRET as string) as any;
      const user = await prisma.user.findUnique({ 
        where: { id: decoded.id },
        select: { id: true, username: true }
      });
      
      if (!user) {
        return next(new Error('Authentication error: User not found'));
=======
        return next(new Error("Authentication error: No token provided"));
      }

      const decoded = jwt.verify(token, env.JWT_SECRET as string) as any;
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, username: true },
      });

      if (!user) {
        return next(new Error("Authentication error: User not found"));
>>>>>>> main
      }

      socket.userId = user.id;
      socket.username = user.username;
      next();
    } catch (err) {
<<<<<<< HEAD
      next(new Error('Authentication error: Invalid token'));
    }
  });
  
  io.on("connection", (socket: AuthenticatedSocket) => {
    console.log(`🟢 User ${socket.username} (${socket.userId}) connected:`, socket.id);
    
    // Join user to their own room for direct messaging
    socket.join(`user_${socket.userId}`);
    
    // Notify friends of online status
    socket.broadcast.emit('user_status', {
      userId: socket.userId,
      username: socket.username,
      isOnline: true
    });
    
    // Rate limited typing indicator
    socket.on("typing_start", ({ toUserId }) => {
      if (!socketEventRateLimiter.checkLimit(`typing:${socket.userId}`)) {
        socket.emit('rate_limit_exceeded', { event: 'typing_start' });
        return;
      }
      
      if (toUserId && typeof toUserId === 'number') {
        io.to(`user_${toUserId}`).emit('user_typing', {
          userId: socket.userId,
          username: socket.username,
          isTyping: true
        });
      }
    });
    
    socket.on("typing_stop", ({ toUserId }) => {
      if (!socketEventRateLimiter.checkLimit(`typing:${socket.userId}`)) {
        socket.emit('rate_limit_exceeded', { event: 'typing_stop' });
        return;
      }
      
      if (toUserId && typeof toUserId === 'number') {
        io.to(`user_${toUserId}`).emit('user_typing', {
          userId: socket.userId,
          username: socket.username,
          isTyping: false
        });
      }
    });
    
    // Rate limited ping/heartbeat
    socket.on("ping", () => {
      if (!socketEventRateLimiter.checkLimit(`ping:${socket.userId}`)) {
        socket.emit('rate_limit_exceeded', { event: 'ping' });
        return;
      }
      
      socket.emit('pong', { timestamp: Date.now() });
    });
    
    // Legacy message handler - now redirects to API
    socket.on("private_message", async ({ to, message }) => {
      if (!socketMessageRateLimiter.checkLimit(`message:${socket.userId}`)) {
        socket.emit('rate_limit_exceeded', { 
          event: 'private_message',
          message: 'Too many messages. Please use the API endpoint or wait before sending more.' 
        });
        return;
      }
      
      console.log("Direct socket message received - redirecting to API endpoint for proper validation.");
      socket.emit('message_error', {
        error: 'Please use the /chats/send API endpoint for sending messages'
      });
    });
    
    socket.on("disconnect", () => {
      console.log(`🔴 User ${socket.username} (${socket.userId}) disconnected:`, socket.id);
      
      // Notify friends of offline status
      socket.broadcast.emit('user_status', {
        userId: socket.userId,
        username: socket.username,
        isOnline: false
      });
    });
  });
}
=======
      next(new Error("Authentication error: Invalid token"));
    }
  });

  // Rate limiting middleware - after authentication
  io.use(async (socket: AuthenticatedSocket, next) => {
    const userId = socket.userId;

    if (!userId) {
      return next(new Error("Rate limiting error: User not authenticated"));
    }

    // Create a new rate limiter for this user if one doesn't exist
    if (!userLimiters.has(userId)) {
      userLimiters.set(
        userId,
        new RateLimiter({
          tokensPerInterval: 10, // 10 events
          interval: "second", // per second
          fireImmediately: true, // Don't wait, return immediately if rate limited
        }),
      );
    }

    const limiter = userLimiters.get(userId);

    if (!limiter) {
      return next(new Error("Rate limiting error: Failed to create limiter"));
    }

    try {
      // Try to remove a token (make a request)
      const remainingRequests = await limiter.removeTokens(1);

      if (remainingRequests < 0) {
        return next(new Error("Rate limit exceeded: Too many requests"));
      }

      next();
    } catch (err) {
      return next(new Error("Rate limiting error: Internal error"));
    }
  });

  // Setup remote game events
  setupRemoteGameEvents(io);

  io.on("connection", (socket: AuthenticatedSocket) => {
    console.log(
      `🟢 User ${socket.username} (${socket.userId}) connected:`,
      socket.id,
    );

    // Join user to their own room for direct messaging
    socket.join(`user_${socket.userId}`);

    // Notify friends of online status
    socket.broadcast.emit("user_status", {
      userId: socket.userId,
      username: socket.username,
      isOnline: true,
    });

    // Note: Message sending is now handled by the API endpoint to prevent duplicates
    // Socket.IO is used only for real-time delivery which is handled by the API
    socket.on("private_message", (_data) => {
      console.log(
        "Direct socket message received - this should not be used. Use API endpoint instead.",
      );
    });

    socket.on("disconnect", () => {
      console.log(
        `🔴 User ${socket.username} (${socket.userId}) disconnected:`,
        socket.id,
      );

      // Clean up the rate limiter when user disconnects
      if (socket.userId) {
        userLimiters.delete(socket.userId);
      }

      // Notify friends of offline status
      socket.broadcast.emit("user_status", {
        userId: socket.userId,
        username: socket.username,
        isOnline: false,
      });
    });
  });
}

/*
| Function        | Description                                                   |
| ----------------|---------------------------------------------------------------|
| setupSocketIO() | Initializes and configures Socket.IO server with auth         |
|                 | - Validates JWT on connection                                 |
|                 | - Rate limits users to 10 events per second                   |
|                 | - Sets up remote game events for multiplayer pong             |
|                 | - Joins users to private rooms for messaging                  |
|                 | - Emits online/offline status to others                       |
|                 | - Rejects direct message sending via socket (use API instead) |
*/
>>>>>>> main
