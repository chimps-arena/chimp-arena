"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

// One metre per unit. These are clear interior extents, not the exterior lot bounds.
const HALL = [-3, 9, -7, 8.2] as const;
const ROOM = [-9, -3, -2.5, 2.5] as const;
const BAY = [0, 6, -3, 3] as const;
const CONSOLE = [-8.1, -6.3, -2.3, -1.45] as const;
const SPAWN = [-8, 0] as const;
const CONSOLE_POINT = [-7.2, -0.8] as const;
const RADIUS = 0.5;
const FLOOR = "#343441";
const WALL = "#353849";
const TRIM = "#777486";
const HOT = "#ff7b32";
const FLOW_RATE = 0.55;

type HUD = "entry" | "console" | "hall" | "view" | "room";
type Vec = [number, number, number];
type Rect = readonly [number, number, number, number];
const within = (x: number, z: number, b: Rect) => x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3];
function walkable(x: number, z: number, radius = RADIUS) {
  for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [.707, .707], [.707, -.707], [-.707, .707], [-.707, -.707]]) {
    const px = x + dx * radius, pz = z + dz * radius;
    const doorway = Math.abs(pz) <= 1.35;
    const room = within(px, pz, ROOM) && (doorway || px < -3.22);
    const hall = within(px, pz, HALL) && (doorway || px > -2.78);
    if ((!room && !hall) || within(px, pz, BAY) || within(px, pz, CONSOLE)) return false;
  }
  return true;
}

function Block({ p, s, color = WALL, glow }: { p: Vec; s: Vec; color?: string; glow?: string }) {
  return <mesh position={p}><boxGeometry args={s} /><meshStandardMaterial color={color} roughness={0.78} emissive={glow} emissiveIntensity={glow ? 1.4 : 0} /></mesh>;
}
function Drum({ p, sizes, color, glow }: { p: Vec; sizes: [number, number, number]; color: string; glow?: string }) {
  return <mesh position={p}><cylinderGeometry args={[...sizes, 20]} /><meshStandardMaterial color={color} metalness={0.33} roughness={0.69} emissive={glow} emissiveIntensity={glow ? 1.5 : 0} /></mesh>;
}

function Flow() {
  const markers = useRef<(THREE.Mesh | null)[]>([]);
  const surface = useRef<THREE.MeshStandardMaterial>(null);
  const route = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(2.4, 2.25, 0.32), new THREE.Vector3(2.4, 1.96, 1.28),
    new THREE.Vector3(2.4, 1.58, 1.86), new THREE.Vector3(2.4, 0.72, 2.04),
  ]), []);
  const tube = useMemo(() => new THREE.TubeGeometry(route, 28, 0.16, 10, false), [route]);
  useEffect(() => () => tube.dispose(), [tube]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    markers.current.forEach((band, i) => {
      if (!band) return;
      const phase = (t * FLOW_RATE + i / 5) % 1;
      const p = route.getPointAt(phase);
      const direction = route.getTangentAt(phase);
      band.position.copy(p);
      band.rotation.x = Math.atan2(direction.z, direction.y) - Math.PI / 2;
      band.scale.setScalar(0.88 + Math.sin(phase * Math.PI) * 0.15);
    });
    if (surface.current) surface.current.emissiveIntensity = 1.05 + Math.sin(t * 8 * FLOW_RATE / 0.95) * 0.19;
  });
  return <>
    <mesh geometry={tube}><meshStandardMaterial color="#ff7431" roughness={0.85} emissive="#ff4310" emissiveIntensity={1.05} /></mesh>
    {Array.from({ length: 5 }, (_, i) => <mesh key={i} ref={(m) => { markers.current[i] = m; }}><torusGeometry args={[0.162, 0.023, 5, 12]} /><meshBasicMaterial color="#ffd785" toneMapped={false} /></mesh>)}
    <mesh position={[2.4, 0.72, 2.04]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.56, 24]} /><meshStandardMaterial ref={surface} color="#ff8c35" emissive="#ff4a09" roughness={0.9} /></mesh>
    <pointLight position={[2.4, 1.55, 2.05]} intensity={21} distance={7} color="#ff8c54" />
  </>;
}

