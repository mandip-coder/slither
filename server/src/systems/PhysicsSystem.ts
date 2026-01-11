import { GameState } from '../core/GameState';
import { ISystem } from '../types/game.types';
import { wrap } from '../utils/math';
import { GAME_CONFIG } from '../config/game.config';

/**
 * Physics system - handles snake movement
 */
export class PhysicsSystem implements ISystem {
  public name = 'PhysicsSystem';

  update(deltaTime: number, gameState: GameState): void {
    const { snakes, worldSize } = gameState;

    for (const snake of snakes.values()) {
      if (!snake.isAlive) continue;

      // Move snake
      snake.move(deltaTime);

      // Handle world boundaries (wrap around)
      this.handleWorldBoundaries(snake, worldSize.width, worldSize.height);
    }
  }

  /**
   * Handle world boundaries - wrap around to opposite side
   */
  /**
   * Handle world boundaries - KILL snake if it hits game boundary
   */
  private handleWorldBoundaries(snake: any, worldWidth: number, worldHeight: number): void {
    const head = snake.head;
    const centerX = worldWidth / 2;
    const centerY = worldHeight / 2;
    const radius = GAME_CONFIG.MAP_RADIUS;

    // Check distance from center
    const dx = head.x - centerX;
    const dy = head.y - centerY;
    const distSq = dx * dx + dy * dy;

    // Die if outside circle
    if (distSq > radius * radius) {
      snake.die();
    }
  }
}
