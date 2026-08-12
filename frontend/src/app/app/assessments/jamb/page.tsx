"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiJson, errorFromUnknown } from "@/lib/api";
import { getStoredUser, type AuthUser } from "@/lib/auth";

type JambAttemptRow = {
  id: number;
  title: string;
  score_percent: string | number;
  subjects_json: unknown;
  taken_at: string;
  source: string;
  student_name?: string;
  student_code?: string;
};

type ProgressPayload = {
  integration?: string;
  message?: string;
  results?: JambAttemptRow[];
};

export default function JambCbtPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [attempts, setAttempts] = useState<JambAttemptRow[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [examOpen, setExamOpen] = useState(false);
  const [studentName, setStudentName] = useState("");

  const isStudent = user?.account_type === "student";
  const canBrowse =
    user?.account_type === "admin" ||
    user?.account_type === "principal" ||
    user?.account_type === "teacher" ||
    user?.account_type === "parent";

  const loadProgress = useCallback(async () => {
    setError("");
    try {
      const data = await apiJson<ProgressPayload>("/api/cbt/jamb/progress/");
      setAttempts(data.results ?? []);
    } catch (e) {
      setError(errorFromUnknown(e, "Could not load JAMB progress"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = getStoredUser();
    setUser(stored);
    apiJson<{ full_name?: string; student_code?: string }>("/api/auth/me/")
      .then((me) => {
        setStudentName(me.full_name || stored?.full_name || "");
      })
      .catch(() => undefined);
    loadProgress();
  }, [loadProgress]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.type !== "pcims-jamb-complete") return;
      setMessage(
        `Practice saved — ${data.report?.totalPercent ?? "—"}% overall.`,
      );
      setExamOpen(false);
      loadProgress();
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [loadProgress]);

  const iframeSrc = useMemo(() => {
    const params = new URLSearchParams();
    if (studentName) params.set("name", studentName);
    const qs = params.toString();
    return `/jamb-cbt/index.html${qs ? `?${qs}` : ""}`;
  }, [studentName]);

  if (examOpen && isStudent) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-pink)]">
              JAMB practice
            </p>
            <h1 className="font-display text-2xl text-[var(--brand-blue-deep)]">
              Live exam session
            </h1>
          </div>
          <button
            type="button"
            className="btn-outline"
            onClick={() => setExamOpen(false)}
          >
            Exit to progress
          </button>
        </div>
        <iframe
          title="JAMB CBT Practice"
          src={iframeSrc}
          className="h-[min(85vh,920px)] w-full rounded-2xl border border-[var(--line)] bg-white"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-pink)]">
          Practice only
        </p>
        <h1 className="font-display text-3xl text-[var(--brand-blue-deep)]">
          JAMB CBT
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
          Full UTME-style practice with 200 questions, a 3-hour timer, and
          subject analytics. Scores are saved to your portal progress and never
          update school report cards.
        </p>
      </header>

      {message ? (
        <p className="rounded-xl border border-[var(--brand-blue)]/20 bg-[var(--brand-blue-wash)] px-4 py-3 text-sm text-[var(--brand-blue-deep)]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      {isStudent ? (
        <div className="rounded-2xl border border-[var(--line)] bg-white p-6">
          <h2 className="font-display text-2xl text-[var(--brand-blue-deep)]">
            Start a practice exam
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Use of English is compulsory. Choose 3 more subjects, then sit a
            randomized paper generated from the PCIMS JAMB engine.
          </p>
          <button
            type="button"
            className="btn-primary mt-4"
            onClick={() => {
              setMessage("");
              setExamOpen(true);
            }}
          >
            Open JAMB CBT
          </button>
        </div>
      ) : canBrowse ? (
        <div className="rounded-2xl border border-dashed border-[var(--brand-pink)] bg-white p-6">
          <p className="text-sm text-[var(--muted)]">
            Students take JAMB practice from this page. Staff and parents can
            review saved attempt history below.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--line)] bg-white p-6">
          <p className="text-sm text-[var(--muted)]">
            Sign in as a student to take JAMB practice.
          </p>
          <Link href="/login?portal=student" className="btn-outline mt-3 inline-flex">
            Student login
          </Link>
        </div>
      )}

      <section className="rounded-2xl border border-[var(--line)] bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl text-[var(--brand-blue-deep)]">
            Recent practice
          </h2>
          <button type="button" className="btn-outline" onClick={loadProgress}>
            Refresh
          </button>
        </div>
        {loading ? (
          <p className="mt-3 text-sm text-[var(--muted)]">Loading…</p>
        ) : attempts.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            No JAMB practice attempts yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--line)]">
            {attempts.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-[var(--ink)]">
                    {row.title || "JAMB Practice"}
                  </p>
                  <p className="text-[var(--muted)]">
                    {row.student_name ? `${row.student_name} · ` : ""}
                    {new Date(row.taken_at).toLocaleString()}
                  </p>
                </div>
                <p className="font-display text-xl text-[var(--brand-pink)]">
                  {Number(row.score_percent).toFixed(0)}%
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
