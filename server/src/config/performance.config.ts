export const PERFORMANCE_CONFIG = {
  // Tick budget (30 Hz = 33ms per tick)
  TICK_BUDGET_MS: 33,

  // System budgets (in milliseconds)
  SYSTEM_BUDGETS: {
    input: 2,
    physics: 8,
    collision: 10,
    food: 2,
    score: 1,
    serialization: 5,
    network: 3,
    cleanup: 2
  },

  // Spatial grid settings
  SPATIAL_GRID_CELL_SIZE: 500, // 500x500 pixel cells
  MAX_NEARBY_CHECKS: 50, // Maximum entities to check per collision

  // Performance monitoring
  SLOW_TICK_THRESHOLD: 40, // Log warning if tick exceeds 40ms
  PERFORMANCE_LOG_INTERVAL: 300, // Log performance stats every 300 ticks (10 seconds)

  // Memory management
  DEAD_SNAKE_CLEANUP_INTERVAL: 30, // Clean up dead snakes every 30 ticks (1 second)
  FOOD_SPAWN_INTERVAL: 10, // Check food spawning every 10 ticks

  // Circuit breaker
  MAX_CONSECUTIVE_SLOW_TICKS: 10, // Trigger warning after 10 slow ticks
  CRITICAL_TICK_TIME: 50 // Critical threshold (50ms)
} as const;
