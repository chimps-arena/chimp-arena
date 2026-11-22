"use client";

/**
 * The ground, the Core plaza and its Astrocorp tower, the safe-zone wall,
 * roads out to the three districts, scattered asteroid rock, and the sky.
 */

import type { Cover } from "@chimp-arena/shared";
import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Environment, Html, Lightformer, Stars } from "@react-three/drei";
import * as THREE from "three";
import { DISTRICTS, ROAD_ANGLES, SAFE_RADIUS, WORLD_RADIUS, LOT_SPACING } from "@chimp-arena/shared";
import { preloadCoreItems, ResourceExchange } from "./items";

preloadCoreItems();

/** Solid things the local player can't walk through: [x, z, radius]. */
/** Astrocorp HQ: [x, z, radius, height] (see Cover in shared/world-layout). */
export const STATIC_COLLIDERS: Cover[] = [[0, 0, 6.5, 60]];

export const DISTRICT_HALF = LOT_SPACING * 3.6;

function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[WORLD_RADIUS + 120, 96]} />
        <meshStandardMaterial color="#3a3046" roughness={0.95} />
      </mesh>
      {/* Core plaza */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[SAFE_RADIUS, 96]} />
        <meshStandardMaterial map={plazaTiles()} metalness={0.35} roughness={0.42} />
      </mesh>
      {[14, 32, SAFE_RADIUS - 0.4].map((r, i) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <ringGeometry args={[r - 0.15, r + 0.15, 128]} />
          <meshBasicMaterial color={i === 0 ? "#f5b301" : "#a855f7"} toneMapped={false} />
        </mesh>
      ))}
      {/* district pads */}
      {DISTRICTS.map((d) => (
        <group key={d.zone} position={[d.x, 0, d.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
            <planeGeometry args={[DISTRICT_HALF * 2, DISTRICT_HALF * 2]} />
            <meshStandardMaterial color={d.ground} metalness={0.15} roughness={0.85} />
          </mesh>
          <lineSegments rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
            <edgesGeometry args={[new THREE.PlaneGeometry(DISTRICT_HALF * 2, DISTRICT_HALF * 2)]} />
            <lineBasicMaterial color={d.accent} />
          </lineSegments>
          <Html position={[0, 34, 0]} center distanceFactor={60} style={{ pointerEvents: "none" }}>
            <div className="whitespace-nowrap text-center text-2xl font-black uppercase tracking-[0.3em]" style={{ color: d.accent, textShadow: "0 0 12px rgba(0,0,0,.9)" }}>
              {d.zone}
              <div className="text-xs font-bold tracking-widest text-red-400">Combat zone</div>
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}

function Roads() {
  return (
    <group>
      {ROAD_ANGLES.map((a, i) => {
        const d = DISTRICTS[i];
        const start = SAFE_RADIUS - 2;
        const end = Math.hypot(d.x, d.z) - DISTRICT_HALF + 2;
        const len = end - start;
        const mid = start + len / 2;
        return (
          <group key={a} position={[Math.sin(a) * mid, 0.015, Math.cos(a) * mid]} rotation={[0, a, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[12, len]} />
              <meshStandardMaterial color="#3a3448" metalness={0.25} roughness={0.6} />
            </mesh>
            {[-5.9, 5.9].map((x) => (
              <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.01, 0]}>
                <planeGeometry args={[0.2, len]} />
                <meshBasicMaterial color={d.accent} toneMapped={false} />
              </mesh>
            ))}
            {Array.from({ length: Math.floor(len / 10) }, (_, k) => (
              <mesh key={k} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -len / 2 + 5 + k * 10]}>
                <planeGeometry args={[0.25, 4]} />
                <meshBasicMaterial color="#f5f5f5" />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

/** Translucent energy wall marking the safe zone, with gates at the roads. */
function SafeWall() {
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (mat.current) mat.current.opacity = 0.1 + Math.sin(clock.elapsedTime * 1.5) * 0.03;
  });
  const posts = useMemo(() => Array.from({ length: 48 }, (_, i) => (i / 48) * Math.PI * 2), []);
  return (
    <group>
      <mesh position={[0, 2.5, 0]}>
        <cylinderGeometry args={[SAFE_RADIUS, SAFE_RADIUS, 5, 96, 1, true]} />
        <meshBasicMaterial ref={mat} color="#a855f7" transparent opacity={0.1} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
      {posts.map((a) => (
        <group key={a} position={[Math.sin(a) * SAFE_RADIUS, 0, Math.cos(a) * SAFE_RADIUS]}>
          <mesh position={[0, 2.6, 0]}>
            <cylinderGeometry args={[0.12, 0.16, 5.2, 6]} />
            <meshStandardMaterial color="#5a5470" metalness={0.6} roughness={0.35} />
          </mesh>
          <mesh position={[0, 5.3, 0]}>
            <sphereGeometry args={[0.24, 10, 8]} />
            <meshBasicMaterial color="#f5b301" toneMapped={false} />
          </mesh>
        </group>
      ))}
      {ROAD_ANGLES.map((a) => (
        <Html key={a} position={[Math.sin(a) * (SAFE_RADIUS + 1), 7, Math.cos(a) * (SAFE_RADIUS + 1)]} center distanceFactor={30} style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded bg-black/70 px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest text-red-300">
            ⚠ Leaving safe zone
          </div>
        </Html>
      ))}
    </group>
  );
}

function Tower() {
  const crown = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (crown.current) crown.current.rotation.y += dt * 0.3;
  });
  return (
    <group>
      <mesh position={[0, 16, 0]}>
        <cylinderGeometry args={[4.2, 5.5, 32, 8]} />
        <meshStandardMaterial color="#3a3552" metalness={0.75} roughness={0.22} />
      </mesh>
      {[4, 10, 16, 22, 28].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <cylinderGeometry args={[5.6 - y * 0.042, 5.6 - y * 0.042, 0.3, 8, 1, true]} />
          <meshBasicMaterial color="#a855f7" toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <group ref={crown} position={[0, 33.5, 0]}>
        {Array.from({ length: 5 }, (_, i) => {
          const a = (i / 5) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.sin(a) * 3, i % 2 ? 1.4 : 2.2, Math.cos(a) * 3]}>
              <coneGeometry args={[0.8, i % 2 ? 2.8 : 4.4, 4]} />
              <meshBasicMaterial color="#f5b301" toneMapped={false} />
            </mesh>
          );
        })}
      </group>
      <pointLight position={[0, 36, 0]} color="#a855f7" intensity={500} distance={110} />
      <Html position={[0, 6, 6]} center distanceFactor={20} style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap text-center text-sm font-black uppercase tracking-[0.25em] text-amber-300" style={{ textShadow: "0 0 10px #000" }}>
          Astrocorp HQ
          <div className="text-[10px] font-semibold tracking-widest text-emerald-300">Astroworld Core · Safe zone</div>
        </div>
      </Html>
    </group>
  );
}

/** Asteroid rock scattered between districts (instanced: one draw call). */
function Rocks() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 600;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    let placed = 0;
    for (let tries = 0; placed < count && tries < count * 10; tries++) {
      const a = rnd() * Math.PI * 2;
      const r = SAFE_RADIUS + 12 + rnd() * (WORLD_RADIUS - SAFE_RADIUS);
      const x = Math.sin(a) * r;
      const z = Math.cos(a) * r;
      if (DISTRICTS.some((d) => Math.abs(x - d.x) < DISTRICT_HALF + 4 && Math.abs(z - d.z) < DISTRICT_HALF + 4)) continue;
      if (ROAD_ANGLES.some((ra) => Math.abs(Math.sin(a - ra) * r) < 10 && Math.cos(a - ra) > 0)) continue;
      const s = 0.6 + rnd() * 3.2;
      q.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3));
      m.compose(new THREE.Vector3(x, s * 0.3, z), q, new THREE.Vector3(s, s * (0.5 + rnd() * 0.6), s));
      mesh.setMatrixAt(placed++, m);
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#5a4a52" roughness={1} flatShading />
    </instancedMesh>
  );
}

/** Plaza floor: metal tiles with lit seams, drawn once into a texture. */
let tiles: THREE.CanvasTexture | null = null;
function plazaTiles(): THREE.CanvasTexture {
  if (tiles) return tiles;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#3b3552";
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 2; y++)
    for (let x = 0; x < 2; x++) {
      // slight per-tile variation so the floor doesn't look printed
      g.fillStyle = (x + y) % 2 ? "#433c5c" : "#38324d";
      g.fillRect(x * 128 + 3, y * 128 + 3, 122, 122);
    }
  g.strokeStyle = "#7a6aa8";
  g.lineWidth = 2;
  for (let i = 0; i <= 256; i += 128) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, 256);
    g.moveTo(0, i);
    g.lineTo(256, i);
    g.stroke();
  }
  tiles = new THREE.CanvasTexture(c);
  tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping;
  tiles.repeat.set(36, 36);
  tiles.colorSpace = THREE.SRGBColorSpace;
  tiles.anisotropy = 8;
  return tiles;
}

