"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiJson } from "@/lib/api";
import {
  clampScoreInput,
  parseClampedScore,
  SCORE_LIMITS,
} from "@/lib/assessments";
import { AuthUser, getStoredUser } from "@/lib/auth";

type Student = {
  id: number;
  student_id: string;
  full_name: string;
  class_arm: number | null;
  class_arm_label?: string;
  class_level?: number | null;
  class_level_name?: string;
};

type Term = { id: number; name: string; is_active: boolean };
type Subject = { id: number; name: string; subject_type: string; is_active?: boolean };
type Score = {
  id: number;
  subject: number;
  ca1: number;
  ca2: number;
  exam: number;
  status: string;
};
type FormRecord = {
  id: number;
  days_present: number;
  days_absent: number;
  teacher_remark: string;
};

type ScoreDraft = { ca1: string; ca2: string; exam: string };

function unwrapList<T>(data: { results?: T[] } | T[]): T[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

export default function StudentReportEntryPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = Number(params.id);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [terms, setTerms] = useState<Term[]>([]);
  const [termId, setTermId] = useState<number | "">("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [scores, setScores] = useState<Record<number, ScoreDraft>>({});
  const [daysPresent, setDaysPresent] = useState("0");
  const [daysAbsent, setDaysAbsent] = useState("0");
  const [remark, setRemark] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);

  const canManage =
    user?.account_type === "admin" || user?.account_type === "principal";

  const loadStudent = useCallback(async () => {
    const data = await apiJson<Student>(`/api/students/${studentId}/`);
    setStudent(data);
    return data;
  }, [studentId]);

  const loadTerms = useCallback(async () => {
    const data = await apiJson<{ results?: Term[] } | Term[]>("/api/terms/");
    const list = unwrapList(data);
    setTerms(list);
    const active = list.find((t) => t.is_active);
    setTermId((prev) => prev || active?.id || list[0]?.id || "");
    return list;
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
      return;
    }
    if (!studentId) return;
    setLoading(true);
    Promise.all([loadStudent(), loadTerms()])
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [router, studentId, loadStudent, loadTerms]);

  useEffect(() => {
    if (!student?.class_level || !termId) return;
    let cancelled = false;
    (async () => {
      try {
        const [subjectData, scoreData, formData] = await Promise.all([
          apiJson<{ results?: Subject[] } | Subject[]>(
            `/api/subjects/?class_level=${student.class_level}`,
          ),
          apiJson<{ results?: Score[] } | Score[]>(
            `/api/scores/?student=${student.id}&term=${termId}`,
          ),
          apiJson<{ results?: FormRecord[] } | FormRecord[]>(
            `/api/student-form/?student=${student.id}&term=${termId}`,
          ),
        ]);
        if (cancelled) return;
        const subjectList = unwrapList(subjectData).filter(
          (s) => s.is_active !== false,
        );
        setSubjects(subjectList);
        const existing = unwrapList(scoreData);
        const bySubject = new Map(existing.map((s) => [s.subject, s]));
        const draft: Record<number, ScoreDraft> = {};
        for (const subject of subjectList) {
          const row = bySubject.get(subject.id);
          draft[subject.id] = {
            ca1: String(row?.ca1 ?? 0),
            ca2: String(row?.ca2 ?? 0),
            exam: String(row?.exam ?? 0),
          };
        }
        setScores(draft);
        const form = unwrapList(formData)[0];
        setDaysPresent(String(form?.days_present ?? 0));
        setDaysAbsent(String(form?.days_absent ?? 0));
        setRemark(form?.teacher_remark ?? "");
        setError("");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load scores");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [student, termId]);

  const totals = useMemo(() => {
    let sum = 0;
    let count = 0;
    for (const subject of subjects) {
      if (subject.subject_type !== "subject") continue;
      const row = scores[subject.id];
      if (!row) continue;
      sum += Number(row.ca1 || 0) + Number(row.ca2 || 0) + Number(row.exam || 0);
      count += 1;
    }
    return {
      total: sum,
      average: count ? Math.round((sum / count) * 100) / 100 : 0,
      count,
    };
  }, [subjects, scores]);

  async function saveAll(event: FormEvent) {
    event.preventDefault();
    if (!student || !termId || !student.class_arm) {
      setError("Student must be assigned to a class arm before entering results.");
      return;
    }
    setPending(true);
    setMessage("");
    setError("");
    try {
      for (const subject of subjects) {
        const row = scores[subject.id];
        if (!row) continue;
        await apiJson("/api/scores/", {
          method: "POST",
          body: JSON.stringify({
            student: student.id,
            subject: subject.id,
            term: termId,
            class_arm: student.class_arm,
            ca1: parseClampedScore(row.ca1 || "0", SCORE_LIMITS.ca1),
            ca2: parseClampedScore(row.ca2 || "0", SCORE_LIMITS.ca2),
            exam: parseClampedScore(row.exam || "0", SCORE_LIMITS.exam),
          }),
        });
      }
      await apiJson("/api/student-form/", {
        method: "POST",
        body: JSON.stringify({
          student: student.id,
          term: termId,
          class_arm: student.class_arm,
          days_present: Number(daysPresent || 0),
          days_absent: Number(daysAbsent || 0),
          teacher_remark: remark,
        }),
      });
      setMessage("Report card scores and attendance saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save results");
    } finally {
      setPending(false);
    }
  }

  if (user && !canManage) {
    return <p className="text-sm text-[var(--muted)]">Redirecting…</p>;
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Loading report card…</p>;
  }

  if (!student) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-700">{error || "Student not found."}</p>
        <Link href="/app/users" className="text-sm font-semibold text-[var(--brand-blue)]">
          Back to Users
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-pink)]">
            Report card
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold text-[var(--brand-blue-deep)]">
            {student.full_name}
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {student.student_id}
            {student.class_arm_label ? ` · ${student.class_arm_label}` : ""}
            {student.class_level_name ? ` · ${student.class_level_name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/app/users"
            className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold"
          >
            Back to Users
          </Link>
          {termId ? (
            <a
              href={`/api/identity/report-card/${student.id}/?term=${termId}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-[var(--brand-blue)] px-4 py-2 text-sm font-semibold text-white"
            >
              Download PDF
            </a>
          ) : null}
        </div>
      </header>

      {message ? (
        <p className="rounded-xl bg-[var(--brand-blue-wash)] px-4 py-3 text-sm text-[var(--brand-blue)]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {!student.class_arm ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Assign this student to a class arm before entering results.
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-[var(--muted)]">Term</span>
          <select
            className="field-input min-w-[14rem]"
            value={termId}
            onChange={(e) => setTermId(Number(e.target.value))}
          >
            {terms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.name}
                {term.is_active ? " (active)" : ""}
              </option>
            ))}
          </select>
        </label>
        <p className="pb-2 text-sm text-[var(--muted)]">
          Total {totals.total} · Average {totals.average} · {totals.count} subjects
        </p>
      </div>

      <form onSubmit={saveAll} className="space-y-6">
        <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white/90">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--mist)] text-left text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Subject</th>
                  <th className="px-4 py-3 font-semibold">CA1 /20</th>
                  <th className="px-4 py-3 font-semibold">CA2 /20</th>
                  <th className="px-4 py-3 font-semibold">Exam /60</th>
                  <th className="px-4 py-3 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {subjects.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-[var(--muted)]">
                      No subjects configured for this class level.
                    </td>
                  </tr>
                ) : (
                  subjects.map((subject) => {
                    const row = scores[subject.id] || { ca1: "0", ca2: "0", exam: "0" };
                    const total =
                      Number(row.ca1 || 0) + Number(row.ca2 || 0) + Number(row.exam || 0);
                    return (
                      <tr key={subject.id}>
                        <td className="px-4 py-3 font-medium">
                          {subject.name}
                          {subject.subject_type !== "subject" ? (
                            <span className="ml-2 text-xs text-[var(--muted)]">
                              (additional)
                            </span>
                          ) : null}
                        </td>
                        {(["ca1", "ca2", "exam"] as const).map((field) => (
                          <td key={field} className="px-4 py-3">
                            <input
                              className="field-input w-20"
                              inputMode="decimal"
                              min={0}
                              max={SCORE_LIMITS[field]}
                              value={row[field]}
                              onChange={(e) =>
                                setScores((prev) => ({
                                  ...prev,
                                  [subject.id]: {
                                    ...prev[subject.id],
                                    [field]: clampScoreInput(
                                      e.target.value,
                                      SCORE_LIMITS[field],
                                    ),
                                  },
                                }))
                              }
                            />
                          </td>
                        ))}
                        <td className="px-4 py-3 font-semibold">{total}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <section className="rounded-2xl border border-[var(--line)] bg-white/90 p-5">
          <h2 className="font-display text-2xl text-[var(--brand-blue-deep)]">
            Attendance & remark
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-[var(--muted)]">Days present</span>
              <input
                className="field-input w-full"
                value={daysPresent}
                onChange={(e) => setDaysPresent(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-[var(--muted)]">Days absent</span>
              <input
                className="field-input w-full"
                value={daysAbsent}
                onChange={(e) => setDaysAbsent(e.target.value)}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-[var(--muted)]">Teacher remark</span>
              <textarea
                className="field-input w-full"
                rows={3}
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
              />
            </label>
          </div>
        </section>

        <button type="submit" className="btn-primary" disabled={pending || !student.class_arm}>
          {pending ? "Saving…" : "Save report card"}
        </button>
      </form>

      <style jsx global>{`
        .field-input {
          border: 1px solid var(--line);
          background: #fff;
          border-radius: 0.65rem;
          padding: 0.55rem 0.7rem;
        }
      `}</style>
    </div>
  );
}
