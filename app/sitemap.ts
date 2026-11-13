import type { MetadataRoute } from "next";
import { PUBLIC_PAGES, SITE_ORIGIN } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.map((p) => ({
    url: `${SITE_ORIGIN}${p.path === "/" ? "" : p.path}`,
    changeFrequency: "weekly",
    priority: p.priority,
  }));
}