/** Big inverted sphere: deep violet overhead, glowing horizon. */
const skyMaterial = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
  uniforms: {
    top: { value: new THREE.Color("#0b0820") },
    mid: { value: new THREE.Color("#2b1d5c") },
    horizon: { value: new THREE.Color("#7a4fb0") },
  },
  vertexShader: "varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader:
    "uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; varying vec3 vDir;" +
    "void main(){ float h = vDir.y; vec3 c = mix(horizon, mid, smoothstep(0.0, 0.18, h)); c = mix(c, top, smoothstep(0.18, 0.7, h));" +
    "c = mix(c, horizon * 0.6, smoothstep(0.0, -0.2, h)); gl_FragColor = vec4(c, 1.0); }",
});

/**
 * Lights + a generated reflection environment. Metal and glass only look like
 * metal and glass when there's something to reflect - without this they read
 * as flat black.
 */
export function WorldLighting() {
  return (
    <>
      <ambientLight intensity={0.55} color="#d8ccff" />
      <hemisphereLight args={["#cbb8ff", "#4a3a58", 1.1]} />
      <directionalLight position={[80, 120, 60]} intensity={2.4} color="#ffe2b8" />
      <directionalLight position={[-90, 60, -80]} intensity={0.9} color="#8fb4ff" />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.2} color="#b9a2ff" scale={[200, 60, 1]} position={[0, 40, -80]} />
        <Lightformer form="rect" intensity={1.4} color="#ffcf8a" scale={[120, 40, 1]} position={[80, 30, 60]} rotation-y={-Math.PI / 2} />
        <Lightformer form="rect" intensity={1.2} color="#7fd8ff" scale={[120, 40, 1]} position={[-80, 20, 40]} rotation-y={Math.PI / 2} />
        <Lightformer form="ring" intensity={3} color="#a855f7" scale={40} position={[0, 80, 0]} rotation-x={Math.PI / 2} />
        <Lightformer form="rect" intensity={0.6} color="#2b1d5c" scale={[400, 400, 1]} position={[0, -10, 0]} rotation-x={-Math.PI / 2} />
      </Environment>
    </>
  );
}

