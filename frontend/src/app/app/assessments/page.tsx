"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getStoredUser, type AuthUser } from "@/lib/auth";

export default function AssessmentsHubPage() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  const isStudent = user?.account_type === "student";
  const isParent = user?.account_type === "parent";

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-3xl font-semibold text-[var(--brand-blue-deep)]">
        Assessments
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {isStudent || isParent
          ? "Take Normal CBT tests for school scores, or open JAMB practice for UTME-style drills."
          : "Create Normal CBT papers that write into CA1, CA2, or Exam scores. JAMB CBT is practice-only."}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/app/assessments/normal"
          className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm transition hover:border-[var(--brand-blue)]"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-blue)]">
            School results
          </p>
          <h2 className="mt-2 font-display text-2xl text-[var(--brand-blue-deep)]">
            Normal CBT
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            MCQ tests for CA1, CA2, or Exam. Auto-marked and saved to student
            results.
          </p>
        </Link>

        <Link
          href="/app/assessments/jamb"
          className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm transition hover:border-[var(--brand-pink)]"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-pink)]">
            Practice only
          </p>
          <h2 className="mt-2 font-display text-2xl text-[var(--brand-blue-deep)]">
            JAMB CBT
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            200-question timed UTME simulation with subject analytics. Does not
            update school report scores.
          </p>
        </Link>
      </div>
    </div>
  );
}
