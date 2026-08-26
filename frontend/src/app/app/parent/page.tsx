"use client";

import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { loadActiveSessionTerms, type PortalTerm } from "@/lib/terms";
import { FeeBillList, type FeeBill } from "@/components/FeeBillList";

type Child = { id: number; student_id: string; full_name: string };
type ResultPayload = {
  locked?: boolean;
  detail?: string;
  student_name?: string;
  total?: number;
  average?: number;
  position?: number | null;
  subjects?: { subject_name: string; total: number }[];
};
type AttendanceSummary = {
  days_present: number;
  days_absent: number;
  term?: { id: number; name: string };
  recent?: { date: string; status: string }[];
};

export default function ParentPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [childId, setChildId] = useState<number | "">("");
  const [terms, setTerms] = useState<PortalTerm[]>([]);
  const [termId, setTermId] = useState<number | "">("");
  const [result, setResult] = useState<ResultPayload | null>(null);
  const [fees, setFees] = useState<FeeBill[]>([]);
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiJson<{ children?: Child[] }>("/api/auth/me/")
      .then((me) => {
        const list = me.children ?? [];
        setChildren(list);
        if (list[0]) setChildId(list[0].id);
      })
      .catch((e) => setError(e.message));
    loadActiveSessionTerms().then((list) => {
      setTerms(list);
      const active = list.find((t) => t.is_active) ?? list[0];
      if (active) setTermId(active.id);
    });
    apiJson<{ results?: FeeBill[] } | FeeBill[]>("/api/fee-records/")
      .then((data) => setFees(Array.isArray(data) ? data : data.results ?? []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!childId || !termId) return;
    apiJson<ResultPayload>(`/api/results/me/?term=${termId}&student=${childId}`)
      .then(setResult)
      .catch((e) => setError(e.message));
    apiJson<AttendanceSummary>(
      `/api/attendance/my_summary/?student=${childId}&term=${termId}`,
    )
      .then(setAttendance)
      .catch(() => setAttendance(null));
  }, [childId, termId]);

  const user = getStoredUser();
  const childFees = fees.filter((f) => !childId || f.student === childId);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          Parent portal
        </p>
        <h1 className="font-display text-4xl text-[var(--brand-green)]">
          {user?.full_name || "Guardian"} — children
        </h1>
        <p className="mt-2 text-[var(--ink-soft)]">
          View results (fee-gated), attendance, and fee status for each linked
          child.
        </p>
      </header>

      {error ? (
        <p className="bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <select
          className="field-input"
          value={childId}
          onChange={(e) => setChildId(Number(e.target.value))}
        >
          {children.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name} ({c.student_id})
            </option>
          ))}
        </select>
        <select
          className="field-input"
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

      {result?.locked ? (
        <div className="border border-[var(--line)] bg-white/80 p-5">
          <h2 className="font-display text-2xl">Results locked</h2>
          <p className="mt-2 text-[var(--ink-soft)]">{result.detail}</p>
        </div>
      ) : result ? (
        <div className="border border-[var(--line)] bg-white/80 p-5">
          <h2 className="font-display text-2xl text-[var(--brand-green)]">
            {result.student_name}
          </h2>
          <p className="mt-2 text-sm">
            Total {Number(result.total).toFixed(1)} · Average{" "}
            {Number(result.average).toFixed(2)} · Position {result.position ?? "—"}
          </p>
          <ul className="mt-4 space-y-1 text-sm">
            {(result.subjects ?? []).map((s) => (
              <li
                key={s.subject_name}
                className="flex justify-between border-b border-[var(--line)] py-1"
              >
                <span>{s.subject_name}</span>
                <span>{s.total}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">No linked children yet.</p>
      )}

      <section className="border border-[var(--line)] bg-white/80 p-5">
        <h2 className="font-display text-2xl text-[var(--brand-green)]">
          Attendance
        </h2>
        {attendance ? (
          <>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">
              {attendance.term?.name ?? "Current term"}: present{" "}
              {attendance.days_present}, absent {attendance.days_absent}
            </p>
            <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-sm">
              {(attendance.recent ?? []).map((row) => (
                <li
                  key={`${row.date}-${row.status}`}
                  className="flex justify-between border-b border-[var(--line)] py-1"
                >
                  <span>{row.date}</span>
                  <span className="uppercase text-[var(--muted)]">{row.status}</span>
                </li>
              ))}
              {(attendance.recent ?? []).length === 0 ? (
                <li className="text-[var(--muted)]">No daily records yet.</li>
              ) : null}
            </ul>
          </>
        ) : (
          <p className="mt-2 text-sm text-[var(--muted)]">
            Attendance summary unavailable for this child.
          </p>
        )}
      </section>

      <section className="border border-[var(--line)] bg-white/80 p-5">
        <h2 className="font-display text-2xl text-[var(--brand-green)]">
          Fee status
        </h2>
        <FeeBillList
          bills={childFees}
          onBillsChange={setFees}
          emptyLabel="No fee records for this child."
        />
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
