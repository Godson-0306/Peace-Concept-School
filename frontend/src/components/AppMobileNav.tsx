"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import { AuthUser, getStoredUser } from "@/lib/auth";
import { SCHOOL_SHORT } from "@/lib/brand";
import {
  ClassLevelNav,
  collectOpenNavGroups,
  isExactPortalNavActive,
  isPortalNavActive,
  PortalNavItem,
  portalNavFor,
  withUsersClassLevels,
} from "@/lib/portalNav";

function unwrapList<T>(data: { results?: T[] } | T[]): T[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

function MobileNavChildLinks({
  items,
  pathname,
  openGroups,
  setOpenGroups,
}: {
  items: PortalNavItem[];
  pathname: string;
  openGroups: Record<string, boolean>;
  setOpenGroups: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  return (
    <div className="mt-1 ml-2 space-y-0.5 border-l border-[var(--line)] pl-2">
      {items.map((child) => {
        if (child.children?.length) {
          const nestedOpen = Boolean(openGroups[child.href]);
          const nestedActive = isPortalNavActive(pathname, child.href);
          return (
            <div key={child.href + child.label} className="mb-0.5">
              <button
                type="button"
                onClick={() =>
                  setOpenGroups((prev) => ({
                    ...prev,
                    [child.href]: !prev[child.href],
                  }))
                }
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm ${
                  nestedActive
                    ? "bg-[var(--brand-blue-wash)] font-semibold text-[var(--brand-blue)]"
                    : "text-[var(--muted)] hover:bg-[var(--mist)] hover:text-[var(--ink)]"
                }`}
                aria-expanded={nestedOpen}
              >
                <span>{child.label}</span>
                <span className="text-xs opacity-80">{nestedOpen ? "−" : "+"}</span>
              </button>
              {nestedOpen ? (
                <MobileNavChildLinks
                  items={child.children}
                  pathname={pathname}
                  openGroups={openGroups}
                  setOpenGroups={setOpenGroups}
                />
              ) : null}
            </div>
          );
        }

        const active = isExactPortalNavActive(pathname, child.href);
        return (
          <Link
            key={child.href + child.label}
            href={child.href}
            className={`block rounded-lg px-3 py-2.5 text-sm ${
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
  );
}

export default function AppMobileNav() {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [levels, setLevels] = useState<ClassLevelNav[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
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

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const links = useMemo(
    () =>
      withUsersClassLevels(
        portalNavFor(user?.account_type),
        levels,
        user?.account_type,
      ),
    [user?.account_type, levels],
  );

  useEffect(() => {
    setOpenGroups((prev) => ({ ...prev, ...collectOpenNavGroups(links, pathname) }));
  }, [pathname, links]);

  return (
    <div className="border-b border-[var(--line)] bg-white/90 md:hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/app"
          className="font-display text-xl font-semibold text-[var(--brand-blue-deep)]"
        >
          {SCHOOL_SHORT}
        </Link>
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--line)] text-[var(--brand-blue)]"
          aria-expanded={menuOpen}
          aria-controls="mobile-portal-menu"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden className="flex w-4 flex-col gap-1">
            <span
              className={`h-0.5 w-full bg-current transition ${
                menuOpen ? "translate-y-[6px] rotate-45" : ""
              }`}
            />
            <span
              className={`h-0.5 w-full bg-current transition ${
                menuOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`h-0.5 w-full bg-current transition ${
                menuOpen ? "-translate-y-[6px] -rotate-45" : ""
              }`}
            />
          </span>
        </button>
      </div>

      {menuOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-[rgba(12,47,109,0.35)]"
            aria-label="Close menu overlay"
            onClick={() => setMenuOpen(false)}
          />
          <nav
            id="mobile-portal-menu"
            className="fixed inset-y-0 right-0 z-50 flex w-[min(20rem,88vw)] flex-col bg-white shadow-[-12px_0_40px_rgba(12,47,109,0.18)]"
            aria-label="App mobile"
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-4">
              <p className="font-display text-lg font-semibold text-[var(--brand-blue-deep)]">
                Menu
              </p>
              <button
                type="button"
                className="text-sm font-semibold text-[var(--muted)]"
                onClick={() => setMenuOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {links.map((link) => {
                if (link.children?.length) {
                  const parentActive = isPortalNavActive(pathname, link.href);
                  const open = Boolean(openGroups[link.href]);
                  return (
                    <div key={link.href} className="mb-1">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenGroups((prev) => ({
                            ...prev,
                            [link.href]: !prev[link.href],
                          }))
                        }
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm font-semibold ${
                          parentActive
                            ? "bg-[var(--brand-blue)] text-white"
                            : "text-[var(--ink)] hover:bg-[var(--brand-blue-wash)]"
                        }`}
                        aria-expanded={open}
                      >
                        <span>{link.label}</span>
                        <span className="text-xs opacity-80">
                          {open ? "−" : "+"}
                        </span>
                      </button>
                      {open ? (
                        <MobileNavChildLinks
                          items={link.children}
                          pathname={pathname}
                          openGroups={openGroups}
                          setOpenGroups={setOpenGroups}
                        />
                      ) : null}
                    </div>
                  );
                }

                const active = isPortalNavActive(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`mb-1 block rounded-lg px-3 py-3 text-sm font-semibold ${
                      active
                        ? "bg-[var(--brand-blue)] text-white"
                        : "text-[var(--ink)] hover:bg-[var(--brand-blue-wash)]"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
            <div className="border-t border-[var(--line)] px-4 py-4">
              <Link
                href="/"
                className="text-sm font-semibold text-[var(--brand-blue)]"
              >
                Public site
              </Link>
            </div>
          </nav>
        </>
      ) : null}
    </div>
  );
}
