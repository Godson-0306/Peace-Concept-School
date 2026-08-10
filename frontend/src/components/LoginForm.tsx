"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { dashboardPathFor, normalizeAccountType, storeUser } from "@/lib/auth";

type Portal = "student" | "staff";
type Status = { type: "error"; message: string } | null;

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const data = payload as Record<string, unknown>;
  if (typeof data.detail === "string") return data.detail;
  if (typeof data.message === "string") return data.message;
  if (Array.isArray(data.non_field_errors) && data.non_field_errors[0]) {
    return String(data.non_field_errors[0]);
  }
  for (const value of Object.values(data)) {
    if (Array.isArray(value) && value[0]) return String(value[0]);
    if (typeof value === "string") return value;
  }
  return fallback;
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [portal, setPortal] = useState<Portal>("student");
  const [status, setStatus] = useState<Status>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus(null);

    const data = new FormData(event.currentTarget);
    const identifier = String(data.get("identifier") ?? "").trim();
    const password = String(data.get("password") ?? "");

    try {
      const response = await apiFetch("/api/auth/login/", {
        method: "POST",
        body: JSON.stringify({ portal, identifier, password }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          extractErrorMessage(
            payload,
            portal === "student"
              ? "Invalid Student ID or password. Please try again."
              : "Invalid username or password. Please try again.",
          ),
        );
      }

      const userPayload = payload.user ?? payload;
      const accountType = normalizeAccountType(userPayload.account_type);

      storeUser({
        id: userPayload.id,
        email: userPayload.email ?? identifier,
        full_name: userPayload.full_name,
        account_type: accountType,
      });

      const next = searchParams.get("next");
      const destination =
        next && next.startsWith("/app") ? next : dashboardPathFor(accountType);

      router.replace(destination);
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to sign in. Please try again.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form method="post" action="#" onSubmit={onSubmit} className="space-y-5">
      <div
        className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--mist)] p-1"
        role="tablist"
        aria-label="Sign-in type"
      >
        {(
          [
            { id: "student", label: "Student" },
            { id: "staff", label: "Staff" },
          ] as const
        ).map((tab) => {
          const active = portal === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setPortal(tab.id);
                setStatus(null);
              }}
              className={`rounded-lg px-3 py-2.5 text-sm font-bold transition-all duration-200 ${
                active
                  ? tab.id === "student"
                    ? "bg-[var(--brand-pink)] text-white shadow-sm"
                    : "bg-[var(--brand-blue)] text-white shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <p className="text-sm leading-relaxed text-[var(--muted)]">
        {portal === "student"
          ? "Sign in with your Student ID and password issued by the school."
          : "Sign in with the username and password created when your staff account was registered."}
      </p>

      <div className="field" key={`${portal}-identifier`}>
        <label htmlFor="login-identifier">
          {portal === "student" ? "Student ID" : "Username"}
        </label>
        <input
          id="login-identifier"
          name="identifier"
          type="text"
          required
          autoComplete="username"
          autoCapitalize={portal === "student" ? "characters" : "none"}
          autoCorrect="off"
          spellCheck={false}
          placeholder={portal === "student" ? "e.g. PCS025001" : "e.g. teacher1"}
        />
      </div>

      <div className="field">
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>

      {status ? (
        <p className="form-status error" role="alert">
          {status.message}
        </p>
      ) : null}

      <button
        type="submit"
        className={`inline-flex w-full items-center justify-center rounded-[0.75rem] px-5 py-3 text-sm font-bold text-white transition disabled:opacity-60 ${
          portal === "student"
            ? "bg-[var(--brand-pink)] hover:brightness-105"
            : "bg-[var(--brand-blue)] hover:brightness-105"
        }`}
        disabled={pending}
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
