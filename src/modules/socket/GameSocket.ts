import { Server as SocketIOServer, Socket } from "socket.io";
import { gameService } from "../../services/GameService";

interface AuthenticatedSocket extends Socket {
  userId?: number;
  username?: string;
}

interface GameEventData {
  gameId: string;
  userId: number;
}

interface PaddleMoveData extends GameEventData {
  direction: number; // -1 for up, 1 for down
}

interface PlayerReadyData extends GameEventData {
  ready: boolean;
}

export class GameSocket {
  private io: SocketIOServer;
  private gameRooms: Map<string, Set<number>> = new Map();
  private playerGames: Map<number, string> = new Map();

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  /**
   * Setup all game-related socket events
   */
  setupGameEvents(socket: AuthenticatedSocket): void {
    if (!socket.userId) return;

    console.log(
      `🎮 Setting up game events for ${socket.username} (${socket.userId})`,
    );

    // Game joining
    socket.on("game:join", async (data: GameEventData) => {
      await this.handleJoinGame(socket, data);
    });

    // Player ready status
    socket.on("game:ready", (data: PlayerReadyData) => {
      this.handlePlayerReady(socket, data);
    });

    // Paddle movement
    socket.on("game:paddle_move", (data: PaddleMoveData) => {
      this.handlePaddleMove(socket, data);
    });

    // Spectate game
    socket.on("game:spectate", (data: { gameId: string }) => {
      this.handleSpectateGame(socket, data.gameId);
    });

    // Leave game
    socket.on("game:leave", () => {
      this.handleLeaveGame(socket);
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      this.handleDisconnection(socket);
    });
  }

  /**
   * Handle player joining a game
   */
  private async handleJoinGame(
    socket: AuthenticatedSocket,
    data: GameEventData,
  ): Promise<void> {
    if (!socket.userId || !data.gameId) {
      socket.emit("game:error", { message: "Invalid game data" });
      return;
    }

    try {
      // Check if player is already in another game
      const existingGame = this.playerGames.get(socket.userId);
      if (existingGame) {
        socket.emit("game:error", { message: "Already in another game" });
        return;
      }

      // Try to join the game
      const success = await gameService.joinGame(data.gameId, socket.userId);
      if (!success) {
        socket.emit("game:error", { message: "Failed to join game" });
        return;
      }

      // Add player to game room
      this.addPlayerToRoom(socket.userId, data.gameId);
      socket.join(`game:${data.gameId}`);

      // Get updated game state
      const gameState = gameService.getGameState(data.gameId);
      if (gameState) {
        // Notify all players in the room
        this.io.to(`game:${data.gameId}`).emit("game:player_joined", {
          gameState,
          playerId: socket.userId,
          username: socket.username,
        });

        // Send game state to the joining player
        socket.emit("game:state", gameState);
      }

      console.log(`🎮 Player ${socket.username} joined game ${data.gameId}`);
    } catch (error) {
      console.error("❌ Error joining game:", error);
      socket.emit("game:error", { message: (error as Error).message });
    }
  }

  /**
   * Handle player ready status
   */
  private handlePlayerReady(
    socket: AuthenticatedSocket,
    data: PlayerReadyData,
  ): void {
    if (!socket.userId || !data.gameId) {
      socket.emit("game:error", { message: "Invalid ready data" });
      return;
    }

    try {
      const success = gameService.setPlayerReady(
        data.gameId,
        socket.userId,
        data.ready,
      );
      if (!success) {
        socket.emit("game:error", { message: "Failed to set ready status" });
        return;
      }

      const gameState = gameService.getGameState(data.gameId);
      if (gameState) {
        // Broadcast updated game state
        this.io.to(`game:${data.gameId}`).emit("game:state", gameState);

        // If game started, notify players
        if (gameState.status === "playing") {
          this.io.to(`game:${data.gameId}`).emit("game:started", {
            message:
              "Game started! Use arrow keys or WASD to control your paddle.",
          });

          // Setup game end listener for this game
          this.setupGameEndListener(data.gameId);
        }
      }

      console.log(
        `🎮 Player ${socket.username} ready status: ${data.ready} in game ${data.gameId}`,
      );
    } catch (error) {
      console.error("❌ Error setting ready status:", error);
      socket.emit("game:error", { message: "Failed to set ready status" });
    }
  }

  /**
   * Handle paddle movement
   */
  private handlePaddleMove(
    socket: AuthenticatedSocket,
    data: PaddleMoveData,
  ): void {
    if (!socket.userId || !data.gameId) return;

    // Validate direction
    if (data.direction !== -1 && data.direction !== 1) return;

    try {
      const success = gameService.movePaddle(
        data.gameId,
        socket.userId,
        data.direction,
      );
      if (!success) return;

      // No need to broadcast individual paddle moves as game state is broadcasted at 60 FPS
    } catch (error) {
      console.error("❌ Error moving paddle:", error);
    }
  }

