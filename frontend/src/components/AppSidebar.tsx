"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AuthUser, clearUser, getStoredUser } from "@/lib/auth";
import { SCHOOL_SHORT } from "@/lib/brand";
import { isPortalNavActive, portalNavFor } from "@/lib/portalNav";

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  const links = useMemo(
    () => portalNavFor(user?.account_type),
    [user?.account_type],
  );

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

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4" aria-label="App">
        {links.map((link) => {
          const active = isPortalNavActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-[var(--brand-blue)] text-white"
                  : "text-[var(--ink)] hover:bg-[var(--brand-blue-wash)]"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--line)] px-5 py-4">
        <p className="truncate text-sm font-medium text-[var(--brand-blue-deep)]">
          {user?.full_name || user?.email || "Signed in"}
        </p>
        <p className="mt-0.5 text-xs capitalize text-[var(--muted)]">
          {user?.account_type ?? "staff"}
        </p>
        <button
          type="button"
          onClick={logout}
          className="mt-3 text-sm font-medium text-[var(--brand-blue-soft)] hover:text-[var(--brand-blue)]"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
