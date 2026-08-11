"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { apiJson } from "@/lib/api";
import {
  FORM_CLASS_ASSESSMENTS,
  type FormClassAssessmentKey,
} from "@/lib/assessments";

type ClassLevel = { id: number; name: string };
type ClassArm = { id: number; name: string; label: string; class_level: number };
type Term = {
  id: number;
  name: string;
  next_term_resumption?: string | null;
};
type Student = {
  id: number;
  full_name: string;
  student_id: string;
};
type FormRecord = {
  id: number;
  student: number;
  term: number;
  class_arm: number;
  days_present: number;
  teacher_remark: string;
} & Partial<Record<FormClassAssessmentKey, number | null>>;

type RankRow = {
  student_id: number;
  average: number | string;
  position: number;
  subject_count: number;
};

type RowState = {
  days_present: string;
  next_term_begins: string;
  teacher_remark: string;
  assessments: Record<FormClassAssessmentKey, string>;
};

function unwrapList<T>(data: { results?: T[] } | T[]): T[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

function emptyAssessments(): Record<FormClassAssessmentKey, string> {
  return Object.fromEntries(
    FORM_CLASS_ASSESSMENTS.map((item) => [item.key, ""]),
  ) as Record<FormClassAssessmentKey, string>;
}

function FormClassSheetInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const levelId = Number(params.levelId);
  const termId = Number(searchParams.get("term"));
  const armId = Number(searchParams.get("arm"));

  const [levelName, setLevelName] = useState("");
  const [armName, setArmName] = useState("");
  const [termName, setTermName] = useState("");
  const [defaultNextTerm, setDefaultNextTerm] = useState("");
  const [subjectCount, setSubjectCount] = useState(0);
  const [students, setStudents] = useState<Student[]>([]);
  const [ranks, setRanks] = useState<Record<number, RankRow>>({});
  const [rows, setRows] = useState<Record<number, RowState>>({});
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!levelId || !termId || !armId) {
      setError("Choose a class, term, and arm from Form Class first.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [level, arm, term, subjectData, studentData, formData, classResults] =
          await Promise.all([
            apiJson<ClassLevel>(`/api/class-levels/${levelId}/`),
            apiJson<ClassArm>(`/api/class-arms/${armId}/`),
            apiJson<Term>(`/api/terms/${termId}/`),
            apiJson<{ count?: number; results?: unknown[] }>(
              `/api/subjects/?class_level=${levelId}&is_active=true&page_size=1`,
            ),
            apiJson<{ results?: Student[] } | Student[]>(
              `/api/students/?class_arm=${armId}&page_size=500`,
            ),
            apiJson<{ results?: FormRecord[] } | FormRecord[]>(
              `/api/student-form/?class_arm=${armId}&term=${termId}&page_size=500`,
            ),
            apiJson<RankRow[] | { results?: RankRow[] }>(
              `/api/scores/class_results/?term=${termId}&class_arm=${armId}`,
            ).catch(() => [] as RankRow[]),
          ]);
        if (cancelled) return;

        const list = unwrapList(studentData);
        const forms = unwrapList(formData);
        const formByStudent = new Map(forms.map((f) => [f.student, f]));
        const rankList = Array.isArray(classResults)
          ? classResults
          : unwrapList(classResults);
        const rankByStudent = Object.fromEntries(
          rankList.map((r) => [r.student_id, r]),
        );
        const nextDefault = term.next_term_resumption || "";
        const init: Record<number, RowState> = {};
        for (const student of list) {
          const form = formByStudent.get(student.id);
          const assessments = emptyAssessments();
          for (const item of FORM_CLASS_ASSESSMENTS) {
            const value = form?.[item.key];
            assessments[item.key] =
              value === null || value === undefined ? "" : String(value);
          }
          init[student.id] = {
            days_present: form ? String(form.days_present ?? "") : "",
            next_term_begins: nextDefault,
            teacher_remark: form?.teacher_remark || "",
            assessments,
          };
        }

        setLevelName(level.name);
        setArmName(arm.name);
        setTermName(term.name);
        setDefaultNextTerm(nextDefault);
        setSubjectCount(
          typeof subjectData.count === "number"
            ? subjectData.count
            : (subjectData.results?.length ?? 0),
        );
        setStudents(list);
        setRanks(rankByStudent);
        setRows(init);
        setError("");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load form class sheet");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [levelId, termId, armId]);

  const classSize = students.length;

  const backHref = useMemo(() => "/app/results/form-class", []);

  function updateRow(studentId: number, patch: Partial<RowState>) {
    setRows((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], ...patch },
    }));
  }

  function updateAssessment(
    studentId: number,
    key: FormClassAssessmentKey,
    value: string,
  ) {
    setRows((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        assessments: {
          ...prev[studentId].assessments,
          [key]: value,
        },
      },
    }));
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setError("");
    try {
      await apiJson("/api/form-class/", {
        method: "POST",
        body: JSON.stringify({
          class_arm: armId,
          term: termId,
          number_in_class: classSize,
          next_term_resumption: defaultNextTerm || null,
        }),
      });

      for (const student of students) {
        const row = rows[student.id];
        if (!row) continue;
        const payload: Record<string, unknown> = {
          student: student.id,
          term: termId,
          class_arm: armId,
          days_present: Number(row.days_present) || 0,
          teacher_remark: row.teacher_remark,
        };
        for (const item of FORM_CLASS_ASSESSMENTS) {
          const raw = row.assessments[item.key];
          payload[item.key] = raw === "" ? null : Number(raw);
        }
        await apiJson("/api/student-form/", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setMessage("Form class results saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save form class results");
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Loading form class sheet…</p>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-pink)]">
            Form Class
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold text-[var(--brand-blue-deep)]">
            {levelName} · Arm {armName}
          </h1>
          <p className="mt-3 text-base text-[var(--muted)]">
            {termName} · Enter attendance, remarks, and default assessments for each
            student.
          </p>
        </div>
        <Link
          href={backHref}
          className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold"
        >
          Back to classes
        </Link>
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

      <label className="inline-flex items-center gap-2 text-sm">
        <span className="font-semibold text-[var(--muted)]">Next term begins</span>
        <input
          type="date"
          className="field-input"
          value={defaultNextTerm}
          onChange={(e) => {
            setDefaultNextTerm(e.target.value);
            setRows((prev) => {
              const next = { ...prev };
              for (const id of Object.keys(next)) {
                next[Number(id)] = {
                  ...next[Number(id)],
                  next_term_begins: e.target.value,
                };
              }
              return next;
            });
          }}
        />
      </label>

      {students.length === 0 ? (
        <p className="rounded-2xl border border-[var(--line)] bg-white/90 px-5 py-8 text-sm text-[var(--muted)]">
          No students in this class arm yet.
        </p>
      ) : (
        <form
          onSubmit={onSave}
          className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-white/90"
        >
          <table className="min-w-max text-left text-xs">
            <thead className="bg-[var(--mist)] text-[0.65rem] uppercase tracking-[0.06em] text-[var(--ink)]">
              <tr>
                <th className="sticky left-0 z-10 bg-[var(--mist)] px-3 py-3">
                  Admission Number
                </th>
                <th className="sticky left-28 z-10 bg-[var(--mist)] px-3 py-3">Name</th>
                <th className="px-3 py-3">Arm</th>
                <th className="px-3 py-3">No. Subject</th>
                <th className="px-3 py-3">Attendance</th>
                <th className="px-3 py-3">Next Term Begins</th>
                <th className="px-3 py-3">Average</th>
                <th className="px-3 py-3">Position</th>
                <th className="px-3 py-3">Class Size</th>
                <th className="px-3 py-3">Remark</th>
                {FORM_CLASS_ASSESSMENTS.map((item) => (
                  <th
                    key={item.key}
                    className="max-w-[3.5rem] px-2 py-3 [writing-mode:vertical-rl] rotate-180"
                    title={item.label}
                  >
                    {item.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const row = rows[student.id] ?? {
                  days_present: "",
                  next_term_begins: defaultNextTerm,
                  teacher_remark: "",
                  assessments: emptyAssessments(),
                };
                const rank = ranks[student.id];
                const average =
                  rank?.average !== undefined ? Number(rank.average).toFixed(2) : "—";
                return (
                  <tr key={student.id} className="border-t border-[var(--line)]">
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium">
                      {student.student_id}
                    </td>
                    <td className="sticky left-28 z-10 bg-white px-3 py-2 font-medium">
                      {student.full_name}
                    </td>
                    <td className="px-3 py-2">{armName}</td>
                    <td className="px-3 py-2">
                      <input
                        className="field-input w-14"
                        readOnly
                        value={rank?.subject_count ?? subjectCount}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className="field-input w-16"
                        inputMode="numeric"
                        value={row.days_present}
                        onChange={(e) =>
                          updateRow(student.id, { days_present: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        className="field-input w-36"
                        value={row.next_term_begins || defaultNextTerm}
                        onChange={(e) =>
                          updateRow(student.id, { next_term_begins: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-3 py-2 font-semibold">{average}</td>
                    <td className="px-3 py-2 font-semibold">
                      {rank?.position ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <input className="field-input w-14" readOnly value={classSize} />
                    </td>
                    <td className="px-3 py-2">
                      <textarea
                        className="field-input min-w-[12rem]"
                        rows={2}
                        value={row.teacher_remark}
                        onChange={(e) =>
                          updateRow(student.id, { teacher_remark: e.target.value })
                        }
                      />
                    </td>
                    {FORM_CLASS_ASSESSMENTS.map((item) => (
                      <td key={item.key} className="px-2 py-2">
                        <input
                          className="field-input w-12"
                          inputMode="numeric"
                          value={row.assessments[item.key]}
                          onChange={(e) =>
                            updateAssessment(student.id, item.key, e.target.value)
                          }
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-3">
            <p className="text-sm text-[var(--muted)]">
              Ratings use the default form-class assessments for every class.
            </p>
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? "Saving…" : "Save form class results"}
            </button>
          </div>
        </form>
      )}

      <style jsx global>{`
        .field-input {
          border: 1px solid var(--line);
          background: #fff;
          border-radius: 0.45rem;
          padding: 0.4rem 0.5rem;
          font-size: 0.8rem;
        }
      `}</style>
    </div>
  );
}

export default function FormClassSheetPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
      <FormClassSheetInner />
    </Suspense>
  );
}
