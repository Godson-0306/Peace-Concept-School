"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiJson } from "@/lib/api";
import { AuthUser, getStoredUser } from "@/lib/auth";

type Tab = "session" | "term";

type Session = {
  id: number;
  name: string;
  start_year: number;
  is_active: boolean;
};

type Term = {
  id: number;
  session: number;
  session_name: string;
  number: number;
  name: string;
  is_active: boolean;
  results_entry_open: boolean;
  start_date: string | null;
  end_date: string | null;
  next_term_resumption: string | null;
};

type MissingClass = {
  class_arm_id: number;
  label: string;
  subject_count: number;
  subjects_with_scores: number;
  student_count: number;
};

function unwrapList<T>(data: { results?: T[] } | T[]): T[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tab, setTab] = useState<Tab>("session");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [sessionId, setSessionId] = useState<number | "">("");
  const [selectedTermId, setSelectedTermId] = useState<number | "">("");
  const [missing, setMissing] = useState<MissingClass[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const isAdmin = user?.account_type === "admin";
  const canManageTerms =
    user?.account_type === "admin" || user?.account_type === "principal";

  const selectedTerm = useMemo(
    () => terms.find((t) => t.id === selectedTermId) ?? null,
    [terms, selectedTermId],
  );

  const loadSessions = useCallback(async () => {
    const data = await apiJson<{ results?: Session[] } | Session[]>("/api/sessions/");
    const list = unwrapList(data);
    setSessions(list);
    setSessionId((current) => {
      if (current) return current;
      const active = list.find((s) => s.is_active);
      return active?.id ?? list[0]?.id ?? "";
    });
  }, []);

  const loadTerms = useCallback(async (sid: number) => {
    const data = await apiJson<{ results?: Term[] } | Term[]>(
      `/api/terms/?session=${sid}`,
    );
    const list = unwrapList(data);
    setTerms(list);
    setSelectedTermId((current) => {
      if (current && list.some((t) => t.id === current)) return current;
      const active = list.find((t) => t.is_active);
      return active?.id ?? list[0]?.id ?? "";
    });
  }, []);

  const loadReadiness = useCallback(async (termId: number) => {
    const data = await apiJson<{ classes_missing_results: MissingClass[] }>(
      `/api/dashboard/?term=${termId}`,
    );
    setMissing(data.classes_missing_results ?? []);
  }, []);

  useEffect(() => {
    const stored = getStoredUser();
    setUser(stored);
    if (
      stored &&
      stored.account_type !== "admin" &&
      stored.account_type !== "principal"
    ) {
      router.replace("/app");
    }
  }, [router]);

  useEffect(() => {
    if (!canManageTerms) return;
    loadSessions().catch((e) =>
      setError(e instanceof Error ? e.message : "Failed to load sessions"),
    );
  }, [canManageTerms, loadSessions]);

  useEffect(() => {
    if (!sessionId || !canManageTerms) return;
    loadTerms(sessionId).catch((e) =>
      setError(e instanceof Error ? e.message : "Failed to load terms"),
    );
  }, [sessionId, canManageTerms, loadTerms]);

  useEffect(() => {
    if (!selectedTermId || tab !== "term") return;
    loadReadiness(selectedTermId).catch(() => setMissing([]));
  }, [selectedTermId, tab, loadReadiness]);

  async function createSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) return;
    setPending(true);
    setMessage("");
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const created = await apiJson<Session>("/api/sessions/", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          start_year: Number(form.get("start_year")),
          is_active: form.get("is_active") === "on",
        }),
      });
      setMessage(
        `Session ${created.name} created with 1st, 2nd, and 3rd terms.`,
      );
      event.currentTarget.reset();
      await loadSessions();
      setSessionId(created.id);
      setTab("term");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create session");
    } finally {
      setPending(false);
    }
  }

  async function activateSession(id: number) {
    if (!isAdmin) return;
    setPending(true);
    setMessage("");
    setError("");
    try {
      await apiJson(`/api/sessions/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: true }),
      });
      setMessage("Session activated.");
      await loadSessions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not activate session");
    } finally {
      setPending(false);
    }
  }

  async function patchTerm(id: number, payload: Partial<Term>, okMessage: string) {
    setPending(true);
    setMessage("");
    setError("");
    try {
      await apiJson(`/api/terms/${id}/`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setMessage(okMessage);
      if (sessionId) await loadTerms(sessionId);
      if (payload.results_entry_open !== undefined || selectedTermId === id) {
        await loadReadiness(id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update term");
    } finally {
      setPending(false);
    }
  }

  async function saveTermDates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTerm) return;
    const form = new FormData(event.currentTarget);
    const start = String(form.get("start_date") || "");
    const end = String(form.get("end_date") || "");
    const next = String(form.get("next_term_resumption") || "");
    await patchTerm(
      selectedTerm.id,
      {
        start_date: start || null,
        end_date: end || null,
        next_term_resumption: next || null,
      } as Partial<Term>,
      "Term dates saved.",
    );
  }

  async function publishClass(classArmId: number) {
    if (!selectedTerm) return;
    setPending(true);
    setMessage("");
    setError("");
    try {
      const res = await apiJson<{ published_count: number }>("/api/scores/publish/", {
        method: "POST",
        body: JSON.stringify({
          term: selectedTerm.id,
          class_arm: classArmId,
        }),
      });
      setMessage(`Published ${res.published_count} score rows for that class.`);
      await loadReadiness(selectedTerm.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setPending(false);
    }
  }

  async function publishAll() {
    if (!selectedTerm) return;
    setPending(true);
    setMessage("");
    setError("");
    try {
      const res = await apiJson<{
        published_count: number;
        class_arms_notified: number;
      }>("/api/scores/publish_term/", {
        method: "POST",
        body: JSON.stringify({ term: selectedTerm.id }),
      });
      setMessage(
        `Published ${res.published_count} scores across ${res.class_arms_notified} classes.`,
      );
      await loadReadiness(selectedTerm.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish term failed");
    } finally {
      setPending(false);
    }
  }

  if (user && !canManageTerms) {
    return (
      <p className="text-sm text-[var(--muted)]">Redirecting to Dashboard…</p>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-pink)]">
          Settings
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold text-[var(--brand-blue-deep)]">
          Academic settings
        </h1>
        <p className="mt-3 max-w-2xl text-base text-[var(--muted)]">
          Manage sessions and control when teachers can enter results and when
          results are published.
        </p>
      </header>

      <div
        className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--mist)] p-1"
        role="tablist"
        aria-label="Settings sections"
      >
        {(
          [
            { id: "session", label: "Session Management" },
            { id: "term", label: "Term Management" },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`rounded-lg px-3 py-2.5 text-sm font-bold transition ${
              tab === item.id
                ? "bg-[var(--brand-blue)] text-white"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {message ? (
        <p className="rounded-xl bg-[var(--brand-blue-wash)] px-4 py-3 text-sm text-[var(--brand-blue-deep)]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {tab === "session" ? (
        <section className="space-y-6">
          {isAdmin ? (
            <form
              onSubmit={createSession}
              className="rounded-2xl border border-[var(--line)] bg-white/90 p-5 sm:p-6"
            >
              <h2 className="font-display text-2xl font-semibold text-[var(--brand-blue-deep)]">
                Create session
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Creating a session automatically adds 1st, 2nd, and 3rd terms.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <label className="field">
                  <span>Session name</span>
                  <input
                    name="name"
                    required
                    placeholder="e.g. 2026/2027"
                    className="field-input"
                  />
                </label>
                <label className="field">
                  <span>Start year</span>
                  <input
                    name="start_year"
                    type="number"
                    required
                    defaultValue={new Date().getFullYear()}
                    className="field-input"
                  />
                </label>
              </div>
              <label className="mt-4 flex items-center gap-2 text-sm text-[var(--ink)]">
                <input name="is_active" type="checkbox" />
                Set as active session
              </label>
              <button
                type="submit"
                className="btn-primary mt-5"
                disabled={pending}
              >
                {pending ? "Creating…" : "Create session"}
              </button>
            </form>
          ) : (
            <p className="rounded-2xl border border-[var(--line)] bg-white/90 px-5 py-4 text-sm text-[var(--muted)]">
              Only administrators can create or activate sessions. You can manage
              terms under Term Management.
            </p>
          )}

          <div className="rounded-2xl border border-[var(--line)] bg-white/90">
            <div className="border-b border-[var(--line)] px-5 py-4 sm:px-6">
              <h2 className="font-display text-2xl font-semibold text-[var(--brand-blue-deep)]">
                Sessions
              </h2>
            </div>
            <ul className="divide-y divide-[var(--line)]">
              {sessions.length === 0 ? (
                <li className="px-5 py-6 text-sm text-[var(--muted)] sm:px-6">
                  No sessions yet.
                </li>
              ) : (
                sessions.map((session) => (
                  <li
                    key={session.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6"
                  >
                    <div>
                      <p className="font-semibold text-[var(--ink)]">
                        {session.name}
                        {session.is_active ? (
                          <span className="ml-2 rounded-md bg-[var(--brand-pink-wash)] px-2 py-0.5 text-xs font-bold text-[var(--brand-pink)]">
                            Active
                          </span>
                        ) : null}
                      </p>
                      <p className="text-sm text-[var(--muted)]">
                        Start year {session.start_year}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm font-semibold text-[var(--brand-blue)]"
                        onClick={() => {
                          setSessionId(session.id);
                          setTab("term");
                        }}
                      >
                        Manage terms
                      </button>
                      {isAdmin && !session.is_active ? (
                        <button
                          type="button"
                          disabled={pending}
                          className="rounded-lg bg-[var(--brand-blue)] px-3 py-1.5 text-sm font-bold text-white"
                          onClick={() => activateSession(session.id)}
                        >
                          Activate
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </section>
      ) : (
        <section className="space-y-6">
          <div className="rounded-2xl border border-[var(--line)] bg-white/90 p-5 sm:p-6">
            <label className="field max-w-md">
              <span>Session</span>
              <select
                className="field-input"
                value={sessionId}
                onChange={(e) =>
                  setSessionId(e.target.value ? Number(e.target.value) : "")
                }
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.is_active ? " (active)" : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-5 flex flex-wrap gap-2">
              {terms.map((term) => (
                <button
                  key={term.id}
                  type="button"
                  onClick={() => setSelectedTermId(term.id)}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                    selectedTermId === term.id
                      ? "bg-[var(--brand-blue)] text-white"
                      : "bg-[var(--mist)] text-[var(--ink)]"
                  }`}
                >
                  {term.name}
                  {term.is_active ? " · Active" : ""}
                </button>
              ))}
            </div>
          </div>

          {selectedTerm ? (
            <>
              <div className="rounded-2xl border border-[var(--line)] bg-white/90 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl font-semibold text-[var(--brand-blue-deep)]">
                      {selectedTerm.name}
                    </h2>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {selectedTerm.session_name}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!selectedTerm.is_active ? (
                      <button
                        type="button"
                        disabled={pending}
                        className="rounded-lg bg-[var(--brand-blue)] px-3 py-2 text-sm font-bold text-white"
                        onClick={() =>
                          patchTerm(
                            selectedTerm.id,
                            { is_active: true },
                            "Term set as active.",
                          )
                        }
                      >
                        Set as active term
                      </button>
                    ) : (
                      <span className="rounded-md bg-[var(--brand-blue-wash)] px-2 py-1 text-xs font-bold text-[var(--brand-blue)]">
                        Active term
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={pending}
                      className={`rounded-lg px-3 py-2 text-sm font-bold text-white ${
                        selectedTerm.results_entry_open
                          ? "bg-[var(--brand-pink)]"
                          : "bg-[var(--brand-blue-deep)]"
                      }`}
                      onClick={() =>
                        patchTerm(
                          selectedTerm.id,
                          {
                            results_entry_open: !selectedTerm.results_entry_open,
                          },
                          selectedTerm.results_entry_open
                            ? "Result entry closed for teachers."
                            : "Result entry opened for teachers.",
                        )
                      }
                    >
                      {selectedTerm.results_entry_open
                        ? "Close result entry"
                        : "Open result entry"}
                    </button>
                  </div>
                </div>

                <p className="mt-4 text-sm text-[var(--muted)]">
                  Result entry is{" "}
                  <strong
                    className={
                      selectedTerm.results_entry_open
                        ? "text-[var(--brand-pink)]"
                        : "text-[var(--ink)]"
                    }
                  >
                    {selectedTerm.results_entry_open ? "open" : "closed"}
                  </strong>{" "}
                  for teachers.
                </p>

                <form onSubmit={saveTermDates} className="mt-6 grid gap-3 sm:grid-cols-3">
                  <label className="field">
                    <span>Start date</span>
                    <input
                      name="start_date"
                      type="date"
                      defaultValue={selectedTerm.start_date ?? ""}
                      key={`start-${selectedTerm.id}-${selectedTerm.start_date}`}
                      className="field-input"
                    />
                  </label>
                  <label className="field">
                    <span>End date</span>
                    <input
                      name="end_date"
                      type="date"
                      defaultValue={selectedTerm.end_date ?? ""}
                      key={`end-${selectedTerm.id}-${selectedTerm.end_date}`}
                      className="field-input"
                    />
                  </label>
                  <label className="field">
                    <span>Next term begins</span>
                    <input
                      name="next_term_resumption"
                      type="date"
                      defaultValue={selectedTerm.next_term_resumption ?? ""}
                      key={`next-${selectedTerm.id}-${selectedTerm.next_term_resumption}`}
                      className="field-input"
                    />
                  </label>
                  <button
                    type="submit"
                    className="btn-primary sm:col-span-3 sm:w-fit"
                    disabled={pending}
                  >
                    Save dates
                  </button>
                </form>
              </div>

              <div className="rounded-2xl border border-[var(--line)] bg-white/90">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4 sm:px-6">
                  <div>
                    <h2 className="font-display text-2xl font-semibold text-[var(--brand-blue-deep)]">
                      Class readiness & publish
                    </h2>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Incomplete score entry for {selectedTerm.name}. Publish when
                      ready.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded-lg bg-[var(--brand-pink)] px-3 py-2 text-sm font-bold text-white"
                    onClick={publishAll}
                  >
                    Publish all classes
                  </button>
                </div>

                {missing.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-[var(--muted)] sm:px-6">
                    All classes with students have complete subject coverage for
                    this term — or there are no classes yet. You can still publish
                    any remaining draft scores with “Publish all classes”.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-[var(--mist)] text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                        <tr>
                          <th className="px-5 py-3 font-semibold sm:px-6">Class</th>
                          <th className="px-5 py-3 font-semibold sm:px-6">
                            Subjects
                          </th>
                          <th className="px-5 py-3 font-semibold sm:px-6">
                            Students
                          </th>
                          <th className="px-5 py-3 font-semibold sm:px-6">
                            Next term
                          </th>
                          <th className="px-5 py-3 font-semibold sm:px-6">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--line)]">
                        {missing.map((row) => (
                          <tr key={row.class_arm_id}>
                            <td className="px-5 py-3.5 font-semibold sm:px-6">
                              {row.label}
                            </td>
                            <td className="px-5 py-3.5 text-[var(--muted)] sm:px-6">
                              {row.subjects_with_scores} / {row.subject_count}
                            </td>
                            <td className="px-5 py-3.5 text-[var(--muted)] sm:px-6">
                              {row.student_count}
                            </td>
                            <td className="px-5 py-3.5 text-[var(--muted)] sm:px-6">
                              {formatDate(selectedTerm.next_term_resumption)}
                            </td>
                            <td className="px-5 py-3.5 sm:px-6">
                              <button
                                type="button"
                                disabled={pending}
                                className="text-sm font-bold text-[var(--brand-blue)] hover:underline"
                                onClick={() => publishClass(row.class_arm_id)}
                              >
                                Publish
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              Select a session with terms to manage result entry and publishing.
            </p>
          )}
        </section>
      )}

      <style jsx global>{`
        .field {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .field span {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--muted);
        }
        .field-input {
          width: 100%;
          border: 1px solid var(--line);
          background: #fff;
          border-radius: 0.65rem;
          padding: 0.65rem 0.75rem;
          font-size: 0.95rem;
        }
      `}</style>
    </div>
  );
}