function Layout() {
  return <>
    <Block p={[3, -0.14, (HALL[2] + HALL[3]) / 2]} s={[12, 0.28, HALL[3] - HALL[2]]} color={FLOOR} />
    <Block p={[-6, -0.14, 0]} s={[6, 0.28, 5]} color="#414353" />
    {[HALL[2], HALL[3]].map((z) => <Block key={z} p={[3, 1.55, z]} s={[12, 3.1, .22]} />)}
    <Block p={[9, 1.55, (HALL[2] + HALL[3]) / 2]} s={[.22, 3.1, HALL[3] - HALL[2]]} />
    {([[HALL[2], -1.35], [1.35, HALL[3]]] as const).map(([a, b]) => <Block key={a} p={[-3, 1.55, (a + b) / 2]} s={[.22, 3.1, b - a]} />)}
    {[-2.5, 2.5].map((z) => <Block key={z} p={[-6, 1.55, z]} s={[6, 3.1, .22]} />)}
    {[-1.83, 1.83].map((z) => <Block key={z} p={[-9, 1.55, z]} s={[.22, 3.1, 1.34]} />)}
    <Block p={[-3, 2.88, 0]} s={[.35, .44, 2.7]} color="#447d87" glow="#1d6871" />
    <Block p={[-9, 2.88, 0]} s={[.35, .44, 2.36]} color="#447d87" glow="#1d6871" />
    <Block p={[-7.2, .55, -1.875]} s={[1.8, 1.1, .85]} color={TRIM} />
    <Block p={[-7.2, 1.14, -1.78]} s={[1.36, .06, .4]} color="#6eb4bd" glow="#238a98" />
    {[-5.8, 6.55].map((z) => <Block key={z} p={[3.05, .013, z]} s={[9.7,.026,.11]} color="#519f9c" glow="#165751" />)}
    {[7.9,-1.8].map((x) => <Block key={x} p={[x, .014, .375]} s={[.11,.027,12.35]} color="#519f9c" glow="#165751" />)}
    <Block p={[3, .1, 0]} s={[5.94, .2, 5.94]} color="#3c3138" />
    <Drum p={[2.4, 1.55, -.96]} sizes={[1.27, 1.53, 2.8]} color="#5a4b49" />
    <Drum p={[2.4, 3, -.96]} sizes={[1.2, 1.14, .32]} color="#70615d" />
    <Drum p={[2.4, 3.77, -.96]} sizes={[.31, .48, 1.45]} color="#746360" />
    <Drum p={[4.8, 1.05, -.76]} sizes={[.71, .89, 1.9]} color="#5d5a63" />
    <Block p={[3.8, 2.02, -.8]} s={[1.95,.31,.33]} color={TRIM} />
    <Block p={[2.4, 2.39, .35]} s={[.8,.24,.63]} color="#726466" />
    <Drum p={[2.4, .41, 2.04]} sizes={[.68,.53,.63]} color="#988079" />
    <Flow />
    {[0, 3, 6].map((x) => <group key={x}>{[-3,3].map((z) => <Block key={z} p={[x,.62,z]} s={[.14,1.24,.14]} color="#9d6437" />)}</group>)}
    {[-3,3].map((z) => <Block key={z} p={[3,1.12,z]} s={[6.02,.12,.13]} color="#c38245" />)}
    {[0,6].map((x) => <Block key={x} p={[x,1.12,0]} s={[.13,.12,6.02]} color="#c38245" />)}
    {[[-6, 2.8, 0],[6.2, 3, -5.8]].map(([x,y,z]) => <pointLight key={x} position={[x,y,z]} intensity={11} distance={9} color="#a6c8ff" />)}
    {[0.5, 5.7].map((x) => <pointLight key={x} position={[x, 2.75, 6.25]} intensity={17} distance={6.2} color="#ffc48c" />)}
  </>;
}

