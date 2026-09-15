import { CLASS_LEVELS } from "@/lib/brand";
import { apiJson } from "@/lib/api";

export type PublicClassLevel = { id: number; name: string; order: number };

function sortLevels(list: PublicClassLevel[]): PublicClassLevel[] {
  return [...list].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name),
  );
}

function fallbackLevels(): PublicClassLevel[] {
  return CLASS_LEVELS.map((name, index) => ({
    id: index + 1,
    name,
    order: index + 1,
  }));
}

/** Server-side public ladder. Falls back to brand.ts if the API is unreachable. */
export async function fetchPublicClassLevelNames(): Promise<string[]> {
  const origin = (
    process.env.API_PROXY_ORIGIN ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://127.0.0.1:8000"
  ).replace(/\/$/, "");
  try {
    const response = await fetch(`${origin}/api/public/class-levels/`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(1000),
    });
    if (!response.ok) return [...CLASS_LEVELS];
    const data = (await response.json()) as PublicClassLevel[] | { results?: PublicClassLevel[] };
    const list = Array.isArray(data) ? data : data.results ?? [];
    const names = sortLevels(list)
      .map((row) => String(row.name || "").trim())
      .filter(Boolean);
    return names.length ? names : [...CLASS_LEVELS];
  } catch {
    return [...CLASS_LEVELS];
  }
}

export async function loadPublicClassLevels(): Promise<PublicClassLevel[]> {
  try {
    const data = await apiJson<PublicClassLevel[] | { results?: PublicClassLevel[] }>(
      "/api/public/class-levels/",
    );
    const list = Array.isArray(data) ? data : data.results ?? [];
    return sortLevels(list).length ? sortLevels(list) : fallbackLevels();
  } catch {
    return fallbackLevels();
  }
}
