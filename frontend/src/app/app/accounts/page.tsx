"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiJson, errorFromUnknown } from "@/lib/api";
import { loadClassLevels } from "@/lib/classLevels";
import type { ClassLevelNav } from "@/lib/portalNav";

type Tab = "structures" | "bills" | "debtors";

type Session = { id: number; name: string; is_active: boolean };
type Term = {
  id: number;
  name: string;
  number: number;
  session: number;
  is_active: boolean;
};

type FeeStructure = {
  id: number;
  name: string;
  session: number;
  session_name: string;
  term: number;
  term_name: string;
  class_level: number;
  class_level_name: string;
  amount: string;
  description: string;
  is_active: boolean;
};

type Payment = {
  id: number;
  amount: string;
  method: string;
  reference: string;
  note: string;
  recorded_at: string;
};

type FeeRecord = {
  id: number;
  student: number;
  student_name: string;
  student_code: string;
  term: number;
  term_name: string;
  class_level_name: string;
  class_arm_name: string;
  fee_structure: number | null;
  amount_due: string;
  amount_paid: string;
  balance: string;
  status: string;
  results_unlocked: boolean;
  notes: string;
  payments: Payment[];
};

type GenerateResult = {
  created: number;
  updated: number;
  skipped: number;
  total_students: number;
};

