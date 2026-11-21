import type { Metadata } from "next";
import { ItemGalleryClient } from "./item-gallery-client";

export const metadata: Metadata = {
  title: "Astroworld items (review)",
  description: "Every Astroworld economy item model, for reviewing 3D deliveries.",
  robots: { index: false, follow: false },
};

export default function ItemGalleryPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-4">
      <ItemGalleryClient />
    </div>
  );
}
