"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiJson } from "@/lib/api";
import { AuthUser, getStoredUser } from "@/lib/auth";
import { loadActiveSessionTerms, type PortalTerm } from "@/lib/terms";

type Student = {
  id: number;
  student_id: string;
  full_name: string;
  class_arm_label?: string;
};

type ResultSubject = {
  subject_id: number;
  subject_name: string;
  subject_type: string;
  ca1: number;
  ca2: number;
  exam: number;
  total: number | string;
  status: string;
};

type ResultPayload = {
  locked?: boolean;
  detail?: string;
  student_name?: string;
  student_code?: string;
  total?: number | string;
  average?: number | string;
  position?: number | null;
  subject_count?: number;
  subjects?: ResultSubject[];
};

export default function StudentPerformancePage() {
  const params = useParams();
  const router = useRouter();
  const studentId = Number(params.id);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [terms, setTerms] = useState<PortalTerm[]>([]);
  const [termId, setTermId] = useState<number | "">("");
  const [result, setResult] = useState<ResultPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const canManage =
    user?.account_type === "admin" || user?.account_type === "principal";

  const loadBase = useCallback(async () => {
    const [studentData, termList] = await Promise.all([
      apiJson<Student>(`/api/students/${studentId}/`),
      loadActiveSessionTerms(),
    ]);
    setStudent(studentData);
    setTerms(termList);
    const active = termList.find((t) => t.is_active);
    setTermId((prev) => prev || active?.id || termList[0]?.id || "");
  }, [studentId]);

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
    loadBase()
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [router, studentId, loadBase]);

  useEffect(() => {
    if (!studentId || !termId) return;
    let cancelled = false;
    apiJson<ResultPayload>(`/api/results/me/?student=${studentId}&term=${termId}`)
      .then((data) => {
        if (!cancelled) {
          setResult(data);
          setError("");
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setResult(null);
          setError(e instanceof Error ? e.message : "Failed to load results");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [studentId, termId]);

  if (user && !canManage) {
    return <p className="text-sm text-[var(--muted)]">Redirecting…</p>;
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Loading performance…</p>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-pink)]">
            Performance
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold text-[var(--brand-blue-deep)]">
            {student?.full_name || "Student"}
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {student?.student_id}
            {student?.class_arm_label ? ` · ${student.class_arm_label}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/app/users/students/${studentId}/report`}
            className="rounded-lg bg-[var(--brand-blue)] px-4 py-2 text-sm font-semibold text-white"
          >
            Enter results
          </Link>
          <Link
            href="/app/users"
            className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold"
          >
            Back to Users
          </Link>
        </div>
      </header>

      <label className="block max-w-xs text-sm">
        <span className="mb-1 block text-[var(--muted)]">Term</span>
        <select
          className="field-input w-full"
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

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {result?.locked ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {result.detail || "Results are locked for this term."}
        </p>
      ) : null}

      {result && !result.locked ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--line)] bg-white/90 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                Total
              </p>
              <p className="mt-1 font-display text-3xl text-[var(--brand-blue-deep)]">
                {result.total ?? "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-white/90 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                Average
              </p>
              <p className="mt-1 font-display text-3xl text-[var(--brand-blue-deep)]">
                {result.average ?? "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-white/90 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                Position
              </p>
              <p className="mt-1 font-display text-3xl text-[var(--brand-blue-deep)]">
                {result.position ?? "—"}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white/90">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--mist)] text-left text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Subject</th>
                  <th className="px-4 py-3 font-semibold">CA1</th>
                  <th className="px-4 py-3 font-semibold">CA2</th>
                  <th className="px-4 py-3 font-semibold">Exam</th>
                  <th className="px-4 py-3 font-semibold">Total</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {(result.subjects || []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-[var(--muted)]">
                      No scores recorded for this term yet.
                    </td>
                  </tr>
                ) : (
                  (result.subjects || []).map((subject) => (
                    <tr key={subject.subject_id}>
                      <td className="px-4 py-3 font-medium">{subject.subject_name}</td>
                      <td className="px-4 py-3">{subject.ca1}</td>
                      <td className="px-4 py-3">{subject.ca2}</td>
                      <td className="px-4 py-3">{subject.exam}</td>
                      <td className="px-4 py-3 font-semibold">{subject.total}</td>
                      <td className="px-4 py-3 capitalize text-[var(--muted)]">
                        {subject.status}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

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
