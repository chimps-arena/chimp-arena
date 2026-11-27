"use client";

/**
 * A property's own name board: a real sign standing on its lot, like the
 * signs in the NFT art (red claim posts on mining claims, hazard-striped berth
 * boards at the docks, neon panels in the Core). It carries the property's
 * exact market name and, where the name has one, its number (A12, K09, Dock 9).
 *
 * Far away the board is a plain coloured shape; its lettering is drawn the
 * first time a player comes near and kept after that.
 */

import { useMemo } from "react";
import * as THREE from "three";

type Style = "claim" | "hazard" | "neon" | "steel";

const STYLE_BY_TYPE: Record<string, Style> = {
  mining_claim: "claim",
  quarry: "claim",
  dock: "hazard",
  hangar: "hazard",
  yard: "hazard",
  fuel_lot: "hazard",
  array: "hazard",
};

export function styleFor(zone: string, type: string): Style {
  if (zone === "Astroworld Core") return "neon";
  return STYLE_BY_TYPE[type] ?? "steel";
}

/** The number in a property's name: "Nickel Claim A12" -> A12, "Gantry Dock 9" -> 9, "Founders Club II" -> II. */
export function boardCode(name: string): string | null {
  const m = name.match(/\b([A-Z]{0,3}-?\d{1,3}[A-Z]?|I{1,3}|IV|V|VI{0,3})$/);
  return m ? m[1] : null;
}

const COLORS: Record<Style, { bg: string; fg: string; sub: string }> = {
  claim: { bg: "#9f1d17", fg: "#fff4e6", sub: "#ffd8c2" },
  hazard: { bg: "#f2b705", fg: "#111014", sub: "#2b2410" },
  neon: { bg: "#120a1f", fg: "#ffffff", sub: "#c9b8ff" },
  steel: { bg: "#24222e", fg: "#f1eef8", sub: "#b7b2c7" },
};

const SANS = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';

/** Fit text to a width by shrinking the font. */
function fitFont(g: CanvasRenderingContext2D, text: string, weight: number, max: number, width: number) {
  let size = max;
  do {
    g.font = `${weight} ${size}px ${SANS}`;
    size -= 2;
  } while (g.measureText(text).width > width && size > 12);
}

/** A tiny crown, the Chimp Arena mark used on every sign in the art. */
function crown(g: CanvasRenderingContext2D, cx: number, cy: number, w: number, color: string) {
  const h = w * 0.62;
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(cx - w / 2, cy + h / 2);
  g.lineTo(cx - w / 2, cy - h / 4);
  g.lineTo(cx - w / 4, cy + h / 8);
  g.lineTo(cx, cy - h / 2);
  g.lineTo(cx + w / 4, cy + h / 8);
  g.lineTo(cx + w / 2, cy - h / 4);
  g.lineTo(cx + w / 2, cy + h / 2);
  g.closePath();
  g.fill();
}

const boardTextures = new Map<string, THREE.CanvasTexture>();

