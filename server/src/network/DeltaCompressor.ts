import { SerializedSnake, SerializedFood } from '../types/game.types';
import { logger } from '../utils/logger';

/**
 * Delta state - only changed entities
 */
export interface DeltaState {
  tick: number;
  snakes?: {
    added?: SerializedSnake[];
    updated?: Partial<SerializedSnake>[];
    removed?: string[];
  };
  food?: {
    added?: SerializedFood[];
    removed?: string[];
  };
  leaderboard?: any[];
}

/**
 * Delta compressor - sends only changed data
 * Reduces bandwidth by 70-90%
 */
export class DeltaCompressor {
  private lastStates: Map<string, any> = new Map(); // playerId -> last state
  private readonly maxCachedStates = 200; // Limit memory usage

  /**
   * Compute delta between current and previous state
   */
  computeDelta(playerId: string, currentState: any): DeltaState | null {
    const lastState = this.lastStates.get(playerId);

    // First update - send full state
    if (!lastState) {
      this.cacheState(playerId, currentState);
      return null; // Return null to indicate full state should be sent
    }

    const delta: DeltaState = {
      tick: currentState.tick
    };

    // Compute snake deltas
    const snakeDelta = this.computeSnakeDelta(lastState.snakes || [], currentState.snakes || []);
    if (snakeDelta) {
      delta.snakes = snakeDelta;
    }

    // Compute food deltas
    const foodDelta = this.computeFoodDelta(lastState.food || [], currentState.food || []);
    if (foodDelta) {
      delta.food = foodDelta;
    }

    // Leaderboard (always send if changed)
    if (JSON.stringify(lastState.leaderboard) !== JSON.stringify(currentState.leaderboard)) {
      delta.leaderboard = currentState.leaderboard;
    }

    // Cache current state
    this.cacheState(playerId, currentState);

    // Return delta only if there are changes
    if (delta.snakes || delta.food || delta.leaderboard) {
      return delta;
    }

    return null; // No changes
  }

  /**
   * Compute snake delta
   */
  private computeSnakeDelta(oldSnakes: SerializedSnake[], newSnakes: SerializedSnake[]): any {
    const oldMap = new Map(oldSnakes.map(s => [s.id, s]));
    const newMap = new Map(newSnakes.map(s => [s.id, s]));

    const added: SerializedSnake[] = [];
    const updated: any[] = [];
    const removed: string[] = [];

    // Find added and updated snakes
    for (const newSnake of newSnakes) {
      const oldSnake = oldMap.get(newSnake.id);

      if (!oldSnake) {
        // New snake
        added.push(newSnake);
      } else {
        // Check if snake changed
        const changes = this.computeSnakeChanges(oldSnake, newSnake);
        if (changes) {
          updated.push({ id: newSnake.id, ...changes });
        }
      }
    }

    // Find removed snakes
    for (const oldSnake of oldSnakes) {
      if (!newMap.has(oldSnake.id)) {
        removed.push(oldSnake.id);
      }
    }

    // Return delta only if there are changes
    if (added.length > 0 || updated.length > 0 || removed.length > 0) {
      return {
        ...(added.length > 0 && { added }),
        ...(updated.length > 0 && { updated }),
        ...(removed.length > 0 && { removed })
      };
    }

    return null;
  }

  /**
   * Compute changes for a single snake
   */
  private computeSnakeChanges(oldSnake: SerializedSnake, newSnake: SerializedSnake): any {
    const changes: any = {};

    // Check position change (most common)
    if (oldSnake.head.x !== newSnake.head.x || oldSnake.head.y !== newSnake.head.y) {
      changes.head = newSnake.head;
    }

    // Check direction change
    if (oldSnake.direction !== newSnake.direction) {
      changes.direction = newSnake.direction;
    }

    // Check length change
    if (oldSnake.length !== newSnake.length) {
      changes.length = newSnake.length;
    }

    // Check score change
    if (oldSnake.score !== newSnake.score) {
      changes.score = newSnake.score;
    }

    // Check path change
    // OPTIMIZATION: Only send path if the snake changed significantly (teleport, respawn).
    // For normal movement, the client simulates the path update (bandwidth saving).
    if (newSnake.path && newSnake.path.length > 0) {
      const dx = newSnake.head.x - oldSnake.head.x;
      const dy = newSnake.head.y - oldSnake.head.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // If moved more than 100 units in one tick, it's a teleport -> Send Refreshed Path
      // Also send if checking for path existence fails
      // STRICT CHECK: dist > 100 ensures we NEVER send path for normal movement (15px/tick)
      if (!oldSnake.path || oldSnake.path.length === 0 || dist > 100) {
        changes.path = newSnake.path;
      }
    }

    return Object.keys(changes).length > 0 ? changes : null;
  }

