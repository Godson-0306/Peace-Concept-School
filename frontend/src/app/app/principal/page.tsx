"use client";

import { useCallback, useEffect, useState } from "react";
import { apiJson } from "@/lib/api";
import { loadActiveSessionTerms, type PortalTerm } from "@/lib/terms";

type ClassArm = { id: number; label: string };
type ResultRow = {
  student_id: number;
  student_name: string;
  student_code: string;
  total: number;
  average: number;
  position: number;
};

export default function PrincipalPage() {
  const [arms, setArms] = useState<ClassArm[]>([]);
  const [terms, setTerms] = useState<PortalTerm[]>([]);
  const [armId, setArmId] = useState<number | "">("");
  const [termId, setTermId] = useState<number | "">("");
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      apiJson<{ results?: ClassArm[] } | ClassArm[]>("/api/class-arms/"),
      loadActiveSessionTerms(),
    ])
      .then(([a, termsList]) => {
        const armsList = Array.isArray(a) ? a : a.results ?? [];
        setArms(armsList);
        setTerms(termsList);
        if (armsList[0]) setArmId(armsList[0].id);
        const active = termsList.find((x) => x.is_active) ?? termsList[0];
        if (active) setTermId(active.id);
      })
      .catch((e) => setError(e.message));
  }, []);

  const loadResults = useCallback(async () => {
    if (!armId || !termId) return;
    setError("");
    try {
      const data = await apiJson<ResultRow[]>(
        `/api/scores/class_results/?term=${termId}&class_arm=${armId}`,
      );
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load results");
    }
  }, [armId, termId]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  async function publish() {
    if (!armId || !termId) return;
    setMessage("");
    setError("");
    try {
      const res = await apiJson<{ published_count: number }>("/api/scores/publish/", {
        method: "POST",
        body: JSON.stringify({ term: termId, class_arm: armId }),
      });
      setMessage(`Published ${res.published_count} score rows. Guardians notified.`);
      loadResults();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          Principal
        </p>
        <h1 className="font-display text-4xl text-[var(--brand-green)]">
          Academic oversight
        </h1>
        <p className="mt-2 text-[var(--ink-soft)]">
          View and publish results for every class. Vice Principals share this
          visibility in view-only mode.
        </p>
      </header>

      {message ? (
        <p className="bg-[rgba(20,80,163,0.08)] px-4 py-3 text-sm text-[var(--brand-green)]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <select
          className="field-input"
          value={armId}
          onChange={(e) => setArmId(Number(e.target.value))}
        >
          {arms.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
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
        <button type="button" className="btn-primary" onClick={publish}>
          Publish class results
        </button>
      </div>

      <div className="overflow-x-auto border border-[var(--line)] bg-white/80">
        <table className="min-w-full text-sm">
          <thead className="bg-[rgba(20,80,163,0.06)] text-left">
            <tr>
              <th className="px-3 py-2">Pos</th>
              <th className="px-3 py-2">Student</th>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Average</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.student_id} className="border-t border-[var(--line)]">
                <td className="px-3 py-2">{r.position}</td>
                <td className="px-3 py-2">{r.student_name}</td>
                <td className="px-3 py-2">{r.student_code}</td>
                <td className="px-3 py-2">{Number(r.total).toFixed(1)}</td>
                <td className="px-3 py-2">{Number(r.average).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-[var(--muted)]">No scores for this class yet.</p>
        ) : null}
      </div>

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
