import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // APIs, admin tools, the team dev log and logged-in-only pages
      disallow: ["/api/", "/admin/", "/devlog", "/dashboard", "/missions/", "/bank", "/my-assets"],
    },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
    host: SITE_ORIGIN,
  };
}
