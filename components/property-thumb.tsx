"use client";

import { useState } from "react";
import Image from "next/image";
import { PropertyArt } from "@/components/glyphs";

const EXTENSIONS = ["jpg", "png", "jpeg", "webp"] as const;

/**
 * Property card art: tries a real photo at /properties/<type>.<ext> — jpg,
 * png, jpeg, then webp, in that order (drop whichever format your image
 * tool exports) — and falls back to the geometric placeholder once every
 * extension has failed.
 */
export function PropertyThumb({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  const [tries, setTries] = useState(0);

  if (tries >= EXTENSIONS.length) {
    return <PropertyArt type={type} className={className} />;
  }

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      <Image
        key={tries}
        src={`/properties/${type}.${EXTENSIONS[tries]}`}
        alt=""
        fill
        sizes="(max-width: 640px) 100vw, 33vw"
        className="object-cover"
        onError={() => setTries((t) => t + 1)}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
    </div>
  );
}
