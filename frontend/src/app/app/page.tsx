"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthUser, dashboardPathFor, getStoredUser } from "@/lib/auth";

const roles = [
  { href: "/app/admin", label: "Admin" },
  { href: "/app/principal", label: "Principal" },
  { href: "/app/teacher", label: "Teacher" },
  { href: "/app/accountant", label: "Accountant" },
  { href: "/app/student", label: "Student" },
  { href: "/app/parent", label: "Parent" },
  { href: "/app/store", label: "Store" },
];

export default function AppHomePage() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-gold)]">
        Management portal
      </p>
      <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--brand-green)]">
        Welcome{user?.full_name ? `, ${user.full_name}` : ""}
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--muted)]">
        This is a stub workspace for Peace Concept School operations. Role pages
        below are placeholders pending full module implementation.
      </p>

      {user ? (
        <Link
          href={dashboardPathFor(user.account_type)}
          className="btn-primary mt-6 inline-flex"
        >
          Go to {user.account_type} dashboard
        </Link>
      ) : null}

      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((role) => (
          <Link
            key={role.href}
            href={role.href}
            className="border border-[var(--line)] bg-white/70 px-4 py-5 transition-colors hover:border-[var(--brand-green)]"
          >
            <span className="font-display text-2xl font-semibold text-[var(--brand-green)]">
              {role.label}
            </span>
            <span className="mt-2 block text-sm text-[var(--muted)]">
              Open placeholder workspace
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
