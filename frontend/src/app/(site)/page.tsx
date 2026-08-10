import Link from "next/link";
import Image from "next/image";
import { newsItems } from "@/lib/news";

export default function HomePage() {
  const latest = newsItems.slice(0, 3);

  return (
    <>
      <section className="relative min-h-[100svh] overflow-hidden text-white">
        <Image
          src="https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?auto=format&fit=crop&w=2200&q=80"
          alt="Students walking across a bright school campus"
          fill
          priority
          className="animate-soft-zoom object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(10,47,110,0.88)_0%,rgba(20,80,163,0.62)_52%,rgba(232,61,122,0.42)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[rgba(10,47,110,0.45)] to-transparent" />

        <div className="site-container relative flex min-h-[100svh] flex-col justify-end pb-16 pt-32 sm:justify-center sm:pb-24">
          <div className="max-w-4xl">
            <p className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] backdrop-blur">
              <span className="animate-pulse-dot h-2 w-2 rounded-full bg-[var(--brand-pink-soft)]" />
              Admissions open · 2025/2026
            </p>
            <p className="animate-fade-up mt-6 font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl md:text-8xl">
              Peace Concept
              <span className="block text-[var(--brand-pink-soft)]">School</span>
            </p>
            <h1 className="animate-fade-up-delay mt-6 max-w-2xl text-lg font-medium leading-relaxed text-white/90 sm:text-2xl">
              Where focused learning meets lively campus spirit for JSS &amp; SSS.
            </h1>
            <div className="animate-fade-up-delay-2 mt-9 flex flex-wrap gap-3">
              <Link href="/admissions" className="btn-primary">
                Start admissions
              </Link>
              <Link href="/about" className="btn-secondary">
                Meet the school
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section-pad">
        <div className="site-container grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
          <div>
            <p className="eyebrow">The PCS difference</p>
            <h2 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-[var(--brand-blue-deep)] sm:text-5xl">
              Built for ambitious Nigerian students.
            </h2>
          </div>
          <p className="max-w-xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">
            From JSS1 foundations to SSS exam readiness, Peace Concept School
            blends rigorous teaching with warm pastoral care — so every learner
            is challenged, supported, and seen.
          </p>
        </div>

        <div className="site-container mt-12 grid gap-5 md:grid-cols-3">
          {[
            {
              title: "Junior Secondary",
              copy: "Strong literacy, numeracy, sciences, and values from JSS1–JSS3.",
              tone: "bg-[var(--brand-blue)] text-white",
            },
            {
              title: "Senior Secondary",
              copy: "Focused SSS pathways for WAEC, NECO, and life after school.",
              tone: "bg-[var(--brand-pink)] text-white",
            },
            {
              title: "Guided growth",
              copy: "Counselling, clubs, and a culture that prizes peace and grit.",
              tone: "bg-white text-[var(--ink)] border border-[var(--line)]",
            },
          ].map((item, index) => (
            <article
              key={item.title}
              className={`rounded-[1.5rem] p-7 shadow-[0_18px_40px_rgba(16,24,40,0.06)] ${item.tone}`}
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <p className="font-display text-5xl font-extrabold opacity-30">
                0{index + 1}
              </p>
              <h3 className="mt-4 font-display text-2xl font-bold tracking-tight">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed opacity-90">{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-pad pt-0">
        <div className="site-container overflow-hidden rounded-[2rem] bg-[var(--brand-blue-deep)] text-white">
          <div className="grid lg:grid-cols-2">
            <div className="relative min-h-[300px] lg:min-h-[420px]">
              <Image
                src="https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1400&q=80"
                alt="Students learning in class"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
            <div className="flex flex-col justify-center p-8 sm:p-12">
              <p className="eyebrow text-[var(--brand-pink-soft)]">Session 2025/2026</p>
              <h2 className="mt-4 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
                Your place on campus is waiting.
              </h2>
              <p className="mt-4 max-w-md text-base leading-relaxed text-white/75">
                Submit an online application, visit for an enquiry, or speak with
                our admissions desk. Entrance assessments for selected classes
                begin soon.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/contact#application" className="btn-primary">
                  Apply online
                </Link>
                <Link
                  href="/admissions"
                  className="inline-flex items-center rounded-full border border-white/35 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  Read the guide
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-pad pt-0">
        <div className="site-container flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Campus pulse</p>
            <h2 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-[var(--brand-blue-deep)]">
              News &amp; events
            </h2>
          </div>
          <Link href="/news" className="btn-outline">
            See all updates
          </Link>
        </div>

        <div className="site-container mt-10 grid gap-6 md:grid-cols-3">
          {latest.map((item) => (
            <article
              key={item.slug}
              className="group overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-white shadow-[0_16px_36px_rgba(16,24,40,0.05)]"
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
                <h3 className="mt-2 font-display text-2xl font-bold tracking-tight text-[var(--brand-blue-deep)]">
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
