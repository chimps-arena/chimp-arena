"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { GameContext } from "@/components/games/game-shell";
import { mulberry32 } from "@/lib/game/rng";
import { TOOLS, zoneIndexFor, zoneNameFor } from "@/lib/game/mining";

const COLS = 9;
const TILE = 1.7;
/** Rows kept alive in the mesh pool at once - a fixed-size viewing window,
 *  not a streaming world (the grid itself is still generated on demand, same
 *  as before; only this many rows are ever rendered at a time). */
const POOL_ROWS = 9;
const BASE_DIG_SEC = 0.5;
const MOVE_COOLDOWN = 0.12;
/** Visual movement smoothing rate - the sim is still grid-locked, this only
 *  interpolates the rendered position between cells. */
const LERP = 10;

type CellType = "rock" | "empty" | "ore" | "gas" | "air";

interface Cell {
  type: CellType;
  dug: boolean;
  hardness: number;
  progress: number;
}

interface Particle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

// [background/fog color, fog far distance] per zone - deeper zones read
// murkier and more claustrophobic, same zone boundaries the server's
// maxDepthFor/yield rolls use.
const ZONE_FOG: Array<[string, number]> = [
  ["#241b12", 10],
  ["#1a222c", 9],
  ["#20172e", 8],
  ["#0c2a2e", 7],
];

const ORE_COLOR = "#7dd3fc";
const GAS_COLOR = "#ff5470";
const AIR_COLOR = "#4ade80";
const ROCK_COLOR = "#5a4a34";
const ROCK_DARK = "#2a2014";

function colWorldX(col: number) {
  return (col - (COLS - 1) / 2) * TILE;
}
function rowWorldY(row: number) {
  return -row * TILE;
}

/**
 * Real tile-by-tile digging (move into rock = dig it, takes time based on
 * tool power and tile hardness) - identical rules to the previous 2D canvas
 * version, now rendered as an actual 3D scene (React Three Fiber): real
 * lighting (a headlamp point light on the player carves visibility out of
 * the dark instead of a faked canvas vignette), fog for depth/atmosphere,
 * and a chase camera. Depth (deepest row reached) is still the only thing
 * that becomes the mission score - the server rolls the real resource
 * payout from depth + tool tier at settlement, same as before.
 */
const PING_INTERVAL_SEC = 4;

/** Fire-and-forget proof-of-progress ping - best-effort, a dropped ping just
 *  means a bigger (still correctly bounded) allowance on the next one. */
function pingProgress(startToken: string, depth: number) {
  void fetch("/api/mining/progress", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ startToken, depth }),
    keepalive: true,
  }).catch(() => {});
}

