import { Point, SerializedSnake } from '../types/game.types';
import { GAME_CONFIG } from '../config/game.config';
import { circlesIntersect } from '../utils/math';

export class Snake {
  // ============================================
  public id: string;
  public playerId: string;
  public name: string;
  public head: Point;
  public direction: number;
  public targetDirection: number;
  public length: number;
  public speed: number;
  public color: string;
  public skinId: string;
  public isAlive: boolean;
  public spawnTime: number;

  get age(): number {
    return Date.now() - this.spawnTime;
  }

  // PATH-BASED MOVEMENT (CORE)
  private path: Point[] = [];
  private readonly segmentDistance = GAME_CONFIG.SEGMENT_SPACING; // Fixed distance between body segments
  private readonly maxLength = 500;
  private segmentsDirty: boolean = true;
  private cachedSegments: Array<Point & { radius: number }> = [];

  constructor(
    id: string,
    playerId: string,
    name: string,
    position: Point,
    direction: number,
    color: string,
    skinId: string = 'neon-green'
  ) {
    this.id = id;
    this.playerId = playerId;
    this.name = name;
    this.head = { ...position };
    this.direction = direction;
    this.targetDirection = direction;
    this.length = GAME_CONFIG.INITIAL_SNAKE_LENGTH;
    this.speed = GAME_CONFIG.SNAKE_SPEED;
    this.color = color;
    this.skinId = skinId;
    this.isAlive = true;
    this.spawnTime = Date.now();

    // Initialize path with initial body length
    // Create path points going backwards from head
    // Path structure: [tail...body...head] (head at END, consistent with movement)
    for (let i = this.length - 1; i >= 0; i--) {
      const distance = i * this.segmentDistance;
      const x = position.x - Math.cos(direction) * distance;
      const y = position.y - Math.sin(direction) * distance;
      this.path.push({ x, y }); // Add to END (head will be last)
    }
  }

  /**
   * Set boosting state
   */
  setBoosting(isBoosting: boolean): void {
    // Can only boost if enough length
    if (isBoosting && this.length > 5) {
      this.isBoosting = true;
    } else {
      this.isBoosting = false;
    }
  }

  public isBoosting: boolean = false;

  /**
   * Move snake forward (called every tick)
   */
  move(deltaTime: number): void {
    if (!this.isAlive) return;

    // Handle Boost Physics
    let currentSpeed = this.speed;
    if (this.isBoosting) {
      if (this.length > 10) {
        currentSpeed = this.speed * 2.0; // Double speed

        // Consume mass (lose length)
        // Lose 1 segment every 0.3 seconds (approx)
        if (Date.now() % 300 < 50) {
          // Simple probabilistic check for now, can be improved with accumulator
          // Ideally use a 'massBurnAccumulator'
          this.length = Math.max(10, this.length - 0.2);
          this.segmentsDirty = true;
        }
      } else {
        this.isBoosting = false; // Stop boosting if too small
      }
    }

    // STEP 1: Smooth angle interpolation (NO SNAPPING)
    const angleDiff = this.angleDifference(this.direction, this.targetDirection);
    // Turning is slower when boosting? (Optional balance tweak, keeping same for now)
    const turnAmount = Math.max(-0.15, Math.min(0.15, angleDiff));
    this.direction = this.normalizeAngle(this.direction + turnAmount);

    // STEP 2: Move head forward
    const distance = currentSpeed * deltaTime;

    // Sub-steps for smoother curves during turns
    // If we moved too far in one tick (e.g. > 5px), break it down
    // This prevents "jagged" polygon looking turns
    const maxStepSize = 4;
    const steps = Math.ceil(distance / maxStepSize);
    const stepDist = distance / steps;
    const stepTurn = turnAmount / steps;

    // Execute sub-steps
    for (let i = 0; i < steps; i++) {
      // Incrementally turn
      this.direction = this.normalizeAngle(this.direction + stepTurn);

      // Incrementally move
      this.head.x += Math.cos(this.direction) * stepDist;
      this.head.y += Math.sin(this.direction) * stepDist;

      // Capture path points during the move to preserve curve shape
      this.appendToPath();
    }

    // STEP 4: Trim path to maintain snake length
    this.trimPathByDistance();

    // Mark segments as dirty
    this.segmentsDirty = true;
  }

