import { GameState } from '../core/GameState';
import { InputCommand } from '../types/network.types';
import { validateInputCommand } from '../utils/validation';
import { NETWORK_CONFIG } from '../config/network.config';
import { logger } from '../utils/logger';

/**
 * Input handler - validates and queues client inputs
 * Prevents cheating through input validation and rate limiting
 */
export class InputHandler {
  private inputQueue: Map<string, InputCommand[]> = new Map();
  private lastInputTime: Map<string, number> = new Map();

  /**
   * Handle input from client
   * Returns true if input was accepted, false if rejected
   */
  handleInput(playerId: string, input: InputCommand): boolean {
    // Validate input structure
    if (!validateInputCommand(input)) {
      logger.warn('Invalid input command', { playerId, input });
      return false;
    }

    // Rate limiting
    if (!this.checkRateLimit(playerId)) {
      logger.debug('Rate limit exceeded', { playerId });
      return false;
    }

    // Timestamp validation (prevent old/future inputs)
    if (!this.validateTimestamp(input.timestamp)) {
      logger.debug('Invalid timestamp', {
        playerId,
        timestamp: input.timestamp,
        now: Date.now()
      });
      return false;
    }

    // Add to queue
    if (!this.inputQueue.has(playerId)) {
      this.inputQueue.set(playerId, []);
    }

    const queue = this.inputQueue.get(playerId)!;

    // Limit queue size to prevent memory issues
    if (queue.length >= NETWORK_CONFIG.INPUT_BUFFER_SIZE) {
      queue.shift(); // Remove oldest
    }

    queue.push(input);
    this.lastInputTime.set(playerId, Date.now());

    return true;
  }

  /**
   * Process all queued inputs for a player
   */
  processPlayerInputs(playerId: string, gameState: GameState): void {
    const queue = this.inputQueue.get(playerId);
    if (!queue || queue.length === 0) return;

    const snake = gameState.getSnakeByPlayerId(playerId);
    if (!snake || !snake.isAlive) {
      this.clearQueue(playerId);
      return;
    }

    // Process all queued inputs
    for (const input of queue) {
      switch (input.type) {
        case 'direction-change':
          if (input.direction !== undefined) {
            snake.changeDirection(input.direction);
          }
          break;

        case 'boost':
          if (input.isBoosting !== undefined) {
            snake.setBoosting(input.isBoosting);
          }
          break;
      }
    }

    // Clear processed inputs
    this.clearQueue(playerId);
  }

  /**
   * Process all inputs for all players
   * Called at the beginning of each game tick
   */
  processAllInputs(gameState: GameState): void {
    for (const playerId of this.inputQueue.keys()) {
      this.processPlayerInputs(playerId, gameState);
    }
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(playerId: string): boolean {
    const lastTime = this.lastInputTime.get(playerId) || 0;
    const now = Date.now();
    const timeSinceLastInput = now - lastTime;
    const minInterval = 1000 / NETWORK_CONFIG.MAX_INPUT_RATE;

    return timeSinceLastInput >= minInterval;
  }

  /**
   * Validate input timestamp
   * Rejects inputs that are too old or in the future
   */
  private validateTimestamp(timestamp: number): boolean {
    const now = Date.now();
    const diff = Math.abs(now - timestamp);

    // Reject if more than 5 seconds old or in future
    return diff <= 5000;
  }

  /**
   * Clear input queue for player
   */
  clearQueue(playerId: string): void {
    this.inputQueue.set(playerId, []);
  }

  /**
   * Remove player from input handler
   * Called on disconnect
   */
  removePlayer(playerId: string): void {
    this.inputQueue.delete(playerId);
    this.lastInputTime.delete(playerId);
  }

  /**
   * Get queue size for debugging
   */
  getQueueSize(playerId: string): number {
    return this.inputQueue.get(playerId)?.length || 0;
  }

  /**
   * Get total queued inputs across all players
   */
  getTotalQueuedInputs(): number {
    let total = 0;
    for (const queue of this.inputQueue.values()) {
      total += queue.length;
    }
    return total;
  }
}
