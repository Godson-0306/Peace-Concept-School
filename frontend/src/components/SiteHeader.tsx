"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SCHOOL_NAME, SCHOOL_SHORT } from "@/lib/brand";

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
          ? "border-b border-white/15 bg-[rgba(12,47,109,0.45)] text-white backdrop-blur-xl"
          : "border-b border-[var(--line)] bg-white/92 text-[var(--ink)] backdrop-blur-xl"
      }`}
    >
      <div className="site-container flex h-[4.6rem] items-center justify-between gap-3">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <Image
            src="/pcims-logo.jpeg"
            alt={`${SCHOOL_NAME} logo`}
            width={48}
            height={48}
            className="h-11 w-11 shrink-0 rounded-full bg-white object-contain p-0.5 shadow-sm"
            priority
          />
          <span className="min-w-0 leading-tight">
            <span
              className={`block truncate font-display text-[1.05rem] font-semibold sm:text-[1.2rem] ${
                isHome ? "text-white" : "text-[var(--brand-blue-deep)]"
              }`}
            >
              <span className="sm:hidden">{SCHOOL_SHORT}</span>
              <span className="hidden sm:inline">{SCHOOL_NAME}</span>
            </span>
            <span
              className={`hidden text-[0.68rem] font-semibold uppercase tracking-[0.12em] md:block ${
                isHome ? "text-white/70" : "text-[var(--muted)]"
              }`}
            >
              Day Care · Nursery · Basic · JSS · SS
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 xl:flex" aria-label="Main">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
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
            className={`hidden rounded-lg px-3.5 py-2 text-sm font-bold sm:inline-flex ${
              isHome
                ? "bg-white text-[var(--brand-blue-deep)]"
                : "bg-[var(--brand-blue)] text-white"
            }`}
          >
            Login
          </Link>
          <button
            type="button"
            className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border xl:hidden ${
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
          className={`border-t xl:hidden ${
            isHome
              ? "border-white/10 bg-[rgba(12,47,109,0.96)] text-white"
              : "border-[var(--line)] bg-white"
          }`}
          aria-label="Mobile"
        >
          <div className="site-container flex flex-col py-3">
            <p
              className={`mb-2 text-xs font-semibold ${
                isHome ? "text-white/70" : "text-[var(--muted)]"
              }`}
            >
              {SCHOOL_NAME}
            </p>
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
              className="mt-2 mb-2 inline-flex w-fit rounded-lg bg-[var(--brand-pink)] px-4 py-2 text-sm font-bold text-white"
            >
              Login
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
