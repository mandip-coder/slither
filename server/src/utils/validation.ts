import { InputCommand } from '../types/network.types';

/**
 * Validate player name
 */
export function validatePlayerName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  if (name.length < 1 || name.length > 20) return false;
  // Allow alphanumeric, spaces, and basic punctuation
  return /^[a-zA-Z0-9 _-]+$/.test(name);
}

/**
 * Sanitize player name
 */
export function sanitizePlayerName(name: string): string {
  return name.trim().substring(0, 20);
}

/**
 * Validate direction angle
 */
export function validateDirection(direction: number): boolean {
  return typeof direction === 'number' &&
    !isNaN(direction) &&
    isFinite(direction);
}

/**
 * Validate input command
 */
export function validateInputCommand(input: any): input is InputCommand {
  if (!input || typeof input !== 'object') return false;

  if (!input.type || typeof input.type !== 'string') return false;

  if (!input.timestamp || typeof input.timestamp !== 'number') return false;

  // Check timestamp is not too old or in future
  const now = Date.now();
  const timeDiff = Math.abs(now - input.timestamp);
  if (timeDiff > 5000) return false; // Reject if >5 seconds old/future

  switch (input.type) {
    case 'direction-change':
      return validateDirection(input.direction);
    case 'spawn':
      return typeof input.playerName === 'string';
    case 'boost':
      return true;
    default:
      return false;
  }
}

/**
 * Validate position is within world bounds
 */
export function validatePosition(
  x: number,
  y: number,
  worldWidth: number,
  worldHeight: number
): boolean {
  return x >= 0 && x <= worldWidth && y >= 0 && y <= worldHeight;
}

/**
 * Validate room ID
 */
export function validateRoomId(roomId: string): boolean {
  if (!roomId || typeof roomId !== 'string') return false;
  return /^[a-zA-Z0-9-_]+$/.test(roomId);
}

/**
 * Check if value is a valid number
 */
export function isValidNumber(value: any): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Check if value is a positive number
 */
export function isPositiveNumber(value: any): boolean {
  return isValidNumber(value) && value > 0;
}
