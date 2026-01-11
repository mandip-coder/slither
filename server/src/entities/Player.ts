export class Player {
  public id: string;
  public socketId: string;
  public name: string;
  public score: number;
  public isAlive: boolean;
  public snakeId: string | null;
  public joinedAt: number;
  public lastInputTime: number;

  constructor(id: string, socketId: string, name: string) {
    this.id = id;
    this.socketId = socketId;
    this.name = name;
    this.score = 0;
    this.isAlive = false;
    this.snakeId = null;
    this.joinedAt = Date.now();
    this.lastInputTime = Date.now();
  }

  /**
   * Update player score
   */
  addScore(points: number): void {
    this.score += points;
  }

  /**
   * Set player's snake
   */
  setSnake(snakeId: string): void {
    this.snakeId = snakeId;
    this.isAlive = true;
  }

  /**
   * Remove player's snake (on death)
   */
  removeSnake(): void {
    this.snakeId = null;
    this.isAlive = false;
  }

  /**
   * Update last input time (for rate limiting)
   */
  updateInputTime(): void {
    this.lastInputTime = Date.now();
  }

  /**
   * Check if player can send input (rate limiting)
   */
  canSendInput(maxRate: number): boolean {
    const now = Date.now();
    const timeSinceLastInput = now - this.lastInputTime;
    const minInterval = 1000 / maxRate;
    return timeSinceLastInput >= minInterval;
  }

  /**
   * Serialize player for network transmission
   */
  serialize() {
    return {
      id: this.id,
      name: this.name,
      score: this.score,
      isAlive: this.isAlive
    };
  }
}