function Sky() {
  return (
    <group>
      <mesh material={skyMaterial} renderOrder={-10}>
        <sphereGeometry args={[2000, 32, 16]} />
      </mesh>
      <Stars radius={1500} depth={200} count={5000} factor={6} fade speed={0.4} />
      <group position={[-260, 140, -420]} rotation={[0.3, 0, 0.35]}>
        <mesh>
          <sphereGeometry args={[90, 48, 32]} />
          <meshStandardMaterial color="#6b5ca8" emissive="#3b2a7a" emissiveIntensity={0.6} roughness={1} />
        </mesh>
        <mesh rotation={[Math.PI / 2.3, 0, 0]}>
          <ringGeometry args={[115, 160, 96]} />
          <meshBasicMaterial color="#b9a6ff" transparent opacity={0.35} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      </group>
      <mesh position={[380, 90, 260]}>
        <sphereGeometry args={[22, 32, 24]} />
        <meshStandardMaterial color="#9a9aa8" emissive="#555566" emissiveIntensity={0.4} roughness={1} />
      </mesh>
    </group>
  );
}

/** Rover showroom pad in the Core. */
export const SHOWROOM = { x: 26, z: -14 };

export function WorldScenery({ showroomRover, showroomLot }: { showroomRover: React.ReactNode; showroomLot?: React.ReactNode }) {
  const spin = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += dt * 0.25;
  });
  return (
    <group>
      <Sky />
      <Ground />
      <Roads />
      <SafeWall />
      <Tower />
      <ResourceExchange />
      <Rocks />
      <group position={[SHOWROOM.x, 0, SHOWROOM.z]}>
        <mesh position={[0, 0.15, 0]}>
          <cylinderGeometry args={[4.5, 4.8, 0.3, 6]} />
          <meshStandardMaterial color="#4a4466" metalness={0.6} roughness={0.3} />
        </mesh>
        <group ref={spin} position={[0, 0.3, 0]}>
          {showroomRover}
        </group>
        {showroomLot}
        <pointLight position={[0, 6, 0]} color="#f5b301" intensity={60} distance={14} />
        <Html position={[0, 4.4, 0]} center distanceFactor={14} style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded border border-amber-400/60 bg-black/75 px-2 py-1 text-center text-[11px] font-bold uppercase tracking-wider text-amber-300">
            Rover Showroom
            <div className="text-[9px] font-normal normal-case text-white/70">Press F anywhere for a free test rover</div>
          </div>
        </Html>
      </group>
    </group>
  );
}
