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

/** A crew's initial on a tinted tile, in the crew colour. */
export function CrewMark({
  name,
  color,
  size = 40,
}: {
  name: string;
  color: string;
  size?: number;
}) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-xl font-extrabold leading-none"
      style={{
        width: size,
        height: size,
        fontFamily: "var(--font-display), sans-serif",
        fontSize: Math.round(size * 0.42),
        color,
        background: `color-mix(in srgb, ${color} 16%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 42%, transparent)`,
        boxShadow: `0 0 22px -10px ${color}`,
      }}
    >
      {name.charAt(0)}
    </span>
  );
}
