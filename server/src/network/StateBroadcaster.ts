import { Server as SocketIOServer } from 'socket.io';
import { RoomManager } from '../core/RoomManager';
import { GameStateUpdate, DeltaUpdate, SOCKET_EVENTS } from '../types/network.types';
import { DeltaCompressor } from './DeltaCompressor';
import { NETWORK_CONFIG } from '../config/network.config';
import { logger } from '../utils/logger';
import { distance } from '../utils/math';

/**
 * State broadcaster - sends optimized game state updates to clients
 * Uses delta compression to reduce bandwidth by 70-90%
 */
export class StateBroadcaster {
  private io: SocketIOServer;
  private roomManager: RoomManager;
  private deltaCompressor: DeltaCompressor;
  private updateInterval: number;
  private intervalId: NodeJS.Timeout | null = null;
  private updateCount: number = 0;

  constructor(io: SocketIOServer, roomManager: RoomManager) {
    this.io = io;
    this.roomManager = roomManager;
    this.deltaCompressor = new DeltaCompressor();
    this.updateInterval = 1000 / NETWORK_CONFIG.UPDATE_RATE; // 20 Hz = 50ms
  }

  /**
   * Start broadcasting state updates
   */
  start(): void {
    if (this.intervalId) {
      logger.warn('StateBroadcaster already running');
      return;
    }

    this.intervalId = setInterval(() => {
      this.broadcast();
    }, this.updateInterval);

    logger.info('StateBroadcaster started', {
      updateRate: NETWORK_CONFIG.UPDATE_RATE + ' Hz',
      deltaCompression: NETWORK_CONFIG.DELTA_COMPRESSION ? 'enabled' : 'disabled'
    });
  }

  /**
   * Stop broadcasting
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    logger.info('StateBroadcaster stopped');
  }

  /**
   * Broadcast game state to all clients
   */
  private broadcast(): void {
    try {
      this.updateCount++;
      const rooms = this.roomManager.getAllRoomsInfo();

      for (const roomInfo of rooms) {
        const room = this.roomManager.getRoom(roomInfo.id);
        if (!room) continue;

        const gameState = room.getGameState();
        const scoreSystem = room.getScoreSystem();

        // Get all sockets in this room
        const socketsInRoom = this.io.sockets.adapter.rooms.get(roomInfo.id);
        if (!socketsInRoom) continue;

        // Send personalized state to each player
        for (const socketId of socketsInRoom) {
          const socket = this.io.sockets.sockets.get(socketId);
          if (!socket) continue;

          const playerId = socket.data.playerId;
          if (!playerId) continue;

          const player = gameState.players.get(playerId);
          if (!player) continue;

          // Get player's snake
          const playerSnake = gameState.getSnakeByPlayerId(playerId);

          // Serialize state with interest management
          const fullState = this.serializeStateForPlayer(
            gameState,
            scoreSystem,
            playerId,
            playerSnake
          );

          // Use delta compression if enabled
          if (NETWORK_CONFIG.DELTA_COMPRESSION) {
            // Send full state every 10 updates (2 seconds @ 20Hz) for sync
            const shouldSendFullState = this.updateCount % 40 === 0;

            if (shouldSendFullState) {
              socket.emit(SOCKET_EVENTS.GAME_STATE, fullState);
            } else {
              // Compute and send delta
              const delta = this.deltaCompressor.computeDelta(playerId, fullState);

              if (delta) {
                socket.emit(SOCKET_EVENTS.DELTA_UPDATE, delta);
              }
              // If no delta (no changes), don't send anything
            }
          } else {
            // Send full state every update
            socket.emit(SOCKET_EVENTS.GAME_STATE, fullState);
          }
        }
      }
    } catch (error) {
      logger.error('Error broadcasting state', error);
    }
  }

  /**
   * Serialize game state for a specific player (interest management)
   */
  private serializeStateForPlayer(
    gameState: any,
    scoreSystem: any,
    playerId: string,
    playerSnake: any
  ): GameStateUpdate {
    const viewportRadius = NETWORK_CONFIG.VIEWPORT_RADIUS;
    const visibleSnakes = [];
    const visibleFood = [];

    // If player has a snake, only send nearby entities
    if (playerSnake && playerSnake.isAlive) {
      const playerPos = playerSnake.head;

      // Get visible snakes
      for (const snake of gameState.snakes.values()) {
        if (!snake.isAlive) continue;

        const dist = distance(playerPos, snake.head);
        if (dist <= viewportRadius + NETWORK_CONFIG.VIEWPORT_BUFFER) {
          visibleSnakes.push(snake.serialize());
        }
      }

      // Get visible food
      for (const food of gameState.food.values()) {
        if (food.isConsumed) continue;

        const dist = distance(playerPos, food.position);
        if (dist <= viewportRadius + NETWORK_CONFIG.VIEWPORT_BUFFER) {
          visibleFood.push(food.serialize());
        }
      }
    } else {
      // Player is dead - send all snakes (spectator mode)
      for (const snake of gameState.snakes.values()) {
        if (snake.isAlive) {
          visibleSnakes.push(snake.serialize());
        }
      }

      // Send sample of food
      let foodCount = 0;
      for (const food of gameState.food.values()) {
        if (!food.isConsumed && foodCount < 50) {
          visibleFood.push(food.serialize());
          foodCount++;
        }
      }
    }

    return {
      tick: gameState.currentTick,
      worldSize: gameState.worldSize, // Send world boundaries for client rendering
      snakes: visibleSnakes,
      food: visibleFood,
      leaderboard: scoreSystem.getLeaderboard()
    };
  }

  /**
   * Clean up player state on disconnect
   */
  cleanupPlayer(playerId: string): void {
    this.deltaCompressor.clearPlayerState(playerId);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      updateCount: this.updateCount,
      ...this.deltaCompressor.getStats()
    };
  }
}