function unwrapList<T>(data: { results?: T[] } | T[]): T[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

function naira(value: string | number) {
  return `₦${Number(value).toLocaleString()}`;
}

export default function AccountsPage() {
  const [tab, setTab] = useState<Tab>("structures");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [levels, setLevels] = useState<ClassLevelNav[]>([]);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [records, setRecords] = useState<FeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Structure form
  const [structureName, setStructureName] = useState("Tuition");
  const [structureSession, setStructureSession] = useState<number | "">("");
  const [structureTerm, setStructureTerm] = useState<number | "">("");
  const [structureLevel, setStructureLevel] = useState<number | "">("");
  const [structureAmount, setStructureAmount] = useState("");
  const [editingStructureId, setEditingStructureId] = useState<number | null>(
    null,
  );
  const [generatingId, setGeneratingId] = useState<number | null>(null);

  // Bills filters
  const [filterTerm, setFilterTerm] = useState<number | "">("");
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");

  // Expanded bill panels
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [adjustDue, setAdjustDue] = useState<Record<number, string>>({});
  const [adjustNotes, setAdjustNotes] = useState<Record<number, string>>({});

  const structureTerms = useMemo(
    () =>
      structureSession
        ? terms.filter((t) => t.session === structureSession)
        : terms,
    [terms, structureSession],
  );

  const loadMeta = useCallback(async () => {
    const [sessionData, termData, levelList] = await Promise.all([
      apiJson<{ results?: Session[] } | Session[]>("/api/sessions/?page_size=100"),
      apiJson<{ results?: Term[] } | Term[]>("/api/terms/?page_size=100"),
      loadClassLevels(),
    ]);
    const sessionList = unwrapList(sessionData);
    const termList = unwrapList(termData);
    setSessions(sessionList);
    setTerms(termList);
    setLevels(levelList);
    const activeSession =
      sessionList.find((s) => s.is_active) ?? sessionList[0];
    if (activeSession && structureSession === "") {
      setStructureSession(activeSession.id);
    }
    const activeTerm = termList.find((t) => t.is_active) ?? termList[0];
    if (activeTerm) {
      if (structureTerm === "") setStructureTerm(activeTerm.id);
      if (filterTerm === "") setFilterTerm(activeTerm.id);
    }
  }, [structureSession, structureTerm, filterTerm]);

  const loadStructures = useCallback(async () => {
    const data = await apiJson<{ results?: FeeStructure[] } | FeeStructure[]>(
      "/api/fee-structures/?page_size=200",
    );
    setStructures(unwrapList(data));
  }, []);

  const loadRecords = useCallback(async () => {
    const params = new URLSearchParams({ page_size: "500" });
    if (filterTerm) params.set("term", String(filterTerm));
    if (filterStatus) params.set("status", filterStatus);
    if (search.trim()) params.set("search", search.trim());
    const data = await apiJson<{ results?: FeeRecord[] } | FeeRecord[]>(
      `/api/fee-records/?${params.toString()}`,
    );
    setRecords(unwrapList(data));
  }, [filterTerm, filterStatus, search]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await loadMeta();
      await Promise.all([loadStructures(), loadRecords()]);
    } catch (e) {
      setError(errorFromUnknown(e, "Failed to load accounts data"));
    } finally {
      setLoading(false);
    }
  }, [loadMeta, loadStructures, loadRecords]);

  useEffect(() => {
    refreshAll();
    // Intentionally once on mount; filters reload via loadRecords effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;
    loadRecords().catch((e) =>
      setError(errorFromUnknown(e, "Failed to load fee records")),
    );
  }, [filterTerm, filterStatus, search, loadRecords, loading]);

  const debtors = useMemo(() => {
    return records
      .filter((r) => r.status === "unpaid" || r.status === "partial")
      .slice()
      .sort((a, b) => Number(b.balance) - Number(a.balance));
  }, [records]);

  const debtorTotal = useMemo(
    () => debtors.reduce((sum, r) => sum + Number(r.balance), 0),
    [debtors],
  );

  async function saveStructure(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (!structureSession || !structureTerm || !structureLevel || !structureAmount) {
      setError("Session, term, class level, and amount are required.");
      return;
    }
    const body = {
      name: structureName.trim() || "Tuition",
      session: structureSession,
      term: structureTerm,
      class_level: structureLevel,
      amount: structureAmount,
      is_active: true,
    };
    try {
      if (editingStructureId) {
        await apiJson(`/api/fee-structures/${editingStructureId}/`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        setMessage("Fee structure updated.");
      } else {
        await apiJson("/api/fee-structures/", {
          method: "POST",
          body: JSON.stringify(body),
        });
        setMessage("Fee structure created.");
      }
      setEditingStructureId(null);
      setStructureAmount("");
      await loadStructures();
    } catch (e) {
      setError(errorFromUnknown(e, "Could not save fee structure"));
    }
  }

  function startEditStructure(s: FeeStructure) {
    setEditingStructureId(s.id);
    setStructureName(s.name);
    setStructureSession(s.session);
    setStructureTerm(s.term);
    setStructureLevel(s.class_level);
    setStructureAmount(s.amount);
    setTab("structures");
  }

  async function generateBills(structureId: number) {
    setGeneratingId(structureId);
    setMessage("");
    setError("");
    try {
      const result = await apiJson<GenerateResult>(
        `/api/fee-structures/${structureId}/generate-bills/`,
        { method: "POST", body: "{}" },
      );
      setMessage(
        `Bills generated: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped (${result.total_students} students).`,
      );
      await loadRecords();
      setTab("bills");
    } catch (e) {
      setError(errorFromUnknown(e, "Bill generation failed"));
    } finally {
      setGeneratingId(null);
    }
  }

  async function saveAdjustment(record: FeeRecord) {
    setMessage("");
    setError("");
    const amount_due = adjustDue[record.id] ?? record.amount_due;
    const notes = adjustNotes[record.id] ?? record.notes ?? "";
    try {
      await apiJson(`/api/fee-records/${record.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ amount_due, notes }),
      });
      setMessage(`Adjusted bill for ${record.student_code}.`);
      await loadRecords();
    } catch (e) {
      setError(errorFromUnknown(e, "Adjustment failed"));
    }
  }

  async function recordPayment(event: FormEvent<HTMLFormElement>, record: FeeRecord) {
    event.preventDefault();
    setMessage("");
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await apiJson(`/api/fee-records/${record.id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          payment: {
            amount: Number(data.get("amount")),
            method: data.get("method"),
            reference: data.get("reference") || "",
            note: data.get("note") || "",
          },
        }),
      });
      setMessage(`Payment recorded for ${record.student_code}.`);
      event.currentTarget.reset();
      await loadRecords();
    } catch (e) {
      setError(errorFromUnknown(e, "Payment failed"));
    }
  }

  async function unlockResults(record: FeeRecord) {
    setMessage("");
    setError("");
    try {
      await apiJson(`/api/fee-records/${record.id}/unlock-results/`, {
        method: "POST",
        body: "{}",
      });
      setMessage(`Results unlocked for ${record.student_code}.`);
      await loadRecords();
    } catch (e) {
      setError(errorFromUnknown(e, "Unlock failed"));
    }
  }

  function toggleExpand(record: FeeRecord) {
    if (expandedId === record.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(record.id);
    setAdjustDue((prev) => ({ ...prev, [record.id]: record.amount_due }));
    setAdjustNotes((prev) => ({ ...prev, [record.id]: record.notes || "" }));
  }

  function renderBillCard(record: FeeRecord) {
    const open = expandedId === record.id;
    return (
      <article
        key={record.id}
        className="border border-[var(--line)] bg-white/80 p-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-medium text-[var(--brand-green)]">
              {record.student_name}
            </h3>
            <p className="text-sm text-[var(--muted)]">
              {record.student_code}
              {record.class_level_name
                ? ` · ${record.class_level_name}${record.class_arm_name ? ` ${record.class_arm_name}` : ""}`
                : ""}
              {record.term_name ? ` · ${record.term_name}` : ""}
            </p>
            <p className="mt-1 text-sm">
              Due {naira(record.amount_due)} · Paid {naira(record.amount_paid)} ·
              Balance <strong>{naira(record.balance)}</strong>
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="text-xs uppercase tracking-wide text-[var(--muted)]">
              {record.status}
              {record.results_unlocked ? " · results unlocked" : ""}
            </span>
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => toggleExpand(record)}
            >
              {open ? "Hide" : "Manage"}
            </button>
          </div>
        </div>

        {open ? (
          <div className="mt-4 space-y-4 border-t border-[var(--line)] pt-4">
            <div className="grid gap-2 md:grid-cols-3">
              <label className="text-sm">
                <span className="mb-1 block text-[var(--muted)]">Amount due</span>
                <input
                  className="field-input w-full"
                  type="number"
                  min="0"
                  step="0.01"
                  value={adjustDue[record.id] ?? record.amount_due}
                  onChange={(e) =>
                    setAdjustDue((prev) => ({
                      ...prev,
                      [record.id]: e.target.value,
                    }))
                  }
                />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block text-[var(--muted)]">
                  Notes (discount / extra)
                </span>
                <input
                  className="field-input w-full"
                  value={adjustNotes[record.id] ?? record.notes ?? ""}
                  onChange={(e) =>
                    setAdjustNotes((prev) => ({
                      ...prev,
                      [record.id]: e.target.value,
                    }))
                  }
                  placeholder="e.g. Sibling discount ₦10,000"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary"
                onClick={() => saveAdjustment(record)}
              >
                Save adjustment
              </button>
              {!record.results_unlocked ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => unlockResults(record)}
                >
                  Unlock results
                </button>
              ) : null}
            </div>

            <form
              onSubmit={(e) => recordPayment(e, record)}
              className="grid gap-2 md:grid-cols-5"
            >
              <input
                name="amount"
                type="number"
                min="1"
                step="0.01"
                required
                placeholder="Payment amount"
                className="field-input"
              />
              <select name="method" className="field-input" defaultValue="transfer">
                <option value="cash">Cash</option>
                <option value="transfer">Bank Transfer</option>
                <option value="pos">POS</option>
                <option value="other">Other</option>
              </select>
              <input
                name="reference"
                placeholder="Reference"
                className="field-input"
              />
              <input name="note" placeholder="Note" className="field-input" />
              <button type="submit" className="btn-primary">
                Record payment
              </button>
            </form>

            {(record.payments?.length ?? 0) > 0 ? (
              <div>
                <h4 className="text-sm font-medium text-[var(--brand-green)]">
                  Payment history
                </h4>
                <ul className="mt-2 space-y-1 text-sm">
                  {record.payments.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap justify-between gap-2 border-b border-[var(--line)] py-1"
                    >
                      <span>
                        {naira(p.amount)} · {p.method}
                        {p.reference ? ` · ${p.reference}` : ""}
                        {p.note ? ` — ${p.note}` : ""}
                      </span>
                      <span className="text-[var(--muted)]">
                        {p.recorded_at
                          ? new Date(p.recorded_at).toLocaleString()
                          : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">No payments yet.</p>
            )}
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          Accounts
        </p>
        <h1 className="font-display text-4xl text-[var(--brand-green)]">
          Bursary
        </h1>
        <p className="mt-2 max-w-2xl text-[var(--ink-soft)]">
          Set fee structures, generate student bills, record offline payments,
          and unlock results when a term is paid (or manually when needed).
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["structures", "Fee structures"],
            ["bills", "Student bills"],
            ["debtors", "Debtors"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "btn-primary" : "btn-secondary"}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {message ? (
        <p className="bg-[rgba(20,80,163,0.08)] px-4 py-3 text-sm text-[var(--brand-green)]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}
      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : null}

      {tab === "structures" ? (
        <div className="space-y-6">
          <form
            onSubmit={saveStructure}
            className="grid gap-3 border border-[var(--line)] bg-white/80 p-5 md:grid-cols-2"
          >
            <h2 className="font-display text-2xl text-[var(--brand-green)] md:col-span-2">
              {editingStructureId ? "Edit fee structure" : "New fee structure"}
            </h2>
            <label className="text-sm">
              <span className="mb-1 block text-[var(--muted)]">Name</span>
              <input
                className="field-input w-full"
                value={structureName}
                onChange={(e) => setStructureName(e.target.value)}
                required
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-[var(--muted)]">Amount</span>
              <input
                className="field-input w-full"
                type="number"
                min="0"
                step="0.01"
                value={structureAmount}
                onChange={(e) => setStructureAmount(e.target.value)}
                required
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-[var(--muted)]">Session</span>
              <select
                className="field-input w-full"
                value={structureSession}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setStructureSession(id);
                  const first = terms.find((t) => t.session === id);
                  if (first) setStructureTerm(first.id);
                }}
                required
              >
                <option value="">Select session</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-[var(--muted)]">Term</span>
              <select
                className="field-input w-full"
                value={structureTerm}
                onChange={(e) => setStructureTerm(Number(e.target.value))}
                required
              >
                <option value="">Select term</option>
                {structureTerms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm md:col-span-2">
              <span className="mb-1 block text-[var(--muted)]">Class level</span>
              <select
                className="field-input w-full"
                value={structureLevel}
                onChange={(e) => setStructureLevel(Number(e.target.value))}
                required
              >
                <option value="">Select class level</option>
                {levels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <button type="submit" className="btn-primary">
                {editingStructureId ? "Update structure" : "Create structure"}
              </button>
              {editingStructureId ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setEditingStructureId(null);
                    setStructureAmount("");
                    setStructureName("Tuition");
                  }}
                >
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>

          <section className="space-y-3">
            <h2 className="font-display text-2xl text-[var(--brand-green)]">
              Existing structures
            </h2>
            {structures.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No fee structures yet.</p>
            ) : (
              structures.map((s) => (
                <article
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 border border-[var(--line)] bg-white/80 p-4"
                >
                  <div>
                    <h3 className="font-medium text-[var(--brand-green)]">
                      {s.name} — {naira(s.amount)}
                    </h3>
                    <p className="text-sm text-[var(--muted)]">
                      {s.session_name} · {s.term_name} · {s.class_level_name}
                      {!s.is_active ? " · inactive" : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => startEditStructure(s)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={generatingId === s.id}
                      onClick={() => generateBills(s.id)}
                    >
                      {generatingId === s.id ? "Generating…" : "Generate bills"}
                    </button>
                  </div>
                </article>
              ))
            )}
          </section>
        </div>
      ) : null}

      {tab === "bills" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <select
              className="field-input"
              value={filterTerm}
              onChange={(e) =>
                setFilterTerm(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">All terms</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select
              className="field-input"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </select>
            <input
              className="field-input min-w-[14rem] flex-1"
              placeholder="Search student name or ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {records.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No fee records. Create a structure and generate bills.
            </p>
          ) : (
            records.map(renderBillCard)
          )}
        </div>
      ) : null}

      {tab === "debtors" ? (
        <div className="space-y-4">
          <div className="border border-[var(--line)] bg-white/80 p-4">
            <p className="text-sm text-[var(--muted)]">Outstanding total</p>
            <p className="font-display text-3xl text-[var(--brand-green)]">
              {naira(debtorTotal)}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {debtors.length} student{debtors.length === 1 ? "" : "s"} with unpaid
              or partial balances
              {filterTerm
                ? ` (filtered to ${terms.find((t) => t.id === filterTerm)?.name ?? "term"})`
                : ""}
              .
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              className="field-input"
              value={filterTerm}
              onChange={(e) =>
                setFilterTerm(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">All terms</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <input
              className="field-input min-w-[14rem] flex-1"
              placeholder="Search student name or ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {debtors.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No debtors for this filter.</p>
          ) : (
            debtors.map(renderBillCard)
          )}
        </div>
      ) : null}

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
