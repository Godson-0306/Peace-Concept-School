"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api";
import { getStoredUser, type AuthUser } from "@/lib/auth";

type ProgressResponse = {
  integration: string;
  message: string;
  results: Array<{
    id: number;
    title: string;
    score_percent: number | string;
    taken_at: string;
  }>;
};

export default function JambCbtShellPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [data, setData] = useState<ProgressResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        if (user.account_type === "student") {
          const res = await apiJson<ProgressResponse>(
            "/api/cbt/jamb/progress/",
          );
          if (!cancelled) setData(res);
        } else {
          if (!cancelled) {
            setData({
              integration: "pending",
              message:
                "JAMB CBT engine will be wired from the external repository.",
              results: [],
            });
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/app/assessments"
        className="text-sm text-[var(--brand-blue)] hover:underline"
      >
        ← Assessments
      </Link>
      <h1 className="mt-2 font-display text-3xl font-semibold text-[var(--brand-blue-deep)]">
        JAMB CBT
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Practice module for UTME-style exams. Scores stay here for progress
        monitoring only and do not update school report results.
      </p>

      <div className="mt-6 rounded-2xl border border-dashed border-[var(--brand-pink)] bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-pink)]">
          Integration pending
        </p>
        <p className="mt-2 text-sm text-[var(--ink)]">
          {data?.message ||
            "Your existing JAMB CBT repository will be connected here. We will improve it for the school and redesign it to match PCIMS branding."}
        </p>
        <p className="mt-3 text-xs text-[var(--muted)]">
          Drop-in notes: <code>backend/cbt/JAMB_INTEGRATION.md</code>
        </p>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-rose-700">{error}</p>
      ) : null}

      {user?.account_type === "student" ? (
        <section className="mt-8">
          <h2 className="font-display text-2xl text-[var(--brand-blue-deep)]">
            My JAMB progress
          </h2>
          <ul className="mt-3 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)] bg-white">
            {!data?.results?.length ? (
              <li className="px-4 py-4 text-sm text-[var(--muted)]">
                No practice attempts yet. Progress will appear after the JAMB
                module is connected.
              </li>
            ) : (
              data.results.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <span>
                    {row.title}
                    <span className="ml-2 text-[var(--muted)]">
                      {new Date(row.taken_at).toLocaleDateString()}
                    </span>
                  </span>
                  <span className="font-semibold">{row.score_percent}%</span>
                </li>
              ))
            )}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
