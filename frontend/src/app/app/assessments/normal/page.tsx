"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import { getStoredUser, type AuthUser } from "@/lib/auth";

type ClassLevel = { id: number; name: string; order: number };
type ClassArm = {
  id: number;
  name: string;
  label: string;
  class_level: number;
  class_level_name?: string;
};
type Subject = {
  id: number;
  name: string;
  class_level: number;
  class_level_name?: string;
  order?: number;
};
type Term = {
  id: number;
  name: string;
  number: number;
  session: number;
  is_active: boolean;
};
type Session = { id: number; name: string; is_active: boolean; start_year?: number };
type Assignment = {
  id: number;
  class_arm_id: number;
  subject_id: number;
  session_id: number;
};
type CbtOptions = {
  levels: ClassLevel[];
  arms: ClassArm[];
  subjects: Subject[];
  sessions: Session[];
  terms: Term[];
  assignments: Assignment[];
  defaults: {
    session_id: number | null;
    term_id: number | null;
    level_id: number | null;
  };
  score_components: Array<{ value: "ca1" | "ca2" | "exam"; label: string; max: number }>;
};
type Paper = {
  id: number;
  title: string;
  score_component: "ca1" | "ca2" | "exam";
  component_max: number;
  subject_name: string;
  class_arm_label: string;
  term_name: string;
  duration_minutes: number;
  status: string;
  question_count: number;
};

