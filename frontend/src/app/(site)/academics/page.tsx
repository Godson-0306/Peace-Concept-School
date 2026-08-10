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
        description="Curriculum aligned with Nigerian secondary standards — deep understanding, practical skills, and exam readiness."
        image="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1800&q=80"
      />

      <section className="section-pad">
        <div className="site-container grid gap-5 lg:grid-cols-2">
          <article className="rounded-[1.75rem] border border-[var(--line)] bg-white p-8 shadow-[0_16px_36px_rgba(16,24,40,0.05)] sm:p-10">
            <p className="eyebrow">Junior Secondary</p>
            <h2 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-[var(--brand-blue-deep)]">
              JSS1 – JSS3
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
              Strong foundations across English, Mathematics, Basic Science &amp;
              Technology, Social Studies, Nigerian Languages, Creative Arts,
              Religious &amp; National Values, and Business Studies.
            </p>
            <ul className="mt-6 space-y-2 text-sm font-medium text-[var(--brand-blue-deep)]">
              <li>• Literacy and numeracy mastery blocks</li>
              <li>• Introductory STEM practicals</li>
              <li>• Civic and peace education</li>
              <li>• Clubs: debate, ICT, agriculture, music</li>
            </ul>
          </article>

          <article className="rounded-[1.75rem] bg-[var(--brand-blue)] p-8 text-white sm:p-10">
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--brand-pink-soft)]">
              Senior Secondary
            </p>
            <h2 className="mt-3 font-display text-4xl font-extrabold tracking-tight">
              SSS1 – SSS3
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/80">
              Science, Commercial, or Arts pathways with core English,
              Mathematics, and Civic Education — preparing candidates for WAEC,
              NECO, and post-secondary entrance exams.
            </p>
            <ul className="mt-6 space-y-2 text-sm font-medium text-white/90">
              <li>• Science: Physics, Chemistry, Biology, Further Maths</li>
              <li>• Commercial: Accounting, Economics, Commerce</li>
              <li>• Arts: Literature, Government, CRS/IRS, History</li>
              <li>• Career guidance and tertiary counselling</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="section-pad pt-0">
        <div className="site-container max-w-3xl rounded-[1.75rem] bg-[var(--brand-pink-wash)] p-8 sm:p-12">
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-[var(--brand-blue-deep)] sm:text-4xl">
            Assessment &amp; support
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">
            Each term includes formative quizzes, mid-term tests, and a
            comprehensive examination. Parents receive report sheets with subject
            comments and attendance. Extra help runs after school in English,
            Mathematics, and Sciences.
          </p>
          <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">
            For 2025/2026, SSS3 candidates also access an intensive WAEC Prep
            Clinic in the second term.
          </p>
        </div>
      </section>
    </>
  );
}
