"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import { getStoredUser, type AuthUser } from "@/lib/auth";
import { loadClassLevels } from "@/lib/classLevels";

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
  subject_type?: string;
  is_active?: boolean;
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
  class_arm_id?: number;
  class_arm?: number;
  subject_id?: number;
  subject?: number;
  session_id?: number;
};
type ScoreComponent = { value: "ca1" | "ca2" | "exam"; label: string; max: number };
type Catalog = {
  levels: ClassLevel[];
  arms: ClassArm[];
  subjects: Subject[];
  sessions: Session[];
  terms: Term[];
  assignments: Assignment[];
  score_components: ScoreComponent[];
  defaults: {
    session_id: number | null;
    term_id: number | null;
    level_id: number | null;
  };
  source: "options" | "fallback";
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

const SCORE_COMPONENTS: ScoreComponent[] = [
  { value: "ca1", label: "CA1", max: 20 },
  { value: "ca2", label: "CA2", max: 20 },
  { value: "exam", label: "Exam", max: 60 },
];

function unwrapList<T>(data: { results?: T[] } | T[]): T[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

function errMessage(e: unknown, fallback: string) {
  if (e instanceof Error && e.message && e.message !== "0" && e.message !== "{}") {
    return e.message;
  }
  return fallback;
}

async function loadCatalogFallback(isTeacher: boolean): Promise<Catalog> {
  const [levelList, armData, subjectData, termData, sessionData, assignmentData] =
    await Promise.all([
      loadClassLevels(true),
      apiJson<{ results?: ClassArm[] } | ClassArm[]>(
        "/api/class-arms/?page_size=500",
      ),
      apiJson<{ results?: Subject[] } | Subject[]>(
        "/api/subjects/?page_size=500&is_active=true",
      ),
      apiJson<{ results?: Term[] } | Term[]>("/api/terms/?page_size=100"),
      apiJson<{ results?: Session[] } | Session[]>(
        "/api/sessions/?page_size=100",
      ),
      isTeacher
        ? apiJson<{ results?: Assignment[] } | Assignment[]>(
            "/api/teacher-assignments/?is_active=true&page_size=500",
          )
        : Promise.resolve([] as Assignment[]),
    ]);

  let arms = unwrapList(armData);
  let subjects = unwrapList(subjectData).filter(
    (s) => s.subject_type !== "additional_assessment" && s.is_active !== false,
  );
  let levels = levelList;
  const assignments = unwrapList(assignmentData).map((a) => ({
    ...a,
    class_arm_id: a.class_arm_id ?? a.class_arm,
    subject_id: a.subject_id ?? a.subject,
  }));

  if (isTeacher) {
    const allowedArms = new Set(
      assignments.map((a) => a.class_arm_id).filter(Boolean) as number[],
    );
    const allowedSubjects = new Set(
      assignments.map((a) => a.subject_id).filter(Boolean) as number[],
    );
    arms = arms.filter((a) => allowedArms.has(a.id));
    subjects = subjects.filter((s) => allowedSubjects.has(s.id));
    const levelIds = new Set(arms.map((a) => a.class_level));
    levels = levels.filter((l) => levelIds.has(l.id));
  }

  const sessions = unwrapList(sessionData);
  const terms = unwrapList(termData);
  const activeSession = sessions.find((s) => s.is_active) || sessions[0] || null;
  const activeTerm =
    terms.find((t) => t.is_active && (!activeSession || t.session === activeSession.id)) ||
    terms.find((t) => activeSession && t.session === activeSession.id) ||
    terms[0] ||
    null;

  return {
    levels,
    arms,
    subjects,
    sessions,
    terms,
    assignments,
    score_components: SCORE_COMPONENTS,
    defaults: {
      session_id: activeSession?.id ?? null,
      term_id: activeTerm?.id ?? null,
      level_id: levels[0]?.id ?? null,
    },
    source: "fallback",
  };
}

async function loadCatalog(isTeacher: boolean): Promise<Catalog> {
  try {
    const data = await apiJson<{
      levels: ClassLevel[];
      arms: ClassArm[];
      subjects: Subject[];
      sessions: Session[];
      terms: Term[];
      assignments: Assignment[];
      score_components?: ScoreComponent[];
      defaults: Catalog["defaults"];
    }>("/api/cbt/options/");
    return {
      levels: data.levels || [],
      arms: data.arms || [],
      subjects: data.subjects || [],
      sessions: data.sessions || [],
      terms: data.terms || [],
      assignments: (data.assignments || []).map((a) => ({
        ...a,
        class_arm_id: a.class_arm_id ?? a.class_arm,
        subject_id: a.subject_id ?? a.subject,
      })),
      score_components:
        data.score_components?.length ? data.score_components : SCORE_COMPONENTS,
      defaults: data.defaults || {
        session_id: null,
        term_id: null,
        level_id: null,
      },
      source: "options",
    };
  } catch {
    return loadCatalogFallback(isTeacher);
  }
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
  const [catalog, setCatalog] = useState<Catalog | null>(null);
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
      setError("");
      try {
        await loadPapers();
        if (cancelled) return;
        if (user.account_type !== "student") {
          const next = await loadCatalog(user.account_type === "teacher");
          if (cancelled) return;
          setCatalog(next);
          setLevelId(next.defaults.level_id ?? next.levels[0]?.id ?? "");
          setSessionId(next.defaults.session_id ?? next.sessions[0]?.id ?? "");
          setTermId(next.defaults.term_id ?? "");
          if (next.levels.length === 0) {
            setError(
              user.account_type === "teacher"
                ? "No teaching assignments found. Ask an admin to assign your class, arm, and subjects."
                : "No classes found. Set up class levels under Settings first.",
            );
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(errMessage(e, "Failed to load CBT data"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const levels = catalog?.levels ?? [];
  const arms = catalog?.arms ?? [];
  const subjects = catalog?.subjects ?? [];
  const sessions = catalog?.sessions ?? [];
  const terms = catalog?.terms ?? [];
  const assignments = catalog?.assignments ?? [];
  const scoreComponents = catalog?.score_components ?? SCORE_COMPONENTS;

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
      const subjectIds = new Set(
        assignments
          .filter((a) => (a.class_arm_id ?? a.class_arm) === armId)
          .map((a) => a.subject_id ?? a.subject)
          .filter(Boolean) as number[],
      );
      if (subjectIds.size > 0) {
        list = list.filter((s) => subjectIds.has(s.id));
      }
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
      setError(errMessage(err, "Could not create paper"));
    } finally {
      setPending(false);
    }
  }

  const fieldClass =
    "mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand-blue)]";

  const catalogReady = Boolean(catalog && catalog.levels.length > 0);
  const noCatalog =
    canCreate && !isStudent && catalog && catalog.levels.length === 0;

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
        {canCreate && catalogReady ? (
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
            : "No classes, arms, or subjects are set up yet. Configure them under Settings first."}
        </p>
      ) : null}

      {showCreate && canCreate && catalogReady ? (
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
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
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
                    {a.label || `${a.class_level_name || ""}${a.name}` || a.name}
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
              {scoreComponents.map((c) => (
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
            Showing {levels.length} classes, {arms.length} arms,{" "}
            {subjects.length} subjects from the school catalog
            {catalog?.source === "fallback" ? " (fallback load)" : ""}.
            {isTeacher ? " Filtered to your teaching assignments." : ""}
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
