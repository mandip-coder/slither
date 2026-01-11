import { Server as SocketIOServer } from 'socket.io';
import { RoomManager } from '../core/RoomManager';
import { Player } from '../entities/Player';
import { Snake } from '../entities/Snake';
import { SOCKET_EVENTS, InputCommand } from '../types/network.types';
import { logger } from '../utils/logger';
import { randomId, randomVibrantColor, randomPosition, randomAngle } from '../utils/random';
import { validateInputCommand, validatePlayerName, sanitizePlayerName } from '../utils/validation';
import { NETWORK_CONFIG } from '../config/network.config';

/**
 * Connection manager - handles player connections and disconnections
 */
export class ConnectionManager {
  private roomManager: RoomManager;
  private io: SocketIOServer;

  constructor(io: SocketIOServer, roomManager: RoomManager) {
    this.io = io;
    this.roomManager = roomManager;
  }

  /**
   * Handle new player connection
   */
  handleConnection(socket: any): void {
    logger.networkEvent('Player connected', { socketId: socket.id });

    // Handle join room
    socket.on(SOCKET_EVENTS.JOIN_ROOM, (data: any) => {
      this.handleJoinRoom(socket, data);
    });

    // Handle player input
    socket.on(SOCKET_EVENTS.INPUT, (input: any) => {
      this.handleInput(socket, input);
    });

    // Handle ping
    socket.on(SOCKET_EVENTS.PING, () => {
      socket.emit(SOCKET_EVENTS.PONG, { timestamp: Date.now() });
    });

    // Handle disconnect
    socket.on(SOCKET_EVENTS.DISCONNECT, () => {
      this.handleDisconnect(socket);
    });
  }

