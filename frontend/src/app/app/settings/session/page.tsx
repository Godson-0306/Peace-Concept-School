"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiJson } from "@/lib/api";
import { AuthUser, getStoredUser } from "@/lib/auth";

type Session = {
  id: number;
  name: string;
  start_year: number;
  is_active: boolean;
  promotion_ran?: boolean;
  promoted_count?: number;
  graduated_count?: number;
  skipped_count?: number;
};

function promotionMessage(session: Session): string {
  if (!session.promotion_ran) return "";
  return ` Students promoted: ${session.promoted_count ?? 0}; graduated to Ex-Students: ${session.graduated_count ?? 0}.`;
}

function unwrapList<T>(data: { results?: T[] } | T[]): T[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

export default function SettingsSessionPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const isAdmin = user?.account_type === "admin";
  const canAccess =
    user?.account_type === "admin" || user?.account_type === "principal";

  const loadSessions = useCallback(async () => {
    const data = await apiJson<{ results?: Session[] } | Session[]>("/api/sessions/");
    setSessions(unwrapList(data));
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
    if (!canAccess) return;
    loadSessions().catch((e) =>
      setError(e instanceof Error ? e.message : "Failed to load sessions"),
    );
  }, [canAccess, loadSessions]);

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
        `Session ${created.name} created with 1st, 2nd, and 3rd terms.${promotionMessage(created)}`,
      );
      event.currentTarget.reset();
      await loadSessions();
      router.push("/app/settings/terms");
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
      const updated = await apiJson<Session>(`/api/sessions/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: true }),
      });
      setMessage(`Session activated.${promotionMessage(updated)}`);
      await loadSessions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not activate session");
    } finally {
      setPending(false);
    }
  }

  if (user && !canAccess) {
    return <p className="text-sm text-[var(--muted)]">Redirecting…</p>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-pink)]">
          Settings
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold text-[var(--brand-blue-deep)]">
          Session
        </h1>
        <p className="mt-3 max-w-2xl text-base text-[var(--muted)]">
          Create and activate academic sessions. Activating a new session can
          auto-promote students.
        </p>
      </header>

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
          <button type="submit" className="btn-primary mt-5" disabled={pending}>
            {pending ? "Creating…" : "Create session"}
          </button>
        </form>
      ) : (
        <p className="rounded-2xl border border-[var(--line)] bg-white/90 px-5 py-4 text-sm text-[var(--muted)]">
          Only administrators can create or activate sessions. You can manage
          terms under Session Term.
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
                  <Link
                    href="/app/settings/terms"
                    className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm font-semibold text-[var(--brand-blue)]"
                  >
                    Manage terms
                  </Link>
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
