/** Empty string = same-origin (Next.js `/api/[...path]` proxies to Django). */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

function normalizeApiPath(path: string): string {
  if (path.startsWith("http")) return path;
  const withSlash = path.startsWith("/") ? path : `/${path}`;
  // Next.js redirects trailing-slash API routes with 308; strip before fetch.
  // The server proxy re-appends a slash for Django/DRF.
  if (withSlash.startsWith("/api/") && withSlash.length > 5 && withSlash.endsWith("/")) {
    return withSlash.slice(0, -1);
  }
  return withSlash;
}

export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const normalized = normalizeApiPath(path);
  const url = normalized.startsWith("http")
    ? normalized
    : `${API_URL}${normalized}`;
  const headers = new Headers(options.headers);

  if (
    options.body &&
    typeof options.body === "string" &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });
}

export async function apiJson<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await apiFetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (data as { detail?: string }).detail ||
      JSON.stringify(data) ||
      response.statusText;
    throw new Error(typeof message === "string" ? message : "Request failed");
  }
  return data as T;
}
