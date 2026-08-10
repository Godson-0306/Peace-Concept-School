import Link from "next/link";
import Image from "next/image";
import { CLASS_BANDS, SCHOOL_NAME, SCHOOL_SHORT } from "@/lib/brand";
import { newsItems } from "@/lib/news";

export default function HomePage() {
  const latest = newsItems.slice(0, 3);

  return (
    <>
      <section className="relative min-h-[100svh] overflow-hidden text-white">
        <Image
          src="https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=2200&q=80"
          alt="Students on campus at Peace Concept International Mission Schools"
          fill
          priority
          className="animate-soft-zoom object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(12,47,109,0.88)_0%,rgba(22,73,160,0.68)_48%,rgba(226,59,120,0.4)_100%)]" />

        <div className="site-container relative flex min-h-[100svh] flex-col justify-end pb-16 pt-32 sm:justify-center sm:pb-24">
          <div className="max-w-4xl">
            <p className="animate-fade-up eyebrow text-[var(--brand-pink-soft)]">
              Admissions open · Session 2025/2026
            </p>
            <p className="animate-fade-up mt-5 font-display text-[2.6rem] font-semibold leading-[1.02] tracking-tight sm:text-6xl md:text-7xl">
              {SCHOOL_SHORT}
              <span className="mt-1 block text-[1.35rem] font-medium text-white/90 sm:text-3xl md:text-4xl">
                International Mission Schools
              </span>
            </p>
            <span
              aria-hidden
              className="animate-gold-line mt-6 block h-1 w-24 rounded-full bg-[var(--brand-pink-soft)]"
            />
            <h1 className="animate-fade-up-delay mt-6 max-w-2xl text-lg font-medium leading-relaxed text-white/90 sm:text-xl">
              Faith-rooted education from Day Care through Senior Secondary —
              nurturing every child with care, discipline, and joy.
            </h1>
            <div className="animate-fade-up-delay-2 mt-9 flex flex-wrap gap-3">
              <Link href="/admissions" className="btn-primary">
                Start admissions
              </Link>
              <Link href="/academics" className="btn-secondary">
                View class levels
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section-pad">
        <div className="site-container grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-end">
          <div>
            <p className="eyebrow">One school. Many beginnings.</p>
            <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight text-[var(--brand-blue-deep)] sm:text-5xl">
              A complete journey from first steps to SS3.
            </h2>
          </div>
          <p className="max-w-xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">
            {SCHOOL_NAME} welcomes children at every stage — Day Care, Nursery,
            Basic, Junior Secondary, and Senior Secondary — with teaching that is
            warm, structured, and mission-minded.
          </p>
        </div>

        <div className="site-container mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CLASS_BANDS.map((band, index) => (
            <article
              key={band.title}
              className={`rounded-2xl p-6 ${
                index % 2 === 0
                  ? "bg-[var(--brand-blue)] text-white"
                  : "bg-[var(--brand-pink)] text-white"
              }`}
            >
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/75">
                {band.range}
              </p>
              <h3 className="mt-3 font-display text-2xl font-semibold">{band.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/85">{band.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-pad pt-0">
        <div className="site-container overflow-hidden rounded-[1.75rem] bg-[var(--brand-blue-deep)] text-white">
          <div className="grid lg:grid-cols-2">
            <div className="relative min-h-[280px] lg:min-h-[400px]">
              <Image
                src="https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=1400&q=80"
                alt="Early years learners in a bright classroom"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
            <div className="flex flex-col justify-center p-8 sm:p-12">
              <p className="eyebrow text-[var(--brand-pink-soft)]">Session 2025/2026</p>
              <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight">
                Enrolment is open across every class.
              </h2>
              <p className="mt-4 max-w-md text-base leading-relaxed text-white/75">
                Apply online for Day Care, Nursery 1–2, Basic 1–5, JSS1–3, or
                SS1–3. Our admissions team will guide your family through the next
                steps.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/contact#application" className="btn-primary">
                  Apply online
                </Link>
                <Link
                  href="/admissions"
                  className="inline-flex items-center rounded-[0.75rem] border border-white/35 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  Admissions guide
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-pad pt-0">
        <div className="site-container flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Campus life</p>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-[var(--brand-blue-deep)]">
              News &amp; events
            </h2>
          </div>
          <Link href="/news" className="btn-outline">
            All updates
          </Link>
        </div>

        <div className="site-container mt-10 grid gap-6 md:grid-cols-3">
          {latest.map((item) => (
            <article
              key={item.slug}
              className="group overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[0_14px_34px_rgba(26,34,51,0.05)]"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-[var(--brand-blue)]">
                {item.image ? (
                  <Image
                    src={item.image}
                    alt=""
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                ) : null}
              </div>
              <div className="p-5">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-pink)]">
                  {item.category}
                </p>
                <h3 className="mt-2 font-display text-2xl font-semibold text-[var(--brand-blue-deep)]">
                  <Link href={`/news/${item.slug}`} className="hover:text-[var(--brand-pink)]">
                    {item.title}
                  </Link>
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                  {item.excerpt}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
