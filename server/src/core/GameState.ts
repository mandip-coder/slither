import { Snake } from '../entities/Snake';
import { Food } from '../entities/Food';
import { Player } from '../entities/Player';
import { WorldSize } from '../types/game.types';
import { GAME_CONFIG } from '../config/game.config';

/**
 * Authoritative game state
 * Single source of truth for all game entities
 */
export class GameState {
  public snakes: Map<string, Snake>;
  public food: Map<string, Food>;
  public players: Map<string, Player>;
  public worldSize: WorldSize;
  public currentTick: number;
  public startTime: number;

  constructor() {
    this.snakes = new Map();
    this.food = new Map();
    this.players = new Map();
    this.worldSize = {
      width: GAME_CONFIG.WORLD_WIDTH,
      height: GAME_CONFIG.WORLD_HEIGHT
    };
    this.currentTick = 0;
    this.startTime = Date.now();
  }

  /**
   * Add a player to the game
   */
  addPlayer(player: Player): void {
    this.players.set(player.id, player);
  }

  /**
   * Remove a player from the game
   */
  removePlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (player && player.snakeId) {
      this.snakes.delete(player.snakeId);
    }
    this.players.delete(playerId);
  }

  /**
   * Add a snake to the game
   */
  addSnake(snake: Snake): void {
    this.snakes.set(snake.id, snake);

    const player = this.players.get(snake.playerId);
    if (player) {
      player.setSnake(snake.id);
    }
  }

  /**
   * Remove a snake from the game
   */
  removeSnake(snakeId: string): void {
    const snake = this.snakes.get(snakeId);
    if (snake) {
      const player = this.players.get(snake.playerId);
      if (player) {
        player.removeSnake();
      }
    }
    this.snakes.delete(snakeId);
  }

  /**
   * Add food to the game
   */
  addFood(food: Food): void {
    this.food.set(food.id, food);
  }

  /**
   * Remove food from the game
   */
  removeFood(foodId: string): void {
    this.food.delete(foodId);
  }

  /**
   * Get player by socket ID
   */
  getPlayerBySocketId(socketId: string): Player | undefined {
    for (const player of this.players.values()) {
      if (player.socketId === socketId) {
        return player;
      }
    }
    return undefined;
  }

  /**
   * Get snake by player ID
   */
  getSnakeByPlayerId(playerId: string): Snake | undefined {
    for (const snake of this.snakes.values()) {
      if (snake.playerId === playerId) {
        return snake;
      }
    }
    return undefined;
  }

  /**
   * Get game statistics
   */
  getStats() {
    return {
      tick: this.currentTick,
      uptime: Date.now() - this.startTime,
      players: this.players.size,
      snakes: this.snakes.size,
      aliveSnakes: Array.from(this.snakes.values()).filter(s => s.isAlive).length,
      food: this.food.size
    };
  }

  /**
   * Increment tick counter
   */
  incrementTick(): void {
    this.currentTick++;
  }
}
