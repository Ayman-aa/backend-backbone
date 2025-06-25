export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
}

export interface Paddle {
  y: number;
  x: number;
  width: number;
  height: number;
}

export interface Score {
  player1: number;
  player2: number;
}

export interface GameState {
  ball: Ball;
  player1: Paddle;
  player2: Paddle;
  score: Score;
  gameStatus: 'waiting' | 'playing' | 'paused' | 'finished';
  winner?: 1 | 2;
}

export interface GameConfig {
  width: number;
  height: number;
  paddleSpeed: number;
  ballSpeed: number;
  maxScore: number;
  paddleHeight: number;
  paddleWidth: number;
}
