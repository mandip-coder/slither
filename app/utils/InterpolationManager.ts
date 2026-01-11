/**
 * Client-side interpolation system for smooth multiplayer movement
 * Handles packet loss, smooths remote players, prevents rubber-banding
 */

interface Point {
  x: number;
  y: number;
}

interface SnakeSnapshot {
  tick: number;
  timestamp: number;
  head: Point;
  direction: number;
  length: number;
  path?: Point[]; // Add path
  name?: string;
}

interface InterpolatedSnake {
  id: string;
  snapshots: SnakeSnapshot[];
  currentHead: Point;
  currentDirection: number;
  currentLength: number;
  renderDelay: number; // ms behind server
  path: Point[]; // Add path
  name?: string;
}

export class InterpolationManager {
  private snakes: Map<string, InterpolatedSnake> = new Map();
  private readonly bufferSize = 3; // Keep last 3 snapshots
  private readonly renderDelay = 100; // 100ms behind server (2 updates @ 20Hz)
  private readonly maxSnapAge = 500; // Discard snapshots older than 500ms
  private readonly snapThreshold = 200; // Snap if >200 pixels away

  /**
   * Add a new snapshot from server
   */
  addSnapshot(snakeId: string, snapshot: SnakeSnapshot): void {
    let snake = this.snakes.get(snakeId);

    if (!snake) {
      // New snake - initialize
      snake = {
        id: snakeId,
        snapshots: [],
        currentHead: { ...snapshot.head },
        currentDirection: snapshot.direction,
        currentLength: snapshot.length,
        renderDelay: this.renderDelay,
        path: snapshot.path ? [...snapshot.path] : [],
        name: snapshot.name
      };
      this.snakes.set(snakeId, snake);
    }

    // Add snapshot to buffer
    snake.snapshots.push(snapshot);

    // Sort by timestamp (oldest first)
    snake.snapshots.sort((a, b) => a.timestamp - b.timestamp);

    // Limit buffer size
    if (snake.snapshots.length > this.bufferSize + 2) {
      snake.snapshots.shift();
    }

    // Clean old snapshots
    this.cleanOldSnapshots(snake);
  }

  /**
   * Update interpolated positions
   */
  update(currentTime: number): void {
    for (const snake of this.snakes.values()) {
      this.interpolateSnake(snake, currentTime);
    }
  }

  /**
   * Interpolate snake position
   */
  private interpolateSnake(snake: InterpolatedSnake, currentTime: number): void {
    const renderTime = currentTime - snake.renderDelay;
    const prevHead = { ...snake.currentHead };

    // Find two snapshots to interpolate between
    let before: SnakeSnapshot | null = null;
    let after: SnakeSnapshot | null = null;

    for (let i = 0; i < snake.snapshots.length - 1; i++) {
      if (
        snake.snapshots[i].timestamp <= renderTime &&
        snake.snapshots[i + 1].timestamp >= renderTime
      ) {
        before = snake.snapshots[i];
        after = snake.snapshots[i + 1];
        break;
      }
    }

    // No valid snapshots - use latest or extrapolate
    if (!before || !after) {
      if (snake.snapshots.length > 0) {
        const latest = snake.snapshots[snake.snapshots.length - 1];

        // Check if we should snap
        const dist = this.distance(snake.currentHead, latest.head);
        if (dist > this.snapThreshold) {
          // Snap to latest position
          snake.currentHead = { ...latest.head };
          snake.currentDirection = latest.direction;
          snake.currentLength = latest.length;
          // Reset path on snap
          if (latest.path) snake.path = [...latest.path];
        } else {
          // Extrapolate (predict forward)
          this.extrapolate(snake, latest, currentTime);
        }
      }
    } else {
      // Interpolate between snapshots
      const t = (renderTime - before.timestamp) / (after.timestamp - before.timestamp);
      const smoothT = this.smoothstep(t); // Smooth interpolation

      // Interpolate position
      snake.currentHead.x = this.lerp(before.head.x, after.head.x, smoothT);
      snake.currentHead.y = this.lerp(before.head.y, after.head.y, smoothT);

      // Interpolate direction (shortest path)
      snake.currentDirection = this.lerpAngle(before.direction, after.direction, smoothT);

      // Interpolate length (instant for now, could smooth)
      snake.currentLength = after.length;
    }

    // UPDATE PATH HISTORY
    // Only add point if moved enough
    const moveDist = this.distance(prevHead, snake.currentHead);
    if (moveDist > 2) { // Match server resolution (approx)
      snake.path.push({ ...snake.currentHead });
      this.maintainPathLength(snake);
    }
  }

  /**
   * Maintain path length based on snake length
   */
  private maintainPathLength(snake: InterpolatedSnake): void {
    // Simple safety limit first
    if (snake.path.length > 2000) {
      snake.path.shift();
    }

    // Distance-based trimming (Smooth tail)
    // Calculate total path length
    let totalDist = 0;
    const spacing = 5; // Default spacing
    const maxPathLen = snake.currentLength * spacing;

    // We iterate from HEAD (end) backwards
    let trimIndex = 0;
    for (let i = snake.path.length - 1; i > 0; i--) {
      totalDist += this.distance(snake.path[i], snake.path[i - 1]);
      if (totalDist > maxPathLen) {
        trimIndex = i;
        break;
      }
    }

    if (trimIndex > 0) {
      snake.path = snake.path.slice(trimIndex);
    }
  }

  /**
   * Extrapolate position when no future snapshot available
   */
  private extrapolate(snake: InterpolatedSnake, latest: SnakeSnapshot, currentTime: number): void {
    const timeSinceSnapshot = currentTime - latest.timestamp;

    // Don't extrapolate too far (max 100ms)
    if (timeSinceSnapshot > 100) {
      return;
    }

    // Predict forward based on direction and speed
    const speed = 150; // pixels per second (match server)
    const distance = (speed * timeSinceSnapshot) / 1000;

    snake.currentHead.x += Math.cos(latest.direction) * distance;
    snake.currentHead.y += Math.sin(latest.direction) * distance;
    snake.currentDirection = latest.direction;
  }

  /**
   * Clean old snapshots
   */
  private cleanOldSnapshots(snake: InterpolatedSnake): void {
    const now = Date.now();
    snake.snapshots = snake.snapshots.filter(
      s => now - s.timestamp < this.maxSnapAge
    );
  }

  /**
   * Get interpolated snake data
   */
  getSnake(snakeId: string): InterpolatedSnake | undefined {
    return this.snakes.get(snakeId);
  }

  /**
   * Remove snake
   */
  removeSnake(snakeId: string): void {
    this.snakes.delete(snakeId);
  }

  /**
   * Linear interpolation
   */
  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /**
   * Angle interpolation (shortest path)
   */
  private lerpAngle(from: number, to: number, t: number): number {
    let diff = to - from;

    // Normalize to [-PI, PI]
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;

    return from + diff * t;
  }

  /**
   * Smoothstep interpolation (ease in/out)
   */
  private smoothstep(t: number): number {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
  }

  /**
   * Distance between two points
   */
  private distance(a: Point, b: Point): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      snakeCount: this.snakes.size,
      avgBufferSize: this.getAverageBufferSize(),
      renderDelay: this.renderDelay
    };
  }

  /**
   * Get average buffer size
   */
  private getAverageBufferSize(): number {
    if (this.snakes.size === 0) return 0;

    let total = 0;
    for (const snake of this.snakes.values()) {
      total += snake.snapshots.length;
    }
    return total / this.snakes.size;
  }
}
