"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiJson, errorFromUnknown } from "@/lib/api";
import { getStoredUser, type AuthUser } from "@/lib/auth";

type Choice = { id?: number; label: string; text: string; is_correct: boolean };
type Question = {
  id?: number;
  prompt: string;
  order: number;
  marks: number | string;
  choices: Choice[];
};
type Paper = {
  id: number;
  title: string;
  score_component: string;
  component_max: number;
  subject_name: string;
  class_arm_label: string;
  term_name: string;
  duration_minutes: number;
  status: string;
  questions: Question[];
};
type AttemptRow = {
  id: number;
  student_name: string;
  student_code: string;
  status: string;
  scaled_score: number | string;
  written_to_results: boolean;
  submitted_at: string | null;
};

function emptyQuestion(order: number): Question {
  return {
    prompt: "",
    order,
    marks: 1,
    choices: [
      { label: "A", text: "", is_correct: true },
      { label: "B", text: "", is_correct: false },
      { label: "C", text: "", is_correct: false },
      { label: "D", text: "", is_correct: false },
    ],
  };
}

export default function NormalCbtPaperPage() {
  const params = useParams();
  const paperId = Number(params.id);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [paper, setPaper] = useState<Paper | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [results, setResults] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [duration, setDuration] = useState("30");
  const [title, setTitle] = useState("");

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  useEffect(() => {
    if (!paperId || !user) return;
    if (user.account_type === "student") {
      window.location.href = `/app/assessments/normal/${paperId}/take`;
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await apiJson<Paper>(`/api/cbt/papers/${paperId}/`);
        if (cancelled) return;
        setPaper(data);
        setTitle(data.title);
        setDuration(String(data.duration_minutes));
        setQuestions(
          data.questions?.length
            ? data.questions.map((q, i) => ({
                ...q,
                order: q.order || i + 1,
                choices:
                  q.choices?.length === 4
                    ? q.choices
                    : emptyQuestion(i + 1).choices,
              }))
            : [emptyQuestion(1)],
        );
        try {
          const rows = await apiJson<AttemptRow[]>(
            `/api/cbt/papers/${paperId}/results/`,
          );
          if (!cancelled) setResults(rows);
        } catch {
          if (!cancelled) setResults([]);
        }
        setError("");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load paper");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paperId, user]);

  function updateQuestion(index: number, patch: Partial<Question>) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    );
  }

  function setCorrect(index: number, label: string) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === index
          ? {
              ...q,
              choices: q.choices.map((c) => ({
                ...c,
                is_correct: c.label === label,
              })),
            }
          : q,
      ),
    );
  }

  async function saveQuestions(e?: FormEvent): Promise<boolean> {
    e?.preventDefault();
    if (!paper) return false;
    setPending(true);
    setError("");
    setMessage("");

    const localErrors: string[] = [];
    questions.forEach((q, i) => {
      if (!q.prompt.trim()) {
        localErrors.push(`Question ${i + 1} → Question text: This field may not be blank.`);
      }
      q.choices.forEach((c) => {
        if (!c.text.trim()) {
          localErrors.push(
            `Question ${i + 1} → Option ${c.label} → Option text: This field may not be blank.`,
          );
        }
      });
      if (!q.choices.some((c) => c.is_correct)) {
        localErrors.push(`Question ${i + 1}: Mark one option as the correct answer.`);
      }
    });
    if (localErrors.length) {
      setError(localErrors.join("\n"));
      setPending(false);
      return false;
    }

    try {
      await apiJson(`/api/cbt/papers/${paper.id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          title,
          duration_minutes: Number(duration) || 30,
          questions: questions.map((q, i) => ({
            prompt: q.prompt,
            order: i + 1,
            marks: Number(q.marks) || 1,
            choices: q.choices.map((c) => ({
              label: c.label,
              text: c.text,
              is_correct: c.is_correct,
            })),
          })),
        }),
      });
      const refreshed = await apiJson<Paper>(`/api/cbt/papers/${paper.id}/`);
      setPaper(refreshed);
      setQuestions(
        refreshed.questions?.length
          ? refreshed.questions.map((q, i) => ({
              ...q,
              order: q.order || i + 1,
              choices:
                q.choices?.length === 4
                  ? q.choices
                  : emptyQuestion(i + 1).choices,
            }))
          : [emptyQuestion(1)],
      );
      setMessage("Paper saved.");
      return true;
    } catch (err) {
      setMessage("");
      setError(errorFromUnknown(err, "Could not save paper"));
      return false;
    } finally {
      setPending(false);
    }
  }

  async function publish() {
    if (!paper) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const saved = await saveQuestions();
      if (!saved) return;
      setPending(true);
      const data = await apiJson<Paper>(`/api/cbt/papers/${paper.id}/publish/`, {
        method: "POST",
        body: "{}",
      });
      setPaper(data);
      setMessage("Paper published. Students in this class can take it.");
    } catch (err) {
      setMessage("");
      setError(errorFromUnknown(err, "Could not publish"));
    } finally {
      setPending(false);
    }
  }

  async function closePaper() {
    if (!paper) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const data = await apiJson<Paper>(`/api/cbt/papers/${paper.id}/close/`, {
        method: "POST",
        body: "{}",
      });
      setPaper(data);
      setMessage("Paper closed.");
    } catch (err) {
      setMessage("");
      setError(errorFromUnknown(err, "Could not close"));
    } finally {
      setPending(false);
    }
  }

  if (loading || !paper) {
    return (
      <p className="text-sm text-[var(--muted)]">
        {error || "Loading paper…"}
      </p>
    );
  }

  const fieldClass =
    "mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand-blue)]";

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/app/assessments/normal"
        className="text-sm text-[var(--brand-blue)] hover:underline"
      >
        ← Normal CBT
      </Link>
      <h1 className="mt-2 font-display text-3xl font-semibold text-[var(--brand-blue-deep)]">
        {paper.title}
      </h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {paper.subject_name} · {paper.class_arm_label} · {paper.term_name} ·{" "}
        <span className="uppercase">{paper.score_component}</span> (max{" "}
        {paper.component_max}) · <span className="capitalize">{paper.status}</span>
      </p>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <p className="font-semibold">Could not save</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {error.split("\n").filter(Boolean).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {message ? (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </p>
      ) : null}

      <form onSubmit={saveQuestions} className="mt-6 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Title
            <input
              className={fieldClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="text-sm font-medium">
            Duration (minutes)
            <input
              className={fieldClass}
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </label>
        </div>

        {questions.map((q, index) => (
          <div
            key={index}
            className="rounded-xl border border-[var(--line)] bg-white p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">Question {index + 1}</h3>
              <button
                type="button"
                className="text-sm text-rose-700"
                onClick={() =>
                  setQuestions((prev) => prev.filter((_, i) => i !== index))
                }
                disabled={questions.length <= 1}
              >
                Remove
              </button>
            </div>
            <label className="mt-2 block text-sm">
              Prompt
              <textarea
                className={fieldClass}
                rows={2}
                value={q.prompt}
                onChange={(e) =>
                  updateQuestion(index, { prompt: e.target.value })
                }
                required
              />
            </label>
            <label className="mt-2 block text-sm w-28">
              Marks
              <input
                className={fieldClass}
                type="number"
                min={0.01}
                step="0.01"
                value={q.marks}
                onChange={(e) =>
                  updateQuestion(index, { marks: e.target.value })
                }
              />
            </label>
            <div className="mt-3 space-y-2">
              {q.choices.map((c) => (
                <div key={c.label} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${index}`}
                    checked={c.is_correct}
                    onChange={() => setCorrect(index, c.label)}
                    title="Mark as correct"
                  />
                  <span className="w-5 font-semibold">{c.label}</span>
                  <input
                    className={fieldClass + " mt-0"}
                    value={c.text}
                    onChange={(e) =>
                      updateQuestion(index, {
                        choices: q.choices.map((ch) =>
                          ch.label === c.label
                            ? { ...ch, text: e.target.value }
                            : ch,
                        ),
                      })
                    }
                    placeholder={`Option ${c.label}`}
                    required
                  />
                </div>
              ))}
              <p className="text-xs text-[var(--muted)]">
                Select the radio next to the correct option.
              </p>
            </div>
          </div>
        ))}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
            onClick={() =>
              setQuestions((prev) => [...prev, emptyQuestion(prev.length + 1)])
            }
          >
            Add question
          </button>
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Saving…" : "Save questions"}
          </button>
          {paper.status !== "published" ? (
            <button
              type="button"
              className="rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white"
              onClick={() => void publish()}
              disabled={pending}
            >
              Publish
            </button>
          ) : (
            <button
              type="button"
              className="rounded-lg bg-slate-700 px-3 py-2 text-sm text-white"
              onClick={() => void closePaper()}
              disabled={pending}
            >
              Close paper
            </button>
          )}
        </div>
      </form>

      <section className="mt-10">
        <h2 className="font-display text-2xl text-[var(--brand-blue-deep)]">
          Attempts
        </h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--mist)] text-xs uppercase">
              <tr>
                <th className="px-3 py-2">Student</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Scaled score</th>
                <th className="px-3 py-2">In results</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-[var(--muted)]">
                    No attempts yet.
                  </td>
                </tr>
              ) : (
                results.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--line)]">
                    <td className="px-3 py-2">
                      {r.student_name} ({r.student_code})
                    </td>
                    <td className="px-3 py-2 capitalize">{r.status}</td>
                    <td className="px-3 py-2">{r.scaled_score}</td>
                    <td className="px-3 py-2">
                      {r.written_to_results ? "Yes" : "No"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
