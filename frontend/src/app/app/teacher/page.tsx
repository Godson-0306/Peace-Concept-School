"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiJson } from "@/lib/api";

type Assignment = {
  id: number;
  class_arm: number;
  class_arm_label: string;
  subject: number;
  subject_name: string;
};

type Student = {
  id: number;
  full_name: string;
  student_id: string;
};

type Term = { id: number; name: string; is_active: boolean };

export default function TeacherPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [selected, setSelected] = useState<Assignment | null>(null);
  const [termId, setTermId] = useState<number | "">("");
  const [students, setStudents] = useState<Student[]>([]);
  const [scores, setScores] = useState<Record<number, { ca1: string; ca2: string; exam: string }>>(
    {},
  );
  const [formStudentId, setFormStudentId] = useState<number | "">("");
  const [remark, setRemark] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [asg, tm] = await Promise.all([
        apiJson<{ results?: Assignment[] } | Assignment[]>("/api/teacher-assignments/"),
        apiJson<{ results?: Term[] } | Term[]>("/api/terms/"),
      ]);
      const list = Array.isArray(asg) ? asg : asg.results ?? [];
      const termList = Array.isArray(tm) ? tm : tm.results ?? [];
      setAssignments(list);
      setTerms(termList);
      const active = termList.find((t) => t.is_active);
      if (active) setTermId(active.id);
      if (list[0]) setSelected(list[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load assignments");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    apiJson<{ results?: Student[] } | Student[]>(
      `/api/students/?class_arm=${selected.class_arm}`,
    )
      .then((data) => {
        const list = Array.isArray(data) ? data : data.results ?? [];
        setStudents(list);
        const init: typeof scores = {};
        list.forEach((s) => {
          init[s.id] = { ca1: "0", ca2: "0", exam: "0" };
        });
        setScores(init);
        if (list[0]) setFormStudentId(list[0].id);
      })
      .catch((e) => setError(e.message));
  }, [selected]);

  async function saveScores(event: FormEvent) {
    event.preventDefault();
    if (!selected || !termId) return;
    setMessage("");
    setError("");
    try {
      for (const student of students) {
        const row = scores[student.id];
        await apiJson("/api/scores/", {
          method: "POST",
          body: JSON.stringify({
            student: student.id,
            subject: selected.subject,
            term: termId,
            class_arm: selected.class_arm,
            ca1: Number(row.ca1),
            ca2: Number(row.ca2),
            exam: Number(row.exam),
          }),
        });
      }
      setMessage("Draft scores saved for this subject/class.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save scores");
    }
  }

  async function saveRemark(event: FormEvent) {
    event.preventDefault();
    if (!formStudentId || !termId || !selected) return;
    try {
      await apiJson("/api/student-form/", {
        method: "POST",
        body: JSON.stringify({
          student: formStudentId,
          term: termId,
          class_arm: selected.class_arm,
          teacher_remark: remark,
          punctuality: 4,
          neatness: 4,
          politeness: 4,
          honesty: 4,
          cooperation: 4,
          leadership: 3,
          handwriting: 4,
          sports: 3,
          tool_handling: 3,
        }),
      });
      setMessage("Form teacher remark saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save remark");
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          Teacher
        </p>
        <h1 className="font-display text-4xl text-[var(--brand-green)]">
          Score entry & form class
        </h1>
        <p className="mt-2 text-[var(--ink-soft)]">
          Enter CA1 (20), CA2 (20), and Exam (60) for your assigned subject +
          class combinations. Form Teacher tools appear for your assigned arm.
        </p>
      </header>

      {message ? (
        <p className="bg-[rgba(20,80,163,0.08)] px-4 py-3 text-sm text-[var(--brand-green)]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <select
          className="field-input max-w-md"
          value={selected?.id ?? ""}
          onChange={(e) => {
            const a = assignments.find((x) => x.id === Number(e.target.value));
            setSelected(a ?? null);
          }}
        >
          {assignments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.class_arm_label} — {a.subject_name}
            </option>
          ))}
        </select>
        <select
          className="field-input max-w-xs"
          value={termId}
          onChange={(e) => setTermId(Number(e.target.value))}
        >
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={saveScores} className="overflow-x-auto border border-[var(--line)] bg-white/80">
        <table className="min-w-full text-sm">
          <thead className="bg-[rgba(20,80,163,0.06)] text-left">
            <tr>
              <th className="px-3 py-2">Student</th>
              <th className="px-3 py-2">CA1 /20</th>
              <th className="px-3 py-2">CA2 /20</th>
              <th className="px-3 py-2">Exam /60</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-t border-[var(--line)]">
                <td className="px-3 py-2">
                  {s.full_name}
                  <div className="text-xs text-[var(--muted)]">{s.student_id}</div>
                </td>
                {(["ca1", "ca2", "exam"] as const).map((field) => (
                  <td key={field} className="px-3 py-2">
                    <input
                      className="field-input w-20"
                      value={scores[s.id]?.[field] ?? "0"}
                      onChange={(e) =>
                        setScores((prev) => ({
                          ...prev,
                          [s.id]: { ...prev[s.id], [field]: e.target.value },
                        }))
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-3">
          <button type="submit" className="btn-primary">
            Save draft scores
          </button>
        </div>
      </form>

      <section className="border border-[var(--line)] bg-white/80 p-5">
        <h2 className="font-display text-2xl text-[var(--brand-green)]">
          Form Class tab
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Remarks and affective/psychomotor ratings for your form class.
        </p>
        <form onSubmit={saveRemark} className="mt-4 grid gap-3 md:grid-cols-2">
          <select
            className="field-input"
            value={formStudentId}
            onChange={(e) => setFormStudentId(Number(e.target.value))}
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>
          <textarea
            className="field-input md:col-span-2"
            rows={3}
            placeholder="Class teacher's remark"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
          />
          <button type="submit" className="btn-primary md:col-span-2">
            Save form record
          </button>
        </form>
      </section>

      <style jsx global>{`
        .field-input {
          border: 1px solid var(--line);
          background: #fff;
          padding: 0.55rem 0.7rem;
        }
      `}</style>
    </div>
  );
}