  /**
   * Handle player joining a room
   */
  private handleJoinRoom(socket: any, data: any): void {
    try {
      // Validate player name
      if (!data.playerName || !validatePlayerName(data.playerName)) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: 'INVALID_NAME',
          message: 'Invalid player name'
        });
        return;
      }

      const playerName = sanitizePlayerName(data.playerName);
      const roomId = data.roomId || 'main';

      // Get or create room
      const room = this.roomManager.getRoom(roomId) || this.roomManager.getDefaultRoom();
      const gameState = room.getGameState();

      // BRUTE FORCE CLEANUP: Remove ANY player associated with this socket
      // This handles cases where socket ID reused or session persisted incorrectly
      const playersToRemove: string[] = [];
      for (const [pid, p] of gameState.players.entries()) {
        if (p.socketId === socket.id) {
          playersToRemove.push(pid);
        }
      }

      for (const pid of playersToRemove) {
        logger.info('Removing duplicate player session', { socketId: socket.id, playerId: pid });
        gameState.removePlayer(pid);
      }

      // Create player
      const playerId = randomId('player');
      const player = new Player(playerId, socket.id, playerName);
      gameState.addPlayer(player);

      // Spawn snake for player
      const { SKINS } = require('../config/game.config');

      // Use requested skin if valid, otherwise fallback to default
      const requestedSkin = data.skinId && SKINS.find((s: any) => s.id === data.skinId)
        ? data.skinId
        : SKINS[0].id;

      this.spawnSnake(socket, player, gameState, requestedSkin);

      // Join socket room
      socket.join(roomId);
      socket.data.playerId = playerId;
      socket.data.roomId = roomId;

      logger.gameEvent('Player joined', {
        playerId,
        playerName,
        roomId
      });

      // Notify player
      socket.emit(SOCKET_EVENTS.PLAYER_SPAWNED, {
        playerId,
        snakeId: player.snakeId
      });

      // Notify other players
      socket.to(roomId).emit(SOCKET_EVENTS.PLAYER_JOINED, {
        playerId,
        playerName,
        snakeId: player.snakeId
      });

    } catch (error) {
      logger.error('Error handling join room', error);
      socket.emit(SOCKET_EVENTS.ERROR, {
        code: 'JOIN_FAILED',
        message: 'Failed to join room'
      });
    }
  }

  /**
   * Spawn a snake for a player
   */
  private spawnSnake(socket: any, player: Player, gameState: any, skinId: string = 'neon-green'): void {
    const snakeId = randomId('snake');
    // FIX: Find a safe position to avoid instant death
    const position = this.findSafeSpawnPosition(gameState);
    const direction = randomAngle();

    // Look up color from skin ID
    // Lazy load SKINS from config if not imported
    const { SKINS } = require('../config/game.config');
    const skin = SKINS.find((s: any) => s.id === skinId) || SKINS[0];
    const color = skin.color;

    // Create snake with Skin ID
    const snake = new Snake(snakeId, player.id, player.name, position, direction, color, skinId);
    gameState.addSnake(snake);

    logger.gameEvent('Snake spawned', {
      snakeId,
      playerId: player.id,
      position,
      skinId
    });
  }

  /**
   * Find a safe spawn position far from other snakes
   */
  private findSafeSpawnPosition(gameState: any): { x: number, y: number } {
    const maxAttempts = 20;
    const safeRadius = 150; // Buffer distance
    const safeRadiusSq = safeRadius * safeRadius;

    for (let i = 0; i < maxAttempts; i++) {
      const pos = randomPosition(gameState.worldSize, 200);
      let safe = true;

      // Check distance to all other snakes
      for (const snake of gameState.snakes.values()) {
        if (!snake.isAlive) continue;

        // Check head
        const distSq = (snake.head.x - pos.x) ** 2 + (snake.head.y - pos.y) ** 2;
        if (distSq < safeRadiusSq) {
          safe = false;
          break;
        }

        // Check path (approximate with every 10th point for performance)
        if (snake.path) {
          for (let j = 0; j < snake.path.length; j += 10) {
            const point = snake.path[j];
            const pDistSq = (point.x - pos.x) ** 2 + (point.y - pos.y) ** 2;
            if (pDistSq < safeRadiusSq) {
              safe = false;
              break;
            }
          }
        }
        if (!safe) break;
      }

      if (safe) return pos;
    }

    // Fallback if crowded
    return randomPosition(gameState.worldSize, 200);
  }


  /**
   * Handle player input
   * Delegates to InputHandler for validation and queuing
   */
  private handleInput(socket: any, input: any): void {
    try {
      const playerId = socket.data.playerId;
      const roomId = socket.data.roomId;

      if (!playerId || !roomId) {
        return;
      }

      const room = this.roomManager.getRoom(roomId);
      if (!room) return;

      // Delegate to InputHandler for validation and queuing
      const inputHandler = room.getInputHandler();
      inputHandler.handleInput(playerId, input);

      // Handle special cases
      if (input.type === 'spawn') {
        const gameState = room.getGameState();
        const player = gameState.players.get(playerId);

        // Respawn if dead
        if (player && !player.isAlive) {
          const skinId = input.skinId; // Extract requested skin
          this.spawnSnake(socket, player, gameState, skinId);
        }
      }

    } catch (error) {
      logger.error('Error handling input', error);
    }
  }

  /**
   * Handle player disconnect
   */
  private handleDisconnect(socket: any): void {
    try {
      const playerId = socket.data.playerId;
      const roomId = socket.data.roomId;

      if (!playerId || !roomId) {
        return;
      }

      const room = this.roomManager.getRoom(roomId);
      if (!room) return;

      // Clean up input handler
      const inputHandler = room.getInputHandler();
      inputHandler.removePlayer(playerId);

      // Remove from game state
      const gameState = room.getGameState();
      gameState.removePlayer(playerId);

      logger.gameEvent('Player disconnected', {
        playerId,
        roomId
      });

      // Notify other players
      socket.to(roomId).emit(SOCKET_EVENTS.PLAYER_LEFT, {
        playerId,
        reason: 'disconnect'
      });

    } catch (error) {
      logger.error('Error handling disconnect', error);
    }
  }
}
