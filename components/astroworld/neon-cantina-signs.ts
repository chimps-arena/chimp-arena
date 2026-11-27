/**
 * Neon Cantina (core-nc4): every sign, menu, banner, poster and stool name from
 * the NFT art, drawn as sharp canvas textures. Spelling and colours follow
 * docs/property-details/neon-cantina.md; change both together.
 *
 * Meshy models the building with blank panels; these textures go on top, so
 * the text is exact and stays readable (AI models scramble lettering).
 */
import * as THREE from "three";

export const PINK = "#ff4fd8";
export const CYAN = "#4fe3ff";
const INK = "#120a1c";

/** Exact copy from the art. */
export const ORBITAL_DRIFT = {
  title: "ORBITAL DRIFT",
  tagline: "CANTINA · FOOD · FUEL · STORIES · ALL CREWS WELCOME",
  drinks: ["RIM WHISKEY", "ASTRO ALE", "ZERO-G STOUT", "SPICE RUM", "ORBITAL GIN"],
  food: ["DOCKBURGER", "OKTAIL STEW", "SPICE NOODLES", "REPLICANT BREW", "ASTRO JEAKY"],
  languages: [
    { text: "カンティーナ", color: PINK },
    { text: "مقهى الفضاء", color: CYAN },
    { text: "酒吧", color: PINK },
  ],
  banner: ["GOOD", "CREWS", "BETTER", "STORIES"],
  stools: ["Austin", "Smile", "zee", "Omah", "davvycole"],
};

/** Site fonts (next/font CSS variables) so signs match the rest of Chimp Arena. */
function fontVar(name: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.body).getPropertyValue(name).trim();
  return v ? `${v}, ${fallback}` : fallback;
}
export const hud = () => fontVar("--font-hud", "sans-serif");
export const body = () => fontVar("--font-geist-sans", "sans-serif");
const MARKER = "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', 'Chalkboard SE', cursive";

let crownImg: HTMLImageElement | null = null;
/** The Chimp Arena crown, traced from the NFT art (public/astroworld/neon-cantina/crown.png). */
export function loadCrown(): Promise<HTMLImageElement> {
  if (crownImg?.complete) return Promise.resolve(crownImg);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve((crownImg = img));
    img.onerror = reject;
    img.src = "/astroworld/neon-cantina/crown.png";
  });
}

export function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

export function finish(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Dark panel with a scuffed metal edge, like the boards in the art. */
export function panel(g: CanvasRenderingContext2D, w: number, h: number, fill = INK) {
  g.fillStyle = fill;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = "rgba(160,150,175,0.35)";
  g.lineWidth = Math.max(4, w / 160);
  g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth);
}

