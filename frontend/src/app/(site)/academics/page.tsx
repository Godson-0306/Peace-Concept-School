import type { Metadata } from "next";
import Image from "next/image";
import PageHero from "@/components/PageHero";
import { CLASS_BANDS, SCHOOL_NAME } from "@/lib/brand";
import { CAMPUS } from "@/lib/campusPhotos";

export const metadata: Metadata = {
  title: "Academics",
  description: `Academic programmes at ${SCHOOL_NAME} — Creche, Pre-Nursery, Nursery, Basic, JSS, and SS.`,
};

export default function AcademicsPage() {
  return (
    <>
      <PageHero
        eyebrow="Academics"
        title="Learning that grows with your child"
        description="A clear pathway from Creche and Pre-Nursery through Nursery, Basic Education, Junior Secondary, and Senior Secondary."
        image={CAMPUS.scienceLab}
        imageClassName="object-cover object-[center_40%]"
      />

      <section className="section-pad">
        <div className="site-container grid gap-5 md:grid-cols-2">
          {CLASS_BANDS.map((band, index) => (
            <article
              key={band.title}
              className={`rounded-2xl p-8 sm:p-10 ${
                index % 2 === 0
                  ? "border border-[var(--line)] bg-white shadow-[0_14px_34px_rgba(26,34,51,0.05)]"
                  : "bg-[var(--brand-blue)] text-white"
              }`}
            >
              <p
                className={`text-xs font-bold uppercase tracking-[0.12em] ${
                  index % 2 === 0 ? "text-[var(--brand-pink)]" : "text-[var(--brand-pink-soft)]"
                }`}
              >
                {band.range}
              </p>
              <h2
                className={`mt-3 font-display text-3xl font-semibold tracking-tight ${
                  index % 2 === 0 ? "text-[var(--brand-blue-deep)]" : ""
                }`}
              >
                {band.title}
              </h2>
              <p
                className={`mt-4 text-sm leading-relaxed ${
                  index % 2 === 0 ? "text-[var(--muted)]" : "text-white/80"
                }`}
              >
                {band.copy}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-pad pt-0">
        <div className="site-container overflow-hidden rounded-[1.75rem] bg-[var(--brand-blue-deep)] text-white">
          <div className="grid lg:grid-cols-2">
            <div className="relative min-h-[280px] lg:min-h-[420px]">
              <Image
                src={CAMPUS.microscope}
                alt="A Peace Concept student using a microscope in the science laboratory"
                fill
                className="object-cover object-[center_30%]"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
            <div className="flex flex-col justify-center p-8 sm:p-12">
              <p className="eyebrow text-[var(--brand-pink-soft)]">STEM on campus</p>
              <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Science that students can see and touch.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-white/80">
                From Basic science tables to SS Chemistry, learners work in
                white coats at the microscope — observation, experiment, and
                careful recording, guided by their teachers.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-pad pt-0">
        <div className="site-container grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl bg-[var(--brand-pink-wash)] p-8 sm:p-10">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-[var(--brand-blue-deep)]">
              Early Years &amp; Basic
            </h2>
            <ul className="mt-5 space-y-2 text-sm font-medium text-[var(--brand-blue-deep)]">
              <li>• Creche: nurturing care for the youngest learners</li>
              <li>• Pre-Nursery: play, routine, and first social skills</li>
              <li>• Nursery 1–2: phonics, number sense, social skills</li>
              <li>• Basic 1–5: literacy, numeracy, science, civic values</li>
              <li>• Continuous observation and termly progress notes</li>
            </ul>
          </div>
          <div className="rounded-2xl bg-[var(--brand-blue-deep)] p-8 text-white sm:p-10">
            <h2 className="font-display text-3xl font-semibold tracking-tight">
              JSS &amp; SS pathways
            </h2>
            <ul className="mt-5 space-y-2 text-sm font-medium text-white/90">
              <li>• JSS1–3: broad foundation across core subjects</li>
              <li>• SS1–3: Science, Commercial, and Arts pathways</li>
              <li>• WAEC / NECO preparation and career guidance</li>
              <li>• Clubs, sports, and mission activities</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section-pad pt-0">
        <div className="site-container max-w-3xl rounded-2xl border border-[var(--line)] bg-white p-8 sm:p-12">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-[var(--brand-blue-deep)] sm:text-4xl">
            Assessment &amp; support
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">
            Younger learners are assessed through observation and developmental
            milestones. From Basic through SS, each term includes formative
            checks, mid-term tests, and examinations. Parents receive clear
            progress updates, and after-school clinics support English,
            Mathematics, and Sciences.
          </p>
        </div>
      </section>
    </>
  );
}
