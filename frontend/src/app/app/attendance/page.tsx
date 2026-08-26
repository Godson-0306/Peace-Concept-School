"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import { formTeacherClassArmIds, getStoredUser, isFormTeacher, type AuthUser } from "@/lib/auth";
import { loadClassLevels } from "@/lib/classLevels";
import type { ClassLevelNav } from "@/lib/portalNav";

type ClassArm = { id: number; name: string; label: string; class_level: number };
type Session = { id: number; name: string; is_active: boolean };
type Term = {
  id: number;
  name: string;
  number: number;
  session: number;
  is_active: boolean;
};
type RegisterRow = {
  student_id: number;
  student_code: string;
  student_name: string;
  status: "present" | "absent" | "late" | null;
  record_id: number | null;
};
type RegisterPayload = {
  date: string;
  term: { id: number; name: string };
  class_arm: { id: number; label: string };
  counts: { present: number; absent: number; late: number; unmarked: number };
  rows: RegisterRow[];
};
type StudentSummary = {
  term: { id: number; name: string };
  days_present: number;
  days_absent: number;
  recent: { date: string; status: string }[];
};

type StatusValue = "present" | "absent" | "late";

function unwrapList<T>(data: { results?: T[] } | T[]): T[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function AttendancePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const isStudent = user?.account_type === "student";
  const isAdmin = user?.account_type === "admin";
  const isPrincipal = user?.account_type === "principal";
  const formTeacher = isFormTeacher(user);
  const isStaff = isAdmin || isPrincipal || formTeacher;

  const [levels, setLevels] = useState<ClassLevelNav[]>([]);
  const [arms, setArms] = useState<ClassArm[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [levelId, setLevelId] = useState<number | "">("");
  const [armId, setArmId] = useState<number | "">("");
  const [sessionId, setSessionId] = useState<number | "">("");
  const [termId, setTermId] = useState<number | "">("");
  const [date, setDate] = useState(todayISO());
  const [statuses, setStatuses] = useState<Record<number, StatusValue | "">>({});
  const [register, setRegister] = useState<RegisterPayload | null>(null);
  const [summary, setSummary] = useState<StudentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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
        if (user.account_type === "student") {
          const data = await apiJson<StudentSummary>("/api/attendance/my_summary/");
          if (!cancelled) setSummary(data);
          return;
        }
        if (
          user.account_type !== "admin" &&
          user.account_type !== "principal" &&
          !isFormTeacher(user)
        ) {
          return;
        }
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
        const adminish =
          user.account_type === "admin" || user.account_type === "principal";
        const allowedArmIds = new Set(formTeacherClassArmIds(user));
        const visibleArms = adminish
          ? armList
          : armList.filter((arm) => allowedArmIds.has(arm.id));
        const visibleLevels = levelList.filter((level) =>
          visibleArms.some((arm) => arm.class_level === level.id),
        );
        setLevels(visibleLevels);
        setArms(visibleArms);
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
        if (visibleLevels[0]) setLevelId(visibleLevels[0].id);
        if (!adminish && visibleArms.length === 0) {
          setError("No form class is assigned to this account.");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load attendance");
        }
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
    if (!match) setArmId(armsForClass[0]?.id ?? "");
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

  async function loadRegister() {
    if (!armId || !termId || !date) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const data = await apiJson<RegisterPayload>(
        `/api/attendance/register/?class_arm=${armId}&term=${termId}&date=${date}`,
      );
      setRegister(data);
      const next: Record<number, StatusValue | ""> = {};
      for (const row of data.rows) {
        next[row.student_id] = (row.status as StatusValue) || "";
      }
      setStatuses(next);
    } catch (e) {
      setRegister(null);
      setError(e instanceof Error ? e.message : "Failed to load register");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isStaff || !armId || !termId || !date) return;
    void loadRegister();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaff, armId, termId, date]);

  function markAll(status: StatusValue) {
    if (!register) return;
    const next: Record<number, StatusValue | ""> = {};
    for (const row of register.rows) next[row.student_id] = status;
    setStatuses(next);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!armId || !termId || !date || !register) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const marks = register.rows
        .map((row) => {
          const status = statuses[row.student_id];
          if (!status) return null;
          return { student: row.student_id, status };
        })
        .filter(Boolean);
      const data = await apiJson<RegisterPayload>("/api/attendance/bulk/", {
        method: "POST",
        body: JSON.stringify({
          class_arm: armId,
          term: termId,
          date,
          marks,
        }),
      });
      setRegister(data);
      const next: Record<number, StatusValue | ""> = {};
      for (const row of data.rows) {
        next[row.student_id] = (row.status as StatusValue) || "";
      }
      setStatuses(next);
      setMessage(
        `Saved ${marks.length} marks. Report-card days present/absent updated.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save attendance");
    } finally {
      setSaving(false);
    }
  }

  const fieldClass =
    "mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand-blue)]";

  if (!user) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  if (isStudent) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-semibold text-[var(--brand-blue-deep)]">
          My attendance
        </h1>
        {loading ? (
          <p className="mt-6 text-sm text-[var(--muted)]">Loading…</p>
        ) : error ? (
          <p className="mt-6 text-sm text-red-700">{error}</p>
        ) : summary ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-[var(--muted)]">{summary.term.name}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[var(--line)] bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                  Days present
                </p>
                <p className="mt-1 text-3xl font-semibold text-[var(--brand-blue-deep)]">
                  {summary.days_present}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                  Days absent
                </p>
                <p className="mt-1 text-3xl font-semibold text-[var(--brand-blue-deep)]">
                  {summary.days_absent}
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-white p-4">
              <h2 className="font-display text-xl text-[var(--brand-blue-deep)]">
                Recent marks
              </h2>
              <ul className="mt-3 divide-y divide-[var(--line)] text-sm">
                {summary.recent.length === 0 ? (
                  <li className="py-2 text-[var(--muted)]">No daily marks yet.</li>
                ) : (
                  summary.recent.map((row) => (
                    <li
                      key={row.date}
                      className="flex items-center justify-between py-2 capitalize"
                    >
                      <span>{row.date}</span>
                      <span className="font-medium">{row.status}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (!isStaff) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Attendance marking is available to Form Teachers, Admin, and Principal.
      </p>
    );
  }

  const counts = register?.counts;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-[var(--brand-blue-deep)]">
            Attendance
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Mark the daily register. Totals sync to report cards automatically.
          </p>
        </div>
        {isAdmin ? (
          <Link href="/app/attendance/gate" className="btn-primary">
            Automatic clock-in
          </Link>
        ) : null}
      </div>

      <div className="mt-6 grid gap-3 rounded-xl border border-[var(--line)] bg-white/90 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm font-medium">
          Class
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
        <label className="text-sm font-medium">
          Arm
          <select
            className={fieldClass}
            value={armId}
            onChange={(e) =>
              setArmId(e.target.value ? Number(e.target.value) : "")
            }
          >
            {armsForClass.map((arm) => (
              <option key={arm.id} value={arm.id}>
                {arm.label || arm.name}
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
          Date
          <input
            type="date"
            className={fieldClass}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>

      {error ? (
        <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      {message ? (
        <p className="mt-4 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}

      {counts ? (
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">
            Present {counts.present}
          </span>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">
            Late {counts.late}
          </span>
          <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-800">
            Absent {counts.absent}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
            Unmarked {counts.unmarked}
          </span>
        </div>
      ) : null}

      {loading && !register ? (
        <p className="mt-6 text-sm text-[var(--muted)]">Loading register…</p>
      ) : register ? (
        <form onSubmit={onSave} className="mt-4">
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-sm"
              onClick={() => markAll("present")}
            >
              Mark all present
            </button>
            <button
              type="button"
              className="rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-sm"
              onClick={() => markAll("absent")}
            >
              Mark all absent
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--mist)] text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-3">Student ID</th>
                  <th className="px-3 py-3">Name</th>
                  <th className="px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {register.rows.map((row) => (
                  <tr key={row.student_id} className="border-t border-[var(--line)]">
                    <td className="px-3 py-2 font-medium">{row.student_code}</td>
                    <td className="px-3 py-2">{row.student_name}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-3">
                        {(["present", "absent", "late"] as StatusValue[]).map(
                          (status) => (
                            <label
                              key={status}
                              className="inline-flex items-center gap-1.5 capitalize"
                            >
                              <input
                                type="radio"
                                name={`status-${row.student_id}`}
                                checked={statuses[row.student_id] === status}
                                onChange={() =>
                                  setStatuses((prev) => ({
                                    ...prev,
                                    [row.student_id]: status,
                                  }))
                                }
                              />
                              {status}
                            </label>
                          ),
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="submit" className="btn-primary mt-4" disabled={saving}>
            {saving ? "Saving…" : "Save attendance"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
