import { GameState } from '../core/GameState';
import { ISystem } from '../types/game.types';
import { Food } from '../entities/Food';
import { Snake } from '../entities/Snake';
import { randomPosition, randomId, randomElement, randomFloat } from '../utils/random';
import { GAME_CONFIG } from '../config/game.config';
import { circlesIntersect, distance } from '../utils/math';
import { logger } from '../utils/logger';

/**
 * Food system - manages food spawning, cleanup, and death-to-food conversion
 */
export class FoodSystem implements ISystem {
  public name = 'FoodSystem';
  private targetFoodCount: number;
  private deadSnakesProcessed: Set<string> = new Set();

  constructor(targetFoodCount: number = GAME_CONFIG.FOOD_COUNT) {
    this.targetFoodCount = targetFoodCount;
  }

  update(deltaTime: number, gameState: GameState): void {
    // Process dead snakes (convert to food)
    this.processDeadSnakes(gameState);

    // Apply magnet effect (food pulled to snakes)
    this.applyMagnetEffect(gameState, deltaTime);

    // Remove consumed food
    this.removeConsumedFood(gameState);

    // Spawn new food if needed
    this.spawnFood(gameState);
  }

  /**
   * Apply magnet effect: Food moves towards nearby snake heads
   */
  private applyMagnetEffect(gameState: GameState, deltaTime: number): void {
    const { snakes, food } = gameState;

    for (const snake of snakes.values()) {
      if (!snake.isAlive) continue;

      const head = snake.head;
      const magnetRadius = GAME_CONFIG.MAGNET_RADIUS;

      // Check all food items (optimization: use spatial grid in future)
      for (const foodItem of food.values()) {
        if (foodItem.isConsumed) continue;

        const dist = distance(head, foodItem.position);

        if (dist < magnetRadius) {
          // Food is inside magnet radius!
          // Exponential pull: stronger as it gets closer
          // Formula: (1 - dist/radius)^2
          const factor = 1 - (dist / magnetRadius);
          const pullStrength = factor * factor; // Quadratic ease-in for smoother start

          const maxSpeed = 600;
          const minSpeed = 50;
          const speed = minSpeed + (maxSpeed - minSpeed) * pullStrength;

          const dx = head.x - foodItem.position.x;
          const dy = head.y - foodItem.position.y;
          const angle = Math.atan2(dy, dx);

          foodItem.position.x += Math.cos(angle) * speed * deltaTime;
          foodItem.position.y += Math.sin(angle) * speed * deltaTime;
        }
      }
    }
  }

  /**
   * Convert dead snakes into food items
   * Each segment becomes a food item
   */
  private processDeadSnakes(gameState: GameState): void {
    const { snakes, food } = gameState;

    for (const snake of snakes.values()) {
      // Skip if already processed or still alive
      if (snake.isAlive || this.deadSnakesProcessed.has(snake.id)) {
        continue;
      }

      // Mark as processed
      this.deadSnakesProcessed.add(snake.id);

      // Get snake segments
      const segments = snake.getSegments();

      // Convert each segment to food (with some spacing to avoid clutter)
      const foodPerSegment = Math.max(1, Math.floor(snake.length / 20)); // More food for longer snakes
      const segmentStep = Math.max(1, Math.floor(segments.length / (segments.length * foodPerSegment)));

      let foodSpawned = 0;
      for (let i = 0; i < segments.length; i += segmentStep) {
        const segment = segments[i];

        // Create food at segment position
        const foodId = randomId('food');

        // Random visual properties for "loot" feel
        const radius = randomFloat(GAME_CONFIG.FOOD_MIN_SIZE + 2, GAME_CONFIG.FOOD_MAX_SIZE + 4);
        const color = randomElement([...GAME_CONFIG.FOOD_COLORS]);

        // Death food is worth more (based on radius)
        const foodValue = Math.max(1, Math.floor(radius * 0.5)); // Reduced value for slower growth

        const newFood = new Food(
          foodId,
          { x: segment.x, y: segment.y },
          foodValue,
          radius,
          color
        );

        food.set(foodId, newFood);
        foodSpawned++;
      }

      logger.gameEvent('Snake converted to food', {
        snakeId: snake.id,
        foodSpawned,
        snakeLength: snake.length
      });
    }

    // Cleanup processed dead snakes (remove from game state)
    this.cleanupDeadSnakes(gameState);
  }

  /**
   * Remove dead snakes from game state after processing
   */
  private cleanupDeadSnakes(gameState: GameState): void {
    const { snakes } = gameState;
    const toRemove: string[] = [];

    for (const [id, snake] of snakes.entries()) {
      if (!snake.isAlive && this.deadSnakesProcessed.has(id)) {
        toRemove.push(id);
      }
    }

    // Remove dead snakes
    for (const id of toRemove) {
      snakes.delete(id);
      this.deadSnakesProcessed.delete(id); // Clean up tracking
    }
  }

  /**
   * Remove consumed food from the game
   */
  private removeConsumedFood(gameState: GameState): void {
    const { food } = gameState;

    for (const [id, foodItem] of food.entries()) {
      if (foodItem.isConsumed) {
        food.delete(id);
      }
    }
  }

  /**
   * Spawn new food to maintain target count
   */
  private spawnFood(gameState: GameState): void {
    const { food } = gameState;
    const currentCount = food.size;
    const needed = this.targetFoodCount - currentCount;

    // Limit spawning per tick to avoid lag spikes
    const maxSpawnPerTick = 20;
    const toSpawn = Math.min(needed, maxSpawnPerTick);

    for (let i = 0; i < toSpawn; i++) {
      const position = this.findSafeSpawnPosition(gameState);
      if (position) {
        const foodId = randomId('food');
        const radius = randomFloat(GAME_CONFIG.FOOD_MIN_SIZE, GAME_CONFIG.FOOD_MAX_SIZE);
        const color = randomElement([...GAME_CONFIG.FOOD_COLORS]);

        // Scale value with radius
        const value = 1; // Basic food always 1 value for consistency

        const newFood = new Food(
          foodId,
          position,
          value,
          radius,
          color
        );

        food.set(foodId, newFood);
      }
    }
  }

  /**
   * Find a safe position to spawn food (not on snakes)
   */
  private findSafeSpawnPosition(gameState: GameState, maxAttempts: number = 10): { x: number; y: number } | null {
    const { worldSize, snakes } = gameState;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const position = randomPosition(worldSize, 50);
      let isSafe = true;

      // Quick check: only check snake heads (optimization)
      for (const snake of snakes.values()) {
        if (!snake.isAlive) continue;

        const head = snake.head;
        const dx = position.x - head.x;
        const dy = position.y - head.y;
        const distSq = dx * dx + dy * dy;
        const minDist = 100; // Minimum distance from snake head

        if (distSq < minDist * minDist) {
          isSafe = false;
          break;
        }
      }

      if (isSafe) {
        return position;
      }
    }

    // If we couldn't find a safe position, just return a random one
    return randomPosition(worldSize, 50);
  }

  /**
   * Set target food count
   */
  setTargetFoodCount(count: number): void {
    this.targetFoodCount = count;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      deadSnakesProcessed: this.deadSnakesProcessed.size
    };
  }
}
