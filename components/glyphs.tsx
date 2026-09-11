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
