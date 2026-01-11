import { GameState } from './GameState';
import { PerformanceMonitor } from './PerformanceMonitor';
import { ISystem } from '../types/game.types';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { CollisionSystem } from '../systems/CollisionSystem';
import { FoodSystem } from '../systems/FoodSystem';
import { ScoreSystem } from '../systems/ScoreSystem';
import { SpatialGrid } from '../systems/SpatialGrid';
import { InputHandler } from '../network/InputHandler';
import { GAME_CONFIG } from '../config/game.config';
import { PERFORMANCE_CONFIG } from '../config/performance.config';
import { logger } from '../utils/logger';

/**
 * Main game loop - coordinates all systems at fixed tick rate
 */
export class GameLoop {
  private gameState: GameState;
  private performanceMonitor: PerformanceMonitor;
  private spatialGrid: SpatialGrid;
  private inputHandler: InputHandler;
  private systems: ISystem[];

  private tickRate: number;
  private tickInterval: number;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastTickTime: number = 0;

  // Systems
  private physicsSystem: PhysicsSystem;
  private collisionSystem: CollisionSystem;
  private foodSystem: FoodSystem;
  private scoreSystem: ScoreSystem;

  constructor(gameState: GameState) {
    this.gameState = gameState;
    this.performanceMonitor = new PerformanceMonitor();
    this.spatialGrid = new SpatialGrid();
    this.inputHandler = new InputHandler();

    this.tickRate = GAME_CONFIG.TICK_RATE;
    this.tickInterval = GAME_CONFIG.TICK_INTERVAL;

    // Initialize systems
    this.physicsSystem = new PhysicsSystem();
    this.collisionSystem = new CollisionSystem(this.spatialGrid);
    this.foodSystem = new FoodSystem();
    this.scoreSystem = new ScoreSystem();

    this.systems = [
      this.physicsSystem,
      this.collisionSystem,
      this.foodSystem,
      this.scoreSystem
    ];

    logger.info('GameLoop initialized', {
      tickRate: this.tickRate,
      tickInterval: this.tickInterval + 'ms'
    });
  }

  /**
   * Start the game loop
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('GameLoop already running');
      return;
    }

    this.isRunning = true;
    this.lastTickTime = Date.now();

    this.intervalId = setInterval(() => {
      this.tick();
    }, this.tickInterval);

    logger.info('GameLoop started');
  }

  /**
   * Stop the game loop
   */
  stop(): void {
    if (!this.isRunning) {
      logger.warn('GameLoop not running');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    logger.info('GameLoop stopped');
  }

  /**
   * Main tick function - executes all systems
   */
  private tick(): void {
    const tickStartTime = performance.now();
    const systemTimes = new Map<string, number>();

    // Calculate delta time
    const now = Date.now();
    const deltaTime = (now - this.lastTickTime) / 1000; // Convert to seconds
    this.lastTickTime = now;

    try {
      // PHASE 0: Process player inputs (Budget: 2ms)
      const inputStart = performance.now();
      this.inputHandler.processAllInputs(this.gameState);
      const inputDuration = performance.now() - inputStart;
      systemTimes.set('input', inputDuration);
      this.performanceMonitor.recordSystemTime('input', inputDuration);

      // Execute all systems in order
      for (const system of this.systems) {
        const systemStart = performance.now();

        system.update(deltaTime, this.gameState);

        const systemDuration = performance.now() - systemStart;
        systemTimes.set(system.name, systemDuration);
        this.performanceMonitor.recordSystemTime(system.name, systemDuration);

        // Check system budget
        const budget = (PERFORMANCE_CONFIG.SYSTEM_BUDGETS as any)[system.name.replace('System', '').toLowerCase()];
        if (budget && systemDuration > budget) {
          logger.warn(`System exceeded budget`, {
            system: system.name,
            time: systemDuration.toFixed(2) + 'ms',
            budget: budget + 'ms'
          });
        }
      }

      // Increment tick counter
      this.gameState.incrementTick();

      // Record tick performance
      const totalTickTime = performance.now() - tickStartTime;
      this.performanceMonitor.recordTick(
        this.gameState.currentTick,
        totalTickTime,
        systemTimes
      );

    } catch (error) {
      logger.error('Error in game loop tick', error);
    }
  }

  /**
   * Get current game state
   */
  getGameState(): GameState {
    return this.gameState;
  }

  /**
   * Get performance monitor
   */
  getPerformanceMonitor(): PerformanceMonitor {
    return this.performanceMonitor;
  }

  /**
   * Get collision system (for accessing collision events)
   */
  getCollisionSystem(): CollisionSystem {
    return this.collisionSystem;
  }

  /**
   * Get score system (for accessing leaderboard)
   */
  getScoreSystem(): ScoreSystem {
    return this.scoreSystem;
  }

  /**
   * Get spatial grid (for debugging)
   */
  getSpatialGrid(): SpatialGrid {
    return this.spatialGrid;
  }

  /**
   * Get input handler
   */
  getInputHandler(): InputHandler {
    return this.inputHandler;
  }

  /**
   * Check if game loop is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}
