"use client";

/**
 * Glow for neon, lamps and candles (three.js UnrealBloom, no extra packages).
 *
 * Selective by brightness: only pixels brighter than `threshold` (1.0 = pure
 * white) bloom. Ordinary lit surfaces stay below it; light sources opt in by
 * using toneMapped={false} materials with colours pushed above 1 (see neon()
 * in neon-cantina.tsx). Takes over rendering (useFrame priority 1).
 *
 * The composer is created and disposed in one effect: React's development
 * double-mount would otherwise leave the frame loop holding a disposed one
 * (black screen).
 */
import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

/**
 * The game's glow: desktop only. Phones and tablets (coarse pointer) skip it
 * to keep their frame rate; their neon is still bright, just without halos.
 */
export function GameBloom() {
  // ?bloom=0 turns it off (for speed comparisons and very weak GPUs).
  const [on] = useState(
    () => typeof window !== "undefined" && !window.matchMedia("(pointer: coarse)").matches && new URLSearchParams(window.location.search).get("bloom") !== "0",
  );
  return on ? <Bloom /> : null;
}

export function Bloom({ strength = 0.55, radius = 0.4, threshold = 1 }: { strength?: number; radius?: number; threshold?: number }) {
  const { gl, scene, camera, size } = useThree();
  const composer = useRef<EffectComposer | null>(null);
  const bloom = useRef<UnrealBloomPass | null>(null);

  useEffect(() => {
    const c = new EffectComposer(gl);
    c.addPass(new RenderPass(scene, camera));
    const b = new UnrealBloomPass(new THREE.Vector2(256, 256), strength, radius, threshold);
    c.addPass(b);
    c.addPass(new OutputPass());
    composer.current = c;
    bloom.current = b;
    return () => {
      composer.current = null;
      b.dispose();
      c.dispose();
    };
  }, [gl, scene, camera]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const b = bloom.current;
    if (!b) return;
    b.strength = strength;
    b.radius = radius;
    b.threshold = threshold;
  }, [strength, radius, threshold]);

  useEffect(() => {
    composer.current?.setPixelRatio(gl.getPixelRatio());
    composer.current?.setSize(size.width, size.height);
  }, [gl, size]);

  useFrame((_, dt) => {
    const c = composer.current;
    if (!c) return gl.render(scene, camera);
    if (c.readBuffer.width !== Math.floor(size.width * gl.getPixelRatio())) {
      c.setPixelRatio(gl.getPixelRatio());
      c.setSize(size.width, size.height);
    }
    c.render(dt);
  }, 1);
  return null;
}
