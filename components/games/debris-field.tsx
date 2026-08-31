"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameContext } from "@/components/games/game-shell";

const W = 480;
const H = 360;
const SHIP_Y = H - 44;
const SHIP_HALF_W = 16;
const SHIP_HALF_H = 14;
const SHIP_SPEED = 430; // px/s for keyboard steering
const START_SCROLL = 190; // px/s
const MAX_SCROLL = 600;
const SCROLL_ACCEL = 13; // px/s per second

interface Rock {
  x: number;
  y: number;
  r: number;
  vy: number;
  spin: number;
  a: number;
}

export function DebrisField({ complete }: GameContext) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [phase, setPhase] = useState<"idle" | "running" | "dead">("idle");
  const [score, setScore] = useState(0);
  const finishedRef = useRef(false);

  const run = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    finishedRef.current = false;
    setPhase("running");

    let raf = 0;
    let last = performance.now();
    let scroll = START_SCROLL;
    let distance = 0;
    let spawnIn = 650;
    let shipX = W / 2;
    let pointerX = W / 2;
    let usingPointer = false;
    let keyDir = 0;
    const rocks: Rock[] = [];
    const stars = Array.from({ length: 60 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      z: 0.3 + Math.random() * 0.9,
    }));

    const rectFromCanvas = (clientX: number) => {
      const b = canvas.getBoundingClientRect();
      return ((clientX - b.left) / b.width) * W;
    };
    const onPointerMove = (e: PointerEvent) => {
      pointerX = Math.max(SHIP_HALF_W, Math.min(W - SHIP_HALF_W, rectFromCanvas(e.clientX)));
      usingPointer = true;
    };
    const onPointerDown = (e: PointerEvent) => {
      onPointerMove(e);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        keyDir = -1;
        usingPointer = false;
        e.preventDefault();
      } else if (e.code === "ArrowRight" || e.code === "KeyD") {
        keyDir = 1;
        usingPointer = false;
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (
        (e.code === "ArrowLeft" || e.code === "KeyA") && keyDir === -1
      )
        keyDir = 0;
      if ((e.code === "ArrowRight" || e.code === "KeyD") && keyDir === 1) keyDir = 0;
    };

    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const spawn = () => {
      const r = 12 + Math.random() * 16;
      rocks.push({
        x: r + Math.random() * (W - 2 * r),
        y: -r - 4,
        r,
        vy: scroll * (0.5 + Math.random() * 0.5),
        spin: (Math.random() - 0.5) * 4,
        a: Math.random() * Math.PI,
      });
      spawnIn = Math.max(230, 780 - scroll * 0.9) + Math.random() * 420;
    };

    const end = (final: number) => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      if (finishedRef.current) return;
      finishedRef.current = true;
      setScore(final);
      setPhase("dead");
      setTimeout(() => complete({ score: final }), 900);
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      scroll = Math.min(MAX_SCROLL, scroll + SCROLL_ACCEL * dt);
      distance += scroll * dt;
      spawnIn -= dt * 1000;
      if (spawnIn <= 0) spawn();

      if (usingPointer) {
        shipX += (pointerX - shipX) * Math.min(1, dt * 16);
      } else {
        shipX += keyDir * SHIP_SPEED * dt;
      }
      shipX = Math.max(SHIP_HALF_W, Math.min(W - SHIP_HALF_W, shipX));

      for (const o of rocks) {
        o.y += (o.vy + scroll * 0.35) * dt;
        o.a += o.spin * dt;
      }
      while (rocks.length && rocks[0].y - rocks[0].r > H) rocks.shift();

      // collision: circle vs ship rect
      for (const o of rocks) {
        const cx = Math.max(shipX - SHIP_HALF_W, Math.min(o.x, shipX + SHIP_HALF_W));
        const cy = Math.max(SHIP_Y - SHIP_HALF_H, Math.min(o.y, SHIP_Y + SHIP_HALF_H));
        const dx = o.x - cx;
        const dy = o.y - cy;
        if (dx * dx + dy * dy < o.r * o.r * 0.85) {
          end(Math.floor(distance / 8));
          return;
        }
      }

      // ---- draw ----
      ctx.fillStyle = "#05060b";
      ctx.fillRect(0, 0, W, H);
      for (const s of stars) {
        s.y += scroll * dt * s.z * 0.5;
        if (s.y > H) {
          s.y = 0;
          s.x = Math.random() * W;
        }
        ctx.fillStyle = `rgba(200,205,255,${0.15 + s.z * 0.5})`;
        ctx.fillRect(s.x, s.y, 2, 2);
      }

      for (const o of rocks) {
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.rotate(o.a);
        const g = ctx.createRadialGradient(-o.r * 0.3, -o.r * 0.3, o.r * 0.2, 0, 0, o.r);
        g.addColorStop(0, "#b8bccb");
        g.addColorStop(1, "#5b6070");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, o.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.35)";
        ctx.stroke();
        ctx.restore();
      }

      // ship
      ctx.font = "26px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🐵", shipX, SHIP_Y);
      ctx.strokeStyle = "rgba(124,131,255,0.35)";
      ctx.beginPath();
      ctx.moveTo(shipX - 12, SHIP_Y + 16);
      ctx.lineTo(shipX, SHIP_Y + 26);
      ctx.lineTo(shipX + 12, SHIP_Y + 16);
      ctx.stroke();

      ctx.fillStyle = "#eef0f7";
      ctx.font = "600 16px ui-monospace, monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(`${Math.floor(distance / 8)}`, W - 66, 26);

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
  }, [complete]);

  useEffect(() => {
    return () => {
      finishedRef.current = true;
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="w-full rounded-xl border border-border bg-background"
        style={{ maxWidth: W, aspectRatio: `${W} / ${H}`, touchAction: "none" }}
      />
      {phase === "idle" && (
        <button className="btn btn-primary" onClick={run}>
          Launch. Arrow keys, A / D, or drag to steer
        </button>
      )}
      {phase === "running" && (
        <p className="text-sm text-muted">
          Move left and right. Don&apos;t let a rock touch you.
        </p>
      )}
      {phase === "dead" && (
        <p className="text-lg font-bold text-bad">
          Hit! Distance {score}. Banking…
        </p>
      )}
    </div>
  );
}
