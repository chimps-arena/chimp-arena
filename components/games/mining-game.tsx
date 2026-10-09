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

const ZONE_BG = ["#241b12", "#1a222c", "#20172e", "#0c2a2e"];

type CellType = "rock" | "empty" | "ore" | "gas" | "air";

interface Cell {
  type: CellType;
  dug: boolean;
  hardness: number;
  progress: number;
}

const CELL_COLOR: Record<CellType, string> = {
  rock: "#4a3b2a",
  empty: "#0b0d14",
  ore: "#ffd23f",
  gas: "#ff5470",
  air: "#4ade80",
};

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
      ctx.fillStyle = ZONE_BG[zone] ?? ZONE_BG[0];
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      const camRow = playerRow - Math.floor(VISIBLE_ROWS / 3);
      for (let vr = 0; vr < VISIBLE_ROWS; vr++) {
        const row = camRow + vr;
        if (row < 0) continue;
        const y = vr * TILE - ((camRow < 0 ? 0 : 0));
        for (let c = 0; c < COLS; c++) {
          const cell = cellAt(row, c);
          const x = c * TILE;
          if (cell.dug) {
            ctx.fillStyle = "#0b0d14";
            ctx.fillRect(x, y, TILE, TILE);
          } else {
            ctx.fillStyle = CELL_COLOR[cell.type];
            ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
            if (cell.progress > 0) {
              ctx.fillStyle = "rgba(255,255,255,0.35)";
              ctx.fillRect(x + 1, y + TILE - 2 - (TILE - 2) * cell.progress, TILE - 2, (TILE - 2) * cell.progress);
            }
          }
        }
      }

      // player
      const py = (playerRow - camRow) * TILE;
      const px = playerCol * TILE;
      ctx.fillStyle = "#22d3ee";
      ctx.strokeStyle = "#0b0f16";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px + TILE / 2, py + TILE / 2, TILE * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (digDir) {
        ctx.fillStyle = "rgba(34,211,238,0.5)";
        ctx.fillRect(
          px + TILE / 2 + digDir.dc * TILE * 0.5 - 4,
          py + TILE / 2 + digDir.dr * TILE * 0.5 - 4,
          8,
          8,
        );
      }

      ctx.fillStyle = "#eef0f7";
      ctx.font = "600 14px ui-monospace, monospace";
      ctx.textAlign = "left";
      ctx.fillText(`${maxRowReached} m · ${zoneNameFor(maxRowReached)}`, 10, 22);
      ctx.textAlign = "right";
      ctx.fillStyle = oxygen < 15 ? "#ff5470" : "#eef0f7";
      ctx.fillText(`O2 ${Math.max(0, Math.ceil(oxygen))}s`, CANVAS_W - 10, 22);

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
          Yellow tiles are ore, red is gas (costs oxygen), green is air
          (restores it). Dig toward what you want, around what you don&apos;t.
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