function Shaft({
  seed,
  toolTier,
  oxygenStart,
  startToken,
  onDepthChange,
  onOxygenChange,
  onEnd,
}: {
  seed: number;
  toolTier: 0 | 1 | 2;
  oxygenStart: number;
  startToken: string | null;
  onDepthChange: (d: number) => void;
  onOxygenChange: (o: number) => void;
  onEnd: (depth: number) => void;
}) {
  const { camera, scene } = useThree();
  const tool = TOOLS[toolTier] ?? TOOLS[0];

  const rockRefs = useRef<(THREE.Mesh | null)[]>([]);
  const crackRefs = useRef<(THREE.Mesh | null)[]>([]);
  const glyphRefs = useRef<(THREE.Mesh | null)[]>([]);
  const playerRef = useRef<THREE.Group>(null);
  const lampRef = useRef<THREE.PointLight>(null);
  const particlesRef = useRef<Particle[]>([]);
  const particlePoolRef = useRef<THREE.Mesh[]>([]);

  const simRef = useRef({
    grid: new Map<number, Cell[]>(),
    rand: mulberry32(seed),
    playerRow: 0,
    playerCol: Math.floor(COLS / 2),
    visRow: 0,
    visCol: Math.floor(COLS / 2),
    maxRowReached: 0,
    oxygen: oxygenStart,
    moveCooldown: 0,
    keys: new Set<string>(),
    ended: false,
    elapsed: 0,
    hudTimer: 0,
    pingTimer: 0,
  });

  const generateRow = useCallback((row: number): Cell[] => {
    const sim = simRef.current;
    const zone = zoneIndexFor(row);
    const cells: Cell[] = [];
    for (let c = 0; c < COLS; c++) {
      const r = sim.rand();
      let type: CellType = "rock";
      if (r < 0.12) type = "empty";
      else if (r < 0.22) type = "ore";
      else if (r < 0.3) type = "gas";
      else if (r < 0.38) type = "air";
      cells.push({
        type,
        dug: type === "empty",
        hardness: 1 + zone * 0.4 + sim.rand() * 0.6,
        progress: 0,
      });
    }
    sim.grid.set(row, cells);
    return cells;
  }, []);

  const cellAt = useCallback(
    (row: number, col: number): Cell => {
      if (col < 0 || col >= COLS) return { type: "rock", dug: false, hardness: 999, progress: 0 };
      const sim = simRef.current;
      return (sim.grid.get(row) ?? generateRow(row))[col];
    },
    [generateRow],
  );

  useEffect(() => {
    generateRow(0).forEach((c) => {
      c.type = "empty";
      c.dug = true;
    });
  }, [generateRow]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyA", "KeyD", "KeyW", "KeyS"].includes(e.code)) {
        e.preventDefault();
      }
      simRef.current.keys.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => simRef.current.keys.delete(e.code);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  function currentDir(): { dr: number; dc: number } | null {
    const k = simRef.current.keys;
    if (k.has("ArrowDown") || k.has("KeyS")) return { dr: 1, dc: 0 };
    if (k.has("ArrowLeft") || k.has("KeyA")) return { dr: 0, dc: -1 };
    if (k.has("ArrowRight") || k.has("KeyD")) return { dr: 0, dc: 1 };
    if (k.has("ArrowUp") || k.has("KeyW")) return { dr: -1, dc: 0 };
    return null;
  }

  function applyEnterEffects(cell: Cell) {
    const sim = simRef.current;
    if (cell.type === "gas") sim.oxygen = Math.max(0, sim.oxygen - 8);
    else if (cell.type === "air") sim.oxygen += 5;
  }

  function spawnBurst(row: number, col: number, type: CellType) {
    const sim = simRef.current;
    const color = type === "ore" ? ORE_COLOR : type === "gas" ? GAS_COLOR : type === "air" ? AIR_COLOR : ROCK_COLOR;
    const pool = particlePoolRef.current;
    const x = colWorldX(col);
    const y = rowWorldY(row);
    const n = type === "rock" ? 6 : 10;
    for (let i = 0; i < n; i++) {
      const mesh = pool.find((m) => !m.visible);
      if (!mesh) break;
      mesh.visible = true;
      mesh.position.set(x, y, 0);
      mesh.scale.setScalar(1);
      (mesh.material as THREE.MeshBasicMaterial).color.set(color);
      (mesh.material as THREE.MeshBasicMaterial).opacity = 1;
      const angle = sim.rand() * Math.PI * 2;
      const speed = 1.2 + sim.rand() * 2;
      particlesRef.current.push({
        mesh,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + 1.5,
        vz: (sim.rand() - 0.5) * 2,
        life: 0.5 + sim.rand() * 0.3,
        maxLife: 0.8,
      });
    }
  }

  // Mutating camera/scene straight out of useThree() inside useFrame is React
  // Three Fiber's own documented pattern (it deliberately bypasses React's
  // render cycle so animating hundreds of objects doesn't cost a re-render
  // per frame) - not an accidental render-phase mutation, so the generic
  // immutability lint rule doesn't apply to this callback.
  /* eslint-disable react-hooks/immutability */
  useFrame((_state, deltaRaw) => {
    const sim = simRef.current;
    if (sim.ended) return;
    const dt = Math.min(0.05, deltaRaw);
    sim.elapsed += dt;
    sim.oxygen -= dt;
    if (sim.oxygen <= 0) {
      sim.ended = true;
      // Final ping so the last few seconds of real progress aren't lost to
      // the regular interval not having fired again before oxygen ran out -
      // best-effort, the server clamp applies either way.
      if (startToken) pingProgress(startToken, sim.maxRowReached);
      onEnd(sim.maxRowReached);
      return;
    }

    sim.moveCooldown = Math.max(0, sim.moveCooldown - dt);
    const dir = currentDir();

    if (dir && sim.moveCooldown <= 0) {
      const targetRow = sim.playerRow + dir.dr;
      const targetCol = sim.playerCol + dir.dc;
      const target = cellAt(targetRow, targetCol);

      if (target.dug) {
        sim.playerRow = targetRow;
        sim.playerCol = targetCol;
        sim.moveCooldown = MOVE_COOLDOWN;
        if (target.type === "gas" || target.type === "air") {
          applyEnterEffects(target);
          target.type = "empty";
        }
      } else if (dir.dr >= 0) {
        // Only dig forward/down/sideways, never claw back upward through
        // undug rock - this stays a one-way-deeper mining theme.
        const digSpeed = tool.digPower / (target.hardness * BASE_DIG_SEC);
        target.progress += dt * digSpeed;
        if (target.progress >= 1) {
          target.dug = true;
          spawnBurst(targetRow, targetCol, target.type === "empty" ? "rock" : target.type);
          sim.playerRow = targetRow;
          sim.playerCol = targetCol;
          sim.moveCooldown = MOVE_COOLDOWN;
          applyEnterEffects(target);
        }
      }
    }

    sim.maxRowReached = Math.max(sim.maxRowReached, sim.playerRow);

    // smooth visual position toward the grid-locked player cell
    const rate = Math.min(1, LERP * dt);
    sim.visCol += (sim.playerCol - sim.visCol) * rate;
    sim.visRow += (sim.playerRow - sim.visRow) * rate;
    const visX = colWorldX(sim.visCol);
    const visY = rowWorldY(sim.visRow);
    const bob = Math.sin(sim.elapsed * 6) * 0.05;

    if (playerRef.current) {
      playerRef.current.position.set(visX, visY + bob, 0.3);
    }
    if (lampRef.current) {
      lampRef.current.position.set(visX, visY + 0.15, 0.7);
    }

    // chase camera - trails behind and slightly above, looking down the shaft
    const camRate = Math.min(1, 6 * dt);
    camera.position.x += (visX - camera.position.x) * camRate;
    camera.position.y += (visY + 1.1 - camera.position.y) * camRate;
    camera.position.z += (6.5 - camera.position.z) * camRate;
    camera.lookAt(visX, visY - 1, 0);

    // zone-tinted fog/background, set imperatively so it updates smoothly
    // as depth crosses a zone boundary without forcing a React re-render
    const zone = zoneIndexFor(sim.maxRowReached);
    const [fogColor, fogFar] = ZONE_FOG[zone] ?? ZONE_FOG[0];
    if (!scene.fog) scene.fog = new THREE.Fog(fogColor, 2, fogFar);
    const fog = scene.fog as THREE.Fog;
    fog.color.set(fogColor);
    fog.far = fogFar;
    if (!(scene.background instanceof THREE.Color)) scene.background = new THREE.Color(fogColor);
    (scene.background as THREE.Color).set(fogColor);

    // ---- pooled tile meshes ----
    const camRow = sim.playerRow - 2;
    for (let vr = 0; vr < POOL_ROWS; vr++) {
      const row = camRow + vr;
      for (let c = 0; c < COLS; c++) {
        const idx = vr * COLS + c;
        const rockMesh = rockRefs.current[idx];
        const crackMesh = crackRefs.current[idx];
        const glyphMesh = glyphRefs.current[idx];
        if (!rockMesh) continue;

        const x = colWorldX(c);
        const y = rowWorldY(row);
        rockMesh.position.set(x, y, 0);
        if (crackMesh) crackMesh.position.set(x, y, 0);
        if (glyphMesh) glyphMesh.position.set(x, y, 0.5);

        const cell = row < 0 ? null : cellAt(row, c);
        if (!cell || cell.dug) {
          rockMesh.visible = false;
          if (crackMesh) crackMesh.visible = false;
          if (glyphMesh) glyphMesh.visible = false;
          continue;
        }

        rockMesh.visible = true;
        (rockMesh.material as THREE.MeshStandardMaterial).color.set(
          cell.type === "rock" ? ROCK_COLOR : ROCK_DARK,
        );

        if (crackMesh) {
          crackMesh.visible = cell.progress > 0.05;
          (crackMesh.material as THREE.MeshBasicMaterial).opacity = Math.min(0.9, cell.progress);
        }

        if (glyphMesh) {
          if (cell.type === "ore" || cell.type === "gas" || cell.type === "air") {
            glyphMesh.visible = true;
            const glyphColor = cell.type === "ore" ? ORE_COLOR : cell.type === "gas" ? GAS_COLOR : AIR_COLOR;
            const mat = glyphMesh.material as THREE.MeshStandardMaterial;
            mat.color.set(glyphColor);
            mat.emissive.set(glyphColor);
            mat.emissiveIntensity = 1.3 + Math.sin(sim.elapsed * 4 + idx) * 0.4;
            if (cell.type === "air") {
              glyphMesh.position.y = y + Math.sin(sim.elapsed * 3 + idx) * 0.08;
            }
          } else {
            glyphMesh.visible = false;
          }
        }
      }
    }

    // ---- particles ----
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        particlesRef.current.splice(i, 1);
        continue;
      }
      p.vy -= 4 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      const alpha = Math.max(0, p.life / p.maxLife);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = alpha;
      p.mesh.scale.setScalar(0.4 + alpha * 0.6);
    }

    // ---- HUD (throttled - no need to re-render React 60x/sec) ----
    sim.hudTimer -= dt;
    if (sim.hudTimer <= 0) {
      sim.hudTimer = 0.1;
      onDepthChange(sim.maxRowReached);
      onOxygenChange(Math.max(0, Math.ceil(sim.oxygen)));
    }

    // ---- proof-of-progress ping (see /api/mining/progress) ----
    sim.pingTimer -= dt;
    if (sim.pingTimer <= 0) {
      sim.pingTimer = PING_INTERVAL_SEC;
      if (startToken) pingProgress(startToken, sim.maxRowReached);
    }
  });
  /* eslint-enable react-hooks/immutability */

  return (
    <>
      <ambientLight intensity={0.25} />
      <hemisphereLight intensity={0.2} groundColor={"#000000"} />
      <pointLight ref={lampRef} intensity={6} distance={6} decay={2} color={"#ffd68c"} />

      <group ref={playerRef}>
        <mesh>
          <capsuleGeometry args={[0.32, 0.3, 4, 8]} />
          <meshStandardMaterial color="#5eead4" emissive="#0e7490" emissiveIntensity={0.6} />
        </mesh>
      </group>

      {Array.from({ length: POOL_ROWS * COLS }).map((_, i) => (
        <group key={i}>
          <mesh
            ref={(el) => {
              rockRefs.current[i] = el;
            }}
          >
            <boxGeometry args={[TILE * 0.92, TILE * 0.92, TILE * 0.7]} />
            <meshStandardMaterial color={ROCK_COLOR} roughness={0.9} />
          </mesh>
          <mesh
            ref={(el) => {
              crackRefs.current[i] = el;
            }}
          >
            <boxGeometry args={[TILE * 0.96, TILE * 0.96, TILE * 0.74]} />
            <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0} />
          </mesh>
          <mesh
            ref={(el) => {
              glyphRefs.current[i] = el;
            }}
          >
            <octahedronGeometry args={[0.18, 0]} />
            <meshStandardMaterial color={ORE_COLOR} emissive={ORE_COLOR} emissiveIntensity={1.2} />
          </mesh>
        </group>
      ))}

      {Array.from({ length: 40 }).map((_, i) => (
        <mesh
          key={`p${i}`}
          visible={false}
          ref={(el) => {
            if (el) particlePoolRef.current[i] = el;
          }}
        >
          <boxGeometry args={[0.1, 0.1, 0.1]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={1} />
        </mesh>
      ))}
    </>
  );
}

