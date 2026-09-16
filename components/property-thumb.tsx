"use client";

import { useState } from "react";
import Image from "next/image";
import { PropertyArt } from "@/components/glyphs";

/**
 * Property card art: tries a real photo at /properties/<type>.jpg first
 * (one per property type — swap in real art whenever it lands), and falls
 * back to the geometric placeholder if the file doesn't exist yet.
 */
export function PropertyThumb({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) return <PropertyArt type={type} className={className} />;

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      <Image
        src={`/properties/${type}.jpg`}
        alt=""
        fill
        sizes="(max-width: 640px) 100vw, 33vw"
        className="object-cover"
        onError={() => setFailed(true)}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
    </div>
  );
}