function unwrapList<T>(data: { results?: T[] } | T[]): T[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

export default function NormalCbtListPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const isStudent = user?.account_type === "student";
  const isTeacher = user?.account_type === "teacher";
  const canCreate =
    user?.account_type === "admin" ||
    user?.account_type === "principal" ||
    user?.account_type === "teacher";

  const [papers, setPapers] = useState<Paper[]>([]);
  const [options, setOptions] = useState<CbtOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [pending, setPending] = useState(false);

  const [title, setTitle] = useState("");
  const [levelId, setLevelId] = useState<number | "">("");
  const [armId, setArmId] = useState<number | "">("");
  const [subjectId, setSubjectId] = useState<number | "">("");
  const [sessionId, setSessionId] = useState<number | "">("");
  const [termId, setTermId] = useState<number | "">("");
  const [component, setComponent] = useState<"ca1" | "ca2" | "exam">("ca1");
  const [duration, setDuration] = useState("30");

  async function loadPapers() {
    const data = await apiJson<{ results?: Paper[] } | Paper[]>(
      "/api/cbt/papers/?page_size=200",
    );
    setPapers(unwrapList(data));
  }

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await loadPapers();
        if (!cancelled && user.account_type !== "student") {
          const catalog = await apiJson<CbtOptions>("/api/cbt/options/");
          if (cancelled) return;
          setOptions(catalog);
          const defaultLevel =
            catalog.defaults.level_id ?? catalog.levels[0]?.id ?? "";
          setLevelId(defaultLevel || "");
          setSessionId(catalog.defaults.session_id ?? catalog.sessions[0]?.id ?? "");
          setTermId(catalog.defaults.term_id ?? "");
        }
        if (!cancelled) setError("");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load CBT papers");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const levels = options?.levels ?? [];
  const arms = options?.arms ?? [];
  const subjects = options?.subjects ?? [];
  const sessions = options?.sessions ?? [];
  const terms = options?.terms ?? [];
  const assignments = options?.assignments ?? [];

  const armsForClass = useMemo(() => {
    if (!levelId) return [];
    return arms
      .filter((a) => a.class_level === levelId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [arms, levelId]);

  const subjectsForArm = useMemo(() => {
    if (!levelId) return [];
    let list = subjects.filter((s) => s.class_level === levelId);
    if (isTeacher && armId) {
      const allowed = new Set(
        assignments
          .filter((a) => a.class_arm_id === armId)
          .map((a) => a.subject_id),
      );
      list = list.filter((s) => allowed.has(s.id));
    }
    return list.sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name),
    );
  }, [subjects, levelId, armId, isTeacher, assignments]);

  const termsForSession = useMemo(() => {
    if (!sessionId) return [];
    return terms
      .filter((t) => t.session === sessionId)
      .sort((a, b) => a.number - b.number);
  }, [terms, sessionId]);

  useEffect(() => {
    if (!levelId) {
      setArmId("");
      return;
    }
    const preferred =
      armsForClass.find((a) => a.name.toUpperCase() === "A") || armsForClass[0];
    if (!armsForClass.find((a) => a.id === armId)) {
      setArmId(preferred?.id ?? "");
    }
  }, [levelId, armsForClass, armId]);

  useEffect(() => {
    if (!subjectsForArm.find((s) => s.id === subjectId)) {
      setSubjectId(subjectsForArm[0]?.id ?? "");
    }
  }, [subjectsForArm, subjectId]);

  useEffect(() => {
    if (!sessionId) {
      setTermId("");
      return;
    }
    if (!termsForSession.find((t) => t.id === termId)) {
      const preferred =
        termsForSession.find((t) => t.is_active) || termsForSession[0];
      setTermId(preferred?.id ?? "");
    }
  }, [sessionId, termsForSession, termId]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!title || !armId || !subjectId || !termId) {
      setError("Select class, arm, subject, and term.");
      return;
    }
    setPending(true);
    setError("");
    setMessage("");
    try {
      const paper = await apiJson<Paper>("/api/cbt/papers/", {
        method: "POST",
        body: JSON.stringify({
          title,
          score_component: component,
          subject: subjectId,
          class_arm: armId,
          term: termId,
          duration_minutes: Number(duration) || 30,
          status: "draft",
          questions: [],
        }),
      });
      setMessage("Draft paper created. Add questions next.");
      setShowCreate(false);
      setTitle("");
      await loadPapers();
      window.location.href = `/app/assessments/normal/${paper.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create paper");
    } finally {
      setPending(false);
    }
  }

  const fieldClass =
    "mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand-blue)]";

  const noCatalog =
    canCreate &&
    !isStudent &&
    options &&
    (levels.length === 0 || arms.length === 0 || subjects.length === 0);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/app/assessments"
            className="text-sm text-[var(--brand-blue)] hover:underline"
          >
            ← Assessments
          </Link>
          <h1 className="mt-2 font-display text-3xl font-semibold text-[var(--brand-blue-deep)]">
            Normal CBT
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {isStudent
              ? "Open tests published for your class."
              : "Create MCQ papers using existing classes, arms, subjects, and terms."}
          </p>
        </div>
        {canCreate && !noCatalog ? (
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowCreate((v) => !v)}
          >
            {showCreate ? "Cancel" : "New paper"}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 rounded bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
      ) : null}
      {message ? (
        <p className="mt-4 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}

      {noCatalog ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {isTeacher
            ? "No teaching assignments found. Ask an admin to assign your class, arm, and subjects before creating CBT papers."
            : "No classes, arms, or subjects are set up yet. Configure them under Settings / Subjects first."}
        </p>
      ) : null}

      {showCreate && canCreate && !noCatalog ? (
        <form
          onSubmit={onCreate}
          className="mt-6 grid gap-3 rounded-xl border border-[var(--line)] bg-white p-4 sm:grid-cols-2"
        >
          <label className="text-sm font-medium sm:col-span-2">
            Title
            <input
              className={fieldClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>
          <label className="text-sm font-medium">
            Class
            <select
              className={fieldClass}
              value={levelId}
              onChange={(e) =>
                setLevelId(e.target.value ? Number(e.target.value) : "")
              }
              required
            >
              {levels.length === 0 ? (
                <option value="">No classes</option>
              ) : (
                levels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="text-sm font-medium">
            Arm
            <select
              className={fieldClass}
              value={armId}
              onChange={(e) =>
                setArmId(e.target.value ? Number(e.target.value) : "")
              }
              required
            >
              {armsForClass.length === 0 ? (
                <option value="">No arms for class</option>
              ) : (
                armsForClass.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label || a.name}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="text-sm font-medium">
            Subject
            <select
              className={fieldClass}
              value={subjectId}
              onChange={(e) =>
                setSubjectId(e.target.value ? Number(e.target.value) : "")
              }
              required
            >
              {subjectsForArm.length === 0 ? (
                <option value="">No subjects for this class/arm</option>
              ) : (
                subjectsForArm.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="text-sm font-medium">
            Score component
            <select
              className={fieldClass}
              value={component}
              onChange={(e) =>
                setComponent(e.target.value as "ca1" | "ca2" | "exam")
              }
            >
              {(options?.score_components ?? []).map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label} (max {c.max})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Session
            <select
              className={fieldClass}
              value={sessionId}
              onChange={(e) =>
                setSessionId(e.target.value ? Number(e.target.value) : "")
              }
              required
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.is_active ? " (active)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Term
            <select
              className={fieldClass}
              value={termId}
              onChange={(e) =>
                setTermId(e.target.value ? Number(e.target.value) : "")
              }
              required
            >
              {termsForSession.length === 0 ? (
                <option value="">No terms</option>
              ) : (
                termsForSession.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.is_active ? " (active)" : ""}
                  </option>
                ))
              )}
            </select>
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
          <div className="sm:col-span-2 text-xs text-[var(--muted)]">
            Subject list is filtered to the selected class
            {isTeacher ? " and your teaching assignments" : ""}. Scores write to
            the chosen CA1 / CA2 / Exam field for that class subject and term.
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="btn-primary"
              disabled={pending || !armId || !subjectId || !termId}
            >
              {pending ? "Creating…" : "Create draft"}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-[var(--muted)]">Loading…</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--mist)] text-xs uppercase tracking-wide">
              <tr>
                <th className="px-3 py-3">Title</th>
                <th className="px-3 py-3">Component</th>
                <th className="px-3 py-3">Class</th>
                <th className="px-3 py-3">Subject</th>
                <th className="px-3 py-3">Qs</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {papers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-[var(--muted)]">
                    No CBT papers yet.
                  </td>
                </tr>
              ) : (
                papers.map((p) => (
                  <tr key={p.id} className="border-t border-[var(--line)]">
                    <td className="px-3 py-2 font-medium">{p.title}</td>
                    <td className="px-3 py-2 uppercase">{p.score_component}</td>
                    <td className="px-3 py-2">{p.class_arm_label}</td>
                    <td className="px-3 py-2">{p.subject_name}</td>
                    <td className="px-3 py-2">{p.question_count}</td>
                    <td className="px-3 py-2 capitalize">{p.status}</td>
                    <td className="px-3 py-2 text-right">
                      {isStudent ? (
                        <Link
                          className="text-[var(--brand-blue)] hover:underline"
                          href={`/app/assessments/normal/${p.id}/take`}
                        >
                          Take test
                        </Link>
                      ) : (
                        <Link
                          className="text-[var(--brand-blue)] hover:underline"
                          href={`/app/assessments/normal/${p.id}`}
                        >
                          Open
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
