import { Server as HttpServer } from 'http';
import { Socket, Server as SocketIOServer } from 'socket.io';
import { env } from '../../config/env'
import { FastifyInstance } from "fastify";
import { generateRandomUsername, prisma } from '../../utils/prisma';

export let io: SocketIOServer;

export function setupSocketIO(server: HttpServer, app: FastifyInstance) {
  /* Hadi map key: userId, value: socketId, 7alawa*/
  const userSockets = new Map<number, string>();
  
  io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      credentials: true,
    },
  });
  
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Socket error: No token"));
    
    try {
      const decoded = app.jwt.verify(token);
      socket.data.user = decoded;
      next();
    } catch (err) {
      return next(new Error("Socket error: Invalid token"));
    }
  })
  
  io.on("connection", (socket) => {
    const userId = socket.data.user.id;
    userSockets.set(userId, socket.id);
    
    console.log(`User ${userId} connected with socket ID: ${socket.id}`);
    
    socket.on("disconnect", () => {
      userSockets.delete(userId);
      console.log(`User ${userId} disconnected`);
    });
    
    socket.on("private", async (toUserId, message) => {
      const fromUserId = socket.data.user.id;
      const recipientUserId = userSockets.get(toUserId);
      
      if (recipientUserId) {
        io.to(recipientUserId).emit("private_message", {
          from: fromUserId,
          message,
        });
      }
      
      await prisma.message.create({
        data: {
          senderId: fromUserId,
          recipientId: toUserId,
          content: message,
          readAt: null,
        },
      })
      
    });
  });
}