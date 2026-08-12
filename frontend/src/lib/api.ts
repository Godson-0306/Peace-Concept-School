/** Empty string = same-origin (Next.js `/api/[...path]` proxies to Django). */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

function normalizeApiPath(path: string): string {
  if (path.startsWith("http")) return path;
  const withSlash = path.startsWith("/") ? path : `/${path}`;
  // Next.js redirects trailing-slash API routes with 308; strip before fetch.
  // The server proxy re-appends a slash for Django/DRF.
  if (!withSlash.startsWith("/api/")) return withSlash;
  const q = withSlash.indexOf("?");
  const base = q === -1 ? withSlash : withSlash.slice(0, q);
  const query = q === -1 ? "" : withSlash.slice(q);
  const trimmed =
    base.length > 5 && base.endsWith("/") ? base.slice(0, -1) : base;
  return `${trimmed}${query}`;
}

const FIELD_LABELS: Record<string, string> = {
  prompt: "Question text",
  text: "Option text",
  title: "Title",
  marks: "Marks",
  choices: "Options",
  questions: "Questions",
  subject: "Subject",
  class_arm: "Class arm",
  term: "Term",
  duration_minutes: "Duration",
  score_component: "Score component",
  non_field_errors: "Error",
  detail: "Error",
};

function humanField(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  if (/^\d+$/.test(key)) return `item ${Number(key) + 1}`;
  return key.replace(/_/g, " ");
}

/** Flatten DRF / nested validation payloads into readable lines. */
export function formatApiError(
  data: unknown,
  fallback = "Request failed",
): string {
  if (data == null || data === "") return fallback;
  if (typeof data === "string") {
    const trimmed = data.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return formatApiError(JSON.parse(trimmed), fallback);
      } catch {
        return trimmed || fallback;
      }
    }
    return trimmed || fallback;
  }
  if (typeof data === "number" || typeof data === "boolean") {
    return String(data);
  }
  if (Array.isArray(data)) {
    const parts = data
      .map((item) => formatApiError(item, ""))
      .filter(Boolean);
    return parts.join(" ") || fallback;
  }
  if (typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (typeof record.detail === "string") return record.detail;
    if (Array.isArray(record.detail)) {
      return formatApiError(record.detail, fallback);
    }

    const lines: string[] = [];

    const walk = (value: unknown, path: string[]) => {
      if (value == null) return;
      if (typeof value === "string") {
        const label = path.join(" → ");
        lines.push(label ? `${label}: ${value}` : value);
        return;
      }
      if (typeof value === "number" || typeof value === "boolean") {
        const label = path.join(" → ");
        lines.push(label ? `${label}: ${value}` : String(value));
        return;
      }
      if (Array.isArray(value)) {
        if (value.every((v) => typeof v === "string")) {
          const label = path.join(" → ");
          const text = value.join(" ");
          lines.push(label ? `${label}: ${text}` : text);
          return;
        }
        value.forEach((item, index) => walk(item, [...path, String(index)]));
        return;
      }
      if (typeof value === "object") {
        for (const [key, child] of Object.entries(value as object)) {
          if (key === "questions" && typeof child === "object" && child) {
            for (const [idx, qErr] of Object.entries(
              child as Record<string, unknown>,
            )) {
              const qLabel = /^\d+$/.test(idx)
                ? `Question ${Number(idx) + 1}`
                : humanField(idx);
              walk(qErr, [...path, qLabel]);
            }
            continue;
          }
          if (key === "choices" && typeof child === "object" && child) {
            for (const [idx, choiceErr] of Object.entries(
              child as Record<string, unknown>,
            )) {
              const letter = /^\d+$/.test(idx)
                ? String.fromCharCode(65 + Number(idx))
                : idx;
              walk(choiceErr, [...path, `Option ${letter}`]);
            }
            continue;
          }
          walk(child, [...path, humanField(key)]);
        }
      }
    };

    walk(record, []);
    if (lines.length) {
      return [...new Set(lines)].join("\n");
    }
  }
  return fallback;
}

export function errorFromUnknown(
  e: unknown,
  fallback = "Request failed",
): string {
  if (e instanceof Error) return formatApiError(e.message, fallback);
  return formatApiError(e, fallback);
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
    throw new Error(
      formatApiError(data, `Request failed (${response.status})`),
    );
  }
  return data as T;
}
