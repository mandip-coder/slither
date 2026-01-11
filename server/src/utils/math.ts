import { Point } from '../types/game.types';

/**
 * Calculate Euclidean distance between two points
 */
export function distance(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate squared distance (faster, use when you only need comparison)
 */
export function distanceSquared(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy;
}

/**
 * Normalize a vector to unit length
 */
export function normalize(vector: Point): Point {
  const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
  if (length === 0) return { x: 0, y: 0 };
  return {
    x: vector.x / length,
    y: vector.y / length
  };
}

/**
 * Calculate angle between two points in radians
 */
export function angleBetween(from: Point, to: Point): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation between two values
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Linear interpolation between two points
 */
export function lerpPoint(a: Point, b: Point, t: number): Point {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t)
  };
}

/**
 * Wrap a value within bounds (for toroidal world)
 */
export function wrap(value: number, min: number, max: number): number {
  const range = max - min;
  if (value < min) return max - (min - value) % range;
  if (value > max) return min + (value - max) % range;
  return value;
}

/**
 * Calculate point at distance along direction
 */
export function pointAtDistance(start: Point, direction: number, distance: number): Point {
  return {
    x: start.x + Math.cos(direction) * distance,
    y: start.y + Math.sin(direction) * distance
  };
}

/**
 * Normalize angle to range [-PI, PI]
 */
export function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

/**
 * Calculate shortest angular difference
 */
export function angleDifference(a: number, b: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return diff;
}

/**
 * Check if point is within circle
 */
export function pointInCircle(point: Point, center: Point, radius: number): boolean {
  return distanceSquared(point, center) <= radius * radius;
}

/**
 * Check if two circles intersect
 */
export function circlesIntersect(
  center1: Point,
  radius1: number,
  center2: Point,
  radius2: number
): boolean {
  const minDistance = radius1 + radius2;
  return distanceSquared(center1, center2) <= minDistance * minDistance;
}

/**
 * Calculate squared distance from point to line segment
 */
export function distanceToSegmentSquared(p: Point, v: Point, w: Point): number {
  const l2 = distanceSquared(v, w);
  if (l2 === 0) return distanceSquared(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return distanceSquared(p, {
    x: v.x + t * (w.x - v.x),
    y: v.y + t * (w.y - v.y)
  });
}
