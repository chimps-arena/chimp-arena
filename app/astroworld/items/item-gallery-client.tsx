"use client";

import dynamic from "next/dynamic";

// WebGL: client-only.
const ItemGallery = dynamic(() => import("@/components/astroworld/item-gallery").then((m) => m.ItemGallery), {
  ssr: false,
  loading: () => <div className="h-[calc(100dvh-140px)] min-h-[480px] animate-pulse rounded-xl bg-white/5" />,
});

export function ItemGalleryClient() {
  return <ItemGallery />;
}
