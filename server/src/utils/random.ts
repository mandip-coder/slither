import { Point, WorldSize } from '../types/game.types';

/**
 * Generate random integer between min (inclusive) and max (exclusive)
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min)) + min;
}

/**
 * Generate random float between min and max
 */
export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Generate random position within world bounds
 */
export function randomPosition(worldSize: WorldSize, margin: number = 100): Point {
  const radius = (worldSize.width / 2) - margin;
  const angle = Math.random() * Math.PI * 2;
  // Use sqrt for uniform distribution in circle
  const r = radius * Math.sqrt(Math.random());

  return {
    x: worldSize.width / 2 + r * Math.cos(angle),
    y: worldSize.height / 2 + r * Math.sin(angle)
  };
}

/**
 * Generate random angle in radians
 */
export function randomAngle(): number {
  return randomFloat(0, Math.PI * 2);
}

/**
 * Generate random color in hex format
 */
export function randomColor(): string {
  const hue = randomInt(0, 360);
  const saturation = randomInt(60, 100);
  const lightness = randomInt(45, 65);
  return hslToHex(hue, saturation, lightness);
}

/**
 * Generate vibrant random color (for snakes)
 */
export function randomVibrantColor(): string {
  const colors = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#FFA07A', // Light Salmon
    '#98D8C8', // Mint
    '#F7DC6F', // Yellow
    '#BB8FCE', // Purple
    '#85C1E2', // Sky Blue
    '#F8B739', // Orange
    '#52C41A', // Green
    '#FF85C0', // Pink
    '#95E1D3'  // Aqua
  ];
  return colors[randomInt(0, colors.length)];
}

/**
 * Convert HSL to Hex color
 */
function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Generate random ID
 */
export function randomId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 9);
  return prefix ? `${prefix}-${timestamp}-${randomPart}` : `${timestamp}-${randomPart}`;
}

/**
 * Pick random element from array
 */
export function randomElement<T>(array: T[]): T {
  return array[randomInt(0, array.length)];
}

/**
 * Shuffle array in place (Fisher-Yates)
 */
export function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
