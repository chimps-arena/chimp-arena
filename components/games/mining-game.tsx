"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameContext } from "@/components/games/game-shell";
import { mulberry32 } from "@/lib/game/rng";
import { TOOLS, zoneIndexFor, zoneNameFor } from "@/lib/game/mining";

const TILE = 48;
const COLS = 9;
const CANVAS_W = TILE * COLS;
const CANVAS_H = 360;
const VISIBLE_ROWS = Math.ceil(CANVAS_H / TILE) + 1;
const BASE_DIG_SEC = 0.5;
const MOVE_COOLDOWN = 0.12;

type CellType = "rock" | "empty" | "ore" | "gas" | "air";

interface Cell {
  type: CellType;
  dug: boolean;
  hardness: number;
  progress: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

// [top, bottom] of a vertical gradient per zone - darker/cooler the deeper
// the zone, same zone boundaries as the server's maxDepthFor/yield rolls.
const ZONE_GRAD: Array<[string, string]> = [
  ["#2b2116", "#1a1309"],
  ["#1c2430", "#0f141c"],
  ["#241a33", "#140d1f"],
  ["#0d2a2d", "#071618"],
];

const ORE_GLOW = "#7dd3fc";
const GAS_GLOW = "#ff5470";
const AIR_GLOW = "#4ade80";
const ROCK_BASE = "#473a2a";
const ROCK_EDGE = "#2c2319";

function cellHash(row: number, col: number): number {
  const x = Math.sin(row * 374761393 + col * 668265263) * 43758.5453;
  return x - Math.floor(x);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawOreGlyph(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.save();
  ctx.shadowColor = ORE_GLOW;
  ctx.shadowBlur = 8;
  ctx.fillStyle = ORE_GLOW;
  for (const [dx, dy, sz] of [
    [-5, 2, 1],
    [5, -3, 0.8],
    [1, 5, 0.65],
  ] as const) {
    ctx.save();
    ctx.translate(cx + dx * (s / 20), cy + dy * (s / 20));
    ctx.rotate(Math.PI / 4);
    const r = (s / 7) * sz;
    ctx.fillRect(-r / 2, -r / 2, r, r);
    ctx.restore();
  }
  ctx.restore();
}

function drawGasGlyph(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.save();
  ctx.shadowColor = GAS_GLOW;
  ctx.shadowBlur = 9;
  ctx.fillStyle = "rgba(255,84,112,0.85)";
  for (const [dx, dy, r] of [
    [0, -4, 4.5],
    [-6, 4, 3.2],
    [6, 4, 3.2],
  ] as const) {
    ctx.beginPath();
    ctx.arc(cx + dx * (s / 20), cy + dy * (s / 20), r * (s / 24), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawAirGlyph(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, t: number) {
  ctx.save();
  ctx.shadowColor = AIR_GLOW;
  ctx.shadowBlur = 7;
  ctx.strokeStyle = AIR_GLOW;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  const bob = Math.sin(t * 3) * 2;
  for (const yOff of [-7, 3]) {
    const y = cy + yOff + bob;
    ctx.beginPath();
    ctx.moveTo(cx - 7 * (s / 24), y + 4);
    ctx.lineTo(cx, y - 4);
    ctx.lineTo(cx + 7 * (s / 24), y + 4);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCrack(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, progress: number, row: number, col: number) {
  if (progress <= 0.08) return;
  const h = cellHash(row, col);
  const cx = x + size / 2;
  const cy = y + size / 2;
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  const legs = progress > 0.55 ? 3 : progress > 0.3 ? 2 : 1;
  for (let i = 0; i < legs; i++) {
    const angle = h * Math.PI * 2 + (i * Math.PI * 2) / 3;
    const len = size * 0.32 * Math.min(1, progress + 0.15);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Real tile-by-tile digging (move into rock = dig it, takes time based on
 * tool power and tile hardness) - ore/gas/air tiles are visible before you
 * dig them, so reaching depth is an active, spatial choice (dig toward
 * visible ore, route around gas) rather than passively dodging falling
 * shapes. Depth (deepest row reached) is still the only thing that becomes
 * the mission score - ore sparkles here are cosmetic, the server rolls the
 * real resource payout from depth + tool tier at settlement.
 */
export function MiningGame({ start, complete }: GameContext) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [depth, setDepth] = useState(0);
  const finishedRef = useRef(false);

  const toolTier = (typeof start?.toolTier === "number" ? start.toolTier : 0) as 0 | 1 | 2;
  const oxygenStart = typeof start?.oxygenSec === "number" ? start.oxygenSec : 90;
  // Fallback is a fixed constant, not Date.now() - this only ever triggers on
  // malformed start data, and render must stay pure (no impure calls in the body).
  const seed = typeof start?.seed === "number" ? start.seed : 0x9e3779b9;
  const tool = TOOLS[toolTier] ?? TOOLS[0];

  const run = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    finishedRef.current = false;
    setPhase("running");

    const rand = mulberry32(seed);
    const grid = new Map<number, Cell[]>();
    const particles: Particle[] = [];

    function spawnBurst(row: number, col: number, type: CellType) {
      const cx = col * TILE + TILE / 2;
      const cy = row * TILE + TILE / 2; // screen-space, offset applied at draw time via camRow
      const color =
        type === "ore" ? ORE_GLOW : type === "gas" ? GAS_GLOW : type === "air" ? AIR_GLOW : "#8a7a5e";
      const n = type === "rock" ? 6 : 10;
      for (let i = 0; i < n; i++) {
        const angle = rand() * Math.PI * 2;
        const speed = 40 + rand() * 90;
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 40,
          life: 0.4 + rand() * 0.3,
          maxLife: 0.7,
          color,
          size: 2 + rand() * 2.5,
        });
      }
    }

    function generateRow(row: number): Cell[] {
      const zone = zoneIndexFor(row);
      const cells: Cell[] = [];
      for (let c = 0; c < COLS; c++) {
        const r = rand();
        let type: CellType = "rock";
        if (r < 0.12) type = "empty";
        else if (r < 0.22) type = "ore";
        else if (r < 0.3) type = "gas";
        else if (r < 0.38) type = "air";
        cells.push({ type, dug: type === "empty", hardness: 1 + zone * 0.4 + rand() * 0.6, progress: 0 });
      }
      grid.set(row, cells);
      return cells;
    }

    function cellAt(row: number, col: number): Cell {
      if (col < 0 || col >= COLS) return { type: "rock", dug: false, hardness: 999, progress: 0 };
      return (grid.get(row) ?? generateRow(row))[col];
    }

    // Start on an open row so the player isn't boxed in immediately.
    const startRow = 0;
    generateRow(startRow).forEach((c) => {
      c.type = "empty";
      c.dug = true;
    });
    let playerRow = startRow;
    let playerCol = Math.floor(COLS / 2);
    let maxRowReached = 0;
    let oxygen = oxygenStart;
    let moveCooldown = 0;
    let digDir: { dr: number; dc: number } | null = null;
    let raf = 0;
    let last = performance.now();
    let elapsed = 0;

    const keys = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyA", "KeyD", "KeyW", "KeyS"].includes(e.code)) {
        e.preventDefault();
      }
      keys.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    function currentDir(): { dr: number; dc: number } | null {
      if (keys.has("ArrowDown") || keys.has("KeyS")) return { dr: 1, dc: 0 };
      if (keys.has("ArrowLeft") || keys.has("KeyA")) return { dr: 0, dc: -1 };
      if (keys.has("ArrowRight") || keys.has("KeyD")) return { dr: 0, dc: 1 };
      if (keys.has("ArrowUp") || keys.has("KeyW")) return { dr: -1, dc: 0 };
      return null;
    }

    function applyEnterEffects(cell: Cell) {
      if (cell.type === "gas") oxygen = Math.max(0, oxygen - 8);
      else if (cell.type === "air") oxygen += 5;
    }

    const end = (finalDepth: number) => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      if (finishedRef.current) return;
      finishedRef.current = true;
      setDepth(finalDepth);
      setPhase("done");
      setTimeout(() => complete({ score: finalDepth }), 900);
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += dt;
      oxygen -= dt;
      if (oxygen <= 0) {
        end(maxRowReached);
        return;
      }

      moveCooldown = Math.max(0, moveCooldown - dt);
      const dir = currentDir();

      if (dir && moveCooldown <= 0) {
        const targetRow = playerRow + dir.dr;
        const targetCol = playerCol + dir.dc;
        const target = cellAt(targetRow, targetCol);

        if (target.dug) {
          playerRow = targetRow;
          playerCol = targetCol;
          moveCooldown = MOVE_COOLDOWN;
          digDir = null;
          if (target.type === "gas" || target.type === "air") {
            applyEnterEffects(target);
            target.type = "empty"; // one-time effect, don't re-trigger
          }
        } else if (dir.dr >= 0) {
          // Only dig forward/down/sideways, never claw back upward through
          // undug rock - this stays a one-way-deeper mining theme.
          digDir = dir;
          const digSpeed = tool.digPower / (target.hardness * BASE_DIG_SEC);
          target.progress += dt * digSpeed;
          if (target.progress >= 1) {
            target.dug = true;
            spawnBurst(targetRow, targetCol, target.type === "empty" ? "rock" : target.type);
            playerRow = targetRow;
            playerCol = targetCol;
            moveCooldown = MOVE_COOLDOWN;
            digDir = null;
            applyEnterEffects(target);
          }
        }
      } else if (!dir) {
        digDir = null;
      }

      maxRowReached = Math.max(maxRowReached, playerRow);

      // ---- draw ----
      const zone = zoneIndexFor(playerRow);
      const [gTop, gBottom] = ZONE_GRAD[zone] ?? ZONE_GRAD[0];
      const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      bgGrad.addColorStop(0, gTop);
      bgGrad.addColorStop(1, gBottom);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      const camRow = playerRow - Math.floor(VISIBLE_ROWS / 3);
      for (let vr = 0; vr < VISIBLE_ROWS; vr++) {
        const row = camRow + vr;
        if (row < 0) continue;
        const y = vr * TILE;
        for (let c = 0; c < COLS; c++) {
          const cell = cellAt(row, c);
          const x = c * TILE;
          if (cell.dug) {
            ctx.fillStyle = "#0a0c12";
            ctx.fillRect(x, y, TILE, TILE);
            ctx.strokeStyle = "rgba(255,255,255,0.03)";
            ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
            continue;
          }

          if (cell.type === "gas" || cell.type === "ore" || cell.type === "air") {
            // Visible-but-undug special tiles sit in a slightly darker rock
            // pocket so the glyph reads clearly against it.
            ctx.fillStyle = ROCK_EDGE;
            ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
          } else {
            ctx.fillStyle = ROCK_BASE;
            ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
            // cheap per-tile speckle texture, deterministic so it doesn't swim
            const h = cellHash(row, c);
            ctx.fillStyle = "rgba(0,0,0,0.12)";
            ctx.fillRect(x + 6 + h * 10, y + 10 + h * 14, 5, 5);
            ctx.fillRect(x + 24 + (1 - h) * 10, y + 24 + h * 8, 4, 4);
          }
          ctx.strokeStyle = "rgba(0,0,0,0.35)";
          ctx.strokeRect(x + 1.5, y + 1.5, TILE - 3, TILE - 3);

          const cx = x + TILE / 2;
          const cy = y + TILE / 2;
          if (cell.type === "ore") drawOreGlyph(ctx, cx, cy, TILE);
          else if (cell.type === "gas") drawGasGlyph(ctx, cx, cy, TILE);
          else if (cell.type === "air") drawAirGlyph(ctx, cx, cy, TILE, elapsed);

          drawCrack(ctx, x, y, TILE, cell.progress, row, c);
        }
      }

      // particles (screen-space already, offset by camRow)
      const camOffsetY = camRow * TILE;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        p.vy += 160 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - camOffsetY - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;

      // player screen position
      const py = (playerRow - camRow) * TILE;
      const px = playerCol * TILE;
      const pcx = px + TILE / 2;
      const pcy = py + TILE / 2;

      // vignette: darken tiles far from the player, then a warm headlamp
      // bloom near them - this is what gives the dig site actual depth/mood
      // instead of flat, evenly-lit tiles.
      const vignette = ctx.createRadialGradient(pcx, pcy, TILE * 0.8, pcx, pcy, TILE * 3.6);
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, "rgba(0,0,0,0.62)");
      ctx.fillStyle = vignette;
      ctx.globalCompositeOperation = "multiply";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.globalCompositeOperation = "source-over";

      const bloom = ctx.createRadialGradient(pcx, pcy, 0, pcx, pcy, TILE * 2.1);
      bloom.addColorStop(0, "rgba(255,214,140,0.28)");
      bloom.addColorStop(1, "rgba(255,214,140,0)");
      ctx.fillStyle = bloom;
      ctx.globalCompositeOperation = "lighter";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.globalCompositeOperation = "source-over";

      // player rig: rounded body + headlamp aimed at the dig/move direction
      const bob = Math.sin(elapsed * 6) * 1.5;
      const facing = digDir ?? dir ?? { dr: 0, dc: 0 };
      ctx.save();
      ctx.translate(pcx, pcy + bob);

      ctx.shadowColor = "rgba(34,211,238,0.6)";
      ctx.shadowBlur = 10;
      const bodyGrad = ctx.createLinearGradient(0, -TILE * 0.3, 0, TILE * 0.3);
      bodyGrad.addColorStop(0, "#5eead4");
      bodyGrad.addColorStop(1, "#0e7490");
      ctx.fillStyle = bodyGrad;
      ctx.strokeStyle = "#07252b";
      ctx.lineWidth = 2;
      roundRect(ctx, -TILE * 0.26, -TILE * 0.26, TILE * 0.52, TILE * 0.52, 8);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // headlamp cone in the facing direction
      if (facing.dr !== 0 || facing.dc !== 0) {
        const lampX = facing.dc * TILE * 0.3;
        const lampY = facing.dr * TILE * 0.3;
        ctx.fillStyle = "#fff6d8";
        ctx.beginPath();
        ctx.arc(lampX, lampY, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // ---- HUD ----
      ctx.textAlign = "left";
      ctx.font = "600 13px ui-monospace, monospace";
      const depthLabel = `${maxRowReached} m · ${zoneNameFor(maxRowReached)}`;
      const depthW = ctx.measureText(depthLabel).width;
      ctx.fillStyle = "rgba(10,12,18,0.72)";
      roundRect(ctx, 6, 6, depthW + 16, 24, 7);
      ctx.fill();
      ctx.fillStyle = "#eef0f7";
      ctx.fillText(depthLabel, 14, 22);

      const oxyLabel = `O2 ${Math.max(0, Math.ceil(oxygen))}s`;
      ctx.textAlign = "right";
      const oxyW = ctx.measureText(oxyLabel).width;
      ctx.fillStyle = "rgba(10,12,18,0.72)";
      roundRect(ctx, CANVAS_W - 10 - oxyW - 16, 6, oxyW + 16, 24, 7);
      ctx.fill();
      ctx.fillStyle = oxygen < 15 ? "#ff5470" : "#eef0f7";
      ctx.fillText(oxyLabel, CANVAS_W - 14, 22);

      setDepth(maxRowReached);
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
  }, [complete, oxygenStart, seed, tool]);

  useEffect(() => {
    return () => {
      finishedRef.current = true;
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="w-full rounded-xl border border-border bg-background"
        style={{ maxWidth: CANVAS_W, aspectRatio: `${CANVAS_W} / ${CANVAS_H}`, touchAction: "none" }}
      />
      {phase === "idle" && (
        <button className="btn btn-primary" onClick={run}>
          Drop in. Arrow keys or WASD - move into rock to dig it
        </button>
      )}
      {phase === "running" && (
        <p className="text-sm text-muted">
          Blue shards are ore, red pockets cost oxygen, green chevrons restore
          it. Dig toward what you want, around what you don&apos;t.
        </p>
      )}
      {phase === "done" && (
        <p className="text-lg font-bold text-accent">
          Out of oxygen. Reached {depth} m. Surfacing…
        </p>
      )}
    </div>
  );
}