/** Neon lettering: wide soft glow, coloured tube, white-hot core. */
export function neonText(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, font: string) {
  g.font = `400 ${size}px ${font}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineJoin = "round";
  g.shadowColor = color;
  for (const [blur, width, stroke] of [
    [size * 0.5, size * 0.09, color],
    [size * 0.2, size * 0.07, color],
    [0, size * 0.025, "#ffe8fb"],
  ] as const) {
    g.shadowBlur = blur;
    g.lineWidth = width;
    g.strokeStyle = stroke;
    g.strokeText(text, x, y);
  }
  g.shadowBlur = 0;
}

export function glowText(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, font: string, weight = 600, align: CanvasTextAlign = "center") {
  g.font = `${weight} ${size}px ${font}`;
  g.textAlign = align;
  g.textBaseline = "middle";
  g.shadowColor = color;
  g.shadowBlur = size * 0.35;
  g.fillStyle = color;
  g.fillText(text, x, y);
  g.shadowBlur = 0;
}

export function crown(g: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, w: number, glow: string, tint?: string) {
  const h = (w * img.height) / img.width;
  let src: CanvasImageSource = img;
  if (tint) {
    const [c, t] = canvas(img.width, img.height);
    t.drawImage(img, 0, 0);
    t.globalCompositeOperation = "source-in";
    t.fillStyle = tint;
    t.fillRect(0, 0, c.width, c.height);
    src = c;
  }
  g.shadowColor = glow;
  g.shadowBlur = w * 0.12;
  g.drawImage(src, cx - w / 2, cy - h / 2, w, h);
  g.shadowBlur = 0;
}

/** Main sign: ORBITAL DRIFT + tagline (art ratio ~3.4:1). */
export function mainSign() {
  const [c, g] = canvas(2048, 600);
  panel(g, c.width, c.height);
  neonText(g, ORBITAL_DRIFT.title, 1024, 250, 250, PINK, body());
  glowText(g, ORBITAL_DRIFT.tagline, 1024, 500, 62, "#dcd6ff", hud(), 600);
  return finish(c);
}

/** Top-left panel: crown + CHIMP ARENA. */
export function crownPanel(img: HTMLImageElement) {
  const [c, g] = canvas(768, 768);
  panel(g, c.width, c.height);
  crown(g, img, 384, 270, 470, "#b9a8ff");
  glowText(g, "CHIMP", 384, 545, 120, "#efeaff", hud(), 700);
  glowText(g, "ARENA", 384, 670, 120, "#efeaff", hud(), 700);
  return finish(c);
}

/** Right-hand panel: Japanese, Arabic, Chinese (stacked, as in the art). */
export function languagePanel() {
  const [c, g] = canvas(640, 1024);
  panel(g, c.width, c.height);
  const font = "'Yu Gothic', 'Hiragino Sans', 'Noto Sans JP', 'Microsoft YaHei', 'Segoe UI', 'Noto Sans Arabic', sans-serif";
  const [ja, ar, zh] = ORBITAL_DRIFT.languages;
  neonText(g, ja.text, 320, 190, 96, ja.color, font);
  neonText(g, ar.text, 320, 500, 104, ar.color, font);
  neonText(g, zh.text, 320, 820, 190, zh.color, font);
  return finish(c);
}

function icon(g: CanvasRenderingContext2D, kind: "glass" | "bowl", x: number, y: number, s: number) {
  g.save();
  g.strokeStyle = PINK;
  g.lineWidth = s * 0.09;
  g.shadowColor = PINK;
  g.shadowBlur = s * 0.3;
  g.beginPath();
  if (kind === "glass") {
    g.moveTo(x - s * 0.32, y - s * 0.4);
    g.lineTo(x - s * 0.24, y + s * 0.4);
    g.lineTo(x + s * 0.24, y + s * 0.4);
    g.lineTo(x + s * 0.32, y - s * 0.4);
    g.moveTo(x + s * 0.3, y - s * 0.15);
    g.arc(x + s * 0.3, y, s * 0.15, -Math.PI / 2, Math.PI / 2);
  } else {
    g.arc(x, y - s * 0.05, s * 0.4, 0, Math.PI);
    g.closePath();
    g.moveTo(x - s * 0.15, y - s * 0.25);
    g.quadraticCurveTo(x - s * 0.05, y - s * 0.45, x - s * 0.15, y - s * 0.6);
    g.moveTo(x + s * 0.1, y - s * 0.25);
    g.quadraticCurveTo(x + s * 0.2, y - s * 0.45, x + s * 0.1, y - s * 0.6);
  }
  g.stroke();
  g.restore();
}

/** Menu board (drinks or food), five lines with pink neon icons. */
export function menuBoard(kind: "drinks" | "food") {
  const [c, g] = canvas(1024, 640);
  panel(g, c.width, c.height, "#0d0a18");
  const items = ORBITAL_DRIFT[kind];
  items.forEach((item, i) => {
    const y = 90 + i * 115;
    icon(g, kind === "drinks" ? "glass" : "bowl", 110, y, 70);
    glowText(g, item, 200, y, 62, "#d7f3ff", hud(), 600, "left");
    g.strokeStyle = "rgba(79,227,255,0.35)";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(870, y);
    g.lineTo(960, y);
    g.stroke();
  });
  return finish(c);
}

/** Hanging banner: crown, CHIMP ARENA, GOOD CREWS BETTER STORIES. */
export function banner(img: HTMLImageElement) {
  const [c, g] = canvas(512, 1280);
  const grad = g.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, "#5c1050");
  grad.addColorStop(1, "#3f0a3a");
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  crown(g, img, 256, 200, 300, "#ff9de9", "#f7a6ec");
  glowText(g, "CHIMP", 256, 390, 78, "#f7a6ec", hud(), 700);
  glowText(g, "ARENA", 256, 470, 78, "#f7a6ec", hud(), 700);
  ORBITAL_DRIFT.banner.forEach((w, i) => glowText(g, w, 256, 680 + i * 140, 96, "#ff8fe6", hud(), 700));
  return finish(c);
}

/** COLD FUEL poster, covered in stickers. */
export function coldFuelPoster(img: HTMLImageElement) {
  const [c, g] = canvas(512, 704);
  g.fillStyle = "#c9c4cf";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#3a3346";
  g.font = `700 92px ${hud()}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("COLD FUEL", 256, 90);
  const stickers = [
    ["#f2b134", 30, 170, 210, 190],
    ["#3d4f8f", 262, 170, 220, 190],
    ["#7a5fa8", 30, 380, 210, 150],
    ["#e83fa8", 262, 380, 220, 170],
    ["#efe9f2", 30, 545, 210, 135],
    ["#e83fa8", 262, 565, 220, 115],
  ] as const;
  stickers.forEach(([col, x, y, w, h], i) => {
    g.save();
    g.translate(x + w / 2, y + h / 2);
    g.rotate(((i % 3) - 1) * 0.035);
    g.fillStyle = col;
    g.fillRect(-w / 2, -h / 2, w, h);
    g.restore();
  });
  crown(g, img, 372, 465, 150, "transparent", "#fde6f6");
  return finish(c);
}

