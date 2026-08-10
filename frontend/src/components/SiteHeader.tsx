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

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[rgba(243,246,244,0.88)] backdrop-blur-md">
      <div className="site-container flex h-[4.25rem] items-center justify-between gap-4">
        <Link href="/" className="group flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-[var(--brand-green)] font-display text-lg font-bold text-[var(--brand-gold)]"
          >
            PC
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate font-display text-xl font-semibold tracking-tight text-[var(--brand-green)] sm:text-[1.35rem]">
              Peace Concept School
            </span>
            <span className="hidden text-[0.7rem] uppercase tracking-[0.14em] text-[var(--muted)] sm:block">
              Secondary Education
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-sm px-3 py-2 text-sm font-medium transition-colors ${
                isActive(link.href)
                  ? "text-[var(--brand-green)]"
                  : "text-[var(--muted)] hover:text-[var(--brand-green)]"
              }`}
            >
              <span className="relative">
                {link.label}
                {isActive(link.href) ? (
                  <span className="absolute -bottom-1 left-0 h-0.5 w-full bg-[var(--brand-gold)]" />
                ) : null}
              </span>
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-sm px-3 py-2 text-sm font-medium text-[var(--brand-green-soft)] transition-colors hover:text-[var(--brand-green)]"
          >
            Login
          </Link>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-[var(--line)] text-[var(--brand-green)] lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sr-only">Menu</span>
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
          className="border-t border-[var(--line)] bg-[var(--mist)] lg:hidden"
          aria-label="Mobile"
        >
          <div className="site-container flex flex-col py-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`px-1 py-3 text-base ${
                  isActive(link.href)
                    ? "font-semibold text-[var(--brand-green)]"
                    : "text-[var(--muted)]"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
