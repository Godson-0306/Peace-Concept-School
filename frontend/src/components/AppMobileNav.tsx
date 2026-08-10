"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import { AuthUser, getStoredUser } from "@/lib/auth";
import { SCHOOL_SHORT } from "@/lib/brand";
import {
  ClassLevelNav,
  isExactPortalNavActive,
  isPortalNavActive,
  portalNavFor,
  withUsersClassLevels,
} from "@/lib/portalNav";

function unwrapList<T>(data: { results?: T[] } | T[]): T[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

export default function AppMobileNav() {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [levels, setLevels] = useState<ClassLevelNav[]>([]);
  const [usersOpen, setUsersOpen] = useState(false);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  useEffect(() => {
    if (user?.account_type !== "admin" && user?.account_type !== "principal") {
      return;
    }
    apiJson<{ results?: ClassLevelNav[] } | ClassLevelNav[]>("/api/class-levels/")
      .then((data) => setLevels(unwrapList(data).sort((a, b) => a.order - b.order)))
      .catch(() => setLevels([]));
  }, [user?.account_type]);

  useEffect(() => {
    if (pathname.startsWith("/app/users")) setUsersOpen(true);
  }, [pathname]);

  const links = useMemo(
    () => withUsersClassLevels(portalNavFor(user?.account_type), levels),
    [user?.account_type, levels],
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
          if (link.children?.length) {
            const parentActive = isPortalNavActive(pathname, link.href);
            return (
              <div key={link.href} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setUsersOpen((v) => !v)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    parentActive
                      ? "bg-[var(--brand-blue)] text-white"
                      : "bg-[var(--brand-blue-wash)] text-[var(--brand-blue)]"
                  }`}
                >
                  {link.label} {usersOpen ? "−" : "+"}
                </button>
                {usersOpen
                  ? link.children.map((child) => {
                      const active = isExactPortalNavActive(pathname, child.href);
                      return (
                        <Link
                          key={child.href + child.label}
                          href={child.href}
                          className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                            active
                              ? "bg-[var(--brand-pink)] text-white"
                              : "bg-[var(--mist)] text-[var(--ink)]"
                          }`}
                        >
                          {child.label}
                        </Link>
                      );
                    })
                  : null}
              </div>
            );
          }

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
