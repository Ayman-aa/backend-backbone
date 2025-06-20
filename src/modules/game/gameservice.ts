import { prisma } from '../../utils/prisma';

export default interface GameState {
  id: string;
  player1Id: number;
  player2Id: number;
  ballX: number;
  ballY: number;
  ballSpeedX: number;
  ballSpeedY: number;
  paddle1Y: number;
  paddle2Y: number;
  score1: number;
  score2: number;
  gameStatus: 'waiting' | 'playing' | 'finished';
}

export class GameService {
  private activeGames = new Map<string, GameState>();
  private matchmakingQueue: number[] = [];

  addToMatchmaking(userId: number): void {
    if (!this.matchmakingQueue.includes(userId)) {
      this.matchmakingQueue.push(userId);
    }
  }

  removeFromMatchmaking(userId: number): void {
    const index = this.matchmakingQueue.indexOf(userId);
    if (index > -1) {
      this.matchmakingQueue.splice(index, 1);
    }
  }

  findMatch(): { player1: number; player2: number } | null {
    if (this.matchmakingQueue.length >= 2) {
      const player1 = this.matchmakingQueue.shift()!;
      const player2 = this.matchmakingQueue.shift()!;
      return { player1, player2 };
    }
    return null;
  }

  createGame(player1Id: number, player2Id: number): GameState {
    const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const gameState: GameState = {
      id: gameId,
      player1Id,
      player2Id,
      ballX: 400, // Canvas width / 2
      ballY: 250, // Canvas height / 2
      ballSpeedX: 5,
      ballSpeedY: 3,
      paddle1Y: 200,
      paddle2Y: 200,
      score1: 0,
      score2: 0,
      gameStatus: 'playing'
    };

    this.activeGames.set(gameId, gameState);
    return gameState;
  }

  updatePaddle(gameId: string, playerId: number, direction: 'up' | 'down'): void {
    const game = this.activeGames.get(gameId);
    if (!game || game.gameStatus !== 'playing') return;

    const PADDLE_SPEED = 8;
    const CANVAS_HEIGHT = 500;
    const PADDLE_HEIGHT = 100;

    if (game.player1Id === playerId) {
      if (direction === 'up' && game.paddle1Y > 0) {
        game.paddle1Y = Math.max(0, game.paddle1Y - PADDLE_SPEED);
      } else if (direction === 'down' && game.paddle1Y < CANVAS_HEIGHT - PADDLE_HEIGHT) {
        game.paddle1Y = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, game.paddle1Y + PADDLE_SPEED);
      }
    } else if (game.player2Id === playerId) {
      if (direction === 'up' && game.paddle2Y > 0) {
        game.paddle2Y = Math.max(0, game.paddle2Y - PADDLE_SPEED);
      } else if (direction === 'down' && game.paddle2Y < CANVAS_HEIGHT - PADDLE_HEIGHT) {
        game.paddle2Y = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, game.paddle2Y + PADDLE_SPEED);
      }
    }
  }

  getGame(gameId: string): GameState | undefined {
    return this.activeGames.get(gameId);
  }

  removeGame(gameId: string): void {
    this.activeGames.delete(gameId);
  }
}

export const gameService = new GameService();