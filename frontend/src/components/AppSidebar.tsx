"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  AuthUser,
  clearUser,
  dashboardPathFor,
  getStoredUser,
} from "@/lib/auth";
import { SCHOOL_SHORT } from "@/lib/brand";

const roleLinks: Record<string, { href: string; label: string }[]> = {
  admin: [
    { href: "/app/admin", label: "Admin console" },
    { href: "/app/admin#staff", label: "Staff accounts" },
    { href: "/app/admin#students", label: "Students" },
    { href: "/app/admin#leads", label: "Enquiries" },
  ],
  principal: [
    { href: "/app/principal", label: "Results oversight" },
  ],
  teacher: [
    { href: "/app/teacher", label: "My classes" },
  ],
  accountant: [
    { href: "/app/accountant", label: "Fees" },
  ],
  student: [
    { href: "/app/student", label: "My results" },
  ],
  parent: [
    { href: "/app/parent", label: "Children" },
  ],
  store: [
    { href: "/app/store", label: "Inventory" },
  ],
};

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  const links = useMemo(() => {
    const role = user?.account_type ?? "admin";
    const specific = roleLinks[role] ?? [{ href: "/app", label: "Overview" }];
    return [{ href: "/app", label: "Overview" }, ...specific];
  }, [user]);

  async function logout() {
    try {
      await apiFetch("/api/auth/logout/", { method: "POST" });
    } catch {
      /* ignore */
    }
    clearUser();
    router.replace("/login");
  }

  return (
    <aside className="flex h-full flex-col border-r border-[var(--line)] bg-white/70">
      <div className="border-b border-[var(--line)] px-5 py-5">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/pcims-logo.jpeg"
            alt={`${SCHOOL_SHORT} logo`}
            width={40}
            height={40}
            className="h-10 w-10 rounded-full bg-white object-contain"
          />
          <span>
            <span className="block font-display text-xl font-semibold text-[var(--brand-blue-deep)]">
              {SCHOOL_SHORT}
            </span>
            <span className="mt-0.5 block text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
              Management
            </span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="App">
        {links.map((link) => {
          const base = link.href.split("#")[0];
          const active =
            base === "/app" ? pathname === "/app" : pathname.startsWith(base);
          return (
            <Link
              key={link.href + link.label}
              href={link.href}
              className={`block rounded-sm px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-[var(--brand-green)] text-white"
                  : "text-[var(--ink)] hover:bg-[rgba(20,80,163,0.06)]"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
        {user ? (
          <Link
            href={dashboardPathFor(user.account_type)}
            className="mt-4 block px-3 text-xs text-[var(--muted)] hover:text-[var(--brand-green)]"
          >
            Go to my home
          </Link>
        ) : null}
      </nav>

      <div className="border-t border-[var(--line)] px-5 py-4">
        <p className="truncate text-sm font-medium text-[var(--brand-green)]">
          {user?.full_name || user?.email || "Signed in"}
        </p>
        <p className="mt-0.5 text-xs capitalize text-[var(--muted)]">
          {user?.account_type ?? "staff"}
        </p>
        <button
          type="button"
          onClick={logout}
          className="mt-3 text-sm font-medium text-[var(--brand-green-soft)] hover:text-[var(--brand-green)]"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
