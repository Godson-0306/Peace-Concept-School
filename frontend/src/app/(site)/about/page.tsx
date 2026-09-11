import type { Metadata } from "next";
import Image from "next/image";
import PageHero from "@/components/PageHero";
import { CURRENT_SESSION, SCHOOL_MOTTO, SCHOOL_NAME } from "@/lib/brand";
import { CAMPUS } from "@/lib/campusPhotos";

export const metadata: Metadata = {
  title: "About the School",
  description: `Learn about ${SCHOOL_NAME} — Creche through Senior Secondary.`,
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About us"
        title="A mission school for every stage of childhood"
        description={`${SCHOOL_NAME} serves families seeking faith-rooted education from Creche and Pre-Nursery through Nursery, Basic, Junior Secondary, and Senior Secondary.`}
        image={CAMPUS.secondaryClass}
      />

      <section className="section-pad">
        <div className="site-container grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl bg-[var(--brand-blue)] p-8 text-white sm:p-10">
            <p className="text-sm font-bold text-white/70">Mission</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Raise children in wisdom, character, and peace.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/80">
              We form confident learners who love God, pursue excellence, and
              serve their communities — from their earliest years through SS3.
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--brand-pink)] p-8 text-white sm:p-10">
            <p className="text-sm font-bold text-white/70">Motto</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {SCHOOL_MOTTO}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/80">
              Our crest — an open book and a lamp — reminds every learner that
              knowledge and character grow together, in class and on campus.
            </p>
          </div>
        </div>
      </section>

      <section className="section-pad pt-0">
        <div className="site-container grid gap-3 sm:grid-cols-3">
          {[
            { src: CAMPUS.studentSmile, label: "A Peace Concept student in uniform" },
            { src: CAMPUS.scienceLab, label: "Hands-on science in the laboratory" },
            { src: CAMPUS.primaryClass, label: "Class portrait with form teacher" },
          ].map((item) => (
            <figure
              key={item.src}
              className="relative aspect-[4/5] overflow-hidden rounded-[1.4rem]"
            >
              <Image
                src={item.src}
                alt={item.label}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 33vw"
              />
            </figure>
          ))}
        </div>
      </section>

      <section className="section-pad pt-0">
        <div className="site-container">
          <p className="eyebrow">What guides us</p>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-[var(--brand-blue-deep)]">
            Values that shape campus life
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              {
                title: "Excellence",
                copy: "High expectations with patient support — in Creche playrooms and SS examination halls alike.",
              },
              {
                title: "Discipline",
                copy: "Clear routines and respectful conduct that help every learner feel safe and focused.",
              },
              {
                title: "Mission",
                copy: "Faith, service, and peace woven into teaching, assemblies, and community life.",
              },
            ].map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-[var(--line)] bg-white p-7 shadow-[0_14px_34px_rgba(26,34,51,0.05)]"
              >
                <h3 className="font-display text-2xl font-semibold text-[var(--brand-blue-deep)]">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{item.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-pad pt-0">
        <div className="site-container max-w-3xl rounded-2xl bg-[var(--brand-blue-wash)] p-8 sm:p-12">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-[var(--brand-blue-deep)] sm:text-4xl">
            Leadership &amp; campus life
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">
            Led by a committed principal and teaching team, our Port Harcourt
            campus includes early-years spaces, primary classrooms, science
            laboratories, a library, sports field, and halls for worship and
            celebration.
          </p>
          <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">
            Session {CURRENT_SESSION} continues our promise: every child known by
            name — from Creche to SS3.
          </p>
        </div>
      </section>
    </>
  );
}
