import { GameState } from '../core/GameState';
import { ISystem, CollisionEvent } from '../types/game.types';
import { SpatialGrid } from './SpatialGrid';
import { circlesIntersect, pointInCircle, distanceToSegmentSquared } from '../utils/math';
import { GAME_CONFIG } from '../config/game.config';
import { logger } from '../utils/logger';

/**
 * Collision system - detects collisions between snakes and food
 */
export class CollisionSystem implements ISystem {
  public name = 'CollisionSystem';
  private spatialGrid: SpatialGrid;
  private collisionEvents: CollisionEvent[] = [];

  constructor(spatialGrid: SpatialGrid) {
    this.spatialGrid = spatialGrid;
  }

  update(deltaTime: number, gameState: GameState): void {
    this.collisionEvents = [];

    // Rebuild spatial grid for this tick
    this.spatialGrid.rebuild(gameState.snakes);

    // Check snake-to-snake collisions
    this.checkSnakeCollisions(gameState);

    // Check snake-to-food collisions
    this.checkFoodCollisions(gameState);

    // Check self-collisions
    this.checkSelfCollisions(gameState);
  }

  /**
   * Check collisions between snakes
   */
  private checkSnakeCollisions(gameState: GameState): void {
    const { snakes } = gameState;

    for (const snake of snakes.values()) {
      if (!snake.isAlive) continue;

      const nearbySnakes = this.spatialGrid.getNearbySnakes(snake, snakes);
      const head = snake.getHead();

      for (const otherSnake of nearbySnakes) {
        // Check if snake's head collides with other snake's body
        const otherSegments = otherSnake.getSegments();

        for (const segment of otherSegments) {
          // Grace Period: Don't die in first 3 seconds
          if (snake.age < 3000) continue;

          if (circlesIntersect(head, head.radius, segment, segment.radius)) {
            // Collision detected!
            this.collisionEvents.push({
              type: 'snake-snake',
              snakeId: snake.id,
              targetId: otherSnake.id,
              position: { x: head.x, y: head.y },
              timestamp: Date.now()
            });

            snake.die();
            logger.gameEvent('Snake collision', {
              snake: snake.id,
              killedBy: otherSnake.id
            });
            break;
          }
        }

        if (!snake.isAlive) break;
      }
    }
  }

  /**
   * Check snake-to-food collisions
   */
  private checkFoodCollisions(gameState: GameState): void {
    const { snakes, food } = gameState;

    for (const snake of snakes.values()) {
      if (!snake.isAlive) continue;

      const head = snake.getHead();

      // Optimization: Only check food in the snake's vicinity using SpatialGrid
      // Use a grab radius + max food size to be safe
      const searchRadius = head.radius + GAME_CONFIG.FOOD_MAX_SIZE * 2;
      const nearbyFood = this.spatialGrid.getFoodInRadius(head, searchRadius, food);

      for (const foodItem of nearbyFood) {
        if (foodItem.isConsumed) continue;

        // Check head collision with forgiving radius
        const grabRadius = head.radius + foodItem.radius * 1.0;
        let eaten = pointInCircle(foodItem.position, head, grabRadius);

        // Anti-tunneling: Check collision with the last path segment as well
        if (!eaten) {
          const prevPoint = snake.getLastPathPoint();
          if (prevPoint) {
            const distSq = distanceToSegmentSquared(foodItem.position, head, prevPoint);

            if (distSq <= grabRadius * grabRadius) {
              eaten = true;
            }
          }
        }

        if (eaten) {
          // Food consumed!
          foodItem.consume();
          snake.grow(foodItem.value);

          // IMPORTANT: Remove from spatial grid immediately so other snakes don't eat it in same tick
          this.spatialGrid.removeFood(foodItem.id);

          this.collisionEvents.push({
            type: 'snake-food',
            snakeId: snake.id,
            targetId: foodItem.id,
            position: { ...foodItem.position },
            timestamp: Date.now()
          });

          // Update player score
          const player = gameState.players.get(snake.playerId);
          if (player) {
            player.addScore(foodItem.value * GAME_CONFIG.POINTS_PER_FOOD);
          }
        }
      }
    }
  }

  /**
   * Check if snakes collide with themselves
   */
  private checkSelfCollisions(gameState: GameState): void {
    const { snakes } = gameState;

    for (const snake of snakes.values()) {
      if (!snake.isAlive) continue;

      // NOTE: User requested to disable self-collision
      // if (snake.checkSelfCollision()) {
      if (false) {
        this.collisionEvents.push({
          type: 'snake-self',
          snakeId: snake.id,
          position: { ...snake.head },
          timestamp: Date.now()
        });

        snake.die();
        logger.gameEvent('Self collision', { snake: snake.id });
      }
    }
  }

  /**
   * Get collision events from this tick
   */
  getCollisionEvents(): CollisionEvent[] {
    return this.collisionEvents;
  }
}
