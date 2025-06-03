import { Server as HttpServer } from 'http';
import { Socket, Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { prisma } from '../../utils/prisma';
import { socketMessageRateLimiter, socketEventRateLimiter } from '../../middlewares/rateLimiting.middleware';

export let io: SocketIOServer;

interface AuthenticatedSocket extends Socket {
  userId?: number;
  username?: string;
}

export function setupSocketIO(server: HttpServer) {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      credentials: true,
    },
  });

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, env.JWT_SECRET as string) as any;
      const user = await prisma.user.findUnique({ 
        where: { id: decoded.id },
        select: { id: true, username: true }
      });
      
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.userId = user.id;
      socket.username = user.username;
      next();
    } catch (err) {
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