import { GameLoop } from './GameLoop';
import { GameState } from './GameState';
import { RoomConfig, RoomInfo } from '../types/game.types';
import { GAME_CONFIG } from '../config/game.config';
import { logger } from '../utils/logger';
import { randomId } from '../utils/random';

/**
 * Room manager - manages multiple game rooms
 */
export class RoomManager {
  private rooms: Map<string, GameLoop> = new Map();
  private defaultRoomId: string;

  constructor() {
    // Create default room
    this.defaultRoomId = 'main';
    this.createRoom({
      id: this.defaultRoomId,
      maxPlayers: GAME_CONFIG.MAX_PLAYERS_PER_ROOM,
      worldSize: {
        width: GAME_CONFIG.WORLD_WIDTH,
        height: GAME_CONFIG.WORLD_HEIGHT
      }
    });

    logger.info('RoomManager initialized with default room', {
      roomId: this.defaultRoomId
    });
  }

  /**
   * Create a new game room
   */
  createRoom(config: RoomConfig): GameLoop {
    if (this.rooms.has(config.id)) {
      logger.warn(`Room ${config.id} already exists`);
      return this.rooms.get(config.id)!;
    }

    const gameState = new GameState();
    const gameLoop = new GameLoop(gameState);

    this.rooms.set(config.id, gameLoop);
    gameLoop.start();

    logger.info(`Room created`, {
      roomId: config.id,
      maxPlayers: config.maxPlayers
    });

    return gameLoop;
  }

  /**
   * Get room by ID
   */
  getRoom(roomId: string): GameLoop | null {
    return this.rooms.get(roomId) || null;
  }

  /**
   * Get default room
   */
  getDefaultRoom(): GameLoop {
    return this.rooms.get(this.defaultRoomId)!;
  }

  /**
   * Assign player to a room (load balancing)
   */
  assignPlayerToRoom(playerId: string): string {
    // For now, just assign to default room
    // In the future, implement load balancing logic
    return this.defaultRoomId;
  }

  /**
   * Destroy a room
   */
  destroyRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      logger.warn(`Room ${roomId} not found`);
      return;
    }

    // Don't allow destroying default room
    if (roomId === this.defaultRoomId) {
      logger.warn(`Cannot destroy default room`);
      return;
    }

    room.stop();
    this.rooms.delete(roomId);

    logger.info(`Room destroyed`, { roomId });
  }

  /**
   * Get all rooms info
   */
  getAllRoomsInfo(): RoomInfo[] {
    const roomsInfo: RoomInfo[] = [];

    for (const [roomId, gameLoop] of this.rooms.entries()) {
      const gameState = gameLoop.getGameState();
      roomsInfo.push({
        id: roomId,
        playerCount: gameState.players.size,
        maxPlayers: GAME_CONFIG.MAX_PLAYERS_PER_ROOM,
        isActive: gameLoop.isActive()
      });
    }

    return roomsInfo;
  }

  /**
   * Get room count
   */
  getRoomCount(): number {
    return this.rooms.size;
  }

  /**
   * Stop all rooms
   */
  stopAll(): void {
    for (const gameLoop of this.rooms.values()) {
      gameLoop.stop();
    }
    logger.info('All rooms stopped');
  }
}
