"use client";

/**
 * Core lot dressing: the neon look of the Astroworld Core NFT art (pink and
 * cyan tubes, Chimp Arena banners, a violet wash on the ground) around the
 * team's industrial models, which are yellow-and-black hazard paint.
 *
 * Every Core lot uses the same layout, so the tubes and pylons are merged into
 * three shared geometries (pink, cyan, dark metal) built once: five draw
 * calls a lot. No real lights; the glow is the bloom pass (colours pushed
 * above 1, toneMapped off, as in neon-cantina.tsx) plus an additive wash.
 *
 * Lot space: 14 x 14 m, centred, street side at +z (see Building).
 */

import { useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const neon = (hex: string, k = 1.8) => {
  const m = new THREE.MeshBasicMaterial({ color: hex, toneMapped: false });
  m.color.multiplyScalar(k);
  return m;
};

/** A box of size [w, h, d] at [x, y, z]. */
function box(w: number, h: number, d: number, x: number, y: number, z: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

const EDGE = 6.85; // tube line, just inside the 7 m lot edge
const TUBE = 0.07;
const PYLON_X = 6.7;
const PYLON_Z = 4.0;
const PYLON_H = 4.4;

let parts: { pink: THREE.BufferGeometry; cyan: THREE.BufferGeometry; dark: THREE.BufferGeometry } | null = null;
function coreParts() {
  if (parts) return parts;
  const pink: THREE.BufferGeometry[] = [];
  const cyan: THREE.BufferGeometry[] = [];
  const dark: THREE.BufferGeometry[] = [];
  // Ground tubes round the lot: pink sides and back, cyan along the street.
  pink.push(box(TUBE, TUBE, EDGE * 2, -EDGE, 0.08, 0), box(TUBE, TUBE, EDGE * 2, EDGE, 0.08, 0), box(EDGE * 2, TUBE, TUBE, 0, 0.08, -EDGE));
  cyan.push(box(EDGE * 2, TUBE, TUBE, 0, 0.08, EDGE - 0.25));
  // Two pylons at the front corners: dark posts with glowing rings and caps.
  for (const s of [-1, 1]) {
    const x = s * PYLON_X;
    dark.push(box(0.32, PYLON_H, 0.32, x, PYLON_H / 2, PYLON_Z), box(0.6, 0.2, 0.6, x, 0.1, PYLON_Z));
    pink.push(box(0.42, 0.1, 0.42, x, PYLON_H * 0.45, PYLON_Z), box(0.42, 0.1, 0.42, x, PYLON_H * 0.75, PYLON_Z));
    cyan.push(box(0.36, 0.22, 0.36, x, PYLON_H + 0.11, PYLON_Z), box(0.05, PYLON_H * 0.8, 0.05, x + s * 0.17, PYLON_H * 0.45, PYLON_Z + 0.17));
    // Banner arm reaching in toward the lot.
    dark.push(box(1.2, 0.08, 0.08, x - s * 0.6, PYLON_H - 0.35, PYLON_Z));
  }
  parts = { pink: mergeGeometries(pink)!, cyan: mergeGeometries(cyan)!, dark: mergeGeometries(dark)! };
  return parts;
}

const PINK = neon("#ff3fd2");
const CYAN = neon("#3fdcff");
const DARK = new THREE.MeshStandardMaterial({ color: "#1b1428", metalness: 0.7, roughness: 0.3 });

/** Violet wash on the lot, like neon spilling onto wet plaza tiles in the art. */
let washMat: THREE.MeshBasicMaterial | null = null;
function wash() {
  if (washMat) return washMat;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 6, 64, 64, 64);
  grad.addColorStop(0, "rgba(200,70,255,0.55)");
  grad.addColorStop(0.55, "rgba(120,60,255,0.22)");
  grad.addColorStop(1, "rgba(60,40,200,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  washMat = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  return washMat;
}

/** Magenta "CHIMP ARENA" banner with the crown, as hung all over the Core art. */
let bannerMat: THREE.MeshBasicMaterial | null = null;
function banner() {
  if (bannerMat) return bannerMat;
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#8e1a8c";
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = "#c026d3";
  g.fillRect(0, 0, 128, 14);
  g.fillRect(0, 242, 128, 14);
  // crown
  g.fillStyle = "#ffe2fb";
  g.beginPath();
  g.moveTo(34, 104);
  g.lineTo(34, 66);
  g.lineTo(50, 86);
  g.lineTo(64, 56);
  g.lineTo(78, 86);
  g.lineTo(94, 66);
  g.lineTo(94, 104);
  g.closePath();
  g.fill();
  g.textAlign = "center";
  g.font = '800 26px "Segoe UI", Arial, sans-serif';
  g.fillText("CHIMP", 64, 150);
  g.fillText("ARENA", 64, 182);
  // swallowtail cut at the bottom
  g.globalCompositeOperation = "destination-out";
  g.beginPath();
  g.moveTo(40, 256);
  g.lineTo(64, 226);
  g.lineTo(88, 256);
  g.closePath();
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  bannerMat = new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, toneMapped: false });
  bannerMat.color.multiplyScalar(1.15);
  return bannerMat;
}

const PLANE = new THREE.PlaneGeometry(1, 1);

/** One Core lot's dressing as a plain three.js group (shared geometry and materials). */
export function coreNeonGroup() {
  const p = coreParts();
  const g = new THREE.Group();
  g.add(new THREE.Mesh(p.pink, PINK), new THREE.Mesh(p.cyan, CYAN), new THREE.Mesh(p.dark, DARK));
  const floor = new THREE.Mesh(PLANE, wash());
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.045, -0.5);
  floor.scale.set(17, 17, 1);
  // Banner hanging from the right pylon's arm, facing the street.
  const flag = new THREE.Mesh(PLANE, banner());
  flag.position.set(PYLON_X - 0.75, PYLON_H - 1.35, PYLON_Z);
  flag.scale.set(0.95, 1.9, 1);
  g.add(floor, flag);
  return g;
}

export function CoreNeon() {
  const group = useMemo(() => coreNeonGroup(), []);
  return <primitive object={group} />;
}
