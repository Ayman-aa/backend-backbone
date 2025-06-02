import { Server as HttpServer } from 'http';
import { Socket, Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { prisma } from '../../utils/prisma';

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
    
    // Note: Message sending is now handled by the API endpoint to prevent duplicates
    // Socket.IO is used only for real-time delivery which is handled by the API
    socket.on("private_message", async ({ to, message }) => {
      console.log("Direct socket message received - this should not be used. Use API endpoint instead.");
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