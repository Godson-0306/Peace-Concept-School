"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiJson } from "@/lib/api";

type SubjectCol = { id: number; name: string };
type ScoreCell = {
  ca1: number;
  ca2: number;
  exam: number;
  total: number;
  status?: string | null;
};
type ReportRow = {
  student_id: number;
  student_name: string;
  student_code: string;
  total: number;
  average: number;
  position: number;
  by_subject: Record<string, ScoreCell>;
};
type GeneralReport = {
  session: { id: number; name: string };
  term: { id: number; name: string; number: number };
  class_level: { id: number; name: string };
  class_arm: { id: number; name: string; label: string };
  subjects: SubjectCol[];
  rows: ReportRow[];
};

type SortKey = "name" | "total" | "average" | "position" | `subject-${number}`;

function formatNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return Number(n.toFixed(2)).toString();
}

function shortSubject(name: string, max = 5): string {
  const compact = name.replace(/\s+/g, "").toUpperCase();
  return compact.length <= max ? compact : compact.slice(0, max);
}

function ScoreCellView({
  cell,
  subjectName,
}: {
  cell: ScoreCell | undefined;
  subjectName: string;
}) {
  const total = cell?.total ?? 0;
  const ca1 = cell?.ca1 ?? 0;
  const ca2 = cell?.ca2 ?? 0;
  const exam = cell?.exam ?? 0;
  return (
    <div className="flex min-w-[3.25rem] flex-col items-center gap-0.5 py-1 text-[10px] leading-tight text-[var(--ink)]">
      <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-red-600 text-[11px] font-bold text-red-700">
        {formatNum(total)}
      </span>
      <span className="whitespace-nowrap tabular-nums">
        {formatNum(ca1)}- {formatNum(ca2)}
      </span>
      <span className="whitespace-nowrap tabular-nums">
        - {formatNum(exam)}-
      </span>
      <span className="max-w-[3rem] truncate font-semibold uppercase text-slate-500">
        {shortSubject(subjectName)}
      </span>
    </div>
  );
}

