export class SpatialHashGrid {
  private cells: Map<string, Set<string>> = new Map();
  private cellSize: number;

  constructor(cellSize: number) {
    this.cellSize = cellSize;
  }

  /**
   * Get unique key for cell coordinates
   */
  private getKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  /**
   * Get grid coordinates for world position
   */
  private getCellCoords(x: number, y: number): { x: number, y: number } {
    return {
      x: Math.floor(x / this.cellSize),
      y: Math.floor(y / this.cellSize)
    };
  }

  /**
   * Insert an entity into the grid
   */
  insert(x: number, y: number, id: string): void {
    const { x: cx, y: cy } = this.getCellCoords(x, y);
    const key = this.getKey(cx, cy);

    if (!this.cells.has(key)) {
      this.cells.set(key, new Set());
    }
    this.cells.get(key)!.add(id);
  }

  /**
   * Remove an entity from a specific position
   * Note: You must provide the position where the entity was last inserted/updated
   */
  remove(x: number, y: number, id: string): void {
    const { x: cx, y: cy } = this.getCellCoords(x, y);
    const key = this.getKey(cx, cy);

    const cell = this.cells.get(key);
    if (cell) {
      cell.delete(id);
      if (cell.size === 0) {
        this.cells.delete(key);
      }
    }
  }

  /**
   * Clear the entire grid
   */
  clear(): void {
    this.cells.clear();
  }

  /**
   * Query for entities within radius of a point
   * Returns a Set of entity IDs
   */
  query(x: number, y: number, radius: number): Set<string> {
    const results = new Set<string>();

    // Calculate range of cells to check
    const startX = Math.floor((x - radius) / this.cellSize);
    const endX = Math.floor((x + radius) / this.cellSize);
    const startY = Math.floor((y - radius) / this.cellSize);
    const endY = Math.floor((y + radius) / this.cellSize);

    for (let cy = startY; cy <= endY; cy++) {
      for (let cx = startX; cx <= endX; cx++) {
        const key = this.getKey(cx, cy);
        const cell = this.cells.get(key);

        if (cell) {
          for (const id of cell) {
            results.add(id);
          }
        }
      }
    }

    return results;
  }
}
