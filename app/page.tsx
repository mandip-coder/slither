'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { InterpolationManager } from './utils/InterpolationManager';
import EntryScreen from './components/EntryScreen';

// Types
interface Point {
  x: number;
  y: number;
}

interface Snake {
  id: string;
  playerId: string;
  name?: string; // Player name
  head: Point;
  direction: number;
  length: number;
  color: string;
  skinId?: string;
  score: number;
  path?: Point[]; // Path for smooth rendering
  isBoosting?: boolean;
}

interface Food {
  id: string;
  position: Point;
  value: number;
  radius?: number;
  color?: string;
}

interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
}

interface GameState {
  tick: number;
  snakes: Snake[];
  food: Food[];
  leaderboard: LeaderboardEntry[];
  worldSize?: { width: number; height: number }; // Optional until first update
}


interface LocalSnakeState {
  head: Point;
  direction: number;
  targetDirection: number;
  lastServerSync: number;
  path: Point[]; // Local high-res history for smooth rendering
  pendingPathLength: number; // To handle length updates smoothly
  currentVisualLength: number; // Smoothed length for animation
}

interface InputCommand {
  type: 'direction-change' | 'spawn' | 'boost';
  direction?: number;
  isBoosting?: boolean;
  playerName?: string;
  timestamp: number;
}

const SKINS = [
  { id: 'neon-green', name: 'Neon Green', color: '#33ff00' },
  { id: 'neon-cyan', name: 'Neon Cyan', color: '#00ffcc' },
  { id: 'neon-purple', name: 'Neon Purple', color: '#cc00ff' },
  { id: 'neon-pink', name: 'Neon Pink', color: '#ff00cc' },
  { id: 'neon-red', name: 'Neon Red', color: '#ff0055' },
  { id: 'fire', name: 'Fire', color: '#ff4500' },
  { id: 'ice', name: 'Ice', color: '#00bfff' },
  { id: 'gold', name: 'Gold', color: '#ffd700' },
  { id: 'dark', name: 'Shadow', color: '#404040' }
];

// --- VISUAL HELPERS (Two-Pass Segmented Rendering) ---

/**
 * Helper: Get equidistant points along a path (KEY TO SEGMENTED LOOK)
 * Walks the path backwards from head and places visual segments at fixed intervals.
 * This decouples the server's update rate from the visual density.
 */
function getEquidistantPoints(path: Point[], spacing: number): Point[] {
  if (path.length === 0) return [];
  if (path.length === 1) return [path[0]];

  const segments: Point[] = [path[0]]; // Always include Head (0)
  let accumulatedDist = 0;

  // path[0] is HEAD. path[last] is TAIL.
  // We want to walk from Head -> Tail
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i];
    const p2 = path[i + 1];

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy);

    if (dist === 0) continue;

    let currentSegmentDist = 0;

    // Interpolate points at fixed `spacing` intervals
    while (accumulatedDist + (dist - currentSegmentDist) >= spacing) {
      const neededForNext = spacing - accumulatedDist;
      const t = (currentSegmentDist + neededForNext) / dist;

      segments.push({
        x: p1.x + dx * t,
        y: p1.y + dy * t
      });

      accumulatedDist = 0;
      currentSegmentDist += neededForNext;
    }

    accumulatedDist += (dist - currentSegmentDist);
  }

  return segments;
}

/**
 * Render Snake V2: The "Slither Style" Two-Pass System
 * Pass 1: Draw larger circles for the outline (creates the ribbed border)
 * Pass 2: Draw inner circles for the body
 */