export function drawBoard(id: string, name: string, zone: string, type: string, style: Style, accent: string, portrait: boolean) {
  const hit = boardTextures.get(id);
  if (hit) return hit;
  const W = portrait ? 256 : 512;
  const H = portrait ? 384 : 256;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const col = COLORS[style];
  g.fillStyle = col.bg;
  g.fillRect(0, 0, W, H);
  // Border: neon in the Core, the district accent elsewhere, hazard stripes at the docks.
  if (style === "hazard") {
    g.fillStyle = "#111014";
    for (let x = -H; x < W; x += 36) {
      g.beginPath();
      g.moveTo(x, H);
      g.lineTo(x + 18, H);
      g.lineTo(x + 18 + 22, H - 22);
      g.lineTo(x + 22, H - 22);
      g.fill();
    }
  }
  g.strokeStyle = style === "neon" ? accent : style === "hazard" ? "#111014" : style === "claim" ? col.fg : accent;
  g.lineWidth = style === "neon" ? 8 : 6;
  g.strokeRect(6, 6, W - 12, H - 12);

  const code = boardCode(name);
  const label = code ? name.slice(0, name.length - code.length).trim() || name : name;
  g.textAlign = "center";
  g.textBaseline = "middle";
  crown(g, W / 2 - (portrait ? 0 : 92), portrait ? 46 : 40, 34, style === "neon" ? accent : col.fg);
  g.fillStyle = col.sub;
  g.font = `700 ${portrait ? 20 : 22}px ${SANS}`;
  g.fillText("CHIMP ARENA", W / 2 + (portrait ? 0 : 26), portrait ? 84 : 41);

  if (portrait) {
    // Claim post: "CLAIM" over a big number, the name underneath.
    g.fillStyle = col.fg;
    fitFont(g, (code ? label : type.replace(/_/g, " ")).toUpperCase(), 800, 34, W - 40);
    g.fillText((code ? label : type.replace(/_/g, " ")).toUpperCase(), W / 2, 140);
    fitFont(g, code ?? name.toUpperCase(), 900, code ? 110 : 40, W - 40);
    g.fillText(code ?? name.toUpperCase(), W / 2, 235);
    g.fillStyle = col.sub;
    fitFont(g, zone.toUpperCase(), 700, 22, W - 40);
    g.fillText(zone.toUpperCase(), W / 2, 330);
  } else {
    g.fillStyle = col.fg;
    fitFont(g, label.toUpperCase(), 900, code ? 48 : 56, code ? W - 170 : W - 48);
    g.fillText(label.toUpperCase(), code ? (W - 120) / 2 + 6 : W / 2, code ? 128 : 132);
    if (code) {
      // The number gets its own block, like a berth or bay plate.
      g.fillStyle = style === "hazard" ? "#111014" : accent;
      g.fillRect(W - 140, 84, 112, 92);
      g.fillStyle = style === "hazard" ? "#f2b705" : "#0b0812";
      fitFont(g, code, 900, 64, 100);
      g.fillText(code, W - 84, 131);
    }
    g.fillStyle = col.sub;
    g.font = `700 22px ${SANS}`;
    g.fillText(`${zone.toUpperCase()} · ${type.replace(/_/g, " ").toUpperCase()}`, W / 2, style === "hazard" ? 196 : 206);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  boardTextures.set(id, t);
  return t;
}

/** One unit box and plane, scaled per board: 100 boards share two geometries. */
const BOX = new THREE.BoxGeometry(1, 1, 1);
const PLANE = new THREE.PlaneGeometry(1, 1);

const postMat = new THREE.MeshStandardMaterial({ color: "#2a2638", metalness: 0.6, roughness: 0.35 });
const blankMats = new Map<string, THREE.MeshBasicMaterial>();
function blank(color: string) {
  let m = blankMats.get(color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    blankMats.set(color, m);
  }
  return m;
}

export function NameBoard({
  id,
  name,
  zone,
  type,
  accent,
  near,
}: {
  id: string;
  name: string;
  zone: string;
  type: string;
  accent: string;
  /** Lettering is drawn the first time a player is near, then kept. */
  near: boolean;
}) {
  const style = styleFor(zone, type);
  const portrait = style === "claim";
  const tex = useMemo(
    () => (near || boardTextures.has(id) ? drawBoard(id, name, zone, type, style, accent, portrait) : null),
    [near, id, name, zone, type, style, accent, portrait],
  );
  const w = portrait ? 1.3 : 3.2;
  const h = portrait ? 1.95 : 1.6;
  const top = portrait ? 3.4 : 3.0;
  const y = top - h / 2;
  return (
    <group>
      {/* posts */}
      {portrait ? (
        <mesh position={[0, y / 2, -0.06]} scale={[0.16, y, 0.16]} geometry={BOX} material={postMat} />
      ) : (
        [-1, 1].map((s) => (
          <mesh key={s} position={[s * (w / 2 - 0.25), (y - h / 2) / 2, -0.06]} scale={[0.14, y - h / 2, 0.14]} geometry={BOX} material={postMat} />
        ))
      )}
      {/* backing and face */}
      <mesh position={[0, y, -0.05]} scale={[w + 0.12, h + 0.12, 0.08]} geometry={BOX} material={postMat} />
      {tex ? (
        <mesh key="lettered" position={[0, y, 0.001]} scale={[w, h, 1]} geometry={PLANE}>
          <meshBasicMaterial map={tex} toneMapped={false} />
        </mesh>
      ) : (
        <mesh key="blank" position={[0, y, 0.001]} scale={[w, h, 1]} geometry={PLANE} material={blank(COLORS[style].bg)} />
      )}
      {/* Core boards glow along the bottom edge, like the neon in the art. */}
      {style === "neon" && (
        <mesh position={[0, y - h / 2 - 0.08, 0.02]} scale={[w + 0.12, 0.06, 0.04]} geometry={BOX} material={blank(accent)} />
      )}
    </group>
  );
}
