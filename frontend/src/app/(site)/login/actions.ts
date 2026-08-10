"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, USER_COOKIE, normalizeAccountType } from "@/lib/auth";

const API_ORIGIN = process.env.API_PROXY_ORIGIN ?? "http://127.0.0.1:8000";

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

async function forwardSetCookies(upstream: Response) {
  const jar = await cookies();
  const getSetCookie = (
    upstream.headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie?.();
  const list = getSetCookie?.length
    ? getSetCookie
    : (() => {
        const single = upstream.headers.get("set-cookie");
        return single ? [single] : [];
      })();

  for (const raw of list) {
    const parts = raw.split(";");
    const [nameValue, ...attrs] = parts;
    const eq = nameValue.indexOf("=");
    if (eq <= 0) continue;
    const name = nameValue.slice(0, eq).trim();
    const value = nameValue.slice(eq + 1).trim();
    if (!name) continue;

    let path = "/";
    let maxAge: number | undefined;
    let httpOnly = false;
    let sameSite: "lax" | "strict" | "none" | undefined = "lax";
    let secure = false;

    for (const attr of attrs) {
      const piece = attr.trim();
      const lower = piece.toLowerCase();
      if (lower.startsWith("path=")) path = piece.slice(5) || "/";
      else if (lower.startsWith("max-age=")) {
        const n = Number(piece.slice(8));
        if (!Number.isNaN(n)) maxAge = n;
      } else if (lower === "httponly") httpOnly = true;
      else if (lower.startsWith("samesite=")) {
        const v = piece.slice(9).toLowerCase();
        if (v === "lax" || v === "strict" || v === "none") sameSite = v;
      } else if (lower === "secure") secure = true;
    }

    jar.set(name, value, {
      path,
      httpOnly,
      sameSite,
      secure,
      ...(typeof maxAge === "number" ? { maxAge } : {}),
    });
  }
}

export async function loginAction(formData: FormData) {
  const portal =
    String(formData.get("portal") ?? "student") === "staff"
      ? "staff"
      : "student";
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  const fail = (message: string): never => {
    const params = new URLSearchParams({ error: message, portal });
    if (next.startsWith("/app")) params.set("next", next);
    redirect(`/login?${params.toString()}`);
  };

  if (!identifier || !password) {
    fail(
      portal === "student"
        ? "Enter your Student ID and password."
        : "Enter your username and password.",
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_ORIGIN}/api/auth/login/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ portal, identifier, password }),
      cache: "no-store",
    });
  } catch {
    fail("Unable to reach the school server. Please try again.");
  }

  const payload = await upstream.json().catch(() => ({}));

  if (!upstream.ok) {
    fail(
      extractErrorMessage(
        payload,
        portal === "student"
          ? "Invalid Student ID or password. Please try again."
          : "Invalid username or password. Please try again.",
      ),
    );
  }

  await forwardSetCookies(upstream);

  const userPayload =
    (payload as { user?: Record<string, unknown> }).user ??
    (payload as Record<string, unknown>);
  const accountType = normalizeAccountType(userPayload.account_type);
  const jar = await cookies();
  jar.set(AUTH_COOKIE, "1", {
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
  });
  jar.set(
    USER_COOKIE,
    encodeURIComponent(
      JSON.stringify({
        id: userPayload.id,
        email: userPayload.email ?? identifier,
        full_name: userPayload.full_name,
        account_type: accountType,
      }),
    ),
    {
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      sameSite: "lax",
    },
  );

  redirect(next.startsWith("/app") ? next : "/app");
}
