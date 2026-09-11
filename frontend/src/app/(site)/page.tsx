import Link from "next/link";
import Image from "next/image";
import {
  CLASS_BANDS,
  CURRENT_SESSION,
  SCHOOL_MOTTO,
  SCHOOL_NAME,
  SCHOOL_SHORT,
} from "@/lib/brand";
import { CAMPUS, CAMPUS_MOSAIC } from "@/lib/campusPhotos";
import { getPublicNews } from "@/lib/websiteContent";

const BAND_PHOTOS = [
  CAMPUS.nurseryClass,
  CAMPUS.primaryClass,
  CAMPUS.juniorStudent,
  CAMPUS.secondaryClass,
] as const;

export default async function HomePage() {
  const latest = (await getPublicNews()).slice(0, 3);

  return (
    <>
      <section className="relative min-h-[calc(100svh-4.6rem)] overflow-hidden text-white">
        <Image
          src={CAMPUS.hero}
          alt="Senior students of Peace Concept International Mission Schools"
          fill
          priority
          className="animate-soft-zoom object-cover object-[center_28%]"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(12,47,109,0.88)_0%,rgba(22,73,160,0.68)_48%,rgba(226,59,120,0.4)_100%)]" />

        <div className="site-container relative flex min-h-[calc(100svh-4.6rem)] flex-col justify-end pb-16 pt-20 sm:justify-center sm:pb-24">
          <div className="max-w-4xl">
            <p className="animate-fade-up eyebrow text-[var(--brand-pink-soft)]">
              Admissions open · Session {CURRENT_SESSION}
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
              Faith-rooted education from Creche through Senior Secondary —
              nurturing every child with care, discipline, and joy.
            </h1>
            <p className="animate-fade-up-delay mt-3 text-sm font-semibold uppercase tracking-[0.16em] text-white/70">
              {SCHOOL_MOTTO}
            </p>
            <div className="animate-fade-up-delay-2 mt-9 flex flex-wrap gap-3">
              <Link href="/admissions" className="btn-primary">
                Start admissions
              </Link>
              <Link href="/gallery" className="btn-secondary">
                See campus life
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
            {SCHOOL_NAME} welcomes children at every stage — Creche, Pre-Nursery,
            Nursery, Basic, Junior Secondary, and Senior Secondary — with teaching
            that is warm, structured, and mission-minded.
          </p>
        </div>

        <div className="site-container mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CLASS_BANDS.map((band, index) => (
            <article
              key={band.title}
              className="group relative overflow-hidden rounded-2xl min-h-[220px]"
            >
              <Image
                src={BAND_PHOTOS[index]}
                alt={band.title}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              />
              <div
                className={`absolute inset-0 ${
                  index % 2 === 0
                    ? "bg-[linear-gradient(180deg,rgba(12,47,109,0.2)_0%,rgba(12,47,109,0.88)_100%)]"
                    : "bg-[linear-gradient(180deg,rgba(226,59,120,0.15)_0%,rgba(226,59,120,0.88)_100%)]"
                }`}
              />
              <div className="relative flex h-full min-h-[220px] flex-col justify-end p-6 text-white">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/75">
                  {band.range}
                </p>
                <h3 className="mt-2 font-display text-2xl font-semibold">{band.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/85">{band.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section-pad pt-0">
        <div className="site-container overflow-hidden rounded-[1.75rem] bg-[var(--brand-blue-deep)] text-white">
          <div className="grid lg:grid-cols-2">
            <div className="relative min-h-[280px] lg:min-h-[400px]">
              <Image
                src={CAMPUS.nurseryClass}
                alt="Nursery learners in Peace Concept uniforms"
                fill
                className="object-cover object-[center_30%]"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
            <div className="flex flex-col justify-center p-8 sm:p-12">
              <p className="eyebrow text-[var(--brand-pink-soft)]">Session {CURRENT_SESSION}</p>
              <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight">
                Enrolment is open across every class.
              </h2>
              <p className="mt-4 max-w-md text-base leading-relaxed text-white/75">
                Apply online for Creche, Pre-Nursery, Nursery 1–2, Basic 1–5,
                JSS1–3, or SS1–3. Our admissions team will guide your family
                through the next steps.
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
              Faces of Peace Concept
            </h2>
          </div>
          <Link href="/gallery" className="btn-outline">
            Open gallery
          </Link>
        </div>
        <div className="site-container mt-10 grid grid-cols-2 gap-3 md:grid-cols-3">
          {CAMPUS_MOSAIC.map((item, index) => (
            <Link
              key={item.src}
              href="/gallery"
              className={`relative overflow-hidden rounded-[1.25rem] ${
                index === 0 ? "col-span-2 aspect-[16/9] md:col-span-2" : "aspect-[4/5]"
              }`}
            >
              <Image
                src={item.src}
                alt={item.label}
                fill
                className="object-cover transition-transform duration-700 hover:scale-105"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-4 pb-4 pt-10 text-sm font-bold text-white">
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section-pad pt-0">
        <div className="site-container flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Campus news</p>
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
                    unoptimized={item.image.startsWith("/media/")}
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
