import { Point } from '../types/game.types';
import { GAME_CONFIG } from '../config/game.config';

export class Food {
  public id: string;
  public position: Point;
  public value: number;
  public radius: number;
  public color: string;
  public isConsumed: boolean;

  constructor(
    id: string,
    position: Point,
    value: number = GAME_CONFIG.FOOD_VALUE,
    radius: number = GAME_CONFIG.FOOD_RADIUS,
    color: string = '#ffffff'
  ) {
    this.id = id;
    this.position = { ...position };
    this.value = value;
    this.radius = radius;
    this.color = color;
    this.isConsumed = false;
  }

  /**
   * Mark food as consumed
   */
  consume(): void {
    this.isConsumed = true;
  }

  /**
   * Serialize food for network transmission
   */
  serialize() {
    return {
      id: this.id,
      position: this.position,
      value: this.value,
      radius: this.radius,
      color: this.color
    };
  }
}
