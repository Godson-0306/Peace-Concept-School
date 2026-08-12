"use client";

import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api";
import { loadActiveSessionTerms, type PortalTerm } from "@/lib/terms";

type ResultPayload = {
  locked?: boolean;
  detail?: string;
  student_name?: string;
  student_code?: string;
  total?: number;
  average?: number;
  position?: number | null;
  subjects?: {
    subject_name: string;
    ca1: number;
    ca2: number;
    exam: number;
    total: number;
    subject_type: string;
  }[];
};

type FeeRecord = {
  id: number;
  amount_due: string;
  amount_paid: string;
  balance?: string;
  status: string;
  results_unlocked: boolean;
  term_name?: string;
};

export default function StudentPage() {
  const [terms, setTerms] = useState<PortalTerm[]>([]);
  const [termId, setTermId] = useState<number | "">("");
  const [result, setResult] = useState<ResultPayload | null>(null);
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    loadActiveSessionTerms()
      .then((list) => {
        setTerms(list);
        const active = list.find((t) => t.is_active) ?? list[0];
        if (active) setTermId(active.id);
      })
      .catch((e) => setError(e.message));
    apiJson<{ results?: FeeRecord[] } | FeeRecord[]>("/api/fee-records/")
      .then((data) => setFees(Array.isArray(data) ? data : data.results ?? []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!termId) return;
    apiJson<ResultPayload>(`/api/results/me/?term=${termId}`)
      .then(setResult)
      .catch((e) => setError(e.message));
  }, [termId]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          Student portal
        </p>
        <h1 className="font-display text-4xl text-[var(--brand-green)]">
          My results & fees
        </h1>
      </header>

      {error ? (
        <p className="bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

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

      {result?.locked ? (
        <div className="border border-[var(--line)] bg-white/80 p-5">
          <h2 className="font-display text-2xl text-[var(--brand-green)]">
            Results locked
          </h2>
          <p className="mt-2 text-[var(--ink-soft)]">
            {result.detail ||
              "Pay the current term fees to unlock results. Past unlocked terms stay visible."}
          </p>
        </div>
      ) : result ? (
        <div className="border border-[var(--line)] bg-white/80 p-5">
          <h2 className="font-display text-2xl text-[var(--brand-green)]">
            {result.student_name}
          </h2>
          <p className="text-sm text-[var(--muted)]">{result.student_code}</p>
          <p className="mt-3 text-sm">
            Total: <strong>{Number(result.total).toFixed(1)}</strong> · Average:{" "}
            <strong>{Number(result.average).toFixed(2)}</strong> · Position:{" "}
            <strong>{result.position ?? "—"}</strong>
          </p>
          <table className="mt-4 min-w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--muted)]">
                <th className="py-1">Subject</th>
                <th>CA1</th>
                <th>CA2</th>
                <th>Exam</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {(result.subjects ?? []).map((s) => (
                <tr key={s.subject_name} className="border-t border-[var(--line)]">
                  <td className="py-2">
                    {s.subject_name}
                    {s.subject_type !== "subject" ? (
                      <span className="ml-1 text-xs text-[var(--muted)]">(extra)</span>
                    ) : null}
                  </td>
                  <td>{s.ca1}</td>
                  <td>{s.ca2}</td>
                  <td>{s.exam}</td>
                  <td>{s.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.student_code ? (
            <a
              className="btn-primary mt-4 inline-block"
              href={`/api/identity/report-card/${/* filled below */ ""}`}
              hidden
            >
              PDF
            </a>
          ) : null}
        </div>
      ) : null}

      <section className="border border-[var(--line)] bg-white/80 p-5">
        <h2 className="font-display text-2xl text-[var(--brand-green)]">Fee status</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {fees.map((f) => {
            const balance =
              f.balance != null
                ? Number(f.balance)
                : Number(f.amount_due) - Number(f.amount_paid);
            return (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] py-2"
              >
                <span>
                  {f.term_name ? `${f.term_name} · ` : ""}
                  Due ₦{Number(f.amount_due).toLocaleString()} · Paid ₦
                  {Number(f.amount_paid).toLocaleString()} · Balance ₦
                  {balance.toLocaleString()}
                </span>
                <span className="uppercase text-[var(--muted)]">
                  {f.status}
                  {f.results_unlocked ? " · unlocked" : " · locked"}
                </span>
              </li>
            );
          })}
          {fees.length === 0 ? (
            <li className="text-[var(--muted)]">No fee records yet.</li>
          ) : null}
        </ul>
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
