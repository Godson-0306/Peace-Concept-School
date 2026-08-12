"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import { getStoredUser, type AuthUser } from "@/lib/auth";
import { loadClassLevels } from "@/lib/classLevels";
import type { ClassLevelNav } from "@/lib/portalNav";

type ClassArm = { id: number; name: string; label: string; class_level: number };
type Subject = { id: number; name: string; class_level: number };
type Term = { id: number; name: string; number: number; session: number; is_active: boolean };
type Session = { id: number; name: string; is_active: boolean };
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
  const canCreate =
    user?.account_type === "admin" ||
    user?.account_type === "principal" ||
    user?.account_type === "teacher";

  const [papers, setPapers] = useState<Paper[]>([]);
  const [levels, setLevels] = useState<ClassLevelNav[]>([]);
  const [arms, setArms] = useState<ClassArm[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
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
          const [levelList, armData, subjectData, termData, sessionData] =
            await Promise.all([
              loadClassLevels(),
              apiJson<{ results?: ClassArm[] } | ClassArm[]>(
                "/api/class-arms/?page_size=500",
              ),
              apiJson<{ results?: Subject[] } | Subject[]>(
                "/api/subjects/?page_size=500",
              ),
              apiJson<{ results?: Term[] } | Term[]>(
                "/api/terms/?page_size=100",
              ),
              apiJson<{ results?: Session[] } | Session[]>(
                "/api/sessions/?page_size=100",
              ),
            ]);
          if (cancelled) return;
          setLevels(levelList);
          setArms(unwrapList(armData));
          setSubjects(unwrapList(subjectData));
          setTerms(unwrapList(termData));
          const sessionList = unwrapList(sessionData);
          setSessions(sessionList);
          const active =
            sessionList.find((s) => s.is_active) || sessionList[0];
          if (active) setSessionId(active.id);
          if (levelList[0]) setLevelId(levelList[0].id);
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

  const armsForClass = useMemo(
    () => arms.filter((a) => a.class_level === levelId),
    [arms, levelId],
  );
  const subjectsForClass = useMemo(
    () => subjects.filter((s) => s.class_level === levelId),
    [subjects, levelId],
  );
  const termsForSession = useMemo(
    () => terms.filter((t) => t.session === sessionId).sort((a, b) => a.number - b.number),
    [terms, sessionId],
  );

  useEffect(() => {
    if (!armsForClass.find((a) => a.id === armId)) {
      setArmId(armsForClass[0]?.id ?? "");
    }
  }, [armsForClass, armId]);

  useEffect(() => {
    if (!subjectsForClass.find((s) => s.id === subjectId)) {
      setSubjectId(subjectsForClass[0]?.id ?? "");
    }
  }, [subjectsForClass, subjectId]);

  useEffect(() => {
    if (!termsForSession.find((t) => t.id === termId)) {
      const preferred =
        termsForSession.find((t) => t.is_active) || termsForSession[0];
      setTermId(preferred?.id ?? "");
    }
  }, [termsForSession, termId]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!title || !armId || !subjectId || !termId) return;
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
              : "Create MCQ papers tied to CA1, CA2, or Exam."}
          </p>
        </div>
        {canCreate ? (
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

      {showCreate && canCreate ? (
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
            >
              {armsForClass.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label || a.name}
                </option>
              ))}
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
            >
              {subjectsForClass.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
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
              <option value="ca1">CA1 (max 20)</option>
              <option value="ca2">CA2 (max 20)</option>
              <option value="exam">Exam (max 60)</option>
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
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
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
            >
              {termsForSession.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
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
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary" disabled={pending}>
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
