import { apiJson } from "@/lib/api";
import { ClassLevelNav, sortClassLevelsForUsers } from "@/lib/portalNav";

function unwrapList<T>(data: { results?: T[] } | T[]): T[] {
  return Array.isArray(data) ? data : data.results || [];
}

let cache: ClassLevelNav[] | null = null;
let inflight: Promise<ClassLevelNav[]> | null = null;

/** Shared class-level list so Sidebar + MobileNav don't double-fetch. */
export function loadClassLevels(force = false): Promise<ClassLevelNav[]> {
  if (!force && cache) return Promise.resolve(cache);
  if (!force && inflight) return inflight;

  inflight = apiJson<{ results?: ClassLevelNav[] } | ClassLevelNav[]>(
    "/api/class-levels/?page_size=200",
  )
    .then((data) => {
      cache = sortClassLevelsForUsers(unwrapList(data));
      return cache;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
