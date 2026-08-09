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
    <footer className="mt-auto border-t border-[var(--line)] bg-[var(--brand-green-deep)] text-white">
      <div className="site-container grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="font-display text-3xl font-semibold tracking-tight">
            Peace Concept School
          </p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/75">
            A Nigerian secondary school nurturing disciplined, thoughtful learners
            from JSS1 through SSS3. Session 2025/2026.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-gold)]">
            Explore
          </p>
          <ul className="mt-4 space-y-2 text-sm text-white/80">
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
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-gold)]">
            Visit
          </p>
          <address className="mt-4 space-y-2 text-sm not-italic leading-relaxed text-white/80">
            <p>Peace Concept School Campus</p>
            <p>Along Unity Road, Abeokuta, Ogun State, Nigeria</p>
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

      <div className="border-t border-white/10">
        <div className="site-container flex flex-col gap-2 py-5 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Peace Concept School. All rights reserved.</p>
          <p>Building character. Advancing learning.</p>
        </div>
      </div>
    </footer>
  );
}
