export function shortWallet(w: string, lead = 4, tail = 4): string {
  if (w.length <= lead + tail + 1) return w;
  return `${w.slice(0, lead)}…${w.slice(-tail)}`;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
