"use client";

import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api";
import { AuthUser, getStoredUser } from "@/lib/auth";

type DashboardClass = {
  class_arm_id: number;
  label: string;
  subject_count: number;
  subjects_with_scores: number;
  student_count: number;
  next_term_begins: string | null;
};

type DashboardData = {
  active_term: {
    id: number;
    name: string;
    session_name: string;
    is_active: boolean;
  } | null;
  next_term_begins: string | null;
  classes_missing_results: DashboardClass[];
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not set";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function AppHomePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiJson<DashboardData>("/api/dashboard/")
      .then((payload) => {
        if (!cancelled) {
          setData(payload);
          setError("");
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load dashboard");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isStudent = user?.account_type === "student";
  const missing = data?.classes_missing_results ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-pink)]">
          Dashboard
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold text-[var(--brand-blue-deep)]">
          Welcome{user?.full_name ? `, ${user.full_name}` : ""}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--muted)]">
          Peace Concept International Mission Schools management portal
          {user?.account_type ? (
            <>
              {" "}
              — signed in as{" "}
              <span className="font-semibold capitalize text-[var(--brand-blue)]">
                {user.account_type.replace("_", " ")}
              </span>
            </>
          ) : null}
          .
        </p>
      </header>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--line)] bg-white/90 px-5 py-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
            Active term
          </p>
          <p className="mt-2 font-display text-2xl font-semibold text-[var(--brand-blue-deep)]">
            {loading
              ? "Loading…"
              : data?.active_term
                ? `${data.active_term.name}`
                : "No term set"}
          </p>
          {data?.active_term ? (
            <p className="mt-1 text-sm text-[var(--muted)]">
              Session {data.active_term.session_name}
            </p>
          ) : null}
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--brand-blue)] px-5 py-5 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/70">
            Next term begins
          </p>
          <p className="mt-2 font-display text-2xl font-semibold">
            {loading ? "Loading…" : formatDate(data?.next_term_begins)}
          </p>
          <p className="mt-1 text-sm text-white/75">
            Resumption date for the next academic term
          </p>
        </div>
      </section>

      {!isStudent ? (
        <section className="rounded-2xl border border-[var(--line)] bg-white/90">
          <div className="border-b border-[var(--line)] px-5 py-4 sm:px-6">
            <h2 className="font-display text-2xl font-semibold text-[var(--brand-blue-deep)]">
              Classes yet to input results
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Classes where subject score entry is incomplete for the active term.
            </p>
          </div>

          {loading ? (
            <p className="px-5 py-8 text-sm text-[var(--muted)] sm:px-6">Loading classes…</p>
          ) : missing.length === 0 ? (
            <p className="px-5 py-8 text-sm text-[var(--muted)] sm:px-6">
              All classes with students have complete subject score entry for this term.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[var(--mist)] text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                  <tr>
                    <th className="px-5 py-3 font-semibold sm:px-6">Class</th>
                    <th className="px-5 py-3 font-semibold sm:px-6">Subjects</th>
                    <th className="px-5 py-3 font-semibold sm:px-6">Students</th>
                    <th className="px-5 py-3 font-semibold sm:px-6">Next term begins</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {missing.map((row) => (
                    <tr key={row.class_arm_id}>
                      <td className="px-5 py-3.5 font-semibold text-[var(--ink)] sm:px-6">
                        {row.label}
                      </td>
                      <td className="px-5 py-3.5 text-[var(--muted)] sm:px-6">
                        {row.subjects_with_scores} / {row.subject_count}
                      </td>
                      <td className="px-5 py-3.5 text-[var(--muted)] sm:px-6">
                        {row.student_count}
                      </td>
                      <td className="px-5 py-3.5 text-[var(--muted)] sm:px-6">
                        {formatDate(row.next_term_begins)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