/*
function renderSnakeV2(ctx: CanvasRenderingContext2D, snake: Snake, isPlayer: boolean, localSnake?: LocalSnakeState, gameState?: GameState) {
  // 1. Construct High-Res Source Path
  let rawPath: Point[] = [];

  const drawHeadPos = isPlayer && localSnake ? localSnake.head : snake.head;
  const drawHeadDir = isPlayer && localSnake ? localSnake.direction : snake.direction;

  if (isPlayer && localSnake) {
    if (snake.path && snake.path.length > 1) {
      // Predict Locally: [LocalHead, ...ServerPathReverse]
      rawPath.push(localSnake.head);
      for (let i = snake.path.length - 2; i >= 0; i--) {
        rawPath.push(snake.path[i]);
      }
    } else {
      rawPath.push(localSnake.head);
    }
  } else {
    // Remote: [Head, ...Body] (Server path reversed)
    if (snake.path && snake.path.length > 0) {
      // Server path is [Tail...Head]. We want [Head...Tail] for walking
      for (let i = snake.path.length - 1; i >= 0; i--) {
        rawPath.push(snake.path[i]);
      }
    } else {
      rawPath.push(snake.head);
    }
  }

  // Not enough points? Draw Head only
  if (rawPath.length < 2) {
    drawSnakeHead(ctx, drawHeadPos, drawHeadDir, snake.color, isPlayer);
    return;
  }

  // 2. Generate Visual Segments (The Ribbed Spacing)
  // Radius grows slowly: Base 10px -> 20px max.
  const baseRadius = (20 + Math.min(10, snake.length / 50)) / 2;

  // KEY TUNING: Spacing = Radius * 0.5 (50% Overlap).
  // Smaller coefficient = More dense/smooth. Larger = More separate beads.
  // 0.5-0.6 is the sweet spot for Slither look.
  const segmentSpacing = baseRadius * 0.5;

  const visualSegments = getEquidistantPoints(rawPath, segmentSpacing);

  const outlineColor = adjustBrightness(snake.color, -30);
  const outlineRadius = baseRadius + 2; // 2px Border

  ctx.save();

  // 3. Render Pass 1: OUTLINE (Large Circles)
  // Draw from TAIL (end of array) to NECK (index 1). Head (0) is special.
  ctx.fillStyle = outlineColor;
  for (let i = visualSegments.length - 1; i > 0; i--) {
    const p = visualSegments[i];
    ctx.beginPath();
    ctx.arc(p.x, p.y, outlineRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4. Render Pass 2: BODY (Inner Circles)
  ctx.fillStyle = snake.color;

  // Shadow
  ctx.shadowBlur = snake.isBoosting ? 20 : 10;
  ctx.shadowColor = snake.isBoosting ? '#ffffff' : snake.color;

  for (let i = visualSegments.length - 1; i > 0; i--) {
    const p = visualSegments[i];

    ctx.beginPath();
    // Use slightly varying radius for organic feel? No, keep steady for clean look.
    ctx.arc(p.x, p.y, baseRadius, 0, Math.PI * 2);
    ctx.fill();

    // OPTIONAL: Spine Texture
    // A small lighter dot in center-ish
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, baseRadius * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore(); // End Shadow/Context

  // 5. Draw Head (Always last = Top Layer)
  drawSnakeHead(ctx, drawHeadPos, drawHeadDir, snake.color, isPlayer);

  // 6. Name Tag
  if (isPlayer || snake.length > 50) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 4;
    ctx.shadowColor = 'black';
    // Position text above head
    ctx.fillText(isPlayer ? 'YOU' : 'Enemy', drawHeadPos.x, drawHeadPos.y - (baseRadius + 15));
  }
}
*/

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const gameStateRef = useRef<GameState>({ tick: 0, snakes: [], food: [], leaderboard: [] });
  const interpolationRef = useRef<InterpolationManager>(new InterpolationManager());
  const playerIdRef = useRef<string | null>(null);
  const animationFrameRef = useRef<number>(0);
  const cameraRef = useRef<Point>({ x: 0, y: 0 });
  const localSnakeRef = useRef<LocalSnakeState | null>(null);
  const inputQueueRef = useRef<InputCommand[]>([]);
  const isBoostingRef = useRef<boolean>(false);

  // Dynamic Zoom
  const [scale, setScale] = useState<number>(1.0);
  const targetScaleRef = useRef<number>(1.0);
  const currentRenderScaleRef = useRef<number>(1.0); // For smooth rendering without state updates every frame

  const [isConnected, setIsConnected] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedSkin, setSelectedSkin] = useState('neon-green');

  /**
   * Render Snake V2: The "Slither Style" Two-Pass System
   * Pass 1: Draw larger circles for the outline (creates the ribbed border)
   * Pass 2: Draw inner circles for the body
   */
  function renderSnakeV2(ctx: CanvasRenderingContext2D, snake: Snake, isPlayer: boolean, localSnake?: LocalSnakeState, gameState?: GameState) {
    // 1. Construct High-Res Source Path
    let rawPath: Point[] = [];

    const drawHeadPos = isPlayer && localSnake ? localSnake.head : snake.head;
    const drawHeadDir = isPlayer && localSnake ? localSnake.direction : snake.direction;

    if (isPlayer && localSnake && localSnake.path && localSnake.path.length > 0) {
      // Use FULL LOCAL PATH for perfect smoothness
      // localSnake.path is already [Head, ...Body, Tail]
      rawPath = localSnake.path;
    } else {
      // Remote: [Head, ...Body] (Server path reversed)
      if (snake.path && snake.path.length > 0) {
        // Server path is [Tail...Head]. We want [Head...Tail] for walking
        for (let i = snake.path.length - 1; i >= 0; i--) {
          rawPath.push(snake.path[i]);
        }
      } else {
        rawPath.push(snake.head);
      }
    }

    // Not enough points? Draw Head only
    if (rawPath.length < 2) {
      drawSnakeHead(ctx, drawHeadPos, drawHeadDir, snake.color, isPlayer);
      return;
    }

    // 2. Generate Visual Segments (The Ribbed Spacing)
    // Radius grows slowly: Base 10px -> 20px max.
    const baseRadius = (20 + Math.min(10, snake.length / 50)) / 2;

    // KEY TUNING: Spacing = Radius * 0.8 (Less Overlap).
    // Smaller coefficient = More dense/smooth. Larger = More separate beads.
    // 0.8 ensures distinct circles (beads).
    const segmentSpacing = baseRadius * 0.8;

    const visualSegments = getEquidistantPoints(rawPath, segmentSpacing);

    const outlineColor = adjustBrightness(snake.color, -30);
    const outlineRadius = baseRadius + 2; // 2px Border

    ctx.save();

    // 3. Render Pass 1: OUTLINE (Large Circles)
    // Draw from TAIL (end of array) to NECK (index 1). Head (0) is special.
    ctx.fillStyle = outlineColor;
    for (let i = visualSegments.length - 1; i > 0; i--) {
      const p = visualSegments[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, outlineRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Render Pass 2: BODY (Inner Circles)
    ctx.fillStyle = snake.color;

    // Shadow
    ctx.shadowBlur = snake.isBoosting ? 20 : 10;
    ctx.shadowColor = snake.isBoosting ? '#ffffff' : snake.color;

    for (let i = visualSegments.length - 1; i > 0; i--) {
      const p = visualSegments[i];

      ctx.beginPath();
      // Use slightly varying radius for organic feel? No, keep steady for clean look.
      ctx.arc(p.x, p.y, baseRadius, 0, Math.PI * 2);
      ctx.fill();

      // OPTIONAL: Spine Texture
      // A small lighter dot in center-ish
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, baseRadius * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore(); // End Shadow/Context

    // 5. Draw Head (Always last = Top Layer)
    drawSnakeHead(ctx, drawHeadPos, drawHeadDir, snake.color, isPlayer);

    // 6. Name Tag
    if (isPlayer || snake.length > 50) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 4;
      ctx.shadowColor = 'black';
      // Position text above head
      ctx.fillText(isPlayer ? 'YOU' : (snake.name || 'Enemy'), drawHeadPos.x, drawHeadPos.y - (baseRadius + 15));
    }
  }

  // Initialize Socket.IO connection
  useEffect(() => {
    const socket = io({
      transports: ['websocket']
    });

    socket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
      setIsPlaying(false);
    });

    // Handle full game state
    socket.on('game-state', (state: GameState) => {
      gameStateRef.current = state;

      const playerSnake = state.snakes.find(s => s.playerId === playerIdRef.current);
      if (playerSnake) {
        // Initialize or reconcile local prediction
        if (!localSnakeRef.current) {
          localSnakeRef.current = {
            head: { ...playerSnake.head },
            direction: playerSnake.direction,
            targetDirection: playerSnake.direction,
            lastServerSync: Date.now(),
            path: playerSnake.path ? [...playerSnake.path].reverse() : [{ ...playerSnake.head }],
            pendingPathLength: playerSnake.length,
            currentVisualLength: playerSnake.length
          };
        } else {
          // Soft Reconcile: If server position is too far, snap. Otherwise blend.
          const dist = Math.sqrt(
            Math.pow(localSnakeRef.current.head.x - playerSnake.head.x, 2) +
            Math.pow(localSnakeRef.current.head.y - playerSnake.head.y, 2)
          );

          if (dist > 50) {
            // Hard snap if desync is huge
            localSnakeRef.current.head = { ...playerSnake.head };
            localSnakeRef.current.direction = playerSnake.direction;
            // Also reset path on hard snap
            localSnakeRef.current.path = playerSnake.path ? [...playerSnake.path].reverse() : [{ ...playerSnake.head }];
          } else if (dist > 5) {
            // Weak Blend (pull local towards server) only if significant drift
            localSnakeRef.current.head.x += (playerSnake.head.x - localSnakeRef.current.head.x) * 0.05;
            localSnakeRef.current.head.y += (playerSnake.head.y - localSnakeRef.current.head.y) * 0.05;
          }

          // Update target length from server
          localSnakeRef.current.pendingPathLength = playerSnake.length;
        }
      }

      // Add snapshots to interpolation manager
      const timestamp = Date.now();
      for (const snake of state.snakes) {
        // Don't interpolate player's own snake
        if (snake.playerId !== playerIdRef.current) {
          interpolationRef.current.addSnapshot(snake.id, {
            tick: state.tick,
            timestamp,
            head: { ...snake.head },
            direction: snake.direction,
            length: snake.length
          });
        }
      }
    });

    // Handle delta updates
    socket.on('delta-update', (delta: any) => {
      applyDelta(delta);
    });

    // Handle player spawned
    socket.on('player-spawned', (data: { playerId: string; snakeId: string }) => {
      playerIdRef.current = data.playerId;
      setIsPlaying(true);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  // Handle Boost Input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isBoostingRef.current) {
        isBoostingRef.current = true;
        emitBoost(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isBoostingRef.current) {
        isBoostingRef.current = false;
        emitBoost(false);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0 && !isBoostingRef.current) { // Left click
        isBoostingRef.current = true;
        emitBoost(true);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0 && isBoostingRef.current) {
        isBoostingRef.current = false;
        emitBoost(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const emitBoost = (isBoosting: boolean) => {
    if (!socketRef.current) return;
    socketRef.current.emit('input', {
      type: 'boost',
      isBoosting,
      timestamp: Date.now()
    });
  };

  // Apply delta updates to game state
  const applyDelta = (delta: any) => {
    const state = gameStateRef.current;
    const timestamp = Date.now();

    state.tick = delta.tick;

    // Apply snake deltas
    if (delta.snakes) {
      if (delta.snakes.added) {
        state.snakes.push(...delta.snakes.added);

        // Add to interpolation
        for (const snake of delta.snakes.added) {
          if (snake.playerId !== playerIdRef.current) {
            interpolationRef.current.addSnapshot(snake.id, {
              tick: state.tick,
              timestamp,
              head: { ...snake.head },
              direction: snake.direction,
              length: snake.length
            });
          }
        }
      }
      if (delta.snakes.updated) {
        for (const update of delta.snakes.updated) {
          const snake = state.snakes.find(s => s.id === update.id);
          if (snake) {
            Object.assign(snake, update);

            // OPTIMIZATION: If server doesn't send path (to save bandwidth), update it locally
            if (update.head && !update.path) {
              // We will handle path simulation in the Render Loop for smoothness.
              // Do nothing here.
            }

            const isPlayer = snake.playerId === playerIdRef.current;

            // CLIENT-SIDE PREDICTION RECONCILIATION
            if (isPlayer && localSnakeRef.current && update.head) {
              const localHead = localSnakeRef.current.head;
              const serverHead = update.head;

              const dist = Math.hypot(localHead.x - serverHead.x, localHead.y - serverHead.y);

              if (dist > 100) {
                localSnakeRef.current.head = { ...serverHead };
              } else if (dist > 20) {
                localSnakeRef.current.head.x += (serverHead.x - localHead.x) * 0.1;
                localSnakeRef.current.head.y += (serverHead.y - localHead.y) * 0.1;
              }
            }

            // Sync length for smooth growth
            if (isPlayer && localSnakeRef.current && update.length) {
              localSnakeRef.current.pendingPathLength = update.length;
            }

            // Add to interpolation for remote snakes
            if (!isPlayer && update.head) {
              interpolationRef.current.addSnapshot(snake.id, {
                tick: state.tick,
                timestamp,
                head: { ...snake.head },
                direction: snake.direction,
                length: snake.length
              });
            }
          }
        }
      }
      if (delta.snakes.removed) {
        for (const id of delta.snakes.removed) {
          interpolationRef.current.removeSnake(id);
        }
        state.snakes = state.snakes.filter(s => !delta.snakes.removed.includes(s.id));
      }
    }

    // Apply food deltas
    if (delta.food) {
      if (delta.food.added) {
        state.food.push(...delta.food.added);
      }
      if (delta.food.removed) {
        state.food = state.food.filter(f => !delta.food.removed.includes(f.id));
      }
    }

    // Update leaderboard
    if (delta.leaderboard) {
      state.leaderboard = delta.leaderboard;
    }
  };

  // Handle input throttling
  const lastInputTimeRef = useRef<number>(0);
  const inputInterval = 50; // 50ms = 20 packets/sec max
  const pendingInputRef = useRef<{ angle: number } | null>(null);

  // Input loop
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      if (pendingInputRef.current && socketRef.current) {
        socketRef.current.emit('input', {
          type: 'direction-change',
          direction: pendingInputRef.current.angle,
          timestamp: Date.now()
        });
        pendingInputRef.current = null;
      }
    }, inputInterval);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Handle BOOST Input
  useEffect(() => {
    if (!isPlaying) return;

    const handleBoost = (boosting: boolean) => {
      if (isBoostingRef.current === boosting) return; // No change

      isBoostingRef.current = boosting;
      // Send immediately
      if (socketRef.current) {
        socketRef.current.emit('input', {
          type: 'boost',
          isBoosting: boosting,
          timestamp: Date.now()
        });
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') handleBoost(true);
      if (e.key === 'Escape') {
        // Stop Game, Return to Menu, Reconnect to Lobby
        if (socketRef.current) {
          socketRef.current.disconnect();
          setIsConnected(false);
        }
        setIsPlaying(false);
        setPlayerName('');
        localSnakeRef.current = null;

        // Reconnect to Lobby
        setTimeout(connectToLobby, 100);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') handleBoost(false);
    };

    const onMouseDown = () => handleBoost(true);
    const onMouseUp = () => handleBoost(false);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isPlaying]);

  // Handle mouse movement for direction
  useEffect(() => {
    if (!isPlaying || !canvasRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Get player snake
      const playerSnake = gameStateRef.current.snakes.find(
        s => s.playerId === playerIdRef.current
      );
      if (!playerSnake) return;

      // Convert mouse position to world coordinates
      const worldX = mouseX - canvas.width / 2 + cameraRef.current.x;
      const worldY = mouseY - canvas.height / 2 + cameraRef.current.y;

      // Calculate angle from snake to mouse
      const angle = Math.atan2(
        worldY - playerSnake.head.y,
        worldX - playerSnake.head.x
      );

      // Update local prediction target IMMEDIATELY
      if (localSnakeRef.current) {
        localSnakeRef.current.targetDirection = angle;
      }

      // Queue input for network
      pendingInputRef.current = { angle };
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isPlaying]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Time-based physics for smoothness
    let lastTime = performance.now();


    // Render function
    const render = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1); // Cap at 0.1s to prevent huge jumps
      lastTime = now;

      const state = gameStateRef.current;

      // Update interpolation
      interpolationRef.current.update(Date.now());

      // Clear canvas
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update camera to follow player
      const playerSnake = state.snakes.find(s => s.playerId === playerIdRef.current);

      // Perform local physics step for prediction!
      if (playerSnake && localSnakeRef.current) {
        // 1. Update Direction
        let angleDiff = localSnakeRef.current.targetDirection - localSnakeRef.current.direction;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

        // Turn speed calculation (fixed per second)
        const turnSpeed = 5.0; // Radians per second
        const turnAmount = Math.max(-turnSpeed * dt, Math.min(turnSpeed * dt, angleDiff));

        localSnakeRef.current.direction += turnAmount;

        // Normalize angle
        while (localSnakeRef.current.direction > Math.PI) localSnakeRef.current.direction -= 2 * Math.PI;
        while (localSnakeRef.current.direction < -Math.PI) localSnakeRef.current.direction += 2 * Math.PI;

        // 2. Move Head
        const speed = 150; // Match server speed
        // Use Real DT!
        localSnakeRef.current.head.x += Math.cos(localSnakeRef.current.direction) * speed * dt;
        localSnakeRef.current.head.y += Math.sin(localSnakeRef.current.direction) * speed * dt;

        // 3. Update Local Path History (The Core of Smoothness)
        const path = localSnakeRef.current.path;
        if (path.length === 0) {
          path.push({ ...localSnakeRef.current.head });
        } else {
          // Only add point if moved enough (optimize)
          const lastPoint = path[0];
          const distToLast = Math.hypot(
            localSnakeRef.current.head.x - lastPoint.x,
            localSnakeRef.current.head.y - lastPoint.y
          );

          if (distToLast >= 2) { // 2px resolution
            // Add new head
            path.unshift({ ...localSnakeRef.current.head });

            // Smooth Length Interpolation
            // pendingPathLength comes from server. currentVisualLength is what we render.
            // Improved: Use exponential smoothing (ease-out) for natural growth.
            // Factor 2.0 = smooth and leisurely. 5.0 = snappy.
            const lengthDiff = localSnakeRef.current.pendingPathLength - localSnakeRef.current.currentVisualLength;

            if (Math.abs(lengthDiff) > 0.1) {
              const interpolationFactor = 3.0; // Adjustable sweetness
              localSnakeRef.current.currentVisualLength += lengthDiff * interpolationFactor * dt;
            } else {
              localSnakeRef.current.currentVisualLength = localSnakeRef.current.pendingPathLength;
            }

            // Trim tail to match SMOOTH visual length
            let currentLen = 0;
            const targetLen = localSnakeRef.current.currentVisualLength;

            for (let i = 0; i < path.length - 1; i++) {
              const dx = path[i].x - path[i + 1].x;
              const dy = path[i].y - path[i + 1].y;
              const dist = Math.hypot(dx, dy);

              if (currentLen + dist > targetLen) {
                // The logical tail end is inside this segment
                const overshoot = (currentLen + dist) - targetLen;
                // We want to keep (dist - overshoot) of this segment
                const ratio = (dist - overshoot) / dist;

                // Move the (i+1) point to the exact tail end
                // Vector P_i -> P_i+1 is (-dx, -dy) if dx is P_i - P_i+1
                // Actually: x2 = x1 - dx => x2 - x1 = -dx
                // We want P_i + (vector) * ratio
                // vector = P_i+1 - P_i = (x_i+1 - x_i, y_i+1 - y_i)
                // x_i+1 - x_i = -dx
                path[i + 1].x = path[i].x + (path[i + 1].x - path[i].x) * ratio;
                path[i + 1].y = path[i].y + (path[i + 1].y - path[i].y) * ratio;

                // Remove remaining points
                path.splice(i + 2);
                break;
              }
              currentLen += dist;
            }
          } else {
            // Update the head point immediately if we haven't pushed a new one yet
            // This keeps the very tip smooth even when moving slowly
            path[0] = { ...localSnakeRef.current.head };
          }
        }
      }

      if (playerSnake) {
        // Smooth camera follow local predicted head
        const targetX = localSnakeRef.current ? localSnakeRef.current.head.x : playerSnake.head.x;
        const targetY = localSnakeRef.current ? localSnakeRef.current.head.y : playerSnake.head.y;

        // Make camera faster/tighter
        // Framerate independent damping
        const lag = 0.15; // 15% correction per frame at 60fps ~ 9.0/sec
        // Time corrected damping: x += (target - x) * (1 - exp(-speed * dt))
        const damping = 1 - Math.exp(-10 * dt);

        cameraRef.current.x += (targetX - cameraRef.current.x) * damping;
        cameraRef.current.y += (targetY - cameraRef.current.y) * damping;

        // Dynamic Zoom Logic - GENTLER FORMULA
        // Start zooming at length 50 instead of 20
        // Use 0.001 factor instead of 0.005
        const newTargetScale = Math.max(0.6, 1.0 - Math.max(0, playerSnake.length - 50) * 0.001);
        targetScaleRef.current = newTargetScale;
      }

      // Smoothly interpolate current render scale to target
      currentRenderScaleRef.current += (targetScaleRef.current - currentRenderScaleRef.current) * 0.05;

      // Save context
      ctx.save();

      // Apply camera transform
      const scale = currentRenderScaleRef.current;
      ctx.scale(scale, scale);
      ctx.translate(-cameraRef.current.x + canvas.width / (2 * scale), -cameraRef.current.y + canvas.height / (2 * scale));

      // Render world
      renderGrid(ctx, canvas);

      // Render Collision Border
      if (gameStateRef.current.worldSize) {
        renderBorder(ctx, gameStateRef.current.worldSize.width, gameStateRef.current.worldSize.height);
      }

      // Render food
      gameStateRef.current.food.forEach(food => renderFood(ctx, food));

      // Render snakes with interpolation
      for (const snake of state.snakes) {
        const isPlayer = snake.playerId === playerIdRef.current;

        if (isPlayer) {
          // Player snake - use PREDICTED position
          // We construct a fake snake object that uses our local head
          // But keeps the server path (which will trail behind slightly, but that's okay for the tail)
          // Ideally we would predict the whole path, but predicting just the head is 90% of the feel.
          const predictedSnake = {
            ...snake,
            head: localSnakeRef.current ? localSnakeRef.current.head : snake.head,
            direction: localSnakeRef.current ? localSnakeRef.current.direction : snake.direction
          };

          renderSnakeV2(ctx, predictedSnake, true, localSnakeRef.current || undefined, state);
        } else {
          // Remote snake - use interpolated position
          const interpolated = interpolationRef.current.getSnake(snake.id);
          if (interpolated) {
            const interpolatedSnake = {
              ...snake,
              head: interpolated.currentHead,
              direction: interpolated.currentDirection,
              length: interpolated.currentLength,
              path: interpolated.path,
              name: interpolated.name
            };

            // Use server path as-is (server sends complete path)
            renderSnakeV2(ctx, interpolatedSnake, false, undefined, state);
          } else {
            // Fallback to server position
            renderSnakeV2(ctx, snake, false, undefined, state);
          }
        }
      }

      // Restore context
      ctx.restore();

      // Render UI
      renderUI(ctx, canvas, state);

      // Continue loop
      animationFrameRef.current = requestAnimationFrame(render);
    };

    // Start render loop
    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // Render grid
  // Render hexagonal grid (Slither.io style)
  const renderGrid = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    // Dynamic background color
    ctx.fillStyle = '#161c22'; // Deep distinct dark blue-grey
    ctx.fillRect(
      cameraRef.current.x - canvas.width,
      cameraRef.current.y - canvas.height,
      canvas.width * 3,
      canvas.height * 3
    );

    const radius = 50; // Hexagon size
    const a = 2 * Math.PI / 6;
    const r = radius;
    const w = radius * 2;
    const h = Math.sqrt(3) * radius;

    // Calculate view bounds to only render visible hexagons
    // Add extra margin for rotation/zoom
    const margin = 200;
    const left = cameraRef.current.x - canvas.width / 2 - margin;
    const right = cameraRef.current.x + canvas.width / 2 + margin;
    const top = cameraRef.current.y - canvas.height / 2 - margin;
    const bottom = cameraRef.current.y + canvas.height / 2 + margin;

    // Calculate start/end indices
    // Hex grid logic (offset coordinates)
    const colStart = Math.floor(left / (w * 0.75));
    const colEnd = Math.floor(right / (w * 0.75));

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#232d36'; // Lighter hex borders
    ctx.fillStyle = '#1a2128'; // Slightly lighter hex fill

    ctx.beginPath();
    for (let col = colStart; col <= colEnd; col++) {
      // Calculate row range for this column
      const x = col * w * 0.75;
      const isOdd = col % 2 !== 0;
      const yOffset = isOdd ? h * 0.5 : 0;

      const rowStart = Math.floor((top - yOffset) / h);
      const rowEnd = Math.floor((bottom - yOffset) / h);

      for (let row = rowStart; row <= rowEnd; row++) {
        const y = row * h + yOffset;

        // Draw hexagon
        const hexX = x;
        const hexY = y;

        ctx.moveTo(hexX + r * Math.cos(0), hexY + r * Math.sin(0));
        for (let i = 1; i < 6; i++) {
          ctx.lineTo(hexX + r * Math.cos(i * a), hexY + r * Math.sin(i * a));
        }
        ctx.closePath();
      }
    }
    // Batch stroke/fill
    ctx.stroke();
    ctx.fill();

    // Vignette effect (on top of grid)
    // We need to draw this in screen space, so we must be careful with transforms
    // But since render acts in world space... we skip vignette for now as it's complex in world space canvas,
    // or we'd have to resetTransform (which is expensive/complex here).
    // The background color change is the biggest win.
  };


  // Render Red Collision Border (Circular)
  const renderBorder = (ctx: CanvasRenderingContext2D, worldWidth: number, worldHeight: number) => {
    ctx.save();

    const centerX = worldWidth / 2;
    const centerY = worldHeight / 2;
    // Assuming Map Radius is half of World Width (minus margin ideally, but usually exact)
    // Server config uses 2500 for 5000 width.
    const mapRadius = worldWidth / 2;

    // Glow effect
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 20;
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 5;

    ctx.beginPath();
    ctx.arc(centerX, centerY, mapRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Add a second inner line for "hazard" look
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ff3333';
    ctx.beginPath();
    ctx.arc(centerX, centerY, mapRadius - 20, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  };



  // Render food with NEON GLOW and PULSING animation
  const renderFood = (ctx: CanvasRenderingContext2D, food: Food) => {
    const radius = food.radius || 5;
    const color = food.color || '#4ade80';

    // Pulsing effect
    const time = Date.now();
    const pulseScale = 1 + Math.sin(time * 0.005 + food.position.x * 0.01) * 0.1;
    const currentRadius = radius * pulseScale;

    ctx.save();

    // Glow
    ctx.shadowBlur = 15;
    ctx.shadowColor = color;
    ctx.fillStyle = color;

    ctx.beginPath();
    ctx.arc(food.position.x, food.position.y, currentRadius, 0, Math.PI * 2);
    ctx.fill();

    // Core (brighter center)
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(food.position.x, food.position.y, currentRadius * 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // Render snake with PATH-BASED smooth body and HIGH FIDELITY visuals
  function renderSnake(ctx: CanvasRenderingContext2D, snake: Snake, isPlayer: boolean, localSnake?: LocalSnakeState) {
    // 1. Construct Full Render Path
    let renderPath: Point[] = [];

    // HEAD position for drawing
    const drawHeadPos = isPlayer && localSnake ? localSnake.head : snake.head;
    const drawHeadDir = isPlayer && localSnake ? localSnake.direction : snake.direction;

    // PATH CONSTRUCTION
    if (isPlayer && localSnake) {
      // PLAYER: Use predicted head + server body
      // Server path structure: [tail...body...head] (head is LAST element)
      // We want: [predictedHead, body...tail] (reversed, without server head)

      if (snake.path && snake.path.length > 1) {
        // Add predicted head
        renderPath.push(localSnake.head);
        // Add server body in reverse (excluding last element which is server head)
        for (let i = snake.path.length - 2; i >= 0; i--) {
          renderPath.push(snake.path[i]);
        }
      } else if (snake.path && snake.path.length === 1) {
        // Only one point (head), just use predicted
        renderPath.push(localSnake.head);
      } else {
        // No path yet, use predicted head
        renderPath.push(localSnake.head);
      }
    } else {
      // REMOTE: Use server path as-is, but reversed for rendering
      if (snake.path && snake.path.length > 0) {
        // Reverse the path so head is first
        for (let i = snake.path.length - 1; i >= 0; i--) {
          renderPath.push(snake.path[i]);
        }
      }
    }

    // 2. Filter & Sample (CRITICAL for Smoothness)
    if (renderPath.length < 2) {
      drawSnakeHead(ctx, drawHeadPos, drawHeadDir, snake.color, isPlayer);
      return;
    }

    // Filter duplicates (reduced threshold for smoother curves)
    const filteredPath: Point[] = [renderPath[0]];
    for (let i = 1; i < renderPath.length; i++) {
      const last = filteredPath[filteredPath.length - 1];
      const curr = renderPath[i];
      if (Math.hypot(curr.x - last.x, curr.y - last.y) > 1) {
        filteredPath.push(curr);
      }
    }

    // Smooth Sample (match server resolution of 3px)
    const activePath = samplePathByDistance(filteredPath, 3);
    if (activePath.length < 2) {
      drawSnakeHead(ctx, drawHeadPos, drawHeadDir, snake.color, isPlayer);
      return;
    }

    // 3. Draw Segmented Body (Circles)
    const baseRadius = (20 + Math.min(10, snake.length / 50)) / 2;
    const outlineColor = adjustBrightness(snake.color, -30);

    // Draw from Tail (activePath[length-1]) to Neck (activePath[1])
    for (let i = activePath.length - 1; i > 0; i--) {
      const point = activePath[i];
      const isNeck = i === 1;

      // Draw Circle Segment
      ctx.beginPath();
      ctx.arc(point.x, point.y, baseRadius, 0, Math.PI * 2);

      // Shadow (skip for neck)
      if (!isNeck) {
        ctx.shadowBlur = snake.isBoosting ? 20 : 10;
        ctx.shadowColor = snake.isBoosting ? '#ffffff' : snake.color;
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.fillStyle = snake.color;
      ctx.fill();

      // Spine / Texture Dot
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.arc(point.x, point.y, baseRadius * 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Outline
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw Head
    drawSnakeHead(ctx, drawHeadPos, drawHeadDir, snake.color, isPlayer);
    /*



    ctx.beginPath();
    ctx.moveTo(activePath[0].x, activePath[0].y);
    // Curve logic for outline
    for (let i = 1; i < activePath.length - 1; i++) {
      const xc = (activePath[i].x + activePath[i + 1].x) / 2;
      const yc = (activePath[i].y + activePath[i + 1].y) / 2;
      ctx.quadraticCurveTo(activePath[i].x, activePath[i].y, xc, yc);
    }
    if (activePath.length > 1) {
      const last = activePath[activePath.length - 1];
      ctx.lineTo(last.x, last.y);
    }
    ctx.stroke();

    // C. Inner Body (Solid)
    ctx.shadowBlur = 0;
    ctx.strokeStyle = snake.color;
    ctx.lineWidth = baseWidth;
    ctx.beginPath();
    // Move to first point
    ctx.moveTo(activePath[0].x, activePath[0].y);

    // Use Quadratic Bezier Curves for smooth organic shape
    // Connect points using midpoints as control points
    for (let i = 1; i < activePath.length - 1; i++) {
      const xc = (activePath[i].x + activePath[i + 1].x) / 2;
      const yc = (activePath[i].y + activePath[i + 1].y) / 2;
      ctx.quadraticCurveTo(activePath[i].x, activePath[i].y, xc, yc);
    }
    // Connect to last point
    if (activePath.length > 1) {
      const last = activePath[activePath.length - 1];
      ctx.lineTo(last.x, last.y);
    }
    ctx.stroke();

    // D. Spine Highlight (Subtle 3D effect)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = baseWidth * 0.3;
    ctx.beginPath();
    ctx.moveTo(activePath[0].x, activePath[0].y);
    // Same curve logic for spine
    for (let i = 1; i < activePath.length - 1; i++) {
      const xc = (activePath[i].x + activePath[i + 1].x) / 2;
      const yc = (activePath[i].y + activePath[i + 1].y) / 2;
      ctx.quadraticCurveTo(activePath[i].x, activePath[i].y, xc, yc);
    }
    if (activePath.length > 1) {
      const last = activePath[activePath.length - 1];
      ctx.lineTo(last.x, last.y);
    }
    ctx.stroke();

    ctx.restore();


    // --- PATTERN LAYER (Stripes) ---
    // If skin is "Fire" or "Ice" or "Gold", add stripes
    */
    // Re-define baseWidth for pattern layer (replaces shadowed/deleted var)
    const baseWidth = (20 + Math.min(10, snake.length / 50));

    if (snake.skinId === 'fire' || snake.skinId === 'ice' || snake.skinId === 'gold') {
      const tick = gameStateRef.current.tick || 0;
      ctx.strokeStyle = snake.skinId === 'fire' ? '#ffff00' : '#ffffff'; // Yellow for fire, White for others
      ctx.lineWidth = baseWidth;
      ctx.setLineDash([baseWidth, baseWidth * 1.5]); // Stripe pattern
      ctx.lineDashOffset = -tick * 2; // Animate flow!

      ctx.beginPath();
      ctx.moveTo(activePath[0].x, activePath[0].y);
      for (let i = 1; i < activePath.length; i++) {
        ctx.lineTo(activePath[i].x, activePath[i].y);
      }
      ctx.stroke();
      ctx.setLineDash([]); // Reset
    }

    // 5. Name Tag
    if (isPlayer || snake.length > 50) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 4;
      ctx.shadowColor = 'black';
      ctx.fillText(isPlayer ? 'YOU' : (snake.name || 'Enemy'), drawHeadPos.x, drawHeadPos.y - 30);
    }
  };

  /**
   * Sample path at fixed distances (KEY TO SMOOTH RENDERING)
   * This smooths out jitter and ensures consistent stroke rendering.
   */
  const samplePathByDistance = (path: Point[], distance: number): Point[] => {
    if (path.length < 2) return [...path];

    const segments: Point[] = [path[0]]; // Start with head
    let currentDist = 0;

    // Iterate through raw path points
    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i];
      const p2 = path[i + 1];

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.hypot(dx, dy);

      if (dist === 0) continue;

      let processedDist = 0;

      while (processedDist < dist) {
        const spaceLeft = distance - currentDist;

        if (processedDist + spaceLeft <= dist) {
          // We can reach the next sample point within this segment
          const t = (processedDist + spaceLeft) / dist;
          segments.push({
            x: p1.x + dx * t,
            y: p1.y + dy * t
          });
          currentDist = 0;
          processedDist += spaceLeft;
        } else {
          // This segment doesn't reach the next sample point
          currentDist += (dist - processedDist);
          processedDist = dist;
        }
      }
    }
    return segments;
  };



  /**
   * Draw snake head with eyes
   */
  /**
   * Draw snake head with eyes
   */
  const drawSnakeHead = (
    ctx: CanvasRenderingContext2D,
    head: Point,
    direction: number,
    color: string,
    isPlayer: boolean
  ) => {
    const headRadius = 14;

    ctx.save();

    // 1. Shadow / Glow (Match body)
    ctx.shadowBlur = 20;
    ctx.shadowColor = color;

    // 2. Head Outline (Match body outline)
    ctx.fillStyle = adjustBrightness(color, -30);
    ctx.beginPath();
    ctx.arc(head.x, head.y, headRadius + 2, 0, Math.PI * 2);
    ctx.fill();

    // 3. Head Fill (Solid color to match body stroke)
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(head.x, head.y, headRadius, 0, Math.PI * 2);
    ctx.fill();

    // 4. Highlight/Sheen (Top reflection)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.ellipse(head.x, head.y - headRadius * 0.3, headRadius * 0.5, headRadius * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // 5. Eyes
    // Position eyes based on direction
    const eyeOffset = headRadius * 0.6;
    const eyeSize = headRadius * 0.35; // Big cute eyes

    // Calculate eye positions rotated by direction
    const leftEyeAngle = direction - 0.6; // ~35 degrees
    const rightEyeAngle = direction + 0.6;

    const leftEyeX = head.x + Math.cos(leftEyeAngle) * eyeOffset;
    const leftEyeY = head.y + Math.sin(leftEyeAngle) * eyeOffset;

    const rightEyeX = head.x + Math.cos(rightEyeAngle) * eyeOffset;
    const rightEyeY = head.y + Math.sin(rightEyeAngle) * eyeOffset;

    // Draw White Sclera
    ctx.fillStyle = 'white';
    ctx.shadowBlur = 4;
    ctx.shadowColor = 'black';

    ctx.beginPath();
    ctx.arc(leftEyeX, leftEyeY, eyeSize, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(rightEyeX, rightEyeY, eyeSize, 0, Math.PI * 2);
    ctx.fill();

    // Draw Black Pupils (Looking forward)
    const pupilSize = eyeSize * 0.5;
    const pupilDist = eyeSize * 0.2;

    ctx.fillStyle = 'black';
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.arc(leftEyeX + Math.cos(direction) * pupilDist, leftEyeY + Math.sin(direction) * pupilDist, pupilSize, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(rightEyeX + Math.cos(direction) * pupilDist, rightEyeY + Math.sin(direction) * pupilDist, pupilSize, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };


  /**
   * Draw eye
   */
  const drawEye = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
    // White
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
    ctx.fill();
  };

  // Cache for brightness calculations
  const colorCache = useRef<Map<string, string>>(new Map());

  // Helper function to adjust color brightness (Memoized)
  const adjustBrightness = (color: string, amount: number): string => {
    const key = `${color}_${amount}`;
    if (colorCache.current.has(key)) return colorCache.current.get(key)!;

    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount));
    const result = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

    // Simple cache limiting
    if (colorCache.current.size > 100) colorCache.current.clear();
    colorCache.current.set(key, result);
    return result;
  };

  // Render UI
  const renderUI = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: GameState) => {
    // Render leaderboard
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 200, 30 + state.leaderboard.length * 25);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Leaderboard', 20, 30);

    ctx.font = '14px Arial';
    state.leaderboard.forEach((entry, index) => {
      ctx.fillText(
        `${entry.rank}. ${entry.name}: ${entry.score}`,
        20,
        55 + index * 25
      );
    });

    // Render player score
    const playerSnake = state.snakes.find(s => s.playerId === playerIdRef.current);
    if (playerSnake) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(canvas.width - 210, 10, 200, 50);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`Score: ${playerSnake.score}`, canvas.width - 20, 35);
      ctx.fillText(`Length: ${Math.floor(playerSnake.length)}`, canvas.width - 20, 55);

      // --- MINIMAP (Circular) ---
      const mapRadius = 75;
      const mapDiameter = mapRadius * 2;
      const mapPadding = 20;
      const mapCenterX = canvas.width - mapRadius - mapPadding;
      const mapCenterY = canvas.height - mapRadius - mapPadding;

      ctx.save();

      // 1. Clip to Circle
      ctx.beginPath();
      ctx.arc(mapCenterX, mapCenterY, mapRadius, 0, Math.PI * 2);
      ctx.clip();

      // 2. Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; // Dark background
      ctx.fill();

      // 3. Render Food on Minimap
      // World Size assumption (should be dynamic ideally)
      const worldW = 5000;
      const worldH = 5000;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; // Weak dot for food
      for (const food of state.food) {
        const fx = (food.position.x / worldW) * mapDiameter - mapRadius;
        const fy = (food.position.y / worldH) * mapDiameter - mapRadius;

        // Only draw if within circle (simple box check first optimization)
        if (fx * fx + fy * fy < mapRadius * mapRadius) {
          ctx.fillRect(mapCenterX + fx, mapCenterY + fy, 2, 2);
        }
      }

      // 4. Render Enemies on Minimap (Red Dots)
      state.snakes.forEach(s => {
        if (s.playerId === playerIdRef.current) return;
        const sx = (s.head.x / worldW) * mapDiameter - mapRadius;
        const sy = (s.head.y / worldH) * mapDiameter - mapRadius;

        ctx.beginPath();
        ctx.fillStyle = '#ff0000';
        ctx.arc(mapCenterX + sx, mapCenterY + sy, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      // 5. Player Dot
      if (playerSnake) {
        const px = (playerSnake.head.x / worldW) * mapDiameter - mapRadius;
        const py = (playerSnake.head.y / worldH) * mapDiameter - mapRadius;

        // Draw Dot
        ctx.fillStyle = '#00ff00'; // Green for player
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#00ff00';
        ctx.beginPath();
        ctx.arc(mapCenterX + px, mapCenterY + py, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Border Ring
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mapCenterX, mapCenterY, mapRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }
  };

  // Join game
  const joinGame = () => {
    if (!playerName.trim()) return;

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setIsConnecting(true); // UI State

    // Create NEW socket connection
    const newSocket = io({
      transports: ['websocket'],
      forceNew: true, // Explicitly force new connection
      reconnection: false // Manual control
    });

    newSocket.on('connect', () => {
      console.log('Connected with NEW socket ID:', newSocket.id);
      setIsConnected(true);
      setIsConnecting(false);

      // Immediately join room after connecting
      newSocket.emit('join-room', {
        playerName: playerName.trim(),
        roomId: 'main',
        skinId: selectedSkin
      });
    });

    setupSocket(newSocket);
  };

  // Connect to Lobby (Spectate/Idle state)
  const connectToLobby = () => {
    if (socketRef.current && socketRef.current.connected) return;

    const socket = io({ transports: ['websocket'] });

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    setupSocket(socket);
  };

  // State
  const [isDead, setIsDead] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Setup Socket Listeners Helper
  const setupSocket = (socket: Socket) => {
    socketRef.current = socket;

    socket.on('disconnect', () => {
      console.log('Disconnected');
      setIsConnected(false);
      setIsPlaying(false);
    });

    socket.on('game-state', (state: GameState) => {
      gameStateRef.current = state;
      // ... (rest of interpolation logic, mostly same)
      const playerSnake = state.snakes.find(s => s.playerId === playerIdRef.current);
      if (playerSnake) {
        if (!localSnakeRef.current) {
          localSnakeRef.current = {
            head: { ...playerSnake.head },
            direction: playerSnake.direction,
            targetDirection: playerSnake.direction,
            lastServerSync: Date.now(),
            path: playerSnake.path ? [...playerSnake.path].reverse() : [{ ...playerSnake.head }],
            pendingPathLength: playerSnake.length,
            currentVisualLength: playerSnake.length
          };
        } else {
          const dist = Math.hypot(
            localSnakeRef.current.head.x - playerSnake.head.x,
            localSnakeRef.current.head.y - playerSnake.head.y
          );
          if (dist > 100) {
            localSnakeRef.current.head = { ...playerSnake.head };
            localSnakeRef.current.direction = playerSnake.direction;
            localSnakeRef.current.path = playerSnake.path ? [...playerSnake.path].reverse() : [{ ...playerSnake.head }];
          } else if (dist > 20) {
            localSnakeRef.current.head.x += (playerSnake.head.x - localSnakeRef.current.head.x) * 0.1;
            localSnakeRef.current.head.y += (playerSnake.head.y - localSnakeRef.current.head.y) * 0.1;
          }
          localSnakeRef.current.pendingPathLength = playerSnake.length;
        }
      }

      const timestamp = Date.now();
      for (const snake of state.snakes) {
        if (snake.playerId !== playerIdRef.current) {
          interpolationRef.current.addSnapshot(snake.id, {
            tick: state.tick,
            timestamp,
            head: { ...snake.head },
            direction: snake.direction,
            length: snake.length,
            path: snake.path,
            name: snake.name

          });
        }
      }
    });

    socket.on('delta-update', (delta: any) => {
      applyDelta(delta);
    });

    socket.on('player-spawned', (data: { playerId: string; snakeId: string }) => {
      playerIdRef.current = data.playerId;
      setIsPlaying(true);
      setIsDead(false);
    });
  };

  // Initialize Socket.IO connection
  useEffect(() => {
    connectToLobby();
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  // Watch for death to trigger disconnect/reconnect to lobby
  useEffect(() => {
    if (!isPlaying || isDead) return;

    const checkDeath = () => {
      const state = gameStateRef.current;
      if (state.tick > 0) {
        const playerSnake = state.snakes.find(s => s.playerId === playerIdRef.current);
        if (!playerSnake) {
          setIsDead(true);
          setIsPlaying(false);
          localSnakeRef.current = null;

          // DETECTED DEATH -> Reconnect to Lobby
          if (socketRef.current) {
            console.log('Player died. Reconnecting to lobby.');
            socketRef.current.disconnect();
            setIsConnected(false); // Briefly offline
            setTimeout(connectToLobby, 100); // Reconnect
          }
        }
      }
    };

    const interval = setInterval(checkDeath, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, isDead]);

  // Also check immediately on state updates if possible, but interval is safer against race conditions

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair"
      />

      {/* Entry Screen Overlay */}
      {(!isPlaying || isDead) && (
        <EntryScreen
          playerName={playerName}
          setPlayerName={setPlayerName}
          selectedSkin={selectedSkin}
          setSelectedSkin={setSelectedSkin}
          onJoin={joinGame}
          isConnecting={isConnecting}
          isConnected={isConnected}
          isDead={isDead}
          skins={SKINS}
        />
      )}

      {/* Instructions Overlay (Minimally intrusive) */}
      {isPlaying && !isDead && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex gap-4 pointer-events-none">
          <div className="glass-panel px-4 py-1.5 rounded-full text-white/70 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
            <span className="w-4 h-4 rounded-full border border-white/30 flex items-center justify-center text-[8px] bg-white/5">M</span>
            Move
          </div>
          <div className="glass-panel px-4 py-1.5 rounded-full text-white/70 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
            <span className="w-4 h-4 rounded-full border border-white/30 flex items-center justify-center text-[8px] bg-white/5">SP</span>
            Boost
          </div>
        </div>
      )}
    </div>
  );
}