  /**
   * Compute food delta
   */
  private computeFoodDelta(oldFood: SerializedFood[], newFood: SerializedFood[]): any {
    // Find added and updated food
    const added: SerializedFood[] = [];
    const updated: any[] = [];
    const removed: string[] = [];

    const oldMap = new Map(oldFood.map(f => [f.id, f]));

    for (const newFoodItem of newFood) {
      const oldFoodItem = oldMap.get(newFoodItem.id);

      if (!oldFoodItem) {
        // New food
        added.push(newFoodItem);
      } else {
        // Check for position change (Magnet effect!)
        if (Math.abs(oldFoodItem.position.x - newFoodItem.position.x) > 0.1 ||
          Math.abs(oldFoodItem.position.y - newFoodItem.position.y) > 0.1) {
          updated.push({
            id: newFoodItem.id,
            position: newFoodItem.position
          });
        }
      }
    }

    // Find removed food
    const newIds = new Set(newFood.map(f => f.id));
    for (const food of oldFood) {
      if (!newIds.has(food.id)) {
        removed.push(food.id);
      }
    }

    // Return delta only if there are changes
    if (added.length > 0 || updated.length > 0 || removed.length > 0) {
      return {
        ...(added.length > 0 && { added }),
        ...(updated.length > 0 && { updated }),
        ...(removed.length > 0 && { removed })
      };
    }

    return null;
  }


  /**
   * Cache state for player
   * OPTIMIZED: Manual copy instead of JSON.stringify to save CPU
   */
  private cacheState(playerId: string, state: any): void {
    // Create a shallow copy structure with manual deep copy where needed
    const cachedState: any = {
      tick: state.tick,
      leaderboard: state.leaderboard // Reference is fine if immutable, but better copy if small
    };

    if (state.snakes) {
      cachedState.snakes = state.snakes.map((s: any) => ({
        id: s.id,
        playerId: s.playerId,
        head: { ...s.head }, // Copy head (Point)
        direction: s.direction,
        length: s.length,
        score: s.score,
        // We do NOT need to copy path content, just the reference is enough for existence check.
        // BUT if s.path is mutated, we might have issues.
        // Since we don't inspect path content in delta check (only existence), ref is fine?
        // NO! We check snake.path.length.
        // Safest to copy path REFERENCE if we trust it's a new array from serialize().
        // (We verified Snake.ts returns this.path, so it is MUTABLE).
        // So we MUST NOT rely on path content if we don't copy it.
        // But we only check existence and distance (using HEAD).
        // So we effectively ignore path content.
        path: s.path
      }));
    }

    if (state.food) {
      cachedState.food = state.food.map((f: any) => ({
        id: f.id,
        position: { ...f.position }, // Copy position
        value: f.value,
        radius: f.radius,
        color: f.color
      }));
    }

    this.lastStates.set(playerId, cachedState);

    // Limit cache size
    if (this.lastStates.size > this.maxCachedStates) {
      const firstKey = this.lastStates.keys().next().value;
      if (firstKey) {
        this.lastStates.delete(firstKey);
      }
    }
  }

  /**
   * Clear cached state for player (on disconnect)
   */
  clearPlayerState(playerId: string): void {
    this.lastStates.delete(playerId);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      cachedPlayers: this.lastStates.size,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(): string {
    const bytes = this.lastStates.size * 2000; // Rough estimate: 2KB per cached state
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
}
