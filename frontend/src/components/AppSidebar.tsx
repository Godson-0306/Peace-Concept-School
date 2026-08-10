"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiFetch, apiJson } from "@/lib/api";
import { AuthUser, clearUser, getStoredUser } from "@/lib/auth";
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

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [levels, setLevels] = useState<ClassLevelNav[]>([]);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  useEffect(() => {
    if (user?.account_type !== "admin" && user?.account_type !== "principal") {
      return;
    }
    apiJson<{ results?: ClassLevelNav[] } | ClassLevelNav[]>("/api/class-levels/")
      .then((data) => setLevels(unwrapList(data)))
      .catch(() => setLevels([]));
  }, [user?.account_type]);

  const links = useMemo(
    () => withUsersClassLevels(portalNavFor(user?.account_type), levels),
    [user?.account_type, levels],
  );

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const link of links) {
        if (link.children?.length && isPortalNavActive(pathname, link.href)) {
          next[link.href] = true;
        }
      }
      return next;
    });
  }, [pathname, links]);

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
          if (link.children?.length) {
            const parentActive = isPortalNavActive(pathname, link.href);
            const open = Boolean(openGroups[link.href]);
            return (
              <div key={link.href} className="space-y-0.5">
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroups((prev) => ({
                      ...prev,
                      [link.href]: !prev[link.href],
                    }))
                  }
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                    parentActive
                      ? "bg-[var(--brand-blue)] text-white"
                      : "text-[var(--ink)] hover:bg-[var(--brand-blue-wash)]"
                  }`}
                  aria-expanded={open}
                >
                  <span>{link.label}</span>
                  <span className="text-xs opacity-80">{open ? "−" : "+"}</span>
                </button>
                {open ? (
                  <div className="ml-2 space-y-0.5 border-l border-[var(--line)] pl-2">
                    {link.children.map((child) => {
                      const active = isExactPortalNavActive(pathname, child.href);
                      return (
                        <Link
                          key={child.href + child.label}
                          href={child.href}
                          className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                            active
                              ? "bg-[var(--brand-blue-wash)] font-semibold text-[var(--brand-blue)]"
                              : "text-[var(--muted)] hover:bg-[var(--mist)] hover:text-[var(--ink)]"
                          }`}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          }

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
