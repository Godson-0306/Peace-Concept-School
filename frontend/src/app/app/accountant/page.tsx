"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiJson } from "@/lib/api";

type FeeRecord = {
  id: number;
  student: number;
  student_name: string;
  student_code: string;
  amount_due: string;
  amount_paid: string;
  status: string;
  results_unlocked: boolean;
  term: number;
};

type Inventory = { id: number; name: string; category: string };

export default function AccountantPage() {
  const [records, setRecords] = useState<FeeRecord[]>([]);
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [fees, inv] = await Promise.all([
        apiJson<{ results?: FeeRecord[] } | FeeRecord[]>("/api/fee-records/"),
        apiJson<{ results?: Inventory[] } | Inventory[]>("/api/inventories/"),
      ]);
      setRecords(Array.isArray(fees) ? fees : fees.results ?? []);
      setInventories(Array.isArray(inv) ? inv : inv.results ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load fees");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          Accountant
        </p>
        <h1 className="font-display text-4xl text-[var(--brand-green)]">
          Fee management
        </h1>
        <p className="mt-2 text-[var(--ink-soft)]">
          Record offline payments (cash, transfer, POS). No payment gateway —
          marking a term Paid unlocks that term&apos;s results for the student.
        </p>
      </header>

      {message ? (
        <p className="bg-[rgba(11,61,46,0.08)] px-4 py-3 text-sm text-[var(--brand-green)]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="space-y-4">
        {records.map((record) => (
          <article
            key={record.id}
            className="border border-[var(--line)] bg-white/80 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-medium text-[var(--brand-green)]">
                  {record.student_name}
                </h2>
                <p className="text-sm text-[var(--muted)]">
                  {record.student_code} · Due ₦
                  {Number(record.amount_due).toLocaleString()} · Paid ₦
                  {Number(record.amount_paid).toLocaleString()}
                </p>
              </div>
              <span className="text-xs uppercase tracking-wide text-[var(--muted)]">
                {record.status}
                {record.results_unlocked ? " · results unlocked" : ""}
              </span>
            </div>
            <form
              onSubmit={(e) => recordPayment(e, record)}
              className="mt-3 grid gap-2 md:grid-cols-4"
            >
              <input
                name="amount"
                type="number"
                min="1"
                step="0.01"
                required
                placeholder="Amount"
                className="field-input"
              />
              <select name="method" className="field-input" defaultValue="transfer">
                <option value="cash">Cash</option>
                <option value="transfer">Bank Transfer</option>
                <option value="pos">POS</option>
                <option value="other">Other</option>
              </select>
              <input name="reference" placeholder="Reference" className="field-input" />
              <button type="submit" className="btn-primary">
                Record payment
              </button>
            </form>
          </article>
        ))}
        {records.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No fee records yet.</p>
        ) : null}
      </div>

      <section className="border border-[var(--line)] bg-white/80 p-5">
        <h2 className="font-display text-2xl text-[var(--brand-green)]">
          Inventory oversight
        </h2>
        <ul className="mt-3 space-y-2 text-sm">
          {inventories.map((inv) => (
            <li key={inv.id} className="flex justify-between border-b border-[var(--line)] py-2">
              <span>{inv.name}</span>
              <span className="text-[var(--muted)]">{inv.category || "General"}</span>
            </li>
          ))}
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
