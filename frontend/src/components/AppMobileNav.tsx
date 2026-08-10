"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AuthUser, getStoredUser } from "@/lib/auth";
import { SCHOOL_SHORT } from "@/lib/brand";
import { isPortalNavActive, portalNavFor } from "@/lib/portalNav";

export default function AppMobileNav() {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  const links = useMemo(
    () => portalNavFor(user?.account_type),
    [user?.account_type],
  );

  return (
    <div className="border-b border-[var(--line)] bg-white/80 md:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <Link
          href="/app"
          className="font-display text-xl font-semibold text-[var(--brand-blue-deep)]"
        >
          {SCHOOL_SHORT}
        </Link>
        <Link href="/" className="text-xs font-medium text-[var(--muted)]">
          Public site
        </Link>
      </div>
      <nav
        className="flex gap-1 overflow-x-auto px-3 pb-3"
        aria-label="App mobile"
      >
        {links.map((link) => {
          const active = isPortalNavActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                active
                  ? "bg-[var(--brand-blue)] text-white"
                  : "bg-[var(--brand-blue-wash)] text-[var(--brand-blue)]"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
