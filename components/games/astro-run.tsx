"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameContext } from "@/components/games/game-shell";

const W = 640;
const H = 280;
const GROUND_Y = 232;
const GRAVITY = 2200; // px/s^2
const JUMP_V = -720; // px/s
const START_SPEED = 240; // px/s
const MAX_SPEED = 520;
const ACCEL = 8; // px/s per second

interface Obstacle {
  x: number;
  w: number;
  h: number;
  kind: "rock" | "debris";
}

export function AstroRun({ complete }: GameContext) {
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
    let speed = START_SPEED;
    let distance = 0;
    let spawnIn = 900;
    let playerY = GROUND_Y;
    let vy = 0;
    let onGround = true;
    const obstacles: Obstacle[] = [];
    const stars = Array.from({ length: 40 }, () => ({
      x: Math.random() * W,
      y: Math.random() * (H - 40),
      z: 0.3 + Math.random() * 0.9,
    }));

    const jump = () => {
      if (onGround) {
        vy = JUMP_V;
        onGround = false;
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        jump();
      }
    };
    const onPointer = () => jump();
    window.addEventListener("keydown", onKey);
    canvas.addEventListener("pointerdown", onPointer);

    const spawn = () => {
      const kind: Obstacle["kind"] = Math.random() < 0.5 ? "rock" : "debris";
      const h = kind === "rock" ? 26 + Math.random() * 22 : 18 + Math.random() * 14;
      obstacles.push({ x: W + 20, w: 18 + Math.random() * 22, h, kind });
      spawnIn = Math.max(420, 1100 - speed * 1.1) + Math.random() * 500;
    };

    const end = (final: number) => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("pointerdown", onPointer);
      if (finishedRef.current) return;
      finishedRef.current = true;
      setScore(final);
      setPhase("dead");
      setTimeout(() => complete({ score: final }), 900);
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      speed = Math.min(MAX_SPEED, speed + ACCEL * dt);
      distance += speed * dt;
      spawnIn -= dt * 1000;
      if (spawnIn <= 0) spawn();

      vy += GRAVITY * dt;
      playerY += vy * dt;
      if (playerY >= GROUND_Y) {
        playerY = GROUND_Y;
        vy = 0;
        onGround = true;
      }

      for (const o of obstacles) o.x -= speed * dt;
      while (obstacles.length && obstacles[0].x + obstacles[0].w < -10)
        obstacles.shift();

      // collision (player box ~ 26x30 at x=70)
      const px = 70;
      const pw = 26;
      const ph = 30;
      const pTop = playerY - ph;
      for (const o of obstacles) {
        const oTop = GROUND_Y - o.h;
        if (px < o.x + o.w && px + pw > o.x && playerY > oTop && pTop < GROUND_Y) {
          if (px + pw > o.x + 3 && px < o.x + o.w - 3 && playerY - 4 > oTop) {
            end(Math.floor(distance / 8));
            return;
          }
        }
      }

      // ---- draw ----
      ctx.fillStyle = "#07070b";
      ctx.fillRect(0, 0, W, H);
      for (const s of stars) {
        s.x -= speed * dt * s.z * 0.4;
        if (s.x < 0) s.x = W;
        ctx.fillStyle = `rgba(200,200,255,${0.2 + s.z * 0.5})`;
        ctx.fillRect(s.x, s.y, 2, 2);
      }
      ctx.strokeStyle = "#262633";
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y + 2);
      ctx.lineTo(W, GROUND_Y + 2);
      ctx.stroke();

      ctx.font = "24px system-ui";
      ctx.fillText("🐵", px - 2, playerY);

      for (const o of obstacles) {
        ctx.fillStyle = o.kind === "rock" ? "#8b5cf6" : "#ef4444";
        ctx.fillRect(o.x, GROUND_Y - o.h, o.w, o.h);
      }

      ctx.fillStyle = "#ededf2";
      ctx.font = "bold 16px ui-monospace, monospace";
      ctx.fillText(`${Math.floor(distance / 8)}`, W - 70, 28);

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
        className="w-full max-w-full rounded-xl border border-border bg-background"
        style={{ touchAction: "none" }}
      />
      {phase === "idle" && (
        <button className="btn btn-primary" onClick={run}>
          Launch — Space / tap to jump
        </button>
      )}
      {phase === "running" && (
        <p className="text-sm text-muted">Space, ↑, or tap the canvas to jump.</p>
      )}
      {phase === "dead" && (
        <p className="text-lg font-bold text-bad">
          Crashed! Distance {score} — banking…
        </p>
      )}
    </div>
  );
}
