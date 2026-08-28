import type { Crew } from "@/lib/types";

export function CrewBadge({
  crew,
  size = "md",
}: {
  crew: Pick<Crew, "name" | "emoji" | "color"> | null;
  size?: "sm" | "md";
}) {
  if (!crew) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs text-muted">
        No crew yet
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold ${
        size === "sm" ? "text-xs" : "text-sm"
      }`}
      style={{
        borderColor: `${crew.color}66`,
        background: `${crew.color}1a`,
        color: crew.color,
      }}
    >
      <span>{crew.emoji}</span>
      {crew.name}
    </span>
  );
}
