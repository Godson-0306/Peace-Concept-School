import Image from "next/image";
import Link from "next/link";
import { MAP_DIRECTIONS_URL } from "@/components/SchoolMap";
import {
  CLASS_LADDER_SHORT,
  CURRENT_SESSION,
  SCHOOL_ADDRESS_LINE,
  SCHOOL_EMAIL,
  SCHOOL_NAME,
  SCHOOL_PHONE,
} from "@/lib/brand";

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
            <div className="flex items-start gap-4">
              <Image
                src="/pcims-logo.jpeg"
                alt={`${SCHOOL_NAME} logo`}
                width={72}
                height={72}
                className="h-16 w-16 shrink-0 rounded-full bg-white object-contain p-1"
              />
              <p className="font-display text-2xl font-semibold tracking-tight sm:text-[1.85rem]">
                {SCHOOL_NAME}
              </p>
            </div>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/75">
              From Creche through Senior Secondary — a mission school where
              faith, learning, and character grow together.
            </p>
            <Link href="/contact#application" className="btn-primary mt-7 inline-flex">
              Apply for {CURRENT_SESSION}
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
              <p>{SCHOOL_ADDRESS_LINE}</p>
              <p>
                <a href={`tel:${SCHOOL_PHONE.replace(/\s/g, "")}`} className="hover:text-white">
                  {SCHOOL_PHONE}
                </a>
              </p>
              <p>
                <a href={`mailto:${SCHOOL_EMAIL}`} className="hover:text-white">
                  {SCHOOL_EMAIL}
                </a>
              </p>
              <p>
                <a
                  href={MAP_DIRECTIONS_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-[var(--brand-pink-soft)] hover:text-white"
                >
                  View on Google Maps →
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
          <p>{CLASS_LADDER_SHORT}</p>
        </div>
      </div>
    </footer>
  );
}
