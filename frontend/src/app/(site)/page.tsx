import Link from "next/link";
import Image from "next/image";
import { newsItems } from "@/lib/news";

export default function HomePage() {
  const latest = newsItems.slice(0, 3);

  return (
    <>
      <section className="relative min-h-[100svh] overflow-hidden text-white">
        <Image
          src="https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=2000&q=80"
          alt="Students gathered on a school campus"
          fill
          priority
          className="animate-soft-zoom object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(7,40,32,0.88)_0%,rgba(20,80,163,0.72)_48%,rgba(20,80,163,0.42)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_30%,rgba(196,163,90,0.22),transparent_40%)]" />

        <div className="site-container relative flex min-h-[100svh] flex-col justify-end pb-16 pt-28 sm:justify-center sm:pb-24 sm:pt-20">
          <div className="max-w-3xl">
            <p className="animate-fade-up font-display text-4xl font-semibold leading-none tracking-tight text-white sm:text-6xl md:text-7xl">
              Peace Concept School
            </p>
            <span
              aria-hidden
              className="animate-gold-line mt-5 block h-0.5 w-24 bg-[var(--brand-gold)]"
            />
            <h1 className="animate-fade-up-delay mt-6 max-w-2xl font-display text-2xl font-medium leading-snug text-white/95 sm:text-3xl md:text-[2.1rem]">
              Character, discipline, and academic excellence for JSS &amp; SSS.
            </h1>
            <p className="animate-fade-up-delay-2 mt-4 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
              Admissions open for the 2025/2026 session — nurturing thoughtful
              learners from JSS1 through SSS3.
            </p>
            <div className="animate-fade-up-delay-2 mt-8 flex flex-wrap gap-3">
              <Link href="/admissions" className="btn-primary">
                Apply for admission
              </Link>
              <Link href="/about" className="btn-secondary">
                Discover our story
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section-pad">
        <div className="site-container grid items-end gap-8 md:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-gold)]">
              Why families choose us
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-[var(--brand-green)] sm:text-5xl">
              A calm campus where ambition meets care.
            </h2>
          </div>
          <p className="text-base leading-relaxed text-[var(--muted)]">
            Peace Concept School combines rigorous Junior and Senior Secondary
            teaching with pastoral guidance, so every student grows in intellect,
            character, and community responsibility.
          </p>
        </div>

        <div className="site-container mt-12 grid gap-8 md:grid-cols-3">
          {[
            {
              title: "Junior Secondary",
              copy: "JSS1–JSS3 foundations in literacy, numeracy, sciences, and civic values.",
            },
            {
              title: "Senior Secondary",
              copy: "SSS1–SSS3 pathways preparing students for WAEC, NECO, and tertiary life.",
            },
            {
              title: "Whole-child care",
              copy: "Guidance counselling, clubs, and a culture of peace-centred discipline.",
            },
          ].map((item, index) => (
            <article
              key={item.title}
              className="border-t border-[var(--brand-gold)] pt-5"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <h3 className="font-display text-2xl font-semibold text-[var(--brand-green)]">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
                {item.copy}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-[var(--line)] bg-[rgba(255,255,255,0.45)] section-pad">
        <div className="site-container grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div className="relative min-h-[280px] overflow-hidden rounded-sm lg:min-h-[360px]">
            <Image
              src="https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1400&q=80"
              alt="Classroom learning at Peace Concept School"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-gold)]">
              Session 2025/2026
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold text-[var(--brand-green)]">
              Admissions are open across JSS1–SSS3.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--muted)]">
              Prospective families may submit an online application, book an
              enquiry visit, or collect forms from the school office. Entrance
              assessments for selected classes begin in August.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/contact#application" className="btn-primary">
                Start application
              </Link>
              <Link href="/admissions" className="btn-outline">
                Admissions guide
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section-pad">
        <div className="site-container flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-gold)]">
              News &amp; events
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold text-[var(--brand-green)]">
              From the school community
            </h2>
          </div>
          <Link href="/news" className="btn-outline">
            View all news
          </Link>
        </div>

        <div className="site-container mt-10 grid gap-8 md:grid-cols-3">
          {latest.map((item) => (
            <article key={item.slug} className="group">
              <div className="relative mb-4 aspect-[16/10] overflow-hidden rounded-sm bg-[var(--brand-green)]">
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
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                {item.category} ·{" "}
                {new Date(item.date).toLocaleDateString("en-NG", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
              <h3 className="mt-2 font-display text-2xl font-semibold text-[var(--brand-green)]">
                <Link href={`/news/${item.slug}`} className="hover:underline">
                  {item.title}
                </Link>
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                {item.excerpt}
              </p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
