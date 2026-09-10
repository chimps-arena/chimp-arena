import Image from "next/image";

/**
 * Full-viewport atmospheric background behind an entry/marketing surface.
 * Sits under the page content (z -1) with a dark gradient scrim so any scene
 * stays readable. Not for dense working screens.
 */
export function SceneBg({
  src,
  objectPosition = "center 30%",
  opacity = 0.5,
}: {
  src: string;
  objectPosition?: string;
  opacity?: number;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: -1 }}
    >
      <Image
        src={src}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
        style={{ objectPosition, opacity }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg," +
            " color-mix(in srgb, var(--background) 45%, transparent) 0%," +
            " color-mix(in srgb, var(--background) 72%, transparent) 45%," +
            " color-mix(in srgb, var(--background) 94%, transparent) 78%," +
            " var(--background) 100%)",
        }}
      />
    </div>
  );
}
