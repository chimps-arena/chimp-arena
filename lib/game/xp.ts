/** Simple quadratic level curve: level L requires 250 * L^2 total XP. */
const K = 250;

export function levelFromXp(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / K)) + 1);
}

export function xpForLevel(level: number): number {
  return K * (level - 1) ** 2;
}

export function levelProgress(xp: number): {
  level: number;
  into: number;
  span: number;
  pct: number;
  nextAt: number;
} {
  const level = levelFromXp(xp);
  const base = xpForLevel(level);
  const nextAt = xpForLevel(level + 1);
  const span = nextAt - base;
  const into = xp - base;
  return { level, into, span, pct: Math.min(100, (into / span) * 100), nextAt };
}
