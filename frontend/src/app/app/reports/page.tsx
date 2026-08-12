"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, apiJson, errorFromUnknown, formatApiError } from "@/lib/api";
import { getStoredUser, type AuthUser } from "@/lib/auth";
import { loadClassLevels } from "@/lib/classLevels";
import type { ClassLevelNav } from "@/lib/portalNav";
import { loadActiveSessionTerms, type PortalTerm } from "@/lib/terms";

type ClassArm = {
  id: number;
  name: string;
  label: string;
  class_level: number;
};

type StudentRow = {
  id: number;
  student_id: string;
  full_name: string;
  class_arm_label?: string;
  is_active?: boolean;
};

const REPORTS_ROLES = new Set(["admin", "principal"]);

function unwrapList<T>(data: { results?: T[] } | T[]): T[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const match = /filename\*?=(?:UTF-8''|")?([^\";]+)"?/i.exec(header);
  if (!match?.[1]) return fallback;
  try {
    return decodeURIComponent(match[1].replace(/["']/g, "").trim());
  } catch {
    return match[1].replace(/["']/g, "").trim() || fallback;
  }
}

async function downloadBatch(path: string, fallbackName: string) {
  const response = await apiFetch(path);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(formatApiError(data, `Download failed (${response.status})`));
  }
  const blob = await response.blob();
  const name = filenameFromDisposition(
    response.headers.get("Content-Disposition"),
    fallbackName,
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [levels, setLevels] = useState<ClassLevelNav[]>([]);
  const [arms, setArms] = useState<ClassArm[]>([]);
  const [terms, setTerms] = useState<PortalTerm[]>([]);
  const [levelId, setLevelId] = useState<number | "">("");
  const [armId, setArmId] = useState<number | "">("");
  const [termId, setTermId] = useState<number | "">("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [batchBusy, setBatchBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const allowed = user != null && REPORTS_ROLES.has(user.account_type);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  useEffect(() => {
    if (!user) return;
    if (!REPORTS_ROLES.has(user.account_type)) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [levelList, armData, termList] = await Promise.all([
          loadClassLevels(),
          apiJson<{ results?: ClassArm[] } | ClassArm[]>(
            "/api/class-arms/?page_size=500",
          ),
          loadActiveSessionTerms(),
        ]);
        if (cancelled) return;
        setLevels(levelList);
        setArms(unwrapList(armData));
        setTerms(termList);
        if (levelList[0]) setLevelId(levelList[0].id);
        const activeTerm = termList.find((t) => t.is_active) ?? termList[0];
        if (activeTerm) setTermId(activeTerm.id);
      } catch (e) {
        if (!cancelled) setError(errorFromUnknown(e, "Failed to load filters"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const armsForClass = useMemo(() => {
    if (!levelId) return [];
    return arms
      .filter((a) => a.class_level === levelId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [arms, levelId]);

  useEffect(() => {
    if (!levelId) {
      setArmId("");
      return;
    }
    const match = armsForClass.find((a) => a.id === armId);
    if (!match) setArmId(armsForClass[0]?.id ?? "");
  }, [levelId, armsForClass, armId]);

  const loadRoster = useCallback(async (arm: number) => {
    setRosterLoading(true);
    setError("");
    try {
      const data = await apiJson<{ results?: StudentRow[] } | StudentRow[]>(
        `/api/students/?class_arm=${arm}&page_size=500`,
      );
      const list = unwrapList(data)
        .filter((s) => s.is_active !== false)
        .sort(
          (a, b) =>
            a.full_name.localeCompare(b.full_name) ||
            a.student_id.localeCompare(b.student_id),
        );
      setStudents(list);
    } catch (e) {
      setStudents([]);
      setError(errorFromUnknown(e, "Failed to load students"));
    } finally {
      setRosterLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!armId || !allowed) {
      setStudents([]);
      return;
    }
    void loadRoster(armId);
  }, [armId, allowed, loadRoster]);

  async function runBatch(
    key: string,
    path: string,
    fallbackName: string,
  ) {
    setBatchBusy(key);
    setError("");
    setMessage("");
    try {
      await downloadBatch(path, fallbackName);
      setMessage("Download started.");
    } catch (e) {
      setError(errorFromUnknown(e, "Batch download failed"));
    } finally {
      setBatchBusy(null);
    }
  }

  const fieldClass =
    "field-input mt-1 w-full min-w-[10rem] rounded border border-[var(--line)] bg-white px-3 py-2 text-sm";

  if (!user || loading) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="font-display text-3xl font-semibold text-[var(--brand-blue-deep)]">
          Reports
        </h1>
        <p className="mt-4 text-sm text-[var(--muted)]">Loading…</p>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="font-display text-3xl font-semibold text-[var(--brand-blue-deep)]">
          Reports
        </h1>
        <p className="mt-4 text-sm text-red-700">
          Only admin and principal can open the Reports print hub.
        </p>
      </div>
    );
  }

  const canBatchReports = Boolean(armId && termId && students.length > 0);
  const canBatchIds = Boolean(armId && students.length > 0);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-[var(--brand-blue-deep)]">
          Reports
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--ink-soft)]">
          Print report cards and ID cards by class. For the class results matrix
          and CSV export, use General Report Sheet.
        </p>
        <p className="mt-3 text-sm">
          <Link
            href="/app/results/general-report-sheet"
            className="font-medium text-[var(--brand-blue)] underline-offset-2 hover:underline"
          >
            Open General Report Sheet
          </Link>
        </p>
      </div>

      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 whitespace-pre-wrap">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}

      <section className="space-y-4 border border-[var(--line)] bg-white/80 p-5">
        <h2 className="font-display text-2xl text-[var(--brand-blue-deep)]">
          Class print
        </h2>
        <div className="flex flex-wrap gap-4">
          <label className="text-sm">
            <span className="mb-1 block text-[var(--muted)]">Class</span>
            <select
              className={fieldClass}
              value={levelId}
              onChange={(e) =>
                setLevelId(e.target.value ? Number(e.target.value) : "")
              }
            >
              {levels.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-[var(--muted)]">Arm</span>
            <select
              className={fieldClass}
              value={armId}
              onChange={(e) =>
                setArmId(e.target.value ? Number(e.target.value) : "")
              }
            >
              {armsForClass.length === 0 ? (
                <option value="">No arms</option>
              ) : (
                armsForClass.map((arm) => (
                  <option key={arm.id} value={arm.id}>
                    {arm.name}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-[var(--muted)]">Term</span>
            <select
              className={fieldClass}
              value={termId}
              onChange={(e) =>
                setTermId(e.target.value ? Number(e.target.value) : "")
              }
            >
              {terms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={!canBatchReports || batchBusy !== null}
            onClick={() =>
              runBatch(
                "rc-pdf",
                `/api/identity/report-cards/batch/?class_arm=${armId}&term=${termId}&format=pdf`,
                "report-cards.pdf",
              )
            }
          >
            {batchBusy === "rc-pdf" ? "Preparing…" : "All report cards (PDF)"}
          </button>
          <button
            type="button"
            className="btn-outline text-sm"
            disabled={!canBatchReports || batchBusy !== null}
            onClick={() =>
              runBatch(
                "rc-zip",
                `/api/identity/report-cards/batch/?class_arm=${armId}&term=${termId}&format=zip`,
                "report-cards.zip",
              )
            }
          >
            {batchBusy === "rc-zip" ? "Preparing…" : "All report cards (ZIP)"}
          </button>
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={!canBatchIds || batchBusy !== null}
            onClick={() =>
              runBatch(
                "id-pdf",
                `/api/identity/id-cards/batch/?class_arm=${armId}&format=pdf`,
                "id-cards.pdf",
              )
            }
          >
            {batchBusy === "id-pdf" ? "Preparing…" : "All ID cards (PDF)"}
          </button>
          <button
            type="button"
            className="btn-outline text-sm"
            disabled={!canBatchIds || batchBusy !== null}
            onClick={() =>
              runBatch(
                "id-zip",
                `/api/identity/id-cards/batch/?class_arm=${armId}&format=zip`,
                "id-cards.zip",
              )
            }
          >
            {batchBusy === "id-zip" ? "Preparing…" : "All ID cards (ZIP)"}
          </button>
        </div>
      </section>

      <section className="space-y-3 border border-[var(--line)] bg-white/80 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl text-[var(--brand-blue-deep)]">
            Students
          </h2>
          <p className="text-sm text-[var(--muted)]">
            {rosterLoading
              ? "Loading…"
              : `${students.length} active student${students.length === 1 ? "" : "s"}`}
          </p>
        </div>

        {!armId ? (
          <p className="text-sm text-[var(--muted)]">Select a class arm.</p>
        ) : rosterLoading ? (
          <p className="text-sm text-[var(--muted)]">Loading roster…</p>
        ) : students.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No active students in this arm.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-left text-[var(--muted)]">
                  <th className="py-2 pr-4">Student ID</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2">Downloads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {students.map((student) => (
                  <tr key={student.id}>
                    <td className="py-3 pr-4 font-mono text-xs">
                      {student.student_id}
                    </td>
                    <td className="py-3 pr-4 font-medium text-[var(--ink)]">
                      {student.full_name}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-3">
                        <a
                          className="text-[var(--brand-blue)] underline-offset-2 hover:underline"
                          href={
                            termId
                              ? `/api/identity/report-card/${student.id}/?term=${termId}`
                              : "#"
                          }
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => {
                            if (!termId) e.preventDefault();
                          }}
                        >
                          Report card
                        </a>
                        <a
                          className="text-[var(--brand-blue)] underline-offset-2 hover:underline"
                          href={`/api/identity/id-card/${student.id}/?format=pdf`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          ID card
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
