"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiJson, errorFromUnknown } from "@/lib/api";

type Tab = "structures" | "bills" | "debtors";

type Session = { id: number; name: string; is_active: boolean; start_year?: number };
type Term = {
  id: number;
  name: string;
  number: number;
  session: number;
  is_active: boolean;
};

type FeeSection =
  | "day_care"
  | "nursery"
  | "primary"
  | "jss"
  | "ss";

type FeeStructure = {
  id: number;
  session: number;
  session_name: string;
  section: FeeSection;
  section_label: string;
  student_type: "new" | "returning";
  student_type_label: string;
  amount: string;
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
  fee_section?: string;
  fee_student_type?: string;
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
  missing_structure?: number;
  total_students: number;
};

const FEE_SECTIONS: { key: FeeSection; label: string; hint: string }[] = [
  { key: "day_care", label: "Day Care", hint: "Day Care only" },
  { key: "nursery", label: "Nursery", hint: "Nursery 1–2" },
  { key: "primary", label: "Primary", hint: "Basic 1–5" },
  { key: "jss", label: "JSS", hint: "JSS1–3" },
  { key: "ss", label: "SS", hint: "SS1–3" },
];

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
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [records, setRecords] = useState<FeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [savingFees, setSavingFees] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [feeSession, setFeeSession] = useState<number | "">("");
  const [generateTerm, setGenerateTerm] = useState<number | "">("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const [filterTerm, setFilterTerm] = useState<number | "">("");
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [adjustDue, setAdjustDue] = useState<Record<number, string>>({});
  const [adjustNotes, setAdjustNotes] = useState<Record<number, string>>({});

  const sessionTerms = useMemo(
    () => (feeSession ? terms.filter((t) => t.session === feeSession) : terms),
    [terms, feeSession],
  );

  const amountKey = (section: FeeSection, studentType: "new" | "returning") =>
    `${section}:${studentType}`;

  const syncAmountsFromStructures = useCallback((rows: FeeStructure[]) => {
    const next: Record<string, string> = {};
    for (const section of FEE_SECTIONS) {
      for (const studentType of ["new", "returning"] as const) {
        const row = rows.find(
          (r) => r.section === section.key && r.student_type === studentType,
        );
        next[amountKey(section.key, studentType)] = row?.amount ?? "0";
      }
    }
    setAmounts(next);
  }, []);

  const loadStructuresForSession = useCallback(
    async (sessionId: number) => {
      const rows = await apiJson<FeeStructure[]>(
        "/api/fee-structures/ensure/",
        {
          method: "POST",
          body: JSON.stringify({ session: sessionId }),
        },
      );
      setStructures(rows);
      syncAmountsFromStructures(rows);
      return rows;
    },
    [syncAmountsFromStructures],
  );

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [sessionData, termData] = await Promise.all([
          apiJson<{ results?: Session[] } | Session[]>(
            "/api/sessions/?page_size=100",
          ),
          apiJson<{ results?: Term[] } | Term[]>("/api/terms/?page_size=100"),
        ]);
        if (cancelled) return;
        const sessionList = unwrapList(sessionData);
        const termList = unwrapList(termData);
        setSessions(sessionList);
        setTerms(termList);
        const activeSession =
          sessionList.find((s) => s.is_active) ?? sessionList[0];
        const activeTerm = termList.find((t) => t.is_active) ?? termList[0];
        if (activeTerm) {
          setFilterTerm(activeTerm.id);
          setGenerateTerm(activeTerm.id);
        }
        if (activeSession) {
          setFeeSession(activeSession.id);
          await loadStructuresForSession(activeSession.id);
          const termForSession =
            termList.find(
              (t) => t.session === activeSession.id && t.is_active,
            ) ?? termList.find((t) => t.session === activeSession.id);
          if (termForSession) {
            setGenerateTerm(termForSession.id);
            setFilterTerm(termForSession.id);
          }
        }
        await loadRecords();
      } catch (e) {
        if (!cancelled) {
          setError(errorFromUnknown(e, "Failed to load accounts data"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;
    loadRecords().catch((e) =>
      setError(errorFromUnknown(e, "Failed to load fee records")),
    );
  }, [filterTerm, filterStatus, search, loadRecords, loading]);

  async function onFeeSessionChange(sessionId: number) {
    setFeeSession(sessionId);
    setMessage("");
    setError("");
    try {
      await loadStructuresForSession(sessionId);
      const first = terms.find((t) => t.session === sessionId);
      if (first) setGenerateTerm(first.id);
    } catch (e) {
      setError(errorFromUnknown(e, "Failed to load fee schedule"));
    }
  }

  async function saveFeeSchedule(event: FormEvent) {
    event.preventDefault();
    if (!feeSession) return;
    setSavingFees(true);
    setMessage("");
    setError("");
    try {
      await Promise.all(
        structures.map((row) => {
          const key = amountKey(row.section, row.student_type);
          const amount = amounts[key] ?? row.amount;
          if (String(amount) === String(row.amount)) return Promise.resolve(null);
          return apiJson(`/api/fee-structures/${row.id}/`, {
            method: "PATCH",
            body: JSON.stringify({ amount }),
          });
        }),
      );
      await loadStructuresForSession(feeSession);
      setMessage("Fee schedule saved.");
    } catch (e) {
      setError(errorFromUnknown(e, "Could not save fee schedule"));
    } finally {
      setSavingFees(false);
    }
  }

  async function generateBills() {
    if (!generateTerm) {
      setError("Select a term to generate bills.");
      return;
    }
    setGenerating(true);
    setMessage("");
    setError("");
    try {
      const result = await apiJson<GenerateResult>(
        "/api/fee-structures/generate-bills/",
        {
          method: "POST",
          body: JSON.stringify({ term: generateTerm }),
        },
      );
      setMessage(
        `Bills generated: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped` +
          (result.missing_structure
            ? `, ${result.missing_structure} missing class/fee mapping`
            : "") +
          ` (${result.total_students} students).`,
      );
      await loadRecords();
      setTab("bills");
      setFilterTerm(generateTerm);
    } catch (e) {
      setError(errorFromUnknown(e, "Bill generation failed"));
    } finally {
      setGenerating(false);
    }
  }

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

  async function recordPayment(
    event: FormEvent<HTMLFormElement>,
    record: FeeRecord,
  ) {
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
              {record.fee_section
                ? ` · ${record.fee_section}${record.fee_student_type ? ` / ${record.fee_student_type}` : ""}`
                : ""}
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
              <select
                name="method"
                className="field-input"
                defaultValue="transfer"
              >
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
          Edit section fees for new and returning students, generate term bills,
          record offline payments, and unlock results when needed.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["structures", "Fee schedule"],
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
            onSubmit={saveFeeSchedule}
            className="space-y-4 border border-[var(--line)] bg-white/80 p-5"
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl text-[var(--brand-green)]">
                  Section fee schedule
                </h2>
                <p className="mt-1 text-sm text-[var(--ink-soft)]">
                  One amount per section for new students and returning students.
                  Update when rates change — then generate bills for a term.
                </p>
              </div>
              <label className="text-sm">
                <span className="mb-1 block text-[var(--muted)]">Session</span>
                <select
                  className="field-input"
                  value={feeSession}
                  onChange={(e) => onFeeSessionChange(Number(e.target.value))}
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--line)] text-left text-[var(--muted)]">
                    <th className="py-2 pr-4">Section</th>
                    <th className="py-2 pr-4">New students</th>
                    <th className="py-2">Returning students</th>
                  </tr>
                </thead>
                <tbody>
                  {FEE_SECTIONS.map((section) => (
                    <tr
                      key={section.key}
                      className="border-b border-[var(--line)]"
                    >
                      <td className="py-3 pr-4">
                        <div className="font-medium text-[var(--brand-green)]">
                          {section.label}
                        </div>
                        <div className="text-xs text-[var(--muted)]">
                          {section.hint}
                        </div>
                      </td>
                      {(["new", "returning"] as const).map((studentType) => {
                        const key = amountKey(section.key, studentType);
                        return (
                          <td key={studentType} className="py-3 pr-4 last:pr-0">
                            <input
                              className="field-input w-full max-w-[12rem]"
                              type="number"
                              min="0"
                              step="0.01"
                              value={amounts[key] ?? "0"}
                              onChange={(e) =>
                                setAmounts((prev) => ({
                                  ...prev,
                                  [key]: e.target.value,
                                }))
                              }
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-[var(--muted)]">
              New vs returning is based on admission year matching the session
              start year (e.g. admitted in 2025 for session 2025/2026 = new).
            </p>

            <button
              type="submit"
              className="btn-primary"
              disabled={savingFees || !feeSession}
            >
              {savingFees ? "Saving…" : "Save fee schedule"}
            </button>
          </form>

          <section className="space-y-3 border border-[var(--line)] bg-white/80 p-5">
            <h2 className="font-display text-2xl text-[var(--brand-green)]">
              Generate term bills
            </h2>
            <p className="text-sm text-[var(--ink-soft)]">
              Creates or refreshes unpaid bills for every active student using
              their section and new/returning rate.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-[var(--muted)]">Term</span>
                <select
                  className="field-input"
                  value={generateTerm}
                  onChange={(e) => setGenerateTerm(Number(e.target.value))}
                >
                  {sessionTerms.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn-primary"
                disabled={generating || !generateTerm}
                onClick={generateBills}
              >
                {generating ? "Generating…" : "Generate bills"}
              </button>
            </div>
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
              No fee records. Save the fee schedule and generate bills for a
              term.
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
              {debtors.length} student{debtors.length === 1 ? "" : "s"} with
              unpaid or partial balances
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
            <p className="text-sm text-[var(--muted)]">
              No debtors for this filter.
            </p>
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