function GeneralReportViewInner() {
  const searchParams = useSearchParams();
  const armId = Number(searchParams.get("arm"));
  const termId = Number(searchParams.get("term"));

  const [report, setReport] = useState<GeneralReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(100);
  const [sortKey, setSortKey] = useState<SortKey>("position");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    if (!armId || !termId) {
      setError("Choose ARM, Class, Term, and Session first.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await apiJson<GeneralReport>(
          `/api/scores/general_report/?term=${termId}&class_arm=${armId}`,
        );
        if (cancelled) return;
        setReport(data);
        setError("");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load report");
          setReport(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [armId, termId]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "asc");
    }
  }

  const filteredSorted = useMemo(() => {
    if (!report) return [];
    const q = search.trim().toLowerCase();
    let rows = report.rows;
    if (q) {
      rows = rows.filter(
        (r) =>
          r.student_name.toLowerCase().includes(q) ||
          r.student_code.toLowerCase().includes(q),
      );
    }
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sortKey === "name") {
        return a.student_name.localeCompare(b.student_name) * dir;
      }
      if (sortKey === "total") return (a.total - b.total) * dir;
      if (sortKey === "average") return (a.average - b.average) * dir;
      if (sortKey === "position") return (a.position - b.position) * dir;
      if (sortKey.startsWith("subject-")) {
        const sid = sortKey.slice("subject-".length);
        const av = a.by_subject[sid]?.total ?? 0;
        const bv = b.by_subject[sid]?.total ?? 0;
        return (av - bv) * dir;
      }
      return 0;
    });
  }, [report, search, sortKey, sortDir]);

  const visible = filteredSorted.slice(0, pageSize);

  function exportCsv() {
    if (!report) return;
    const headers = [
      "NAME",
      "STUDENT ID",
      ...report.subjects.flatMap((s) => [
        `${s.name} CA1`,
        `${s.name} CA2`,
        `${s.name} Exam`,
        `${s.name} Total`,
      ]),
      "TOTAL",
      "AVERAGE",
      "POSITION",
    ];
    const lines = [headers.join(",")];
    for (const row of filteredSorted) {
      const cells = [
        `"${row.student_name.replace(/"/g, '""')}"`,
        row.student_code,
      ];
      for (const subject of report.subjects) {
        const cell = row.by_subject[String(subject.id)];
        cells.push(
          String(cell?.ca1 ?? 0),
          String(cell?.ca2 ?? 0),
          String(cell?.exam ?? 0),
          String(cell?.total ?? 0),
        );
      }
      cells.push(
        String(row.total),
        String(row.average),
        String(row.position),
      );
      lines.push(cells.join(","));
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `general-report-${report.class_arm.label}-${report.term.name}.csv`.replace(
      /\s+/g,
      "-",
    );
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Loading report sheet…</p>;
  }

  if (error || !report) {
    return (
      <div className="space-y-4">
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || "No report data."}
        </p>
        <Link
          href="/app/results/general-report-sheet"
          className="text-sm font-semibold text-[var(--brand-blue)]"
        >
          ← Back to filters
        </Link>
      </div>
    );
  }

  const SortBtn = ({
    label,
    sort,
    className = "",
  }: {
    label: string;
    sort: SortKey;
    className?: string;
  }) => (
    <button
      type="button"
      onClick={() => toggleSort(sort)}
      className={`inline-flex items-center gap-1 font-semibold uppercase tracking-wide ${className}`}
    >
      <span
        className={
          sort.startsWith("subject-")
            ? "[writing-mode:vertical-rl] rotate-180 whitespace-nowrap py-2"
            : ""
        }
      >
        {label}
      </span>
      <span className="text-[10px] text-slate-400" aria-hidden>
        {sortKey === sort ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
      </span>
    </button>
  );

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-pink)]">
            General Report Sheet
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-[var(--brand-blue-deep)]">
            {report.class_level.name}
            {report.class_arm.name} · {report.term.name}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Session {report.session.name}
          </p>
        </div>
        <Link
          href="/app/results/general-report-sheet"
          className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold"
        >
          Change filters
        </Link>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-white px-4 py-3">
        <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
          Show
          <select
            className="rounded border border-slate-300 px-2 py-1"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            {[25, 50, 100, 200].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          entries
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            Search:
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-[var(--brand-blue)]"
              placeholder="Name or ID"
            />
          </label>
          <button
            type="button"
            onClick={exportCsv}
            className="rounded bg-[var(--brand-blue)] px-4 py-1.5 text-sm font-semibold text-white"
          >
            Export
          </button>
        </div>
      </div>

      {report.subjects.length === 0 ? (
        <p className="rounded-xl bg-[var(--brand-blue-wash)] px-4 py-3 text-sm text-[var(--brand-blue-deep)]">
          No subjects are set up for this class yet. Add subjects in Subjects
          Settings, then enter scores.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-700">
              <th className="sticky left-0 z-10 bg-slate-50 px-3 py-3">
                <SortBtn label="Name" sort="name" />
              </th>
              {report.subjects.map((subject) => (
                <th
                  key={subject.id}
                  className="border-l border-slate-100 px-1 py-2 text-center align-bottom"
                >
                  <SortBtn
                    label={subject.name.toUpperCase()}
                    sort={`subject-${subject.id}`}
                  />
                </th>
              ))}
              <th className="border-l border-slate-100 px-3 py-3 text-center">
                <SortBtn label="Total" sort="total" />
              </th>
              <th className="px-3 py-3 text-center">
                <SortBtn label="Average" sort="average" />
              </th>
              <th className="px-3 py-3 text-center">
                <SortBtn label="Position" sort="position" />
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td
                  colSpan={report.subjects.length + 4}
                  className="px-4 py-8 text-center text-[var(--muted)]"
                >
                  No students found for this class arm.
                </td>
              </tr>
            ) : (
              visible.map((row) => (
                <tr
                  key={row.student_id}
                  className="border-b border-slate-100 hover:bg-slate-50/80"
                >
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 align-middle">
                    <div className="min-w-[9rem] font-semibold uppercase leading-tight text-[var(--ink)]">
                      {row.student_name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {row.student_code}
                    </div>
                  </td>
                  {report.subjects.map((subject) => (
                    <td
                      key={subject.id}
                      className="border-l border-slate-100 px-0.5 py-1 text-center align-middle"
                    >
                      <ScoreCellView
                        cell={row.by_subject[String(subject.id)]}
                        subjectName={subject.name}
                      />
                    </td>
                  ))}
                  <td className="border-l border-slate-100 px-3 py-2 text-center font-semibold tabular-nums">
                    {formatNum(row.total)}
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums">
                    {formatNum(row.average)}
                  </td>
                  <td className="px-3 py-2 text-center font-semibold tabular-nums">
                    {row.position}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[var(--muted)]">
        Showing {visible.length} of {filteredSorted.length} student
        {filteredSorted.length === 1 ? "" : "s"}
        {filteredSorted.length !== report.rows.length
          ? ` (filtered from ${report.rows.length})`
          : ""}
        . Circles show subject total (CA1 + CA2 + Exam).
      </p>
    </div>
  );
}

export default function GeneralReportViewPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-[var(--muted)]">Loading report sheet…</p>
      }
    >
      <GeneralReportViewInner />
    </Suspense>
  );
}
