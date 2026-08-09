"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { dashboardPathFor, normalizeAccountType, storeUser } from "@/lib/auth";

type Status = { type: "error"; message: string } | null;

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus(null);

    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");

    try {
      const response = await apiFetch("/api/auth/login/", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload?.detail ||
            payload?.message ||
            "Invalid email or password. Please try again.",
        );
      }

      const accountType = normalizeAccountType(
        payload.account_type ?? payload.user?.account_type,
      );

      storeUser({
        id: payload.id ?? payload.user?.id,
        email: payload.email ?? payload.user?.email ?? email,
        full_name: payload.full_name ?? payload.user?.full_name,
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
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="field">
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          name="email"
          type="email"
          required
          autoComplete="email"
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

      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
