/**
 * Brand-neutral marks that replace emoji in the UI.
 * All monochrome (currentColor) so callers set the tint.
 */
import { Zap, Brain, Rocket, Shield, Pickaxe, Satellite, Orbit, type LucideIcon } from "lucide-react";

const MISSION_ICON: Record<string, LucideIcon> = {
  reaction: Zap,
  trivia: Brain,
  "astro-run": Rocket,
  dodge: Shield,
  mining: Pickaxe,
};

export function MissionGlyph({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  const Icon = MISSION_ICON[type] ?? MISSION_ICON.reaction;
  return <Icon className={className} strokeWidth={2} aria-hidden="true" />;
}

const CREW_ICON: Record<string, LucideIcon> = {
  "banana-bloc": Satellite,
  "jungle-syndicate": Orbit,
  "rocket-primates": Rocket,
  "thunder-apes": Zap,
};

/**
 * A crew's insignia: its icon inside a two-ring hex badge in the crew
 * colour. Extra glow is reserved for `active` (the player's own crew) so it
 * reads as a signal, not decoration.
 */
export function CrewMark({
  slug,
  color,
  size = 40,
  active = false,
}: {
  slug: string;
  color: string;
  size?: number;
  active?: boolean;
}) {
  const Icon = CREW_ICON[slug] ?? Shield;
  return (
    <span
      className="relative grid shrink-0 place-items-center"
      style={{
        width: size,
        height: size,
        color,
        filter: `drop-shadow(0 0 ${active ? 14 : 8}px color-mix(in srgb, ${color} ${active ? 70 : 40}%, transparent))`,
      }}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <polygon
          points="50,3 91,26.5 91,73.5 50,97 9,73.5 9,26.5"
          fill="color-mix(in srgb, currentColor 16%, #070a16)"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <polygon
          points="50,14 81.5,32 81.5,68 50,86 18.5,68 18.5,32"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.35"
          strokeWidth="2"
        />
        {/* rivets at the flat sides */}
        <circle cx="91" cy="50" r="3.2" fill="currentColor" />
        <circle cx="9" cy="50" r="3.2" fill="currentColor" />
      </svg>
      <Icon className="relative" style={{ width: size * 0.46, height: size * 0.46 }} strokeWidth={2.2} aria-hidden="true" />
    </span>
  );
}

const PROPERTY_COLOR: Record<string, string> = {
  mining_claim: "var(--accent)",
  hangar: "var(--accent-2)",
  vault: "var(--accent-violet)",
  greenhouse: "var(--accent-4)",
  dock: "var(--accent-3)",
  fuel_lot: "var(--accent-2)",
  armory: "var(--bad)",
  box: "var(--accent)",
  outpost: "var(--accent-violet)",
  field: "var(--accent-4)",
  loft: "var(--accent-2)",
  observatory: "var(--accent-violet)",
  yard: "var(--accent)",
  stall: "var(--good)",
  array: "var(--accent-2)",
  cantina: "var(--accent-3)",
  tower: "var(--accent-3)",
  dome: "var(--accent-4)",
  foundry: "var(--bad)",
};

const PROPERTY_PATH: Record<string, string> = {
  mining_claim: "M12 2l6 6-6 14L6 8z", // uncut gem / ore
  hangar: "M4 19V10a8 8 0 0116 0v9", // dome / bay door
  vault: "M12 3a9 9 0 100 18 9 9 0 000-18zm0 5.5a3.5 3.5 0 110 7 3.5 3.5 0 010-7z", // vault dial
  greenhouse: "M4 19 12 3l8 16zM8 19V13h8v6", // glasshouse
  dock: "M4 20V9l8-6 8 6v11M4 20h16", // pier / berth
  fuel_lot: "M6 21V8a2 2 0 012-2 2 2 0 012 2v13M14 21V11a2 2 0 012-2 2 2 0 012 2v10", // two tanks
  armory: "M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z", // shield
  box: "M4 8l8-4 8 4-8 4-8-4zm0 0v8l8 4 8-4V8M12 12v8", // stepped seating
  outpost: "M9 21V11a3 3 0 116 0v10M12 3v4M9 21h6", // module + mast
  field: "M6 21V4M6 4l10 3-10 3", // survey stake + flag
  loft: "M4 21V9l8-6 8 6v12H4zM9 14h2m2 0h2", // windows
  observatory: "M4 20a8 8 0 0116 0zM12 3v3M4 20h16", // dome
  yard: "M3 10h8v6H3zM11 8h10v8H11z", // stacked containers
  stall: "M4 10l8-6 8 6v11H4zM9 21v-6h6v6", // kiosk
  array: "M3 8h8M3 13h8M3 18h8M15 8h6M15 13h6M15 18h6", // panel rows
  cantina: "M8 3h8l-1 9a3 3 0 01-6 0zM12 15v6M9 21h6", // lantern
  tower: "M12 2v20M8 6h8M9 12h6M7 18h10", // needle tower
  dome: "M4 20a8 8 0 0116 0H4zM12 20V12", // grow dome
  foundry: "M6 21V13a6 6 0 0112 0v8zM9 21v-4m6 4v-4", // furnace
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
