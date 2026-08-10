"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/admissions", label: "Admissions" },
  { href: "/academics", label: "Academics" },
  { href: "/news", label: "News" },
  { href: "/gallery", label: "Gallery" },
  { href: "/contact", label: "Contact" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isHome = pathname === "/";

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header
      className={`sticky top-0 z-50 ${
        isHome
          ? "border-b border-white/10 bg-[rgba(10,47,110,0.55)] text-white backdrop-blur-xl"
          : "border-b border-[var(--line)] bg-white/90 text-[var(--ink)] backdrop-blur-xl"
      }`}
    >
      <div className="site-container flex h-[4.5rem] items-center justify-between gap-4">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(145deg,var(--brand-blue),var(--brand-pink))] font-display text-sm font-extrabold text-white shadow-lg shadow-[rgba(20,80,163,0.25)]"
          >
            PCS
          </span>
          <span className="min-w-0 leading-tight">
            <span
              className={`block truncate font-display text-[1.15rem] font-bold sm:text-[1.3rem] ${
                isHome ? "text-white" : "text-[var(--brand-blue-deep)]"
              }`}
            >
              Peace Concept School
            </span>
            <span
              className={`hidden text-[0.68rem] font-semibold uppercase tracking-[0.16em] sm:block ${
                isHome ? "text-white/70" : "text-[var(--muted)]"
              }`}
            >
              JSS · SSS · Session 2025/2026
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                isActive(link.href)
                  ? isHome
                    ? "bg-white/15 text-white"
                    : "bg-[var(--brand-blue-wash)] text-[var(--brand-blue)]"
                  : isHome
                    ? "text-white/80 hover:bg-white/10 hover:text-white"
                    : "text-[var(--muted)] hover:bg-[var(--mist)] hover:text-[var(--brand-blue)]"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className={`hidden rounded-full px-4 py-2 text-sm font-bold sm:inline-flex ${
              isHome
                ? "bg-white text-[var(--brand-blue-deep)]"
                : "bg-[var(--brand-blue)] text-white"
            }`}
          >
            Portal login
          </Link>
          <button
            type="button"
            className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border lg:hidden ${
              isHome
                ? "border-white/25 text-white"
                : "border-[var(--line)] text-[var(--brand-blue)]"
            }`}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <span aria-hidden className="flex w-4 flex-col gap-1">
              <span className="h-0.5 w-full bg-current" />
              <span className="h-0.5 w-full bg-current" />
              <span className="h-0.5 w-full bg-current" />
            </span>
          </button>
        </div>
      </div>

      {open ? (
        <nav
          id="mobile-nav"
          className={`border-t lg:hidden ${
            isHome
              ? "border-white/10 bg-[rgba(10,47,110,0.95)] text-white"
              : "border-[var(--line)] bg-white"
          }`}
          aria-label="Mobile"
        >
          <div className="site-container flex flex-col py-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`px-1 py-3 text-base font-semibold ${
                  isActive(link.href)
                    ? isHome
                      ? "text-[var(--brand-pink-soft)]"
                      : "text-[var(--brand-pink)]"
                    : ""
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="mt-2 mb-2 inline-flex w-fit rounded-full bg-[var(--brand-pink)] px-4 py-2 text-sm font-bold text-white"
            >
              Portal login
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
