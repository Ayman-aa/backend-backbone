import { Ball, Paddle, Score, GameState, GameConfig } from './types';

export class PongGame {
  private ball: Ball;
  private player1: Paddle;
  private player2: Paddle;
  private score: Score;
  private gameStatus: 'waiting' | 'playing' | 'finished';
  private winner?: 1 | 2;
  private config: GameConfig;
  
  constructor() {
    this.config = {
      width: 800,
      height: 400,
      paddleSpeed: 8,
      ballSpeed: 4,
      maxScore: 5,
      paddleHeight: 80,
      paddleWidth: 10,
    };
    
    this.resetGame();
  }
  
  private resetGame(): void {
    this.ball = {
      x: this.config.width / 2,
      y: this.config.height / 2,
      vx: this.config.ballSpeed * (Math.random() > 0.5 ? 1 : -1), // Random direction
      vy: this.config.ballSpeed * (Math.random() - 0.5) * 2,      // Random angle
      speed: this.config.ballSpeed
    };
  
    this.player1 = {
      x: 10,
      y: this.config.height / 2 - this.config.paddleHeight / 2,
      width: this.config.paddleWidth,
      height: this.config.paddleHeight
    };
  
    this.player2 = {
      x: this.config.width - 20,
      y: this.config.height / 2 - this.config.paddleHeight / 2,
      width: this.config.paddleWidth,
      height: this.config.paddleHeight
    };
  
    this.score = { player1: 0, player2: 0 };
    this.gameStatus = 'waiting';
    this.winner = undefined;
  }
  
  public startGame(): void {
    this.gameStatus = 'playing';
  }
  
  public update(): void {
    if (this.gameStatus !== 'playing') return;
    
    this.updateBall();
    this.checkCollisions();
    this.checkScoring();
    this.checkWinCondition();
  }
  
  private updateBall(): void {
    this.ball.x += this.ball.vx;
    this.ball.y += this.ball.vy;
  }
  
  private checkCollisions(): void {
    
  }
  
}