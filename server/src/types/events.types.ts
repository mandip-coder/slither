import { CollisionEvent } from './game.types';

// Event types
export type GameEventType =
  | 'snake-spawned'
  | 'snake-died'
  | 'food-consumed'
  | 'collision-detected'
  | 'player-joined'
  | 'player-left'
  | 'score-updated'
  | 'room-created'
  | 'room-destroyed';

export interface GameEvent {
  type: GameEventType;
  timestamp: number;
  data: any;
}

export interface SnakeSpawnedEvent extends GameEvent {
  type: 'snake-spawned';
  data: {
    snakeId: string;
    playerId: string;
    position: { x: number; y: number };
  };
}

export interface SnakeDiedEvent extends GameEvent {
  type: 'snake-died';
  data: {
    snakeId: string;
    playerId: string;
    killerId?: string;
    reason: 'collision' | 'self-collision' | 'wall-collision';
  };
}

export interface FoodConsumedEvent extends GameEvent {
  type: 'food-consumed';
  data: {
    foodId: string;
    snakeId: string;
    value: number;
  };
}

export interface CollisionDetectedEvent extends GameEvent {
  type: 'collision-detected';
  data: CollisionEvent;
}

export interface PlayerJoinedEvent extends GameEvent {
  type: 'player-joined';
  data: {
    playerId: string;
    playerName: string;
    socketId: string;
  };
}

export interface PlayerLeftEvent extends GameEvent {
  type: 'player-left';
  data: {
    playerId: string;
    reason: 'disconnect' | 'kick';
  };
}

export interface ScoreUpdatedEvent extends GameEvent {
  type: 'score-updated';
  data: {
    playerId: string;
    oldScore: number;
    newScore: number;
    delta: number;
  };
}
