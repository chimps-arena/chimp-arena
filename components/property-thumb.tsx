import Image from "next/image";
import { PropertyArt } from "@/components/glyphs";

/**
 * Property card art. `src` is resolved server-side (see
 * lib/chain/property-art.ts) - no client-side extension guessing, which
 * raced React hydration and could leave the fallback showing even when a
 * real photo existed. Falls back to the geometric placeholder when null.
 */
export function PropertyThumb({
  src,
  type,
  className,
}: {
  src: string | null;
  type: string;
  className?: string;
}) {
  if (!src) return <PropertyArt type={type} className={className} />;

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      <Image
        src={src}
        alt=""
        fill
        sizes="(max-width: 640px) 100vw, 33vw"
        className="object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
    </div>
  );
}
