"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiJson } from "@/lib/api";
import { loadClassLevels } from "@/lib/classLevels";
import type { ClassLevelNav } from "@/lib/portalNav";

type ClassArm = { id: number; name: string; label: string; class_level: number };
type Session = { id: number; name: string; is_active: boolean; start_year: number };
type Term = {
  id: number;
  name: string;
  number: number;
  session: number;
  is_active: boolean;
};

function unwrapList<T>(data: { results?: T[] } | T[]): T[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

export default function GeneralReportSheetPage() {
  const router = useRouter();
  const [levels, setLevels] = useState<ClassLevelNav[]>([]);
  const [arms, setArms] = useState<ClassArm[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [armId, setArmId] = useState<number | "">("");
  const [levelId, setLevelId] = useState<number | "">("");
  const [termId, setTermId] = useState<number | "">("");
  const [sessionId, setSessionId] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [levelList, armData, sessionData, termData] = await Promise.all([
          loadClassLevels(),
          apiJson<{ results?: ClassArm[] } | ClassArm[]>(
            "/api/class-arms/?page_size=500",
          ),
          apiJson<{ results?: Session[] } | Session[]>(
            "/api/sessions/?page_size=100",
          ),
          apiJson<{ results?: Term[] } | Term[]>("/api/terms/?page_size=100"),
        ]);
        if (cancelled) return;
        const armList = unwrapList(armData);
        const sessionList = unwrapList(sessionData);
        const termList = unwrapList(termData);
        setLevels(levelList);
        setArms(armList);
        setSessions(sessionList);
        setTerms(termList);

        const activeSession =
          sessionList.find((s) => s.is_active) || sessionList[0] || null;
        if (activeSession) setSessionId(activeSession.id);

        const activeTerm =
          termList.find((t) => t.is_active) ||
          (activeSession
            ? termList.find((t) => t.session === activeSession.id)
            : null) ||
          null;
        if (activeTerm) {
          setTermId(activeTerm.id);
          setSessionId(activeTerm.session);
        }

        if (levelList[0]) setLevelId(levelList[0].id);
        setError("");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load filters");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const armsForClass = useMemo(() => {
    if (!levelId) return [];
    return arms
      .filter((a) => a.class_level === levelId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [arms, levelId]);

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
    const match = armsForClass.find((a) => a.id === armId);
    if (!match) {
      setArmId(armsForClass[0]?.id ?? "");
    }
  }, [levelId, armsForClass, armId]);

  useEffect(() => {
    if (!sessionId) {
      setTermId("");
      return;
    }
    const match = termsForSession.find((t) => t.id === termId);
    if (!match) {
      const preferred =
        termsForSession.find((t) => t.is_active) || termsForSession[0];
      setTermId(preferred?.id ?? "");
    }
  }, [sessionId, termsForSession, termId]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!armId || !levelId || !termId || !sessionId) {
      setError("Select ARM, Class, Term, and Session.");
      return;
    }
    const params = new URLSearchParams({
      arm: String(armId),
      class: String(levelId),
      term: String(termId),
      session: String(sessionId),
    });
    router.push(`/app/results/general-report-sheet/view?${params.toString()}`);
  }

  const fieldClass =
    "mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand-blue)]";

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-3xl font-semibold text-[var(--brand-blue-deep)]">
        Report sheet
      </h1>

      {loading ? (
        <p className="mt-6 text-sm text-[var(--muted)]">Loading…</p>
      ) : (
        <form
          onSubmit={onSubmit}
          className="mt-6 rounded-md bg-[#e8e4f5] px-8 py-8 shadow-sm"
        >
          {error ? (
            <p className="mb-4 rounded bg-white/80 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <label className="block text-sm font-semibold uppercase tracking-wide text-[var(--ink)]">
            ARM
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
                armsForClass.map((arm) => (
                  <option key={arm.id} value={arm.id}>
                    {arm.name}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="mt-5 block text-sm font-semibold text-[var(--ink)]">
            Class
            <select
              className={fieldClass}
              value={levelId}
              onChange={(e) =>
                setLevelId(e.target.value ? Number(e.target.value) : "")
              }
              required
            >
              {levels.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.name.replace(/\s+/g, "").toUpperCase()}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-5 block text-sm font-semibold uppercase tracking-wide text-[var(--ink)]">
            TERM
            <select
              className={fieldClass}
              value={termId}
              onChange={(e) =>
                setTermId(e.target.value ? Number(e.target.value) : "")
              }
              required
            >
              {termsForSession.length === 0 ? (
                <option value="">No terms for session</option>
              ) : (
                termsForSession.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name.toUpperCase()}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="mt-5 block text-sm font-semibold text-[var(--ink)]">
            Session
            <select
              className={fieldClass}
              value={sessionId}
              onChange={(e) =>
                setSessionId(e.target.value ? Number(e.target.value) : "")
              }
              required
            >
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-10 flex justify-center">
            <button
              type="submit"
              className="text-base font-semibold text-[var(--brand-blue-deep)] underline-offset-4 hover:underline"
            >
              View Results
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
