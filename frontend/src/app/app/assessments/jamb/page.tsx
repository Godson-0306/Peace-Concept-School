"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiJson, errorFromUnknown } from "@/lib/api";
import { getStoredUser, normalizeAccountType, type AuthUser } from "@/lib/auth";

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

type MePayload = {
  full_name?: string;
  student_code?: string;
  account_type?: string;
};

export default function JambCbtPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [attempts, setAttempts] = useState<JambAttemptRow[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [examOpen, setExamOpen] = useState(false);
  const [candidateName, setCandidateName] = useState("");

  const isStudent = user?.account_type === "student";

  const loadProgress = useCallback(async () => {
    setError("");
    try {
      const data = await apiJson<ProgressPayload>("/api/cbt/jamb/progress/");
      setAttempts(data.results ?? []);
    } catch (e) {
      // Staff without results access still get the exam — just hide history errors softly.
      setAttempts([]);
      setError(errorFromUnknown(e, "Could not load JAMB progress"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = getStoredUser();
    setUser(stored);
    setCandidateName(stored?.full_name || "");
    apiJson<MePayload>("/api/auth/me/")
      .then((me) => {
        const accountType = normalizeAccountType(me.account_type);
        setUser({
          id: stored?.id,
          email: stored?.email || "",
          full_name: me.full_name || stored?.full_name,
          account_type: accountType,
        });
        setCandidateName(me.full_name || stored?.full_name || "");
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
        isStudent
          ? `Practice saved — ${data.report?.totalPercent ?? "—"}% overall.`
          : `Practice finished — ${data.report?.totalPercent ?? "—"}%. Progress is stored for student accounts only.`,
      );
      setExamOpen(false);
      loadProgress();
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [isStudent, loadProgress]);

  const iframeSrc = useMemo(() => {
    const params = new URLSearchParams();
    if (candidateName) params.set("name", candidateName);
    const qs = params.toString();
    return `/jamb-cbt/index.html${qs ? `?${qs}` : ""}`;
  }, [candidateName]);

  function openExam() {
    setMessage("");
    setError("");
    setExamOpen(true);
  }

  if (examOpen) {
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
            <p className="mt-1 text-sm text-[var(--muted)]">
              200 questions · 4 subjects · 3-hour timer. Use the engine below to
              choose subjects and begin.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={iframeSrc}
              target="_blank"
              rel="noreferrer"
              className="btn-outline"
            >
              Open full window
            </a>
            <button
              type="button"
              className="btn-outline"
              onClick={() => setExamOpen(false)}
            >
              Exit to overview
            </button>
          </div>
        </div>
        <iframe
          title="JAMB CBT Practice"
          src={iframeSrc}
          className="h-[min(88vh,980px)] w-full rounded-2xl border border-[var(--line)] bg-white shadow-sm"
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
          subject analytics. Scores never update school report cards
          {isStudent ? " — your attempts are saved to portal progress." : "."}
        </p>
      </header>

      {message ? (
        <p className="rounded-xl border border-[var(--brand-blue)]/20 bg-[var(--brand-blue-wash)] px-4 py-3 text-sm text-[var(--brand-blue-deep)]">
          {message}
        </p>
      ) : null}
      {error && isStudent ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-blue)]">
          Ready to start
        </p>
        <h2 className="mt-2 font-display text-2xl text-[var(--brand-blue-deep)]">
          Open the JAMB practice engine
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Use of English is compulsory. Pick 3 more subjects, read the
          instructions, then start the timed exam. The paper is freshly
          randomized every session.
        </p>
        {!isStudent ? (
          <p className="mt-3 text-sm text-[var(--ink-soft)]">
            You are signed in as staff/parent — you can run the full exam for
            preview. Automatic progress saving is available on student accounts.
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" className="btn-primary" onClick={openExam}>
            Start JAMB CBT
          </button>
          <a
            href={iframeSrc}
            target="_blank"
            rel="noreferrer"
            className="btn-outline"
          >
            Open in new tab
          </a>
        </div>
      </div>

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
            No JAMB practice attempts yet
            {isStudent
              ? ". Finish an exam to see your score here."
              : ". Student attempts will appear here after they submit."}
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
