"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiJson } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import {
  loadAcademicCalendar,
  type PortalSession,
  type PortalTerm,
} from "@/lib/terms";
import SessionTermPickers from "@/components/SessionTermPickers";

type ArchiveRow = {
  term_id: number;
  term__number: number;
  term__name: string;
  term__session_id: number;
  term__session__name: string;
  term__session__start_year: number;
  class_arm_id: number;
  class_arm__name: string;
  class_arm__label: string;
  class_arm__class_level_id: number;
  class_arm__class_level__name: string;
  class_arm__class_level__order: number;
  score_count: number;
  student_count: number;
};

export default function ResultsArchivePage() {
  const router = useRouter();
  const user = getStoredUser();
  const canAccess =
    user?.account_type === "admin" || user?.account_type === "principal";

  const [sessions, setSessions] = useState<PortalSession[]>([]);
  const [terms, setTerms] = useState<PortalTerm[]>([]);
  const [sessionId, setSessionId] = useState<number | "">("");
  const [termId, setTermId] = useState<number | "">("");
  const [rows, setRows] = useState<ArchiveRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canAccess) {
      router.replace("/app");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [calendar, archive] = await Promise.all([
          loadAcademicCalendar(),
          apiJson<{ results?: ArchiveRow[] }>("/api/results/archive/"),
        ]);
        if (cancelled) return;
        setSessions(calendar.sessions);
        setTerms(calendar.terms);
        setSessionId(calendar.defaultSession?.id ?? "");
        setTermId(calendar.defaultTerm?.id ?? "");
        setRows(archive.results ?? []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load archive");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canAccess, router]);

  const visible = useMemo(() => {
    return rows.filter((row) => {
      if (sessionId && row.term__session_id !== sessionId) return false;
      if (termId && row.term_id !== termId) return false;
      return true;
    });
  }, [rows, sessionId, termId]);

  if (!canAccess) {
    return <p className="text-sm text-[var(--muted)]">Redirecting…</p>;
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          Results
        </p>
        <h1 className="font-display text-4xl text-[var(--brand-green)]">
          Results archive
        </h1>
        <p className="mt-2 max-w-2xl text-[var(--ink-soft)]">
          Score counts by session, term, and class. Defaults to the active
          calendar; switch to browse past years without changing school-wide
          settings.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <SessionTermPickers
          sessions={sessions}
          terms={terms}
          sessionId={sessionId}
          termId={termId}
          onSessionChange={setSessionId}
          onTermChange={setTermId}
        />
      </div>

      {error ? (
        <p className="bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}
      {loading ? <p className="text-sm text-[var(--muted)]">Loading…</p> : null}

      {!loading && visible.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          No stored scores for this session and term.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-white/90">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--mist)] text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
              <tr>
                <th className="px-5 py-3 font-semibold">Session</th>
                <th className="px-5 py-3 font-semibold">Term</th>
                <th className="px-5 py-3 font-semibold">Class</th>
                <th className="px-5 py-3 font-semibold">Students</th>
                <th className="px-5 py-3 font-semibold">Scores</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {visible.map((row) => (
                <tr key={`${row.term_id}-${row.class_arm_id}`}>
                  <td className="px-5 py-3">{row.term__session__name}</td>
                  <td className="px-5 py-3">{row.term__name}</td>
                  <td className="px-5 py-3 font-semibold">
                    {row.class_arm__label ||
                      `${row.class_arm__class_level__name}${row.class_arm__name}`}
                  </td>
                  <td className="px-5 py-3">{row.student_count}</td>
                  <td className="px-5 py-3">{row.score_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
