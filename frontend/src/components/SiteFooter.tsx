import Link from "next/link";
import { SCHOOL_NAME } from "@/lib/brand";

const footerNav = [
  { href: "/about", label: "About" },
  { href: "/admissions", label: "Admissions" },
  { href: "/academics", label: "Academics" },
  { href: "/news", label: "News" },
  { href: "/gallery", label: "Gallery" },
  { href: "/contact", label: "Contact" },
];

export default function SiteFooter() {
  return (
    <footer className="mt-auto overflow-hidden bg-[var(--brand-blue-deep)] text-white">
      <div className="relative">
        <div
          aria-hidden
          className="absolute -right-16 top-0 h-64 w-64 rounded-full bg-[var(--brand-pink)] opacity-20 blur-3xl"
        />
        <div className="site-container relative grid gap-12 py-16 md:grid-cols-[1.55fr_1fr_1fr]">
          <div>
            <p className="font-display text-3xl font-semibold tracking-tight sm:text-[2.1rem]">
              {SCHOOL_NAME}
            </p>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/75">
              From Day Care through Senior Secondary — a mission school where
              faith, learning, and character grow together.
            </p>
            <Link href="/contact#application" className="btn-primary mt-7 inline-flex">
              Apply for 2025/2026
            </Link>
          </div>

          <div>
            <p className="text-sm font-bold text-[var(--brand-pink-soft)]">Explore</p>
            <ul className="mt-4 space-y-2.5 text-sm text-white/80">
              {footerNav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="transition-colors hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-sm font-bold text-[var(--brand-pink-soft)]">Visit us</p>
            <address className="mt-4 space-y-2 text-sm not-italic leading-relaxed text-white/80">
              <p>{SCHOOL_NAME}</p>
              <p>Along Unity Road, Abeokuta, Ogun State</p>
              <p>
                <a href="tel:+2348012345678" className="hover:text-white">
                  +234 801 234 5678
                </a>
              </p>
              <p>
                <a href="mailto:info@peaceconceptschool.ng" className="hover:text-white">
                  info@peaceconceptschool.ng
                </a>
              </p>
            </address>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="site-container flex flex-col gap-2 py-5 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {SCHOOL_NAME}
          </p>
          <p>Day Care · Nursery · Basic · JSS · SS</p>
        </div>
      </div>
    </footer>
  );
}
