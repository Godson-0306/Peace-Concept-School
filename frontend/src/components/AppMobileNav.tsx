"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/app", label: "Home" },
  { href: "/app/admin", label: "Admin" },
  { href: "/app/principal", label: "Principal" },
  { href: "/app/teacher", label: "Teacher" },
  { href: "/app/accountant", label: "Accounts" },
  { href: "/app/student", label: "Student" },
  { href: "/app/parent", label: "Parent" },
  { href: "/app/store", label: "Store" },
];

export default function AppMobileNav() {
  const pathname = usePathname();

  return (
    <div className="border-b border-[var(--line)] bg-white/80 md:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/app" className="font-display text-xl font-semibold text-[var(--brand-green)]">
          Peace Concept
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
          const active =
            link.href === "/app"
              ? pathname === "/app"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`shrink-0 rounded-sm px-3 py-1.5 text-xs font-medium ${
                active
                  ? "bg-[var(--brand-green)] text-white"
                  : "bg-[rgba(11,61,46,0.06)] text-[var(--brand-green)]"
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
