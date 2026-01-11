import { SerializedSnake, SerializedFood, LeaderboardEntry, WorldSize } from './game.types';

// Client -> Server messages
export interface InputCommand {
  type: 'direction-change' | 'spawn' | 'boost';
  direction?: number; // For direction-change
  isBoosting?: boolean; // For boost
  playerName?: string; // For spawn
  skinId?: string; // For spawn
  timestamp: number;
}

export interface JoinRoomMessage {
  playerName: string;
  roomId?: string;
}

// Server -> Client messages
export interface GameStateUpdate {
  tick: number;
  worldSize: WorldSize;
  snakes: SerializedSnake[];
  food: SerializedFood[];
  leaderboard: LeaderboardEntry[];
}

export interface DeltaUpdate {
  tick: number;
  snakes?: {
    added?: SerializedSnake[];
    updated?: Partial<SerializedSnake & { id: string }>[];
    removed?: string[];
  };
  food?: {
    added?: SerializedFood[];
    removed?: string[];
  };
  leaderboard?: LeaderboardEntry[];
}

export type StateChangeType =
  | 'snake-moved'
  | 'snake-grew'
  | 'snake-died'
  | 'snake-spawned'
  | 'food-spawned'
  | 'food-consumed'
  | 'score-updated';

export interface StateChange {
  type: StateChangeType;
  entityId: string;
  data: any;
}

export interface PlayerJoinedMessage {
  playerId: string;
  playerName: string;
  snakeId: string;
}

export interface PlayerLeftMessage {
  playerId: string;
  reason: 'disconnect' | 'death' | 'kick';
}

export interface ErrorMessage {
  code: string;
  message: string;
}

// Socket event names
export const SOCKET_EVENTS = {
  // Client -> Server
  JOIN_ROOM: 'join-room',
  INPUT: 'input',
  PING: 'ping',

  // Server -> Client
  GAME_STATE: 'game-state',
  DELTA_UPDATE: 'delta-update',
  PLAYER_JOINED: 'player-joined',
  PLAYER_LEFT: 'player-left',
  PLAYER_SPAWNED: 'player-spawned',
  PLAYER_DIED: 'player-died',
  ERROR: 'error',
  PONG: 'pong',

  // Connection
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect'
} as const;
