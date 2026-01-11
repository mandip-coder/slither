// Basic geometric types
export interface Point {
  x: number;
  y: number;
}

export interface WorldSize {
  width: number;
  height: number;
}

// Game entity types
export interface SnakeSegment extends Point {
  radius: number;
}

export interface SerializedSnake {
  id: string;
  playerId: string;
  head: Point;
  direction: number;
  length: number;
  color: string;
  skinId?: string; // ID of the selected skin
  score: number;
  path?: Point[]; // Path for client-side rendering
  isBoosting?: boolean; // Visual state for boost effects
  name?: string; // Player name
}

export interface SerializedFood {
  id: string;
  position: Point;
  value: number;
}

export interface LeaderboardEntry {
  playerId: string;
  name: string;
  score: number;
  rank: number;
}

// Collision types
export type CollisionType = 'snake-snake' | 'snake-food' | 'snake-wall' | 'snake-self';

export interface CollisionEvent {
  type: CollisionType;
  snakeId: string;
  targetId?: string;
  position: Point;
  timestamp: number;
}

// Room types
export interface RoomConfig {
  id: string;
  maxPlayers: number;
  worldSize: WorldSize;
}

export interface RoomInfo {
  id: string;
  playerCount: number;
  maxPlayers: number;
  isActive: boolean;
}

// System interface
export interface ISystem {
  name: string;
  update(deltaTime: number, gameState: any): void;
}

// Performance metrics
export interface TickMetric {
  tickNumber: number;
  totalTime: number;
  systemTimes: Map<string, number>;
  timestamp: number;
}

export interface PerformanceStats {
  averageTickTime: number;
  minTickTime: number;
  maxTickTime: number;
  slowTickCount: number;
  totalTicks: number;
}
