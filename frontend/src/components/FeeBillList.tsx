"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { apiJson } from "@/lib/api";

export type FeeBill = {
  id: number;
  student?: number;
  amount_due: string;
  amount_paid: string;
  balance?: string;
  status: string;
  results_unlocked: boolean;
  term_name?: string;
  paystack_enabled?: boolean;
  virtual_account_number?: string;
  virtual_account_bank?: string;
  virtual_account_name?: string;
};

type PayInit = {
  authorization_url?: string;
  access_code?: string;
  reference?: string;
};

declare global {
  interface Window {
    PaystackPop?: new () => {
      resumeTransaction: (accessCode: string) => void;
    };
  }
}

function naira(value: string | number) {
  return Number(value).toLocaleString();
}

function balanceOf(bill: FeeBill) {
  if (bill.balance != null) return Number(bill.balance);
  return Number(bill.amount_due) - Number(bill.amount_paid);
}

function loadPaystack(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.PaystackPop) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v2/inline.js";
    script.async = true;
    script.onload = () => resolve(Boolean(window.PaystackPop));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

async function startCheckout(billId: number) {
  const data = await apiJson<PayInit>(`/api/fee-records/${billId}/pay/`, {
    method: "POST",
    body: "{}",
  });
  if (data.access_code) {
    const ready = await loadPaystack();
    if (ready && window.PaystackPop) {
      const popup = new window.PaystackPop();
      popup.resumeTransaction(data.access_code);
      return;
    }
  }
  if (data.authorization_url) {
    window.location.href = data.authorization_url;
    return;
  }
  throw new Error("Paystack checkout is unavailable.");
}

export function FeeBillList({
  bills,
  onBillsChange,
  emptyLabel,
}: {
  bills: FeeBill[];
  onBillsChange: Dispatch<SetStateAction<FeeBill[]>>;
  emptyLabel: string;
}) {
  const [payingId, setPayingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const dvaTried = useRef<Set<number>>(new Set());
  const verifyTried = useRef(false);

  function replaceBill(updated: FeeBill) {
    onBillsChange((prev) => {
      if (prev.some((row) => row.id === updated.id)) {
        return prev.map((row) =>
          row.id === updated.id ? { ...row, ...updated } : row,
        );
      }
      return prev.length ? prev : [updated];
    });
  }

  useEffect(() => {
    if (verifyTried.current || bills.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") || params.get("trxref");
    if (!reference) {
      verifyTried.current = true;
      return;
    }
    verifyTried.current = true;
    apiJson<FeeBill>("/api/fee-records/verify-paystack/", {
      method: "POST",
      body: JSON.stringify({ reference }),
    })
      .then((updated) => {
        replaceBill(updated);
        setMessage("Payment received. Fee status updated.");
        params.delete("reference");
        params.delete("trxref");
        const next = params.toString();
        window.history.replaceState(
          {},
          "",
          `${window.location.pathname}${next ? `?${next}` : ""}`,
        );
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not confirm payment."),
      );
  }, [bills.length]);

  useEffect(() => {
    const row = bills.find((bill) => {
      if (!bill.paystack_enabled || bill.virtual_account_number) return false;
      const key = bill.student ?? bill.id;
      return !dvaTried.current.has(key);
    });
    if (!row) return;
    const key = row.student ?? row.id;
    dvaTried.current.add(key);
    apiJson<FeeBill>(`/api/fee-records/${row.id}/virtual-account/`, {
      method: "POST",
      body: "{}",
    })
      .then((updated) => {
        onBillsChange((prev) =>
          prev.map((bill) => {
            if (bill.student && updated.student && bill.student === updated.student) {
              return {
                ...bill,
                virtual_account_number: updated.virtual_account_number,
                virtual_account_bank: updated.virtual_account_bank,
                virtual_account_name: updated.virtual_account_name,
                paystack_enabled: updated.paystack_enabled,
              };
            }
            if (bill.id === updated.id) return { ...bill, ...updated };
            return bill;
          }),
        );
      })
      .catch(() => undefined);
  }, [bills, onBillsChange]);

  async function pay(bill: FeeBill) {
    setError("");
    setMessage("");
    setPayingId(bill.id);
    try {
      await startCheckout(bill.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setPayingId(null);
    }
  }

  const transferAccount = bills.find((bill) => bill.virtual_account_number);

  return (
    <div>
      {error ? (
        <p className="mb-3 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}
      {message ? (
        <p className="mb-3 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>
      ) : null}
      {transferAccount?.virtual_account_number ? (
        <p className="mb-3 text-sm text-[var(--ink-soft)]">
          Or transfer to{" "}
          <strong>{transferAccount.virtual_account_bank || "the school account"}</strong>
          {" · "}
          {transferAccount.virtual_account_number}
          {transferAccount.virtual_account_name
            ? ` · ${transferAccount.virtual_account_name}`
            : ""}
          . Incoming transfers credit this child automatically.
        </p>
      ) : null}
      <ul className="mt-3 space-y-2 text-sm">
        {bills.map((bill) => {
          const balance = balanceOf(bill);
          const canPay = Boolean(bill.paystack_enabled) && balance > 0;
          return (
            <li
              key={bill.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] py-2"
            >
              <span>
                {bill.term_name ? `${bill.term_name} · ` : ""}
                Due ₦{naira(bill.amount_due)} · Paid ₦{naira(bill.amount_paid)} ·
                Balance ₦{naira(balance)}
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <span className="uppercase text-[var(--muted)]">
                  {bill.status}
                  {bill.results_unlocked ? " · unlocked" : " · locked"}
                </span>
                {canPay ? (
                  <button
                    type="button"
                    className="btn-primary text-sm"
                    disabled={payingId === bill.id}
                    onClick={() => pay(bill)}
                  >
                    {payingId === bill.id
                      ? "Opening…"
                      : `Pay ₦${naira(balance)}`}
                  </button>
                ) : null}
              </span>
            </li>
          );
        })}
        {bills.length === 0 ? (
          <li className="text-[var(--muted)]">{emptyLabel}</li>
        ) : null}
      </ul>
    </div>
  );
}
