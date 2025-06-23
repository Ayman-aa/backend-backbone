import { prisma } from "../utils/prisma";
import { GameMode } from "@prisma/client";

export interface GameConfig {
  maxScore: number;
  paddleSpeed: number;
  ballSpeed: number;
  canvasWidth: number;
  canvasHeight: number;
  paddleWidth: number;
  paddleHeight: number;
  ballSize: number;
}

export interface GameState {
  id: string;
  status: "waiting" | "ready" | "playing" | "finished";
  player1: {
    id: number;
    username: string;
    y: number;
    score: number;
    ready: boolean;
  };
  player2: {
    id: number;
    username: string;
    y: number;
    score: number;
    ready: boolean;
  } | null;
  ball: {
    x: number;
    y: number;
    dx: number;
    dy: number;
  };
  config: GameConfig;
  lastUpdateTime: number;
  winnerId: number | null;
}

export interface PlayerStats {
  totalGames: number;
  wonGames: number;
  lostGames: number;
  winRate: number;
  totalScore: number;
  averageScore: number;
}

export interface GameResult {
  gameId: string;
  player1Id: number;
  player2Id: number;
  player1Score: number;
  player2Score: number;
  winnerId: number | null;
  duration: number;
}

export class GameService {
  private activeGames: Map<string, GameState> = new Map();
  private gameIntervals: Map<string, NodeJS.Timeout> = new Map();

  private readonly DEFAULT_CONFIG: GameConfig = {
    maxScore: 5,
    paddleSpeed: 8,
    ballSpeed: 5,
    canvasWidth: 800,
    canvasHeight: 400,
    paddleWidth: 10,
    paddleHeight: 80,
    ballSize: 10,
  };

