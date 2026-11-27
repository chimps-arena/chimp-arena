/**
 * Gravity Well Lounge (core-gravity-well): every sign and screen from the NFT
 * art as sharp canvas textures. Spelling and colours follow
 * docs/property-details/gravity-well-lounge.md; change both together.
 * Drawing helpers are shared with the Neon Cantina (neon-cantina-signs.ts).
 */
import { canvas, CYAN, crown, finish, glowText, hud, neonText, panel, PINK } from "./neon-cantina-signs";

const PURPLE = "#c26bff";

/** Exact copy from the art (two garbled menu items corrected, see the details file). */
export const GRAVITY_WELL = {
  title: ["CHIMP ARENA", "CANTINA"],
  left: ["GOOD", "DRINKS", "BOLDER", "APES"],
  right: ["DRINKS", "FOOD", "STORIES", "SAME", "PLANET", "DIFFERENT", "PEOPLE"],
  menuTitle: "ZERO-G DRINKS",
  menu: ["ORBIT ALE", "NEBULA TONIC", "ASTRO RUM", "LUNAR BREW", "CHIMP FIZZ"],
  window: ["SAME", "PLANET", "DIFFERENT", "PEOPLE"],
};

/** Main sign: crown on the left, CHIMP ARENA in pink over CANTINA in cyan. */
export function mainSign(img: HTMLImageElement) {
  const [c, g] = canvas(2048, 560);
  panel(g, c.width, c.height);
  crown(g, img, 300, 280, 380, PINK, "#ff8ff0");
  neonText(g, GRAVITY_WELL.title[0], 1230, 185, 190, PINK, hud());
  neonText(g, GRAVITY_WELL.title[1], 1230, 405, 190, CYAN, hud());
  return finish(c);
}

/** A tall stacked-word neon sign with a crown at the foot. */
function tallSign(img: HTMLImageElement, words: string[], color: string, border: string | null, dash: boolean) {
  const [c, g] = canvas(384, 1280);
  panel(g, c.width, c.height, "#100a18");
  if (border) {
    g.save();
    g.strokeStyle = border;
    g.shadowColor = border;
    g.shadowBlur = 26;
    g.lineWidth = 12;
    g.strokeRect(22, 22, c.width - 44, c.height - 44);
    g.restore();
  }
  const top = 150, gap = (dash ? 760 : 880) / words.length;
  const size = Math.min(78, Math.floor(300 / Math.max(...words.map((w) => w.length * 0.62))));
  words.forEach((w, i) => neonText(g, w, 192, top + i * gap, size, color, hud()));
  if (dash) neonText(g, "—", 192, top + words.length * gap, 64, color, hud());
  crown(g, img, 192, 1130, 170, color, color);
  return finish(c);
}
export const leftSign = (img: HTMLImageElement) => tallSign(img, GRAVITY_WELL.left, PURPLE, null, true);
export const rightSign = (img: HTMLImageElement) => tallSign(img, GRAVITY_WELL.right, PINK, PINK, false);

/** ZERO-G DRINKS screen: blue panel, dot icons left, line icons right. */
export function menuScreen() {
  const [c, g] = canvas(768, 900);
  const bg = g.createLinearGradient(0, 0, 0, c.height);
  bg.addColorStop(0, "#0c2a6e");
  bg.addColorStop(1, "#06143c");
  g.fillStyle = bg;
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = "#4fb8ff";
  g.shadowColor = "#4fb8ff";
  g.shadowBlur = 18;
  g.lineWidth = 8;
  g.strokeRect(14, 14, c.width - 28, c.height - 28);
  g.shadowBlur = 0;
  glowText(g, GRAVITY_WELL.menuTitle, 60, 120, 76, "#d6f1ff", hud(), 700, "left");
  g.strokeStyle = "rgba(255,79,216,0.7)";
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(50, 185);
  g.lineTo(718, 185);
  g.stroke();
  GRAVITY_WELL.menu.forEach((item, i) => {
    const y = 270 + i * 120;
    const dot = i === 2 ? CYAN : PINK;
    g.fillStyle = dot;
    g.shadowColor = dot;
    g.shadowBlur = 16;
    g.beginPath();
    g.arc(78, y, 20, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
    glowText(g, item, 122, y, 58, "#e8f6ff", hud(), 600, "left");
    // line icon on the right (glass outline)
    g.strokeStyle = "#bfe7ff";
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(668, y - 26);
    g.lineTo(676, y + 24);
    g.lineTo(708, y + 24);
    g.lineTo(716, y - 26);
    g.stroke();
  });
  return finish(c);
}

/** Lounge window decals: transparent, glowing, as if projected on the glass. */
export function windowCrown(img: HTMLImageElement) {
  const [c, g] = canvas(768, 768);
  crown(g, img, 384, 300, 440, PURPLE, "#d58bff");
  glowText(g, "CHIMP ARENA", 384, 600, 92, "#e2b8ff", hud(), 700);
  return finish(c);
}
export function windowSign(img: HTMLImageElement) {
  const [c, g] = canvas(384, 640);
  g.fillStyle = "rgba(40,8,48,0.55)";
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = PINK;
  g.shadowColor = PINK;
  g.shadowBlur = 20;
  g.lineWidth = 8;
  g.strokeRect(16, 16, c.width - 32, c.height - 32);
  g.shadowBlur = 0;
  GRAVITY_WELL.window.forEach((w, i) => neonText(g, w, 192, 110 + i * 105, 60, PINK, hud()));
  crown(g, img, 192, 560, 120, PINK, PINK);
  return finish(c);
}

/** Crown panel behind the bar. */
export function crownPanel(img: HTMLImageElement) {
  const [c, g] = canvas(512, 512);
  panel(g, c.width, c.height, "#120a1c");
  crown(g, img, 256, 256, 340, PURPLE, "#d58bff");
  return finish(c);
}
