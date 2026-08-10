import type { Metadata } from "next";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Academics",
  description:
    "Academic programmes at Peace Concept School — Junior Secondary (JSS) and Senior Secondary (SSS).",
};

export default function AcademicsPage() {
  return (
    <>
      <PageHero
        eyebrow="Academics"
        title="A clear pathway from JSS to SSS"
        description="Our curriculum aligns with Nigerian secondary standards while emphasising deep understanding, practical skills, and examination readiness."
      />

      <section className="section-pad">
        <div className="site-container grid gap-12 lg:grid-cols-2">
          <article>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-gold)]">
              Junior Secondary
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold text-[var(--brand-green)]">
              JSS1 – JSS3
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
              Students build strong foundations across English Language,
              Mathematics, Basic Science &amp; Technology, Social Studies,
              Nigerian Languages, Creative Arts, Religious &amp; National Values,
              and Business Studies. Continuous assessment and termly examinations
              track progress.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-[var(--muted)]">
              <li>Literacy and numeracy mastery blocks</li>
              <li>Introductory STEM practicals</li>
              <li>Civic education and peace education</li>
              <li>Clubs: debate, ICT, agriculture, music</li>
            </ul>
          </article>

          <article>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-gold)]">
              Senior Secondary
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold text-[var(--brand-green)]">
              SSS1 – SSS3
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
              Senior students pursue Science, Commercial, or Arts pathways with
              core subjects including English Language, Mathematics, and Civic
              Education. Teaching prepares candidates for WAEC SSCE, NECO, and
              post-secondary entrance examinations.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-[var(--muted)]">
              <li>Science: Physics, Chemistry, Biology, Further Maths</li>
              <li>Commercial: Accounting, Economics, Commerce</li>
              <li>Arts: Literature, Government, CRS/IRS, History</li>
              <li>Career guidance and tertiary counselling</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="border-y border-[var(--line)] bg-[rgba(255,255,255,0.45)] section-pad">
        <div className="site-container max-w-3xl">
          <h2 className="font-display text-3xl font-semibold text-[var(--brand-green)]">
            Assessment &amp; support
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">
            Each term includes formative quizzes, mid-term tests, and a
            comprehensive examination. Parents receive report sheets with subject
            comments and attendance records. Students needing extra help join
            after-school clinics in English, Mathematics, and Sciences.
          </p>
          <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">
            For the 2025/2026 session, SSS3 candidates also access an intensive
            WAEC Prep Clinic in the second term.
          </p>
        </div>
      </section>
    </>
  );
}
