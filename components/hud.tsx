/**
 * HUD theme building blocks (styles in globals.css, "HUD theme").
 */
import type { CSSProperties, ReactNode } from "react";

/** Sets the accent a panel, well or tag lights up with. */
export const tint = (color: string) => ({ "--tint": color }) as CSSProperties;

export function Readout({
  label,
  value,
  unit,
  color,
  align = "left",
  size = "lg",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  color?: string;
  align?: "left" | "right";
  size?: "md" | "lg";
}) {
  return (
    <div className={align === "right" ? "text-right" : undefined}>
      <div className="hud-label">{label}</div>
      <div className={`hud-value mt-1 ${size === "lg" ? "text-2xl" : "text-xl"}`} style={{ color }}>
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-muted">{unit}</span>}
      </div>
    </div>
  );
}

export function Lamp({ color, live = false }: { color: string; live?: boolean }) {
  return (
    <span
      className={`hud-lamp${live ? " hud-lamp-live" : ""}`}
      style={{ "--lamp": color } as CSSProperties}
      aria-hidden="true"
    />
  );
}

/** Page title block: lamp + kicker label, big title, one-line blurb. */
export function PageHeader({
  kicker,
  title,
  blurb,
  children,
}: {
  kicker: string;
  title: string;
  blurb?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="hud-label flex items-center gap-2">
          <Lamp color="var(--hud-cyan)" live />
          {kicker}
        </div>
        <h1 className="mt-2 text-3xl font-bold uppercase sm:text-4xl">{title}</h1>
        {blurb && <p className="mt-1 max-w-prose text-muted">{blurb}</p>}
      </div>
      {children}
    </div>
  );
}

/** `// TITLE ─┼─┼─┼─  aside` */
export function SectionHeader({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-foreground">
        <span className="text-[color:var(--hud-cyan)]">{"//"}</span> {title}
      </h2>
      <span className="hud-rule" aria-hidden="true" />
      {aside && <span className="mono shrink-0 text-xs text-muted">{aside}</span>}
    </div>
  );
}