function Walker({ onHud, onConsole }: { onHud: (hud: HUD) => void; onConsole: () => void }) {
  const buttons = useRef(new Set<string>());
  const pose = useRef({ x: SPAWN[0] as number, z: SPAWN[1] as number, heading: Math.PI / 2, first: false });
  const avatar = useRef<THREE.Group>(null);
  const hud = useRef<HUD>("entry");
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      if (["arrowup","arrowdown","arrowleft","arrowright","w","a","s","d"].includes(k)) e.preventDefault();
      buttons.current.add(k);
      if (e.repeat) return;
      if (k === "v") pose.current.first = !pose.current.first;
      if (k === "e" && hud.current === "console") onConsole();
    };
    const up = (e: KeyboardEvent) => { buttons.current.delete(e.key.toLowerCase()); };
    const release = () => { buttons.current.clear(); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", release);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", release); };
  }, [onConsole]);
  useFrame(({ camera }, rawDt) => {
    const dt = Math.min(rawDt, .05), a = pose.current, held = buttons.current;
    const dx = Number(held.has("d") || held.has("arrowright")) - Number(held.has("a") || held.has("arrowleft"));
    const dz = Number(held.has("s") || held.has("arrowdown")) - Number(held.has("w") || held.has("arrowup"));
    const n = Math.hypot(dx,dz);
    if (n) {
      a.heading = Math.atan2(dx, dz);
      const stride = dt * (held.has("shift") ? 5.1 : 3.55) / n;
      if (walkable(a.x + dx * stride, a.z)) a.x += dx * stride;
      if (walkable(a.x, a.z + dz * stride)) a.z += dz * stride;
    }
    const sx = Math.sin(a.heading), sz = Math.cos(a.heading);
    let back = a.first ? 0 : 3.4;
    if (!a.first) for (let step = .2; step <= 3.41; step += .2) {
      if (!walkable(a.x - sx * step, a.z - sz * step, .18)) { back = Math.max(.32, step - .21); break; }
    }
    camera.position.set(a.x - sx * back, 1.65 + back * .33, a.z - sz * back);
    camera.lookAt(a.x + sx * 3, 1.58, a.z + sz * 3);
    if (avatar.current) { avatar.current.position.set(a.x, 0, a.z); avatar.current.rotation.y = a.heading; avatar.current.visible = !a.first && back > .85; }
    const area: HUD = Math.hypot(a.x - CONSOLE_POINT[0], a.z - CONSOLE_POINT[1]) < 1.05 ? "console" : a.x < -7.7 ? "entry" : a.x <= -3 ? "room" : a.z > 3.5 && a.x > .3 && a.x < 5.9 ? "view" : "hall";
    if (area !== hud.current) { hud.current = area; onHud(area); }
  });
  return <group ref={avatar}>
    <mesh position={[0,.72,0]}><capsuleGeometry args={[.37,.72,4,10]} /><meshStandardMaterial color="#8babbd" /></mesh>
    <mesh position={[0,1.55,0]}><sphereGeometry args={[.26,12,10]} /><meshStandardMaterial color="#96bbcd" /></mesh>
    <Block p={[0,1.56,.2]} s={[.36,.13,.12]} color="#55d0d3" glow="#1c8283" />
  </group>;
}

const PROMPT: Record<HUD, string> = { entry: "SIDE ENTRY · Follow the cyan route to the hall", console: "OPERATOR CONSOLE · Press E for a status readout", hall: "SMELTING HALL · Follow the aisle around the guarded bay", view: "VIEWING AISLE · Watch the molten pour behind the rail", room: "OPERATOR ROOM · Console to the side, hall through the lit doorway" };

export function FoundryInteriorPreview() {
  const [area, setArea] = useState<HUD>("entry");
  const [consoleReads, setConsoleReads] = useState(0);
  const onConsole = useMemo(() => () => { setConsoleReads((n) => n + 1); }, []);
  return <section style={{ maxWidth: 1060, margin: "28px auto", padding: "0 14px", color: "#edf0f9" }}>
    <p style={{ color: "#81dbd2", letterSpacing: ".15em", fontSize: 11 }}>ASTROWORLD / DEVELOPMENT PREVIEW</p>
    <h1 style={{ fontSize: "clamp(23px,4vw,36px)", fontWeight: 750, margin: "5px 0 8px" }}>Foundry interior</h1>
    <p style={{ fontSize: 13, marginBottom: 12, color: "#adb9cd" }}>WASD or arrows to walk · Shift to move faster · V toggles first person · E reads the console</p>
    <div style={{ height: "min(66vh, 600px)", minHeight: 325, background: "#151824", border: "1px solid #394452", borderRadius: 12, overflow: "hidden" }}>
      <Canvas camera={{ fov: 70, near: .07, far: 75 }} gl={{ toneMappingExposure: 1.35 }}>
        <color attach="background" args={["#171b26"]} />
        <hemisphereLight args={["#d2d9ff", "#3b2638", 2.1]} />
        <directionalLight position={[4,8,2]} intensity={1.75} color="#fff1de" />
        <Layout />
        <Walker onHud={setArea} onConsole={onConsole} />
      </Canvas>
    </div>
    <p role="status" style={{ marginTop: 10, fontSize: 13, color: "#9de4db" }}>{PROMPT[area]}</p>
    {!!consoleReads && <p style={{ fontSize: 13, color: HOT }}>Console check {consoleReads}: furnace hot · pour active · bay guarded.</p>}
    <p style={{ marginTop: 8, fontSize: 12, color: "#adb9cd" }}>Solo layout test. The multiplayer side-door connection and production art are not part of this preview. <a href="/astroworld" style={{ color: "#9de4db", textDecoration: "underline" }}>Back to Astroworld</a></p>
  </section>;
}