  /**
   * Create a new remote game
   */
  async createGame(
    hostId: number,
    config?: Partial<GameConfig>,
  ): Promise<string> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: hostId },
        select: { id: true, username: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      // Create game in database
      const dbGame = await prisma.game.create({
        data: {
          player1Id: hostId,
          score1: 0,
          score2: 0,
          mode: GameMode.REMOTE,
        },
      });

      // Create in-memory game state
      const gameState: GameState = {
        id: dbGame.id.toString(),
        status: "waiting",
        player1: {
          id: user.id,
          username: user.username,
          y:
            this.DEFAULT_CONFIG.canvasHeight / 2 -
            this.DEFAULT_CONFIG.paddleHeight / 2,
          score: 0,
          ready: false,
        },
        player2: null,
        ball: {
          x: this.DEFAULT_CONFIG.canvasWidth / 2,
          y: this.DEFAULT_CONFIG.canvasHeight / 2,
          dx: this.DEFAULT_CONFIG.ballSpeed * (Math.random() > 0.5 ? 1 : -1),
          dy: this.DEFAULT_CONFIG.ballSpeed * (Math.random() > 0.5 ? 1 : -1),
        },
        config: { ...this.DEFAULT_CONFIG, ...config },
        lastUpdateTime: Date.now(),
        winnerId: null,
      };

      this.activeGames.set(gameState.id, gameState);

      console.log(`🎮 Game created: ${gameState.id} by ${user.username}`);
      return gameState.id;
    } catch (error) {
      console.error("❌ Failed to create game:", error);
      throw error;
    }
  }

  /**
   * Player joins an existing game
   */
  async joinGame(gameId: string, playerId: number): Promise<boolean> {
    try {
      const game = this.activeGames.get(gameId);
      if (!game) {
        throw new Error("Game not found");
      }

      if (game.status !== "waiting") {
        throw new Error("Game is not available for joining");
      }

      if (game.player1.id === playerId) {
        throw new Error("Cannot join your own game");
      }

      if (game.player2) {
        throw new Error("Game is already full");
      }

      const user = await prisma.user.findUnique({
        where: { id: playerId },
        select: { id: true, username: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      // Add player2 to game
      game.player2 = {
        id: user.id,
        username: user.username,
        y: game.config.canvasHeight / 2 - game.config.paddleHeight / 2,
        score: 0,
        ready: false,
      };

      game.status = "ready";

      // Update database
      await prisma.game.update({
        where: { id: parseInt(gameId) },
        data: { player2Id: playerId },
      });

      console.log(`🎮 Player ${user.username} joined game ${gameId}`);
      return true;
    } catch (error) {
      console.error("❌ Failed to join game:", error);
      throw error;
    }
  }

  /**
   * Set player ready status
   */
  setPlayerReady(gameId: string, playerId: number, ready: boolean): boolean {
    const game = this.activeGames.get(gameId);
    if (!game) return false;

    if (game.player1.id === playerId) {
      game.player1.ready = ready;
    } else if (game.player2?.id === playerId) {
      game.player2.ready = ready;
    } else {
      return false;
    }

    // Start game if both players are ready
    if (game.player1.ready && game.player2?.ready && game.status === "ready") {
      this.startGame(gameId);
    }

    return true;
  }

  /**
   * Start the game loop
   */
  private startGame(gameId: string): void {
    const game = this.activeGames.get(gameId);
    if (!game || !game.player2) return;

    game.status = "playing";
    game.lastUpdateTime = Date.now();

    // Start 60 FPS game loop
    const gameInterval = setInterval(() => {
      this.updateGame(gameId);
    }, 1000 / 60);

    this.gameIntervals.set(gameId, gameInterval);
    console.log(`🎮 Game ${gameId} started`);
  }

  /**
   * Update game physics (60 FPS)
   */
  private updateGame(gameId: string): void {
    const game = this.activeGames.get(gameId);
    if (!game || game.status !== "playing" || !game.player2) return;

    const now = Date.now();
    const deltaTime = (now - game.lastUpdateTime) / 1000;
    game.lastUpdateTime = now;

    // Update ball position
    game.ball.x += game.ball.dx * deltaTime * 60;
    game.ball.y += game.ball.dy * deltaTime * 60;

    // Ball collision with top/bottom walls
    if (
      game.ball.y <= game.config.ballSize / 2 ||
      game.ball.y >= game.config.canvasHeight - game.config.ballSize / 2
    ) {
      game.ball.dy = -game.ball.dy;
      game.ball.y = Math.max(
        game.config.ballSize / 2,
        Math.min(
          game.config.canvasHeight - game.config.ballSize / 2,
          game.ball.y,
        ),
      );
    }

    // Ball collision with paddles
    this.checkPaddleCollision(game);

    // Ball out of bounds (scoring)
    if (game.ball.x <= 0) {
      // Player 2 scores
      game.player2.score++;
      this.resetBall(game);
    } else if (game.ball.x >= game.config.canvasWidth) {
      // Player 1 scores
      game.player1.score++;
      this.resetBall(game);
    }

    // Check win condition
    if (
      game.player1.score >= game.config.maxScore ||
      game.player2.score >= game.config.maxScore
    ) {
      this.endGame(gameId);
    }
  }

  /**
   * Check ball collision with paddles
   */
  private checkPaddleCollision(game: GameState): void {
    if (!game.player2) return;

    const ballLeft = game.ball.x - game.config.ballSize / 2;
    const ballRight = game.ball.x + game.config.ballSize / 2;
    const ballTop = game.ball.y - game.config.ballSize / 2;
    const ballBottom = game.ball.y + game.config.ballSize / 2;

    // Player 1 paddle (left side)
    const p1PaddleRight = game.config.paddleWidth;
    const p1PaddleTop = game.player1.y;
    const p1PaddleBottom = game.player1.y + game.config.paddleHeight;

    if (
      ballLeft <= p1PaddleRight &&
      ballRight >= 0 &&
      ballBottom >= p1PaddleTop &&
      ballTop <= p1PaddleBottom
    ) {
      game.ball.dx = Math.abs(game.ball.dx);
      game.ball.x = p1PaddleRight + game.config.ballSize / 2;
    }

    // Player 2 paddle (right side)
    const p2PaddleLeft = game.config.canvasWidth - game.config.paddleWidth;
    const p2PaddleTop = game.player2.y;
    const p2PaddleBottom = game.player2.y + game.config.paddleHeight;

    if (
      ballRight >= p2PaddleLeft &&
      ballLeft <= game.config.canvasWidth &&
      ballBottom >= p2PaddleTop &&
      ballTop <= p2PaddleBottom
    ) {
      game.ball.dx = -Math.abs(game.ball.dx);
      game.ball.x = p2PaddleLeft - game.config.ballSize / 2;
    }
  }

  /**
   * Reset ball to center
   */
  private resetBall(game: GameState): void {
    game.ball.x = game.config.canvasWidth / 2;
    game.ball.y = game.config.canvasHeight / 2;
    game.ball.dx = game.config.ballSpeed * (Math.random() > 0.5 ? 1 : -1);
    game.ball.dy = game.config.ballSpeed * (Math.random() > 0.5 ? 1 : -1);
  }

  /**
   * Move player paddle
   */
  movePaddle(gameId: string, playerId: number, direction: number): boolean {
    const game = this.activeGames.get(gameId);
    if (!game || game.status !== "playing") return false;

    const moveAmount = game.config.paddleSpeed;
    let targetY: number;

    if (game.player1.id === playerId) {
      targetY = game.player1.y + direction * moveAmount;
      targetY = Math.max(
        0,
        Math.min(game.config.canvasHeight - game.config.paddleHeight, targetY),
      );
      game.player1.y = targetY;
      return true;
    } else if (game.player2?.id === playerId) {
      targetY = game.player2.y + direction * moveAmount;
      targetY = Math.max(
        0,
        Math.min(game.config.canvasHeight - game.config.paddleHeight, targetY),
      );
      game.player2.y = targetY;
      return true;
    }

    return false;
  }

  /**
   * End the game
   */
  private async endGame(gameId: string): Promise<void> {
    const game = this.activeGames.get(gameId);
    if (!game || !game.player2) return;

    game.status = "finished";
    game.winnerId =
      game.player1.score > game.player2.score
        ? game.player1.id
        : game.player2.id;

    // Stop game loop
    const interval = this.gameIntervals.get(gameId);
    if (interval) {
      clearInterval(interval);
      this.gameIntervals.delete(gameId);
    }

    // Save game result to database
    try {
      await prisma.game.update({
        where: { id: parseInt(gameId) },
        data: {
          score1: game.player1.score,
          score2: game.player2.score,
          winnerId: game.winnerId,
        },
      });

      console.log(`🎮 Game ${gameId} ended. Winner: ${game.winnerId}`);
    } catch (error) {
      console.error("❌ Failed to save game result:", error);
    }

    // Clean up after 5 minutes
    setTimeout(
      () => {
        this.activeGames.delete(gameId);
      },
      5 * 60 * 1000,
    );
  }

  /**
   * Force end game (disconnection, etc.)
   */
  async forceEndGame(gameId: string, reason: string): Promise<void> {
    const game = this.activeGames.get(gameId);
    if (!game) return;

    console.log(`🎮 Force ending game ${gameId}: ${reason}`);

    // Stop game loop
    const interval = this.gameIntervals.get(gameId);
    if (interval) {
      clearInterval(interval);
      this.gameIntervals.delete(gameId);
    }

    // Clean up
    this.activeGames.delete(gameId);
  }

  /**
   * Get game state
   */
  getGameState(gameId: string): GameState | null {
    return this.activeGames.get(gameId) || null;
  }

  /**
   * Get all active games
   */
  getActiveGames(): GameState[] {
    return Array.from(this.activeGames.values());
  }

  /**
   * Get player statistics
   */
  async getPlayerStats(playerId: number): Promise<PlayerStats> {
    try {
      const games = await prisma.game.findMany({
        where: {
          OR: [{ player1Id: playerId }, { player2Id: playerId }],
          mode: GameMode.REMOTE,
        },
      });

      const totalGames = games.length;
      const wonGames = games.filter(
        (game: any) => game.winnerId === playerId,
      ).length;
      const lostGames = totalGames - wonGames;
      const winRate = totalGames > 0 ? (wonGames / totalGames) * 100 : 0;

      const totalScore = games.reduce((sum: number, game: any) => {
        return sum + (game.player1Id === playerId ? game.score1 : game.score2);
      }, 0);

      const averageScore = totalGames > 0 ? totalScore / totalGames : 0;

      return {
        totalGames,
        wonGames,
        lostGames,
        winRate: Math.round(winRate * 100) / 100,
        totalScore,
        averageScore: Math.round(averageScore * 100) / 100,
      };
    } catch (error) {
      console.error("❌ Failed to get player stats:", error);
      throw error;
    }
  }

  /**
   * Get game history for a player
   */
  async getGameHistory(playerId: number, limit: number = 10): Promise<any[]> {
    try {
      const games = await prisma.game.findMany({
        where: {
          OR: [{ player1Id: playerId }, { player2Id: playerId }],
          mode: GameMode.REMOTE,
        },
        include: {
          player1: { select: { id: true, username: true } },
          player2: { select: { id: true, username: true } },
          winner: { select: { id: true, username: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      return games;
    } catch (error) {
      console.error("❌ Failed to get game history:", error);
      throw error;
    }
  }

  /**
   * Check if player is in any active game
   */
  isPlayerInGame(playerId: number): string | null {
    for (const [gameId, game] of this.activeGames) {
      if (game.player1.id === playerId || game.player2?.id === playerId) {
        return gameId;
      }
    }
    return null;
  }

  /**
   * Remove player from game (disconnection)
   */
  async removePlayerFromGame(playerId: number): Promise<void> {
    const gameId = this.isPlayerInGame(playerId);
    if (gameId) {
      await this.forceEndGame(gameId, `Player ${playerId} disconnected`);
    }
  }
}

// Export singleton instance
export const gameService = new GameService();