  /**
   * Append current head position to path
   */
  private appendToPath(): void {
    const lastPoint = this.path[this.path.length - 1];
    const dist = this.distance(this.head, lastPoint);

    // KEY FIX: Resolution of the path
    // Changed from 3 to 2 to ensure point is added EVERY TICK at 2.5px speed
    // This solves the 30Hz vs 60Hz aliasing causing "Rigid Stick" jitter
    if (dist >= 2) {
      this.path.push({ ...this.head });

      // Limit path array size for performance
      // Increased from 500 to 2000 because we are adding points 2x faster
      if (this.path.length > 2000) {
        this.path.shift();
      }
    }
  }

  /**
   * Trim path to maintain snake length by DISTANCE, not index
   */
  private trimPathByDistance(): void {
    const maxPathLength = this.length * this.segmentDistance;
    let totalDistance = 0;
    let trimIndex = 0;

    // Calculate total path distance from head backwards
    for (let i = this.path.length - 1; i > 0; i--) {
      const p1 = this.path[i];
      const p2 = this.path[i - 1];
      const segmentLength = this.distance(p1, p2);

      totalDistance += segmentLength;

      if (totalDistance >= maxPathLength) {
        trimIndex = i;
        break;
      }
    }

    // Remove old path points immediately when they exceed target length
    // This prevents accumulation and sudden "snapping" of length
    if (trimIndex > 0) {
      this.path = this.path.slice(trimIndex);
    }
  }

  /**
   * Get body segments by sampling path at FIXED DISTANCES
   * This is the key to organic movement!
   */
  getSegments(): Array<Point & { radius: number }> {
    if (!this.segmentsDirty && this.cachedSegments.length > 0) {
      return this.cachedSegments;
    }

    const segments: Array<Point & { radius: number }> = [];
    const targetDistance = this.segmentDistance;
    let currentDistance = 0;

    // Start from head
    const headRadius = GAME_CONFIG.SEGMENT_RADIUS + 2;
    segments.push({ ...this.head, radius: headRadius });

    // Walk backwards along path, sampling at fixed distances
    for (let i = this.path.length - 1; i > 0 && segments.length < this.length; i--) {
      const p1 = this.path[i];
      const p2 = this.path[i - 1];
      const segmentLength = this.distance(p1, p2);

      // Sample points on this path segment
      while (currentDistance + segmentLength >= targetDistance && segments.length < this.length) {
        const remainingDist = targetDistance - currentDistance;
        const t = remainingDist / segmentLength;

        // Interpolate point on path segment
        const point = {
          x: p1.x + (p2.x - p1.x) * t,
          y: p1.y + (p2.y - p1.y) * t,
          radius: GAME_CONFIG.SEGMENT_RADIUS
        };

        segments.push(point);
        currentDistance = 0;
      }

      currentDistance += segmentLength;
    }

    this.cachedSegments = segments;
    this.segmentsDirty = false;

    return segments;
  }

  /**
   * Get head position
   */
  getHead(): Point & { radius: number } {
    return {
      ...this.head,
      radius: GAME_CONFIG.SEGMENT_RADIUS + 2
    };
  }

  /**
   * Check self-collision
   */
  checkSelfCollision(): boolean {
    const head = this.getHead();
    const segments = this.getSegments();

    // Check head against body (skip first few segments near head)
    for (let i = 5; i < segments.length; i++) {
      if (circlesIntersect(head, head.radius, segments[i], segments[i].radius)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Grow snake
   */
  grow(amount: number = 1): void {
    this.length = Math.min(this.length + amount, this.maxLength);
    this.segmentsDirty = true;
  }

  /**
   * Change target direction (smooth interpolation)
   */
  changeDirection(newDirection: number): void {
    this.targetDirection = this.normalizeAngle(newDirection);
  }

  /**
   * Kill snake
   */
  die(): void {
    this.isAlive = false;
  }

  /**
   * Serialize for network transmission
   */
  serialize(): SerializedSnake {
    return {
      id: this.id,
      playerId: this.playerId,
      head: this.head,
      direction: this.direction,
      length: this.length,
      color: this.color,
      skinId: this.skinId,
      isBoosting: this.isBoosting,
      score: Math.floor(this.length * 10), // Ensure integer score
      // Send FULL path (trimmed by trimPathByDistance) so client can render full length
      // Previously limited to 50, which broke rendering for long snakes
      path: this.path,
      name: this.name
    };
  }

  /**
   * Get the last point in the path (used for collision detection)
   */
  getLastPathPoint(): Point | undefined {
    return this.path.length > 0 ? this.path[this.path.length - 1] : undefined;
  }

  // Helper methods
  private distance(p1: Point, p2: Point): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private angleDifference(from: number, to: number): number {
    let diff = to - from;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return diff;
  }

  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }
}
