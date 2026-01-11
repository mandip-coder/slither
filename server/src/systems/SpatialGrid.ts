import { Point } from '../types/game.types';
import { Snake } from '../entities/Snake';
import { PERFORMANCE_CONFIG } from '../config/performance.config';

/**
 * Spatial grid for efficient collision detection
 * Divides the world into cells and tracks which snakes are in which cells
 */
export class SpatialGrid {
  private cellSize: number;
  private grid: Map<string, Set<string>>; // cellKey -> Set of snake IDs
  private snakePositions: Map<string, string[]>; // snakeId -> cellKeys it occupies

  constructor(cellSize: number = PERFORMANCE_CONFIG.SPATIAL_GRID_CELL_SIZE) {
    this.cellSize = cellSize;
    this.grid = new Map();
    this.snakePositions = new Map();
  }

  /**
   * Get cell key for a position
   */
  private getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  /**
   * Get all cell keys that a snake occupies
   */
  private getSnakeCells(snake: Snake): string[] {
    const cells = new Set<string>();
    const segments = snake.getSegments();

    for (const segment of segments) {
      cells.add(this.getCellKey(segment.x, segment.y));
    }

    return Array.from(cells);
  }

  /**
   * Rebuild the entire grid (called every tick)
   */
  rebuild(snakes: Map<string, Snake>): void {
    // Clear previous grid
    this.grid.clear();
    this.snakePositions.clear();

    // Add all snakes to grid
    for (const snake of snakes.values()) {
      if (!snake.isAlive) continue;

      const cells = this.getSnakeCells(snake);
      this.snakePositions.set(snake.id, cells);

      for (const cellKey of cells) {
        if (!this.grid.has(cellKey)) {
          this.grid.set(cellKey, new Set());
        }
        this.grid.get(cellKey)!.add(snake.id);
      }
    }
  }

  /**
   * Get nearby snakes for collision detection
   */
  getNearbySnakes(snake: Snake, allSnakes: Map<string, Snake>): Snake[] {
    const nearby: Snake[] = [];
    const head = snake.getHead();

    // Check 3x3 grid around snake's head
    const centerCellKey = this.getCellKey(head.x, head.y);
    const [centerX, centerY] = centerCellKey.split(',').map(Number);

    const checkedSnakes = new Set<string>();

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const cellKey = `${centerX + dx},${centerY + dy}`;
        const snakeIds = this.grid.get(cellKey);

        if (snakeIds) {
          for (const snakeId of snakeIds) {
            if (snakeId !== snake.id && !checkedSnakes.has(snakeId)) {
              const otherSnake = allSnakes.get(snakeId);
              if (otherSnake && otherSnake.isAlive) {
                nearby.push(otherSnake);
                checkedSnakes.add(snakeId);
              }
            }
          }
        }
      }
    }

    return nearby;
  }

  /**
   * Get snakes within a radius of a point
   */
  getSnakesInRadius(position: Point, radius: number, allSnakes: Map<string, Snake>): Snake[] {
    const nearby: Snake[] = [];

    // Calculate cell range
    const minCellX = Math.floor((position.x - radius) / this.cellSize);
    const maxCellX = Math.floor((position.x + radius) / this.cellSize);
    const minCellY = Math.floor((position.y - radius) / this.cellSize);
    const maxCellY = Math.floor((position.y + radius) / this.cellSize);

    const checkedSnakes = new Set<string>();

    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
        const cellKey = `${cellX},${cellY}`;
        const snakeIds = this.grid.get(cellKey);

        if (snakeIds) {
          for (const snakeId of snakeIds) {
            if (!checkedSnakes.has(snakeId)) {
              const snake = allSnakes.get(snakeId);
              if (snake && snake.isAlive) {
                nearby.push(snake);
                checkedSnakes.add(snakeId);
              }
            }
          }
        }
      }
    }

    return nearby;
  }

  /**
   * Get statistics about the grid
   */
  getStats() {
    const cellCount = this.grid.size;
    const snakeCounts = Array.from(this.grid.values()).map(set => set.size);
    const avgSnakesPerCell = snakeCounts.length > 0
      ? snakeCounts.reduce((a, b) => a + b, 0) / snakeCounts.length
      : 0;
    const maxSnakesPerCell = snakeCounts.length > 0 ? Math.max(...snakeCounts) : 0;

    return {
      cellCount,
      avgSnakesPerCell: avgSnakesPerCell.toFixed(2),
      maxSnakesPerCell
    };
  }
}
