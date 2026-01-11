export const GAME_CONFIG = {
  // Game loop settings
  TICK_RATE: 60, // 60 ticks per second
  TICK_INTERVAL: 1000 / 60, // ~16ms per tick

  // World settings
  WORLD_WIDTH: 5000,
  WORLD_HEIGHT: 5000,

  // Snake settings
  INITIAL_SNAKE_LENGTH: 10,
  SNAKE_SPEED: 150, // pixels per second
  SEGMENT_RADIUS: 8, // radius of each snake segment
  SEGMENT_SPACING: 15, // distance between segments
  MIN_TURN_ANGLE: 0.05, // minimum angle change per tick
  MAX_TURN_ANGLE: 0.15, // maximum angle change per tick

  // Room settings
  MAX_PLAYERS_PER_ROOM: 100,
  MIN_PLAYERS_TO_START: 1,

  // Food settings
  FOOD_COUNT: 1500, // Reduced from 5000 for performance
  FOOD_VALUE: 1,
  FOOD_RADIUS: 5,
  FOOD_MIN_SIZE: 3,
  FOOD_MAX_SIZE: 8,
  MAGNET_RADIUS: 50, // Reduced from 100 for more realistic feel
  FOOD_COLORS: [
    '#ff0055', // Neon Red
    '#ff9900', // Neon Orange
    '#ffff00', // Neon Yellow
    '#33ff00', // Neon Green
    '#00ffcc', // Neon Cyan
    '#0099ff', // Neon Blue
    '#cc00ff', // Neon Purple
    '#ff00cc'  // Neon Pink
  ],

  // Score settings
  POINTS_PER_FOOD: 2,
  POINTS_PER_KILL: 100,
  LEADERBOARD_SIZE: 10
} as const;

export const SKINS = [
  { id: 'neon-green', name: 'Neon Green', color: '#33ff00' },
  { id: 'neon-cyan', name: 'Neon Cyan', color: '#00ffcc' },
  { id: 'neon-purple', name: 'Neon Purple', color: '#cc00ff' },
  { id: 'neon-pink', name: 'Neon Pink', color: '#ff00cc' },
  { id: 'neon-red', name: 'Neon Red', color: '#ff0055' },
  { id: 'fire', name: 'Fire', color: '#ff4500' }, // Will add pattern logic later
  { id: 'ice', name: 'Ice', color: '#00bfff' },
  { id: 'gold', name: 'Gold', color: '#ffd700' },
  { id: 'dark', name: 'Shadow', color: '#404040' }
];
