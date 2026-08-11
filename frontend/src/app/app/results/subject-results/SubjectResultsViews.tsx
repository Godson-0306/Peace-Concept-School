"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { apiJson } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";

type ClassLevel = { id: number; name: string };
type ClassArm = { id: number; name: string; label: string; class_level: number };
type Term = {
  id: number;
  name: string;
  is_active: boolean;
  results_entry_open?: boolean;
};
type Subject = {
  id: number;
  name: string;
  class_level: number;
  subject_type?: string;
  is_active?: boolean;
};
type Assignment = {
  id: number;
  class_arm: number;
  subject: number;
  subject_name?: string;
};
type Student = {
  id: number;
  full_name: string;
  student_id: string;
};
type ScoreRow = {
  id: number;
  student: number;
  subject: number;
  term: number;
  ca1: number;
  ca2: number;
  exam: number;
};

function unwrapList<T>(data: { results?: T[] } | T[]): T[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

function SubjectPickerInner() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const levelId = Number(params.levelId);
  const termId = Number(searchParams.get("term"));
  const armId = Number(searchParams.get("arm"));

  const [level, setLevel] = useState<ClassLevel | null>(null);
  const [arm, setArm] = useState<ClassArm | null>(null);
  const [term, setTerm] = useState<Term | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const user = getStoredUser();
  const isTeacher = user?.account_type === "teacher";

  useEffect(() => {
    if (!levelId || !termId || !armId) {
      setError("Choose a class, term, and arm from Subject Results first.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [levelData, armData, termData, subjectData, assignmentData] =
          await Promise.all([
            apiJson<ClassLevel>(`/api/class-levels/${levelId}/`),
            apiJson<ClassArm>(`/api/class-arms/${armId}/`),
            apiJson<Term>(`/api/terms/${termId}/`),
            apiJson<{ results?: Subject[] } | Subject[]>(
              `/api/subjects/?class_level=${levelId}&is_active=true&page_size=500`,
            ),
            isTeacher
              ? apiJson<{ results?: Assignment[] } | Assignment[]>(
                  `/api/teacher-assignments/?class_arm=${armId}&is_active=true&page_size=500`,
                )
              : Promise.resolve([] as Assignment[]),
          ]);
        if (cancelled) return;
        let list = unwrapList(subjectData).filter(
          (s) => s.subject_type !== "additional_assessment",
        );
        if (isTeacher) {
          const allowed = new Set(unwrapList(assignmentData).map((a) => a.subject));
          list = list.filter((s) => allowed.has(s.id));
        }
        setLevel(levelData);
        setArm(armData);
        setTerm(termData);
        setSubjects(list);
        setError("");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load subjects");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [levelId, termId, armId, isTeacher]);

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Loading subjects…</p>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-pink)]">
            Subject Results
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold text-[var(--brand-blue-deep)]">
            {level?.name ?? "Class"} — pick a subject
          </h1>
          <p className="mt-3 text-base text-[var(--muted)]">
            {term?.name ?? "Term"} · Arm {arm?.name ?? "—"}
            {term && !term.results_entry_open ? (
              <span className="ml-2 text-amber-700">
                (Result entry is closed for this term — admins can still edit.)
              </span>
            ) : null}
          </p>
        </div>
        <Link
          href="/app/results/subject-results"
          className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold"
        >
          Back to classes
        </Link>
      </header>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {subjects.length === 0 ? (
        <p className="rounded-2xl border border-[var(--line)] bg-white/90 px-5 py-8 text-sm text-[var(--muted)]">
          No subjects available for this class
          {isTeacher ? " in your teaching assignments" : ""}.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((subject) => (
            <button
              key={subject.id}
              type="button"
              className="rounded-2xl border border-[var(--line)] bg-white/90 px-5 py-4 text-left transition hover:border-[var(--brand-blue)] hover:bg-[var(--brand-blue-wash)]"
              onClick={() =>
                router.push(
                  `/app/results/subject-results/${levelId}/${subject.id}?term=${termId}&arm=${armId}`,
                )
              }
            >
              <p className="font-display text-xl font-semibold text-[var(--brand-blue-deep)]">
                {subject.name}
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">Open score sheet</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreSheetInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const levelId = Number(params.levelId);
  const subjectId = Number(params.subjectId);
  const termId = Number(searchParams.get("term"));
  const armId = Number(searchParams.get("arm"));

  const [levelName, setLevelName] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [armName, setArmName] = useState("");
  const [termName, setTermName] = useState("");
  const [entryOpen, setEntryOpen] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [scores, setScores] = useState<
    Record<number, { ca1: string; ca2: string; exam: string }>
  >({});
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!levelId || !subjectId || !termId || !armId) {
      setError("Missing class, subject, term, or arm.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [level, subject, arm, term, studentData, scoreData] =
          await Promise.all([
            apiJson<ClassLevel>(`/api/class-levels/${levelId}/`),
            apiJson<Subject>(`/api/subjects/${subjectId}/`),
            apiJson<ClassArm>(`/api/class-arms/${armId}/`),
            apiJson<Term>(`/api/terms/${termId}/`),
            apiJson<{ results?: Student[] } | Student[]>(
              `/api/students/?class_arm=${armId}&page_size=500`,
            ),
            apiJson<{ results?: ScoreRow[] } | ScoreRow[]>(
              `/api/scores/?class_arm=${armId}&subject=${subjectId}&term=${termId}&page_size=500`,
            ),
          ]);
        if (cancelled) return;
        const list = unwrapList(studentData);
        const existing = unwrapList(scoreData);
        const byStudent = new Map(existing.map((s) => [s.student, s]));
        const init: Record<number, { ca1: string; ca2: string; exam: string }> = {};
        for (const student of list) {
          const row = byStudent.get(student.id);
          init[student.id] = {
            ca1: String(row?.ca1 ?? 0),
            ca2: String(row?.ca2 ?? 0),
            exam: String(row?.exam ?? 0),
          };
        }
        setLevelName(level.name);
        setSubjectName(subject.name);
        setArmName(arm.name);
        setTermName(term.name);
        setEntryOpen(Boolean(term.results_entry_open));
        setStudents(list);
        setScores(init);
        setError("");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load score sheet");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [levelId, subjectId, termId, armId]);

  const backHref = useMemo(
    () => `/app/results/subject-results/${levelId}?term=${termId}&arm=${armId}`,
    [levelId, termId, armId],
  );

  async function saveScores(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setError("");
    try {
      for (const student of students) {
        const row = scores[student.id] ?? { ca1: "0", ca2: "0", exam: "0" };
        await apiJson("/api/scores/", {
          method: "POST",
          body: JSON.stringify({
            student: student.id,
            subject: subjectId,
            term: termId,
            class_arm: armId,
            ca1: Number(row.ca1) || 0,
            ca2: Number(row.ca2) || 0,
            exam: Number(row.exam) || 0,
          }),
        });
      }
      setMessage("Scores saved for this subject.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save scores");
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Loading score sheet…</p>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-pink)]">
            Subject Results
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold text-[var(--brand-blue-deep)]">
            {subjectName}
          </h1>
          <p className="mt-3 text-base text-[var(--muted)]">
            {levelName} · Arm {armName} · {termName}
            {!entryOpen ? (
              <span className="ml-2 text-amber-700">
                (Result entry closed for this term)
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={backHref}
            className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold"
          >
            Change subject
          </Link>
          <Link
            href="/app/results/subject-results"
            className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold"
          >
            All classes
          </Link>
        </div>
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

      {students.length === 0 ? (
        <p className="rounded-2xl border border-[var(--line)] bg-white/90 px-5 py-8 text-sm text-[var(--muted)]">
          No students in this class arm yet.
        </p>
      ) : (
        <form
          onSubmit={saveScores}
          className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-white/90"
        >
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--brand-blue-wash)] text-left">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Student ID</th>
                <th className="px-4 py-3">CA1 /20</th>
                <th className="px-4 py-3">CA2 /20</th>
                <th className="px-4 py-3">Exam /60</th>
                <th className="px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const row = scores[student.id] ?? {
                  ca1: "0",
                  ca2: "0",
                  exam: "0",
                };
                const total =
                  (Number(row.ca1) || 0) +
                  (Number(row.ca2) || 0) +
                  (Number(row.exam) || 0);
                return (
                  <tr key={student.id} className="border-t border-[var(--line)]">
                    <td className="px-4 py-2 font-medium">{student.full_name}</td>
                    <td className="px-4 py-2 text-[var(--muted)]">
                      {student.student_id}
                    </td>
                    {(["ca1", "ca2", "exam"] as const).map((field) => (
                      <td key={field} className="px-4 py-2">
                        <input
                          className="field-input w-20"
                          inputMode="decimal"
                          value={row[field]}
                          onChange={(e) =>
                            setScores((prev) => ({
                              ...prev,
                              [student.id]: {
                                ...prev[student.id],
                                [field]: e.target.value,
                              },
                            }))
                          }
                        />
                      </td>
                    ))}
                    <td className="px-4 py-2 font-semibold">{total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-3">
            <p className="text-sm text-[var(--muted)]">
              Edit existing scores or enter new ones, then save.
            </p>
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? "Saving…" : "Save scores"}
            </button>
          </div>
        </form>
      )}

      <style jsx global>{`
        .field-input {
          border: 1px solid var(--line);
          background: #fff;
          border-radius: 0.55rem;
          padding: 0.45rem 0.55rem;
        }
      `}</style>
    </div>
  );
}

export function SubjectPickerPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
      <SubjectPickerInner />
    </Suspense>
  );
}

export function ScoreSheetPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
      <ScoreSheetInner />
    </Suspense>
  );
}
