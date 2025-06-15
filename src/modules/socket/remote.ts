import { Server as SocketIOServer } from "socket.io";
import { prisma } from "../../utils/prisma";

export function setupRemoteGameEvents(io: SocketIOServer) {
  io.on("connection", (socket) => {
    console.log(`🎮 User connected for remote game: ${socket.id}`);

    // Join a game room
    socket.on("join_game", async (data) => {
      const { gameId, userId } = data;

      try {
        // Verify user is part of this game
        const game = await prisma.game.findUnique({
          where: { id: gameId },
          include: { player1: true, player2: true },
        });

        if (!game) {
          socket.emit("game_error", { message: "Game not found" });
          return;
        }

        if (game.player1Id !== userId && game.player2Id !== userId) {
          socket.emit("game_error", {
            message: "Not authorized for this game",
          });
          return;
        }

        // Join the game room
        socket.join(`game_${gameId}`);
        socket.emit("game_joined", { gameId, game });

        // Notify other player
        socket.to(`game_${gameId}`).emit("player_joined", {
          playerId: userId,
          playerName:
            userId === game.player1Id
              ? game.player1.username
              : game.player2?.username,
        });

        console.log(`👤 User ${userId} joined game ${gameId}`);
      } catch (error) {
        console.error("Join game error:", error);
        socket.emit("game_error", { message: "Failed to join game" });
      }
    });

    // Handle paddle movement
    socket.on("paddle_move", (data) => {
      const { gameId, playerId, paddleY } = data;

      // Broadcast paddle position to other players in the game
      socket.to(`game_${gameId}`).emit("opponent_paddle_move", {
        playerId,
        paddleY,
      });
    });

    // Handle ball updates (only from game host)
    socket.on("ball_update", (data) => {
      const { gameId, ballX, ballY, ballVelX, ballVelY } = data;

      // Broadcast ball position to other players
      socket.to(`game_${gameId}`).emit("ball_position", {
        ballX,
        ballY,
        ballVelX,
        ballVelY,
      });
    });

    // Handle score updates
    socket.on("score_update", (data) => {
      const { gameId, score1, score2 } = data;

      // Broadcast score to all players in game
      io.to(`game_${gameId}`).emit("score_changed", { score1, score2 });
    });

    // Handle game over
    socket.on("game_over", async (data) => {
      const { gameId, winnerId, score1, score2 } = data;

      try {
        // Update game in database
        await prisma.game.update({
          where: { id: gameId },
          data: { score1, score2, winnerId },
        });

        // Notify all players
        io.to(`game_${gameId}`).emit("game_finished", {
          winnerId,
          score1,
          score2,
        });

        console.log(`🏆 Game ${gameId} finished. Winner: ${winnerId}`);
      } catch (error) {
        console.error("Game over error:", error);
      }
    });

    // Handle ready state
    socket.on("player_ready", (data) => {
      const { gameId, playerId } = data;

      // Notify other players that this player is ready
      socket.to(`game_${gameId}`).emit("player_ready_state", { playerId });
    });

    // Handle game start
    socket.on("start_game", (data) => {
      const { gameId } = data;

      // Notify all players to start the game
      io.to(`game_${gameId}`).emit("game_start");
    });

    // Handle disconnection from game
    socket.on("leave_game", (data) => {
      const { gameId, playerId } = data;

      socket.leave(`game_${gameId}`);
      socket.to(`game_${gameId}`).emit("player_left", { playerId });

      console.log(`👤 User ${playerId} left game ${gameId}`);
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log(`🔌 User disconnected: ${socket.id}`);
    });
  });
}
