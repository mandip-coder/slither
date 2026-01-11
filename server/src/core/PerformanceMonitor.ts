import { TickMetric, PerformanceStats } from '../types/game.types';
import { PERFORMANCE_CONFIG } from '../config/performance.config';
import { logger } from '../utils/logger';

/**
 * Performance monitor - tracks tick performance and detects issues
 */
export class PerformanceMonitor {
  private tickMetrics: TickMetric[] = [];
  private systemTimes: Map<string, number[]> = new Map();
  private slowTickCount: number = 0;
  private consecutiveSlowTicks: number = 0;
  private lastLogTick: number = 0;

  /**
   * Record time spent in a system
   */
  recordSystemTime(systemName: string, duration: number): void {
    if (!this.systemTimes.has(systemName)) {
      this.systemTimes.set(systemName, []);
    }
    this.systemTimes.get(systemName)!.push(duration);
  }

  /**
   * Record a complete tick
   */
  recordTick(tickNumber: number, totalTime: number, systemTimes: Map<string, number>): void {
    const metric: TickMetric = {
      tickNumber,
      totalTime,
      systemTimes,
      timestamp: Date.now()
    };

    this.tickMetrics.push(metric);

    // Keep only last 100 ticks
    if (this.tickMetrics.length > 100) {
      this.tickMetrics.shift();
    }

    // Check if tick was slow
    if (totalTime > PERFORMANCE_CONFIG.SLOW_TICK_THRESHOLD) {
      this.slowTickCount++;
      this.consecutiveSlowTicks++;

      logger.warn(`Slow tick detected`, {
        tick: tickNumber,
        time: totalTime.toFixed(2) + 'ms',
        budget: PERFORMANCE_CONFIG.TICK_BUDGET_MS + 'ms'
      });

      // Check for critical performance issues
      if (this.consecutiveSlowTicks >= PERFORMANCE_CONFIG.MAX_CONSECUTIVE_SLOW_TICKS) {
        logger.error(`CRITICAL: ${this.consecutiveSlowTicks} consecutive slow ticks!`, {
          averageTime: this.getAverageTickTime().toFixed(2) + 'ms'
        });
      }
    } else {
      this.consecutiveSlowTicks = 0;
    }

    // Periodic performance logging
    if (tickNumber - this.lastLogTick >= PERFORMANCE_CONFIG.PERFORMANCE_LOG_INTERVAL) {
      this.logPerformanceStats(tickNumber);
      this.lastLogTick = tickNumber;
    }
  }

  /**
   * Get average tick time
   */
  getAverageTickTime(): number {
    if (this.tickMetrics.length === 0) return 0;
    const sum = this.tickMetrics.reduce((acc, m) => acc + m.totalTime, 0);
    return sum / this.tickMetrics.length;
  }

  /**
   * Get performance statistics
   */
  getStats(): PerformanceStats {
    if (this.tickMetrics.length === 0) {
      return {
        averageTickTime: 0,
        minTickTime: 0,
        maxTickTime: 0,
        slowTickCount: 0,
        totalTicks: 0
      };
    }

    const times = this.tickMetrics.map(m => m.totalTime);

    return {
      averageTickTime: this.getAverageTickTime(),
      minTickTime: Math.min(...times),
      maxTickTime: Math.max(...times),
      slowTickCount: this.slowTickCount,
      totalTicks: this.tickMetrics.length
    };
  }

  /**
   * Get slow ticks
   */
  getSlowTicks(): TickMetric[] {
    return this.tickMetrics.filter(
      m => m.totalTime > PERFORMANCE_CONFIG.SLOW_TICK_THRESHOLD
    );
  }

  /**
   * Log performance statistics
   */
  private logPerformanceStats(tickNumber: number): void {
    const stats = this.getStats();

    logger.info('Performance Stats', {
      tick: tickNumber,
      avgTickTime: stats.averageTickTime.toFixed(2) + 'ms',
      minTickTime: stats.minTickTime.toFixed(2) + 'ms',
      maxTickTime: stats.maxTickTime.toFixed(2) + 'ms',
      slowTicks: stats.slowTickCount,
      budget: PERFORMANCE_CONFIG.TICK_BUDGET_MS + 'ms'
    });

    // Log system breakdown
    const systemAvgs: any = {};
    for (const [system, times] of this.systemTimes.entries()) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      systemAvgs[system] = avg.toFixed(2) + 'ms';
    }

    logger.debug('System Breakdown', systemAvgs);

    // Clear system times for next interval
    this.systemTimes.clear();
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.tickMetrics = [];
    this.systemTimes.clear();
    this.slowTickCount = 0;
    this.consecutiveSlowTicks = 0;
    this.lastLogTick = 0;
  }
}
