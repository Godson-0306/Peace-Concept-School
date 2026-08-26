"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiJson } from "@/lib/api";
import { getStoredUser, type AuthUser } from "@/lib/auth";

type Choice = { id: number; label: string; text: string };
type Question = {
  id: number;
  prompt: string;
  order: number;
  marks: number;
  choices: Choice[];
};
type Attempt = {
  id: number;
  paper: number;
  paper_title: string;
  status: string;
  started_at: string;
  deadline: string;
  duration_minutes: number;
  score_component: string;
  component_max: number;
  questions: Question[];
  scaled_score: number | string;
  earned_marks: number | string;
  paper_total: number | string;
  written_to_results: boolean;
};

export default function TakeCbtPage() {
  const params = useParams();
  const paperId = Number(params.id);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  useEffect(() => {
    if (!user || !paperId) return;
    if (user.account_type !== "student") {
      window.location.href = `/app/assessments/normal/${paperId}`;
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await apiJson<Attempt>(
          `/api/cbt/papers/${paperId}/start/`,
          { method: "POST", body: "{}" },
        );
        if (cancelled) return;
        setAttempt(data);
        if (data.status === "submitted") setSubmitted(true);
        setError("");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not start test");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, paperId]);

  useEffect(() => {
    if (!attempt || attempt.status === "submitted") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [attempt]);

  const remainingMs = useMemo(() => {
    if (!attempt?.deadline) return 0;
    return Math.max(0, new Date(attempt.deadline).getTime() - now);
  }, [attempt, now]);

  useEffect(() => {
    if (!attempt || attempt.status === "submitted" || submitted) return;
    if (remainingMs <= 0 && attempt.questions?.length) {
      void autoSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs]);

  async function autoSubmit() {
    if (pending || submitted || !attempt) return;
    await doSubmit();
  }

  async function doSubmit(e?: FormEvent) {
    e?.preventDefault();
    if (!attempt || pending) return;
    setPending(true);
    setError("");
    try {
      const payload = {
        answers: Object.entries(answers).map(([questionId, choiceId]) => ({
          question_id: Number(questionId),
          choice_id: choiceId,
        })),
      };
      const data = await apiJson<Attempt>(
        `/api/cbt/papers/${paperId}/submit/`,
        { method: "POST", body: JSON.stringify(payload) },
      );
      setAttempt(data);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setPending(false);
    }
  }

  function formatTime(ms: number) {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Starting test…</p>;
  }

  if (error && !attempt) {
    return (
      <div>
        <p className="text-sm text-rose-700">{error}</p>
        <Link href="/app/assessments/normal" className="mt-3 inline-block text-[var(--brand-blue)]">
          Back
        </Link>
      </div>
    );
  }

  if (!attempt) return null;

  if (submitted || attempt.status === "submitted") {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-[var(--line)] bg-white p-6">
        <h1 className="font-display text-3xl text-[var(--brand-blue-deep)]">
          Submitted
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">{attempt.paper_title}</p>
        <p className="mt-6 text-4xl font-semibold text-[var(--brand-blue-deep)]">
          {attempt.scaled_score}
          <span className="text-base font-normal text-[var(--muted)]">
            {" "}
            / {attempt.component_max} ({attempt.score_component.toUpperCase()})
          </span>
        </p>
        <p className="mt-2 text-sm">
          Raw: {attempt.earned_marks} / {attempt.paper_total}
        </p>
        <p className="mt-1 text-sm text-emerald-800">
          {attempt.written_to_results
            ? "Score recorded in your results."
            : "Score calculated."}
        </p>
        <Link
          href="/app/assessments/normal"
          className="btn-primary mt-6 inline-block"
        >
          Back to tests
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="flex items-start justify-between gap-4 rounded-2xl border border-[var(--line)] bg-white px-5 py-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold leading-tight text-[var(--brand-blue-deep)] sm:text-3xl">
            {attempt.paper_title}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {attempt.score_component.toUpperCase()} · {attempt.duration_minutes}{" "}
            minutes · {attempt.questions.length} question
            {attempt.questions.length === 1 ? "" : "s"}
          </p>
        </div>
        <div
          className={`shrink-0 rounded-xl px-4 py-2 text-right ${
            remainingMs < 60_000
              ? "bg-rose-100 text-rose-800"
              : "bg-[var(--brand-blue-wash)] text-[var(--brand-blue-deep)]"
          }`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
            Time left
          </p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums leading-none">
            {formatTime(remainingMs)}
          </p>
        </div>
      </header>

      {error ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <form onSubmit={doSubmit} className="mt-5 space-y-3">
        {attempt.questions.map((q, idx) => (
          <div
            key={q.id}
            className="rounded-2xl border border-[var(--line)] bg-white p-5"
          >
            <p className="text-base font-semibold leading-snug text-[var(--ink)]">
              <span className="mr-1.5 text-[var(--brand-blue)]">{idx + 1}.</span>
              {q.prompt}
              <span className="ml-2 text-sm font-normal text-[var(--muted)]">
                ({q.marks} mark{Number(q.marks) === 1 ? "" : "s"})
              </span>
            </p>
            <div className="mt-4 grid gap-2">
              {q.choices.map((c) => {
                const selected = answers[q.id] === c.id;
                return (
                  <label
                    key={c.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                      selected
                        ? "border-[var(--brand-blue)] bg-[var(--brand-blue-wash)]"
                        : "border-[var(--line)] hover:bg-[var(--mist)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      className="mt-0.5"
                      checked={selected}
                      onChange={() =>
                        setAnswers((prev) => ({ ...prev, [q.id]: c.id }))
                      }
                    />
                    <span>
                      <strong className="mr-1">{c.label}.</strong>
                      {c.text}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
        <div className="flex justify-end pt-1">
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Submitting…" : "Submit answers"}
          </button>
        </div>
      </form>
    </div>
  );
}
