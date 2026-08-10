import Link from "next/link";

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
          className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[var(--brand-pink)] opacity-20 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-24 left-10 h-64 w-64 rounded-full bg-[var(--brand-blue-soft)] opacity-30 blur-3xl"
        />

        <div className="site-container relative grid gap-12 py-16 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <p className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              Peace Concept School
            </p>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/75">
              A modern Nigerian secondary school for JSS1–SSS3 — building sharp
              minds, steady character, and confident futures.
            </p>
            <Link
              href="/contact#application"
              className="btn-primary mt-7 inline-flex"
            >
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
              <p>Peace Concept School Campus</p>
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
          <p>© {new Date().getFullYear()} Peace Concept School</p>
          <p>Blue for focus. Pink for spirit.</p>
        </div>
      </div>
    </footer>
  );
}
