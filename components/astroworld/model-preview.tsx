"use client";

import { Suspense, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import type * as THREE from "three";
import { NeonCantina } from "./neon-cantina";
import { GravityWellLounge } from "./gravity-well-lounge";
import { Bloom } from "./bloom";

/**
 * Dev QA: window.__mpCam = [x, y, z, lookX, lookY, lookZ] moves the camera
 * (scripts/astroworld-snapshot.mjs); ?grid=0 hides the metre grid.
 */
function CamPin() {
  const { camera, controls, scene } = useThree();
  useEffect(() => void ((globalThis as { __mpScene?: unknown }).__mpScene = scene), [scene]);
  useEffect(() => {
    const id = setInterval(() => {
      const p = (globalThis as { __mpCam?: number[] }).__mpCam;
      if (p) {
        camera.position.set(p[0], p[1], p[2]);
        camera.lookAt(p[3], p[4], p[5]);
        // OrbitControls would snap back to its own target: move that too.
        const c = controls as unknown as { target?: THREE.Vector3; update?: () => void } | null;
        c?.target?.set(p[3], p[4], p[5]);
        c?.update?.();
      }
    }, 100);
    return () => clearInterval(id);
  }, [camera, controls]);
  return null;
}

/**
 * ?ortho=1: flat front view, 50 px per metre, centred on (0, 6) - for measuring.
 * ?signs=0: the bare model without overlays.
 */
export function ModelPreview() {
  const q = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const grid = q.get("grid") !== "0";
  const ortho = q.get("ortho") === "1";
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#0a0812" }}>
      <Canvas
        orthographic={ortho}
        camera={ortho ? { position: [0, 6, 40], zoom: 50, near: 0.1, far: 100 } : { position: [0, 6, 22], fov: 40 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={["#0a0812"]} />
        {/* Same lights as the world (world.tsx WorldLights), so models look as they will in game. */}
        <ambientLight intensity={0.25} />
        <hemisphereLight args={["#8a7ab8", "#20182a", 0.6]} />
        <directionalLight position={[80, 120, 60]} intensity={2.4} color="#ffe2b8" />
        <directionalLight position={[-90, 60, -80]} intensity={0.9} color="#8fb4ff" />
        <Environment resolution={256} frames={1}>
          <Lightformer form="rect" intensity={2.2} color="#b9a2ff" scale={[200, 60, 1]} position={[0, 40, -80]} />
          <Lightformer form="rect" intensity={1.4} color="#ffcf8a" scale={[120, 40, 1]} position={[80, 30, 60]} rotation-y={-Math.PI / 2} />
          <Lightformer form="rect" intensity={1.2} color="#7fd8ff" scale={[120, 40, 1]} position={[-80, 20, 40]} rotation-y={Math.PI / 2} />
          <Lightformer form="ring" intensity={3} color="#a855f7" scale={40} position={[0, 80, 0]} rotation-x={Math.PI / 2} />
          <Lightformer form="rect" intensity={0.6} color="#2b1d5c" scale={[400, 400, 1]} position={[0, -10, 0]} rotation-x={-Math.PI / 2} />
        </Environment>
        <Suspense fallback={null}>
          {/* ?m=gravity shows Gravity Well Lounge; default is the Neon Cantina. */}
          {q.get("m") === "gravity" ? <GravityWellLounge signs={q.get("signs") !== "0"} /> : <NeonCantina signs={q.get("signs") !== "0"} />}
        </Suspense>
        {grid && (
          <>
            {/* 1 m grid on the front plane (z = 0) and the ground. */}
            <gridHelper args={[16, 16, "#5bd1ff", "#2b5466"]} rotation={[Math.PI / 2, 0, 0]} position={[0, 8, 0]} />
            <gridHelper args={[16, 16, "#5bd1ff", "#2b5466"]} />
          </>
        )}
        {!ortho && <OrbitControls makeDefault target={[0, 5, 0]} />}
        {q.get("bloom") !== "0" && <Bloom />}
        <CamPin />
      </Canvas>
    </div>
  );
}