  /**
   * Handle spectating a game
   */
  private handleSpectateGame(
    socket: AuthenticatedSocket,
    gameId: string,
  ): void {
    if (!socket.userId || !gameId) {
      socket.emit("game:error", { message: "Invalid spectate data" });
      return;
    }

    try {
      const gameState = gameService.getGameState(gameId);
      if (!gameState) {
        socket.emit("game:error", { message: "Game not found" });
        return;
      }

      // Join as spectator
      socket.join(`game:${gameId}`);
      socket.emit("game:spectate_started", { gameState });

      console.log(`👁️ Player ${socket.username} is spectating game ${gameId}`);
    } catch (error) {
      console.error("❌ Error spectating game:", error);
      socket.emit("game:error", { message: "Failed to spectate game" });
    }
  }

  /**
   * Handle player leaving game
   */
  private handleLeaveGame(socket: AuthenticatedSocket): void {
    if (!socket.userId) return;

    const gameId = this.playerGames.get(socket.userId);
    if (!gameId) return;

    try {
      // Remove from game room
      this.removePlayerFromRoom(socket.userId, gameId);
      socket.leave(`game:${gameId}`);

      // Force end the game
      gameService.forceEndGame(
        gameId,
        `Player ${socket.username} left the game`,
      );

      // Notify other players
      socket.to(`game:${gameId}`).emit("game:player_left", {
        playerId: socket.userId,
        username: socket.username,
        message: "Player left the game",
      });

      console.log(`🎮 Player ${socket.username} left game ${gameId}`);
    } catch (error) {
      console.error("❌ Error leaving game:", error);
    }
  }

  /**
   * Handle player disconnection
   */
  private handleDisconnection(socket: AuthenticatedSocket): void {
    if (!socket.userId) return;

    const gameId = this.playerGames.get(socket.userId);
    if (!gameId) return;

    try {
      // Remove from game room
      this.removePlayerFromRoom(socket.userId, gameId);

      // Force end the game
      gameService.forceEndGame(
        gameId,
        `Player ${socket.username} disconnected`,
      );

      // Notify other players
      socket.to(`game:${gameId}`).emit("game:player_disconnected", {
        playerId: socket.userId,
        username: socket.username,
        message: "Player disconnected",
      });

      console.log(
        `🎮 Player ${socket.username} disconnected from game ${gameId}`,
      );
    } catch (error) {
      console.error("❌ Error handling disconnection:", error);
    }
  }

  /**
   * Setup game end listener for a specific game
   */
  private setupGameEndListener(gameId: string): void {
    // Register callback to handle game end events
    gameService.setBroadcastCallback(gameId, (gameState) => {
      if (gameState.status === "finished") {
        // Game ended, send final state
        this.io.to(`game:${gameId}`).emit("game:ended", {
          gameState,
          winner: gameState.winnerId,
          message: gameState.winnerId
            ? `Game ended! Winner: ${gameState.winnerId === gameState.player1.id ? gameState.player1.username : gameState.player2?.username}`
            : "Game ended in a draw!",
        });

        // Clean up callback
        gameService.removeBroadcastCallback(gameId);
      }
    });
  }

  /**
   * Add player to game room
   */
  private addPlayerToRoom(playerId: number, gameId: string): void {
    if (!this.gameRooms.has(gameId)) {
      this.gameRooms.set(gameId, new Set());
    }
    this.gameRooms.get(gameId)!.add(playerId);
    this.playerGames.set(playerId, gameId);
  }

  /**
   * Remove player from game room
   */
  private removePlayerFromRoom(playerId: number, gameId: string): void {
    const room = this.gameRooms.get(gameId);
    if (room) {
      room.delete(playerId);
      if (room.size === 0) {
        this.gameRooms.delete(gameId);
      }
    }
    this.playerGames.delete(playerId);
  }

  /**
   * Get active game rooms
   */
  getActiveRooms(): { gameId: string; playerCount: number }[] {
    return Array.from(this.gameRooms.entries()).map(([gameId, players]) => ({
      gameId,
      playerCount: players.size,
    }));
  }

  /**
   * Get players in a game room
   */
  getPlayersInRoom(gameId: string): number[] {
    const room = this.gameRooms.get(gameId);
    return room ? Array.from(room) : [];
  }
}

export let gameSocket: GameSocket;

/**
 * Initialize game socket with SocketIO server
 */
export function initializeGameSocket(io: SocketIOServer): void {
  gameSocket = new GameSocket(io);
  console.log("🎮 GameSocket initialized");
}
