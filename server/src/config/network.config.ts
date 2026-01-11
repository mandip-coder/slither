export const NETWORK_CONFIG = {
  // Update rates (Hz)
  UPDATE_RATE: 60, // Send state updates 60 times per second

  // Interest management
  VIEWPORT_RADIUS: 1500, // Only send entities within this radius
  VIEWPORT_BUFFER: 200, // Extra buffer to prevent pop-in

  // Optimization
  COMPRESSION_ENABLED: true,
  DELTA_COMPRESSION: true, // Send only changes
  BINARY_PROTOCOL: false, // Future: use binary instead of JSON

  // Rate limiting
  MAX_INPUT_RATE: 60, // Maximum inputs per second per player
  INPUT_BUFFER_SIZE: 10, // Maximum queued inputs per player

  // Connection
  PING_INTERVAL: 5000, // Ping clients every 5 seconds
  PING_TIMEOUT: 10000, // Disconnect after 10 seconds of no response

  // Precision (for quantization)
  POSITION_PRECISION: 1, // Round positions to nearest 1 pixel
  ANGLE_PRECISION: 0.01 // Round angles to 0.01 radians
} as const;
