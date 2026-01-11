import { GameState } from '../core/GameState';
import { ISystem, LeaderboardEntry } from '../types/game.types';
import { GAME_CONFIG } from '../config/game.config';

/**
 * Score system - manages player scores and leaderboard
 */
export class ScoreSystem implements ISystem {
  public name = 'ScoreSystem';
  private leaderboard: LeaderboardEntry[] = [];

  update(deltaTime: number, gameState: GameState): void {
    this.updateLeaderboard(gameState);
  }

  /**
   * Update the leaderboard based on current player scores
   */
  private updateLeaderboard(gameState: GameState): void {
    const { players } = gameState;

    // Create leaderboard entries
    const entries: LeaderboardEntry[] = [];

    for (const player of players.values()) {
      entries.push({
        playerId: player.id,
        name: player.name,
        score: player.score,
        rank: 0 // Will be set below
      });
    }

    // Sort by score (descending)
    entries.sort((a, b) => b.score - a.score);

    // Assign ranks and limit to top N
    this.leaderboard = entries
      .slice(0, GAME_CONFIG.LEADERBOARD_SIZE)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1
      }));
  }

  /**
   * Get current leaderboard
   */
  getLeaderboard(): LeaderboardEntry[] {
    return this.leaderboard;
  }

  /**
   * Get player rank
   */
  getPlayerRank(playerId: string): number {
    const entry = this.leaderboard.find(e => e.playerId === playerId);
    return entry ? entry.rank : -1;
  }

  /**
   * Award points to player
   */
  awardPoints(gameState: GameState, playerId: string, points: number): void {
    const player = gameState.players.get(playerId);
    if (player) {
      player.addScore(points);
    }
  }

  /**
   * Handle snake death - award points to killer
   */
  handleSnakeDeath(gameState: GameState, deadSnakeId: string, killerSnakeId?: string): void {
    if (!killerSnakeId) return;

    const killerSnake = gameState.snakes.get(killerSnakeId);
    if (!killerSnake) return;

    const killerPlayer = gameState.players.get(killerSnake.playerId);
    if (killerPlayer) {
      killerPlayer.addScore(GAME_CONFIG.POINTS_PER_KILL);
    }
  }
}
