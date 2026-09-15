/**
 * Brand-neutral geometric marks that replace emoji in the UI.
 * All monochrome (currentColor) so callers set the tint.
 */

const MISSION_PATH: Record<string, string> = {
  reaction: "M13 2 4 13h6l-1 9 10-12h-6z", // bolt
  trivia: "M12 2l10 10-10 10L2 12z", // diamond
  "astro-run": "M12 2l9 18H3z", // triangle / launch
  dodge: "M7 3h10l5 9-5 9H7l-5-9z", // hexagon / asteroid
};

export function MissionGlyph({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={MISSION_PATH[type] ?? MISSION_PATH.reaction} />
    </svg>
  );
}

/**
 * A crew's identity mark: a flat gradient colour swatch. No letter, no
 * default glow — glow is reserved for `active` (the player's own crew) so it
 * reads as a signal, not decoration.
 */
export function CrewMark({
  color,
  size = 40,
  active = false,
}: {
  color: string;
  size?: number;
  active?: boolean;
}) {
  return (
    <span
      className="block shrink-0 rounded-lg"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(155deg, ${color}, color-mix(in srgb, ${color} 45%, #05060f))`,
        border: `1px solid color-mix(in srgb, ${color} 65%, #05060f)`,
        boxShadow: active
          ? `0 0 24px -8px ${color}, inset 0 1px 0 rgba(255,255,255,0.16)`
          : "inset 0 1px 0 rgba(255,255,255,0.12)",
      }}
    />
  );
}

const PROPERTY_COLOR: Record<string, string> = {
  mining_claim: "var(--accent)",
  hangar: "var(--accent-2)",
  vault: "var(--accent-violet)",
  greenhouse: "var(--accent-4)",
  dock: "var(--accent-3)",
};

const PROPERTY_PATH: Record<string, string> = {
  mining_claim: "M12 2l6 6-6 14L6 8z", // uncut gem / ore
  hangar: "M4 19V10a8 8 0 0116 0v9", // dome / bay door
  vault: "M12 3a9 9 0 100 18 9 9 0 000-18zm0 5.5a3.5 3.5 0 110 7 3.5 3.5 0 010-7z", // vault dial
  greenhouse: "M4 19 12 3l8 16zM8 19V13h8v6", // glasshouse
  dock: "M4 20V9l8-6 8 6v11M4 20h16", // pier / berth
};

/**
 * A property card's header art: no photography yet, so a tinted gradient
 * plate with a geometric mark keyed to the property type. Swap for real
 * location art per type/zone whenever it lands.
 */
export function PropertyArt({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  const color = PROPERTY_COLOR[type] ?? "var(--accent-2)";
  const d = PROPERTY_PATH[type] ?? PROPERTY_PATH.hangar;
  return (
    <div
      className={`relative flex items-center justify-center ${className ?? ""}`}
      style={{
        background: `radial-gradient(120% 140% at 22% 0%, color-mix(in srgb, ${color} 24%, transparent), transparent 60%), linear-gradient(160deg, color-mix(in srgb, ${color} 14%, #05060f), #05060f)`,
      }}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-9 w-9"
        style={{ color }}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={d} />
      </svg>
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
        style={{
          background: `color-mix(in srgb, ${color} 35%, transparent)`,
        }}
      />
    </div>
  );
}
