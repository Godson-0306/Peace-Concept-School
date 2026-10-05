import type { MetadataRoute } from "next";
import { SCHOOL_WEBSITE_URL } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/app", "/app/", "/api", "/api/", "/login"],
      },
    ],
    sitemap: `${SCHOOL_WEBSITE_URL.replace(/\/$/, "")}/sitemap.xml`,
  };
}
