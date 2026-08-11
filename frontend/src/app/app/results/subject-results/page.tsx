"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { loadClassLevels } from "@/lib/classLevels";
import type { ClassLevelNav } from "@/lib/portalNav";

type ClassArm = {
  id: number;
  name: string;
  label: string;
  class_level: number;
};

type Term = {
  id: number;
  name: string;
  number: number;
  is_active: boolean;
  results_entry_open?: boolean;
  next_term_resumption?: string | null;
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
  is_active?: boolean;
};

type CardState = {
  termId: number | "";
  armId: number | "";
};

function unwrapList<T>(data: { results?: T[] } | T[]): T[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

function PeopleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7 text-[var(--brand-blue-deep)]"
      fill="currentColor"
      aria-hidden
    >
      <path d="M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm0 2c-2.67 0-8 1.34-8 4v2h10v-2c0-1.35.67-2.4 1.76-3.2A12.3 12.3 0 0 0 8 13Zm8 0c-.29 0-.62.02-.97.05A5.3 5.3 0 0 1 16 17v2h8v-2c0-2.66-5.33-4-8-4Z" />
    </svg>
  );
}

export default function SubjectResultsPage() {
  const [levels, setLevels] = useState<ClassLevelNav[]>([]);
  const [arms, setArms] = useState<ClassArm[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classSizes, setClassSizes] = useState<Record<number, number>>({});
  const [cardState, setCardState] = useState<Record<number, CardState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const user = getStoredUser();
  const isTeacher = user?.account_type === "teacher";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [levelList, armData, termData, subjectData, assignmentData] =
          await Promise.all([
            loadClassLevels(),
            apiJson<{ results?: ClassArm[] } | ClassArm[]>(
              "/api/class-arms/?page_size=500",
            ),
            apiJson<{ results?: Term[] } | Term[]>("/api/terms/?page_size=100"),
            apiJson<{ results?: Subject[] } | Subject[]>(
              "/api/subjects/?page_size=500&is_active=true",
            ),
            isTeacher
              ? apiJson<{ results?: Assignment[] } | Assignment[]>(
                  "/api/teacher-assignments/?is_active=true&page_size=500",
                )
              : Promise.resolve([] as Assignment[]),
          ]);
        if (cancelled) return;

        const armList = unwrapList(armData);
        const termList = unwrapList(termData);
        const subjectList = unwrapList(subjectData).filter(
          (s) => s.subject_type !== "additional_assessment",
        );
        const assignmentList = unwrapList(assignmentData);

        const activeTerm = termList.find((t) => t.is_active) ?? termList[0];
        const initial: Record<number, CardState> = {};
        for (const level of levelList) {
          const levelArms = armList.filter((a) => a.class_level === level.id);
          const defaultArm =
            levelArms.find((a) => a.name.toUpperCase() === "A") ?? levelArms[0];
          initial[level.id] = {
            termId: activeTerm?.id ?? "",
            armId: defaultArm?.id ?? "",
          };
        }

        const uniqueArmIds = [
          ...new Set(
            Object.values(initial)
              .map((s) => s.armId)
              .filter((id): id is number => Boolean(id)),
          ),
        ];
        const sizeEntries = await Promise.all(
          uniqueArmIds.map(async (armId) => {
            const students = await apiJson<{
              count?: number;
              results?: unknown[];
            }>(`/api/students/?class_arm=${armId}&page_size=1`);
            const finalCount =
              typeof students.count === "number"
                ? students.count
                : (students.results?.length ?? 0);
            return [armId, finalCount] as const;
          }),
        );

        if (cancelled) return;
        setLevels(levelList);
        setArms(armList);
        setTerms(termList);
        setSubjects(subjectList);
        setAssignments(assignmentList);
        setCardState(initial);
        setClassSizes(Object.fromEntries(sizeEntries));
        setError("");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load subject results");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isTeacher]);

  const visibleLevels = useMemo(() => {
    if (!isTeacher) return levels;
    const armIds = new Set(assignments.map((a) => a.class_arm));
    const levelIds = new Set(
      arms.filter((a) => armIds.has(a.id)).map((a) => a.class_level),
    );
    return levels.filter((l) => levelIds.has(l.id));
  }, [isTeacher, levels, arms, assignments]);

  async function refreshClassSize(armId: number) {
    if (!armId || classSizes[armId] !== undefined) return;
    try {
      const students = await apiJson<{ count?: number; results?: unknown[] }>(
        `/api/students/?class_arm=${armId}&page_size=1`,
      );
      const count =
        typeof students.count === "number"
          ? students.count
          : (students.results?.length ?? 0);
      setClassSizes((prev) => ({ ...prev, [armId]: count }));
    } catch {
      /* ignore */
    }
  }

  function updateCard(levelId: number, patch: Partial<CardState>) {
    setCardState((prev) => {
      const next = { ...prev[levelId], ...patch };
      return { ...prev, [levelId]: next };
    });
    if (patch.armId) {
      void refreshClassSize(Number(patch.armId));
    }
  }

  function subjectCountForLevel(levelId: number) {
    return subjects.filter((s) => s.class_level === levelId).length;
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Loading subject results…</p>;
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-pink)]">
          Results
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold text-[var(--brand-blue-deep)]">
          Subject Results
        </h1>
        <p className="mt-3 max-w-2xl text-base text-[var(--muted)]">
          Choose a class, term, and arm, then manage results subject by subject.
          Arm defaults to A.
        </p>
      </header>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {visibleLevels.length === 0 ? (
        <p className="rounded-2xl border border-[var(--line)] bg-white/90 px-5 py-8 text-sm text-[var(--muted)]">
          {isTeacher
            ? "No teaching assignments found. Ask an admin to assign your class, arm, and subjects."
            : "No class levels are set up yet."}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {visibleLevels.map((level) => {
            const state = cardState[level.id] ?? { termId: "", armId: "" };
            const levelArms = arms.filter((a) => a.class_level === level.id);
            const selectedTerm = terms.find((t) => t.id === state.termId);
            const selectedArm = levelArms.find((a) => a.id === state.armId);
            const termLabel = (selectedTerm?.name || "TERM").toUpperCase();
            const armLabel = selectedArm?.name || "—";
            const nextBegins = selectedTerm?.next_term_resumption || "—";
            const size =
              state.armId && classSizes[Number(state.armId)] !== undefined
                ? classSizes[Number(state.armId)]
                : "—";
            const manageHref =
              state.termId && state.armId
                ? `/app/results/subject-results/${level.id}?term=${state.termId}&arm=${state.armId}`
                : null;

            return (
              <article
                key={level.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--mist-warm)] shadow-[0_10px_30px_rgba(12,47,109,0.06)]"
              >
                <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] bg-[#fff3e8] px-4 py-3">
                  <h2 className="font-display text-2xl font-semibold text-[var(--ink)]">
                    {level.name}
                  </h2>
                  <PeopleIcon />
                </div>

                <div className="flex flex-1 flex-col gap-3 px-4 py-4">
                  <label className="field">
                    <span>TERM</span>
                    <select
                      className="field-input"
                      value={state.termId}
                      onChange={(e) =>
                        updateCard(level.id, {
                          termId: e.target.value ? Number(e.target.value) : "",
                        })
                      }
                    >
                      <option value="">Select term</option>
                      {terms.map((term) => (
                        <option key={term.id} value={term.id}>
                          {term.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>ARM</span>
                    <select
                      className="field-input"
                      value={state.armId}
                      onChange={(e) =>
                        updateCard(level.id, {
                          armId: e.target.value ? Number(e.target.value) : "",
                        })
                      }
                    >
                      <option value="">Select arm</option>
                      {levelArms.map((arm) => (
                        <option key={arm.id} value={arm.id}>
                          {arm.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  {manageHref ? (
                    <Link
                      href={manageHref}
                      className="mt-1 inline-flex items-center justify-center rounded-lg bg-[var(--brand-pink)] px-4 py-3 text-center text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[var(--brand-pink-soft)]"
                    >
                      Manage Result
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="mt-1 rounded-lg bg-[var(--brand-pink)]/40 px-4 py-3 text-sm font-bold uppercase tracking-wide text-white"
                    >
                      Manage Result
                    </button>
                  )}
                </div>

                <div className="border-t border-[var(--line)] bg-[#fff3e8] px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2 font-semibold text-[var(--ink)]">
                    <span>
                      {termLabel} ({armLabel})
                    </span>
                    <span className="text-emerald-600" aria-hidden>
                      ✓
                    </span>
                  </div>
                  <dl className="mt-2 space-y-1 text-[var(--ink)]">
                    <div className="flex justify-between gap-3">
                      <dt className="font-semibold">TOTAL NO. SUB:</dt>
                      <dd>{subjectCountForLevel(level.id)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="font-semibold">NEXT TERM BEGINS:</dt>
                      <dd>{nextBegins}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="font-semibold">CLASS SIZE:</dt>
                      <dd>{size === 0 ? "" : size}</dd>
                    </div>
                  </dl>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <style jsx global>{`
        .field {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .field span {
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          color: var(--ink);
        }
        .field-input {
          width: 100%;
          border: 1px solid var(--line);
          background: #fff;
          border-radius: 0.55rem;
          padding: 0.6rem 0.75rem;
          font-size: 0.95rem;
        }
      `}</style>
    </div>
  );
}
