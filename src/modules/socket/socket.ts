import { Server as HttpServer } from "http";
import { Socket, Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { prisma } from "../../utils/prisma";
import { RateLimiter } from "limiter";
import { initializeGameSocket, gameSocket } from "./GameSocket";

export let io: SocketIOServer;

interface AuthenticatedSocket extends Socket {
  userId?: number;
  username?: string;
}

// Store rate limiters for each connected user
const userLimiters = new Map<number, RateLimiter>();

// This Map will hold the state of every user currently connected to the server.
// Export it so it can be used in other modules
export const onlineUsers = new Map<
  number,
  { userId: number; username: string; socketId: string }
>();

// Helper function to check if a user is online (exported for use in routes)
export function isUserOnline(userId: number): boolean {
  return onlineUsers.has(userId);
}

// Helper function to get online user info (exported for use in routes)
export function getOnlineUser(userId: number) {
  return onlineUsers.get(userId);
}

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
        return next(new Error("Authentication error: No token provided"));
      }

      const decoded = jwt.verify(token, env.JWT_SECRET as string) as any;
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, username: true },
      });

      if (!user) {
        return next(new Error("Authentication error: User not found"));
      }

      socket.userId = user.id;
      socket.username = user.username;
      next();
    } catch (err) {
      next(new Error("Authentication error: Invalid token"));
    }
  });

  // Rate limiting middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    const userId = socket.userId;
    if (!userId) {
      return next(new Error("Rate limiting error: User not authenticated"));
    }
    if (!userLimiters.has(userId)) {
      userLimiters.set(
        userId,
        new RateLimiter({
          tokensPerInterval: 10,
          interval: "second",
          fireImmediately: true,
        }),
      );
    }
    const limiter = userLimiters.get(userId);
    if (!limiter) {
      return next(new Error("Rate limiting error: Failed to create limiter"));
    }
    try {
      const remainingRequests = await limiter.removeTokens(1);
      if (remainingRequests < 0) {
        return next(new Error("Rate limit exceeded: Too many requests"));
      }
      next();
    } catch (err) {
      return next(new Error("Rate limiting error: Internal error"));
    }
  });

  // Initialize game socket
  initializeGameSocket(io);

  // Helper function to broadcast the complete, updated list of online users.
  const broadcastOnlineUsers = () => {
    const usersList = Array.from(onlineUsers.values());
    // The event is 'online_users_list'
    io.emit("online_users_list", usersList);
    console.log("📢 Broadcasted updated online users list to all clients:", usersList.map(u => u.username));
  };

  io.on("connection", (socket: AuthenticatedSocket) => {
    console.log(
      `🟢 User ${socket.username} (${socket.userId}) connected:`,
      socket.id,
    );

    // Add the newly connected user to our central list
    if (socket.userId && socket.username) {
      onlineUsers.set(socket.userId, {
        userId: socket.userId,
        username: socket.username,
        socketId: socket.id,
      });
    }

    // Broadcast the new, complete list to EVERYONE.
    broadcastOnlineUsers();

    // Join user to their own room for direct messaging
    socket.join(`user_${socket.userId}`);

    // Setup game events for this socket
    gameSocket.setupGameEvents(socket);

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

      // Clean up the user from the central list and the rate limiter map
      if (socket.userId) {
        onlineUsers.delete(socket.userId);
        userLimiters.delete(socket.userId);
      }

      // Broadcast the updated list to all remaining clients.
      broadcastOnlineUsers();
    });
  });
}