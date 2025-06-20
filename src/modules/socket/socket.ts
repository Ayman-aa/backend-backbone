import { Server as HttpServer } from "http";
import { Socket, Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { prisma } from "../../utils/prisma";
import { RateLimiter } from "limiter";
import { gameService}  from '../game/gameservice';
export let io: SocketIOServer;

interface AuthenticatedSocket extends Socket {
  userId?: number;
  username?: string;
}

// Store rate limiters for each connected user
const userLimiters = new Map<number, RateLimiter>();

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
    

// Add these event handlers inside your socket connection handler:

socket.on('join_matchmaking', () => {
  console.log(`User ${socket.userId} joined matchmaking`);
  gameService.addToMatchmaking(socket.userId!);
  
  // Try to find a match
  const match = gameService.findMatch();
  if (match) {
    const gameState = gameService.createGame(match.player1, match.player2);
    
    // Join both players to the game room
    io.to(`user_${match.player1}`).socketsJoin(gameState.id);
    io.to(`user_${match.player2}`).socketsJoin(gameState.id);
    
    // Notify both players that the game is starting
    io.to(`user_${match.player1}`).emit('game_found', {
      gameId: gameState.id,
      playerId: 1,
      opponent: { id: match.player2 }
    });
    
    io.to(`user_${match.player2}`).emit('game_found', {
      gameId: gameState.id,
      playerId: 2,
      opponent: { id: match.player1 }
    });
    
    // Start the game loop
    startGameLoop(gameState.id);
  }
});

socket.on('paddle_move', (data) => {
  const { gameId, direction } = data;
  if (!gameId || !direction) return;
  
  gameService.updatePaddle(gameId, socket.userId!, direction);
});

socket.on('disconnect', () => {
  // Remove from matchmaking queue
  gameService.removeFromMatchmaking(socket.userId!);
});
  });
}
function startGameLoop(gameId: string) {
  const BALL_RADIUS = 10;
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 500;
  const PADDLE_WIDTH = 10;
  const PADDLE_HEIGHT = 100;
  const PADDLE_PADDING = 20;

  const gameLoop = setInterval(() => {
    const game = gameService.getGame(gameId);
    if (!game || game.gameStatus !== 'playing') {
      clearInterval(gameLoop);
      return;
    }

    // Update ball position
    game.ballX += game.ballSpeedX;
    game.ballY += game.ballSpeedY;

    // Ball collision with top and bottom walls
    if (game.ballY <= BALL_RADIUS || game.ballY >= CANVAS_HEIGHT - BALL_RADIUS) {
      game.ballSpeedY = -game.ballSpeedY;
    }

    // Ball collision with paddles
    // Left paddle
    if (game.ballX - BALL_RADIUS <= PADDLE_PADDING + PADDLE_WIDTH && 
        game.ballY > game.paddle1Y && 
        game.ballY < game.paddle1Y + PADDLE_HEIGHT) {
      game.ballSpeedX = -game.ballSpeedX;
    }

    // Right paddle
    if (game.ballX + BALL_RADIUS >= CANVAS_WIDTH - PADDLE_PADDING - PADDLE_WIDTH && 
        game.ballY > game.paddle2Y && 
        game.ballY < game.paddle2Y + PADDLE_HEIGHT) {
      game.ballSpeedX = -game.ballSpeedX;
    }

    // Check for scoring
    if (game.ballX < 0) {
      game.score2++;
      resetBall(game);
    } else if (game.ballX > CANVAS_WIDTH) {
      game.score1++;
      resetBall(game);
    }

    // Broadcast game state to both players
    io.to(gameId).emit('game_state_update', {
      ballX: game.ballX,
      ballY: game.ballY,
      paddle1Y: game.paddle1Y,
      paddle2Y: game.paddle2Y,
      score1: game.score1,
      score2: game.score2
    });

    // Check for game end
    if (game.score1 >= 5 || game.score2 >= 5) {
      game.gameStatus = 'finished';
      io.to(gameId).emit('game_end', {
        winner: game.score1 >= 5 ? 1 : 2,
        finalScore: { player1: game.score1, player2: game.score2 }
      });
      clearInterval(gameLoop);
      gameService.removeGame(gameId);
    }
  }, 1000 / 60); // 60 FPS
}

function resetBall(game: any) {
  game.ballX = 400;
  game.ballY = 250;
  game.ballSpeedX = (Math.random() > 0.5 ? 1 : -1) * 5;
  game.ballSpeedY = (Math.random() * 6) - 3;
}
/*
| Function        | Description                                                   |
| ----------------|---------------------------------------------------------------|
| setupSocketIO() | Initializes and configures Socket.IO server with auth         |
|                 | - Validates JWT on connection                                 |
|                 | - Rate limits users to 10 events per second                   |
|                 | - Joins users to private rooms for messaging                  |
|                 | - Emits online/offline status to others                       |
|                 | - Rejects direct message sending via socket (use API instead) |
*/
