"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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

function playBeep(ok: boolean) {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = ok ? 880 : 220;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.12 : 0.25));
    window.setTimeout(() => void ctx.close(), 400);
  } catch {
    /* ignore audio failures */
  }
}

export default function GateScannerPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [scanCode, setScanCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ClockInResult | null>(null);
  const [flash, setFlash] = useState<"ok" | "warn" | "err" | null>(null);
  const [useCamera, setUseCamera] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const busyRef = useRef(false);

  const isStaff =
    user?.account_type === "admin" ||
    user?.account_type === "principal" ||
    user?.account_type === "teacher";

  const focusScanner = useCallback(() => {
    if (useCamera) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [useCamera]);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  useEffect(() => {
    if (!isStaff || useCamera) return;
    focusScanner();
    const onFocus = () => focusScanner();
    const onVisibility = () => {
      if (document.visibilityState === "visible") focusScanner();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    const tick = window.setInterval(focusScanner, 4000);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(tick);
    };
  }, [isStaff, useCamera, focusScanner]);

  const submitCode = useCallback(async (code: string) => {
    const cleaned = code.trim().toUpperCase();
    if (!cleaned || busyRef.current) return;
    const now = Date.now();
    if (
      lastScanRef.current.code === cleaned &&
      now - lastScanRef.current.at < 2500
    ) {
      setScanCode("");
      focusScanner();
      return;
    }
    lastScanRef.current = { code: cleaned, at: now };
    busyRef.current = true;
    setPending(true);
    setError("");
    setFlash(null);
    try {
      const data = await apiJson<ClockInResult>("/api/attendance/clock_in/", {
        method: "POST",
        body: JSON.stringify({ student_code: cleaned }),
      });
      setResult(data);
      setFlash(data.already_marked ? "warn" : "ok");
      playBeep(true);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "Clock-in failed");
      setFlash("err");
      playBeep(false);
    } finally {
      setPending(false);
      busyRef.current = false;
      setScanCode("");
      window.setTimeout(() => focusScanner(), 50);
    }
  }, [focusScanner]);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 1800);
    return () => window.clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    if (!isStaff || !useCamera) {
      setScanning(false);
      setCameraError("");
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => undefined);
      }
      return;
    }

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
        if (!cancelled) {
          setScanning(true);
          setCameraError("");
        }
      } catch (e) {
        if (!cancelled) {
          setCameraError(
            e instanceof Error
              ? e.message
              : "Camera unavailable — use the USB scanner instead.",
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
  }, [isStaff, useCamera, submitCode]);

  function onScanSubmit(e: FormEvent) {
    e.preventDefault();
    void submitCode(scanCode);
  }

  if (!user) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  if (!isStaff) {
    return (
      <div className="mx-auto max-w-lg">
        <p className="text-sm text-[var(--muted)]">
          Gate scanner is for staff only.
        </p>
        <Link
          href="/app/attendance"
          className="mt-4 inline-block text-[var(--brand-blue)]"
        >
          Back to attendance
        </Link>
      </div>
    );
  }

  const flashClass =
    flash === "ok"
      ? "ring-4 ring-emerald-400"
      : flash === "warn"
        ? "ring-4 ring-amber-400"
        : flash === "err"
          ? "ring-4 ring-rose-400"
          : "";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-[var(--brand-blue-deep)]">
            Automatic clock-in
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Scan the student ID card with the USB QR/barcode reader.
          </p>
        </div>
        <Link
          href="/app/attendance"
          className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
        >
          Class register
        </Link>
      </div>

      <section
        className={`mt-6 rounded-2xl border border-[var(--line)] bg-white/90 p-6 transition ${flashClass}`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          USB scanner ready
        </p>
        <p className="mt-2 font-display text-2xl text-[var(--brand-blue-deep)]">
          Hold the ID card to the reader
        </p>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          Keep this page open. The scanner types the student ID and presses
          Enter — no camera needed.
        </p>

        <form onSubmit={onScanSubmit} className="mt-5">
          <label className="sr-only" htmlFor="gate-scanner-input">
            Student ID scan
          </label>
          <input
            id="gate-scanner-input"
            ref={inputRef}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="field-input w-full rounded-xl border-2 border-[var(--brand-blue)] bg-[var(--brand-blue-soft,#E8F0FB)] px-4 py-4 text-center font-mono text-2xl tracking-wider text-[var(--brand-blue-deep)] outline-none focus:border-[var(--brand-pink,#E85A8C)]"
            placeholder="Waiting for scan…"
            value={scanCode}
            onChange={(e) => setScanCode(e.target.value)}
            onBlur={() => {
              window.setTimeout(focusScanner, 30);
            }}
            disabled={pending || useCamera}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[var(--muted)]">
              {pending
                ? "Clocking in…"
                : useCamera
                  ? "Camera mode — USB input paused"
                  : "Input stays focused for the USB reader"}
            </p>
            <button
              type="submit"
              className="btn-outline text-sm"
              disabled={pending || !scanCode.trim() || useCamera}
            >
              Clock in
            </button>
          </div>
        </form>
      </section>

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
              : result.status === "late"
                ? "bg-orange-50 text-orange-950"
                : "bg-emerald-50 text-emerald-950"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
            {result.already_marked
              ? "Already marked"
              : result.status === "late"
                ? "Late"
                : "Clocked in"}
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
            Term totals — Present {result.days_present} · Absent{" "}
            {result.days_absent}
          </p>
        </div>
      ) : (
        <p className="mt-4 text-center text-sm text-[var(--muted)]">
          Last scan result will appear here.
        </p>
      )}

      <div className="mt-8 border-t border-[var(--line)] pt-5">
        <button
          type="button"
          className="btn-outline text-sm"
          onClick={() => setUseCamera((v) => !v)}
        >
          {useCamera ? "Use USB scanner instead" : "Use camera instead"}
        </button>

        {useCamera ? (
          <div className="mt-4">
            <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-black">
              <div id="gate-qr-reader" className="min-h-[280px] w-full" />
            </div>
            {scanning ? (
              <p className="mt-2 text-center text-xs text-emerald-700">
                Camera active
              </p>
            ) : null}
            {cameraError ? (
              <p className="mt-2 text-sm text-amber-800">{cameraError}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
