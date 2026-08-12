import { apiJson } from "@/lib/api";

export type PortalTerm = {
  id: number;
  name: string;
  number: number;
  session: number;
  is_active: boolean;
  session_name?: string;
  results_entry_open?: boolean;
  next_term_resumption?: string | null;
};

export type PortalSession = {
  id: number;
  name: string;
  is_active: boolean;
  start_year?: number;
};

function unwrapList<T>(data: { results?: T[] } | T[]): T[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

/** Always First → Second → Third. */
export function sortTermsByNumber<T extends { number: number }>(terms: T[]): T[] {
  return [...terms].sort((a, b) => a.number - b.number || 0);
}

/**
 * Return exactly the three terms for one academic session.
 * If sessionId is omitted, use the session that owns the active term
 * (or the first term's session).
 */
export function termsForOneSession(
  terms: PortalTerm[],
  sessionId?: number | null,
): PortalTerm[] {
  let sid = sessionId ?? null;
  if (sid == null) {
    const active = terms.find((t) => t.is_active);
    sid = active?.session ?? terms[0]?.session ?? null;
  }
  if (sid == null) return [];
  return sortTermsByNumber(terms.filter((t) => t.session === sid));
}

export async function loadSessions(): Promise<PortalSession[]> {
  const data = await apiJson<{ results?: PortalSession[] } | PortalSession[]>(
    "/api/sessions/?page_size=100",
  );
  return unwrapList(data);
}

export async function loadTerms(sessionId?: number): Promise<PortalTerm[]> {
  const path =
    sessionId != null
      ? `/api/terms/?session=${sessionId}&page_size=20`
      : `/api/terms/?page_size=100`;
  const data = await apiJson<{ results?: PortalTerm[] } | PortalTerm[]>(path);
  const list = unwrapList(data);
  return sessionId != null ? sortTermsByNumber(list) : list;
}

/** Load First/Second/Third for the currently active academic session only. */
export async function loadActiveSessionTerms(): Promise<PortalTerm[]> {
  const sessions = await loadSessions();
  const active = sessions.find((s) => s.is_active) ?? sessions[0];
  if (!active) return [];
  return loadTerms(active.id);
}
