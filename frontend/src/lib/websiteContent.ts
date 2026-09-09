import { newsItems, type NewsItem } from "@/lib/news";
import { CAMPUS_MOSAIC } from "@/lib/campusPhotos";
import { mediaUrl } from "@/lib/media";

const API_ORIGIN = process.env.API_PROXY_ORIGIN ?? "http://127.0.0.1:8000";

export type PublicGalleryImage = {
  id: number | string;
  src: string;
  label: string;
  caption?: string;
};

export type PublicNewsItem = NewsItem & {
  fromApi?: boolean;
};

type ApiGallery = {
  id: number;
  title: string;
  image: string;
  caption: string;
  is_published: boolean;
};

type ApiNews = {
  id: number;
  title: string;
  slug: string;
  summary: string;
  body: string;
  cover_image: string | null;
  is_published: boolean;
  published_at: string;
};

function unwrapList<T>(data: { results?: T[] } | T[]): T[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

async function fetchApi<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_ORIGIN}${path}`, {
      next: { revalidate: 30 },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

const FALLBACK_GALLERY: PublicGalleryImage[] = CAMPUS_MOSAIC.map((item, index) => ({
  id: `fallback-${index + 1}`,
  src: item.src,
  label: item.label,
}));

export async function getPublicGallery(): Promise<PublicGalleryImage[]> {
  const data = await fetchApi<{ results?: ApiGallery[] } | ApiGallery[]>(
    "/api/website/gallery/?page_size=500",
  );
  if (!data) return FALLBACK_GALLERY;
  const items = unwrapList(data)
    .filter((item) => item.is_published && item.image)
    .map((item) => ({
      id: item.id,
      src: mediaUrl(item.image),
      label: item.title || item.caption || "Campus moment",
      caption: item.caption,
    }));
  return items.length > 0 ? items : FALLBACK_GALLERY;
}

function mapApiNews(post: ApiNews): PublicNewsItem {
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.summary || post.body.slice(0, 160),
    body: post.body,
    date: post.published_at.slice(0, 10),
    category: "News",
    image: post.cover_image ? mediaUrl(post.cover_image) : undefined,
    fromApi: true,
  };
}

export async function getPublicNews(): Promise<PublicNewsItem[]> {
  const data = await fetchApi<{ results?: ApiNews[] } | ApiNews[]>(
    "/api/website/news/",
  );
  if (!data) return newsItems;
  const items = unwrapList(data)
    .filter((post) => post.is_published)
    .map(mapApiNews);
  return items.length > 0 ? items : newsItems;
}

export async function getPublicNewsBySlug(
  slug: string,
): Promise<PublicNewsItem | null> {
  const data = await fetchApi<ApiNews>(`/api/website/news/${slug}/`);
  if (data && data.is_published !== false) {
    return mapApiNews(data);
  }
  return newsItems.find((item) => item.slug === slug) ?? null;
}

export async function getPublicNewsSlugs(): Promise<string[]> {
  const posts = await getPublicNews();
  return posts.map((post) => post.slug);
}