/** Bar screen with the crown logo. */
export function screen(img: HTMLImageElement) {
  const [c, g] = canvas(512, 320);
  const grad = g.createRadialGradient(256, 160, 20, 256, 160, 300);
  grad.addColorStop(0, "#2a2a6e");
  grad.addColorStop(1, "#0b0b26");
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  crown(g, img, 256, 160, 230, PINK, "#ff7ce0");
  return finish(c);
}

/** Seeded random, so each stool's dents and scuffs stay the same every visit. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

/**
 * The whole barrel skin of one stool: brushed, dented silver with dark scuffs,
 * and the crew member's name in black marker at the front (u = 0.5 faces the bar
 * front when the cylinder starts at theta = -PI).
 */
export function stoolSkin(name: string, seed: number) {
  const [c, g] = canvas(1024, 512);
  const r = rng(seed);
  const base = g.createLinearGradient(0, 0, c.width, 0);
  base.addColorStop(0, "#6f6b72");
  base.addColorStop(0.5, "#c9c5cc");
  base.addColorStop(1, "#6f6b72");
  g.fillStyle = base;
  g.fillRect(0, 0, c.width, c.height);
  // brushed streaks
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? "255,255,255" : "40,36,44"},${0.03 + r() * 0.05})`;
    g.fillRect(0, r() * c.height, c.width, 1 + r() * 2);
  }
  // dents: soft light/dark blobs
  for (let i = 0; i < 26; i++) {
    const x = r() * c.width, y = r() * c.height, s = 12 + r() * 40;
    const d = g.createRadialGradient(x, y, 0, x, y, s);
    d.addColorStop(0, "rgba(30,26,34,0.35)");
    d.addColorStop(0.6, "rgba(255,255,255,0.12)");
    d.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = d;
    g.fillRect(x - s, y - s, s * 2, s * 2);
  }
  // scuffs and grime specks, like the art
  for (let i = 0; i < 420; i++) {
    g.fillStyle = `rgba(28,22,30,${0.25 + r() * 0.5})`;
    const s = 1 + r() * 6;
    g.fillRect(r() * c.width, r() * c.height, s, s * (0.5 + r()));
  }
  // grime collecting at top and bottom rims
  for (const [y0, y1] of [[0, 40], [c.height - 50, c.height]]) {
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(y0 === 0 ? 0 : 1, "rgba(25,20,28,0.6)");
    gr.addColorStop(y0 === 0 ? 1 : 0, "rgba(25,20,28,0)");
    g.fillStyle = gr;
    g.fillRect(0, y0, c.width, y1 - y0);
  }
  // the name, handwritten in marker
  g.save();
  g.translate(512, 250);
  g.rotate(-0.03 + r() * 0.06);
  // Keep every name on the visible front third of the barrel (~340 px of the 1024 wrap).
  g.font = `700 100px ${MARKER}`;
  const fit = Math.min(1, 320 / g.measureText(name).width);
  g.font = `700 ${Math.floor(100 * fit)}px ${MARKER}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#141018";
  g.fillText(name, 0, 0);
  g.restore();
  return finish(c);
}
