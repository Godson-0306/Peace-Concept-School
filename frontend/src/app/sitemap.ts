import type { MetadataRoute } from "next";
import { SCHOOL_WEBSITE_URL } from "@/lib/brand";
import { getPublicNewsSlugs } from "@/lib/websiteContent";

const origin = SCHOOL_WEBSITE_URL.replace(/\/$/, "");

const STATIC_PATHS = [
  "",
  "/about",
  "/admissions",
  "/academics",
  "/news",
  "/gallery",
  "/contact",
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await getPublicNewsSlugs();
  const lastModified = new Date();
  const pages: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: path ? `${origin}${path}` : origin,
    lastModified,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.8,
  }));
  for (const slug of slugs) {
    pages.push({
      url: `${origin}/news/${slug}`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }
  return pages;
}
