/** Empty string = same-origin (Next.js rewrites proxy /api → Django). */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = path.startsWith("http")
    ? path
    : `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
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
