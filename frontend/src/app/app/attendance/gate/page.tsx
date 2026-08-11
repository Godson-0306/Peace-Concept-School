"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { apiJson } from "@/lib/api";
import { getStoredUser, type AuthUser } from "@/lib/auth";

type ClockInResult = {
  student: {
    id: number;
    student_id: string;
    full_name: string;
    class_arm: string;
  };
  status: string;
  already_marked: boolean;
  message: string;
  days_present: number;
  days_absent: number;
  date: string;
};

export default function GateScannerPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ClockInResult | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const busyRef = useRef(false);

  const isStaff =
    user?.account_type === "admin" ||
    user?.account_type === "principal" ||
    user?.account_type === "teacher";

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  async function submitCode(code: string) {
    const cleaned = code.trim().toUpperCase();
    if (!cleaned || busyRef.current) return;
    const now = Date.now();
    if (
      lastScanRef.current.code === cleaned &&
      now - lastScanRef.current.at < 2500
    ) {
      return;
    }
    lastScanRef.current = { code: cleaned, at: now };
    busyRef.current = true;
    setPending(true);
    setError("");
    try {
      const data = await apiJson<ClockInResult>("/api/attendance/clock_in/", {
        method: "POST",
        body: JSON.stringify({ student_code: cleaned }),
      });
      setResult(data);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "Clock-in failed");
    } finally {
      setPending(false);
      busyRef.current = false;
    }
  }

  useEffect(() => {
    if (!isStaff) return;
    let cancelled = false;
    const elementId = "gate-qr-reader";

    (async () => {
      try {
        const scanner = new Html5Qrcode(elementId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 8, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            void submitCode(decoded);
          },
          () => undefined,
        );
        if (!cancelled) setScanning(true);
      } catch (e) {
        if (!cancelled) {
          setCameraError(
            e instanceof Error
              ? e.message
              : "Camera unavailable — use manual ID entry.",
          );
          setScanning(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => undefined);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaff]);

  function onManual(e: FormEvent) {
    e.preventDefault();
    void submitCode(manualCode);
  }

  if (!user) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  if (!isStaff) {
    return (
      <div className="mx-auto max-w-lg">
        <p className="text-sm text-[var(--muted)]">Gate scanner is for staff only.</p>
        <Link href="/app/attendance" className="mt-4 inline-block text-[var(--brand-blue)]">
          Back to attendance
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-[var(--brand-blue-deep)]">
            Gate scanner
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Scan a student ID QR code to clock in for today.
          </p>
        </div>
        <Link
          href="/app/attendance"
          className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
        >
          Class register
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--line)] bg-black">
        <div id="gate-qr-reader" className="min-h-[280px] w-full" />
      </div>
      {scanning ? (
        <p className="mt-2 text-center text-xs text-emerald-700">Camera active</p>
      ) : null}
      {cameraError ? (
        <p className="mt-2 text-sm text-amber-800">{cameraError}</p>
      ) : null}

      <form onSubmit={onManual} className="mt-6 flex flex-wrap gap-2">
        <input
          className="field-input min-w-[12rem] flex-1 rounded-lg border border-[var(--line)] px-3 py-2.5 text-sm"
          placeholder="Manual student ID (e.g. PCS025047)"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Clocking in…" : "Clock in"}
        </button>
      </form>

      {error ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {result ? (
        <div
          className={`mt-4 rounded-2xl px-5 py-5 ${
            result.already_marked
              ? "bg-amber-50 text-amber-950"
              : "bg-emerald-50 text-emerald-950"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
            {result.already_marked ? "Already marked" : "Clocked in"}
          </p>
          <p className="mt-1 font-display text-3xl font-semibold">
            {result.student.full_name}
          </p>
          <p className="mt-1 text-sm">
            {result.student.student_id} · {result.student.class_arm}
          </p>
          <p className="mt-3 text-lg font-semibold capitalize">
            Status: {result.status}
          </p>
          <p className="mt-1 text-sm opacity-90">{result.message}</p>
          <p className="mt-2 text-xs opacity-70">
            Term totals — Present {result.days_present} · Absent {result.days_absent}
          </p>
        </div>
      ) : null}
    </div>
  );
}