export function MiningGame({ start, complete }: GameContext) {
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [depth, setDepth] = useState(0);
  const [oxygen, setOxygen] = useState(90);
  const finishedRef = useRef(false);

  const toolTier = (typeof start?.toolTier === "number" ? start.toolTier : 0) as 0 | 1 | 2;
  const oxygenStart = typeof start?.oxygenSec === "number" ? start.oxygenSec : 90;
  // Fallback is a fixed constant, not Date.now() - this only ever triggers on
  // malformed start data, and render must stay pure (no impure calls in the body).
  const seed = typeof start?.seed === "number" ? start.seed : 0x9e3779b9;
  const startToken = typeof start?.startToken === "string" ? start.startToken : null;

  const run = useCallback(() => {
    finishedRef.current = false;
    setDepth(0);
    setOxygen(oxygenStart);
    setPhase("running");
  }, [oxygenStart]);

  const handleEnd = useCallback(
    (finalDepth: number) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setDepth(finalDepth);
      setPhase("done");
      setTimeout(() => complete({ score: finalDepth }), 900);
    },
    [complete],
  );

  useEffect(() => {
    return () => {
      finishedRef.current = true;
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative w-full overflow-hidden rounded-xl border border-border bg-background"
        style={{ aspectRatio: "9 / 7", maxWidth: 520 }}
      >
        {phase === "running" && (
          <Canvas camera={{ fov: 50, position: [0, 1, 6.5] }} dpr={[1, 1.5]}>
            <Shaft
              seed={seed}
              toolTier={toolTier}
              oxygenStart={oxygenStart}
              startToken={startToken}
              onDepthChange={setDepth}
              onOxygenChange={setOxygen}
              onEnd={handleEnd}
            />
          </Canvas>
        )}
        {phase === "running" && (
          <>
            <div className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-1 font-mono text-xs text-foreground">
              {depth} m · {zoneNameFor(depth)}
            </div>
            <div
              className="absolute right-2 top-2 rounded-md bg-black/60 px-2 py-1 font-mono text-xs"
              style={{ color: oxygen < 15 ? "#ff5470" : undefined }}
            >
              O2 {oxygen}s
            </div>
          </>
        )}
      </div>
      {phase === "idle" && (
        <button className="btn btn-primary" onClick={run}>
          Drop in. Arrow keys or WASD - move into rock to dig it
        </button>
      )}
      {phase === "running" && (
        <p className="text-sm text-muted">
          Blue shards are ore, red pockets cost oxygen, green glow restores
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
