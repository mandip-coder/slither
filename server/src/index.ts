import { Server as SocketIOServer } from 'socket.io';
import { RoomManager } from './core/RoomManager';
import { ConnectionManager } from './network/ConnectionManager';
import { StateBroadcaster } from './network/StateBroadcaster';
import { logger } from './utils/logger';
import { SOCKET_EVENTS } from './types/network.types';

/**
 * Initialize the game server
 */
export function initializeGameServer(io: SocketIOServer): void {
  logger.info('Initializing game server...');

  // Create room manager
  const roomManager = new RoomManager();

  // Create connection manager
  const connectionManager = new ConnectionManager(io, roomManager);

  // Create state broadcaster
  const stateBroadcaster = new StateBroadcaster(io, roomManager);
  stateBroadcaster.start();

  // Handle connections
  io.on(SOCKET_EVENTS.CONNECTION, (socket) => {
    connectionManager.handleConnection(socket);
  });

  logger.info('Game server initialized successfully');
  logger.info(`Server ready to accept connections`);

  // Graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Shutting down game server...');
    stateBroadcaster.stop();
    roomManager.stopAll();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Shutting down game server...');
    stateBroadcaster.stop();
    roomManager.stopAll();
    process.exit(0);
  });
}

// Export for CommonJS
module.exports = { initializeGameServer };
