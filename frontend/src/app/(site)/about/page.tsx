import type { Metadata } from "next";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "About the School",
  description:
    "Learn about Peace Concept School — mission, values, and secondary education from JSS1 to SSS3.",
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About PCS"
        title="Peace with purpose. Learning with energy."
        description="Peace Concept School serves Nigerian families seeking rigorous Junior and Senior Secondary education within a warm, values-driven community."
      />

      <section className="section-pad">
        <div className="site-container grid gap-6 lg:grid-cols-2">
          <div className="rounded-[1.75rem] bg-[var(--brand-blue)] p-8 text-white sm:p-10">
            <p className="text-sm font-bold text-white/70">Mission</p>
            <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              Form confident learners of character.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/80">
              We pursue academic excellence, practise integrity, and contribute
              peaceably to our communities. From JSS1 through SSS3, teaching is
              intentional and every child is known by name.
            </p>
          </div>
          <div className="rounded-[1.75rem] bg-[var(--brand-pink)] p-8 text-white sm:p-10">
            <p className="text-sm font-bold text-white/70">Vision</p>
            <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              Scholarship and character, growing together.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/80">
              To be a trusted Nigerian secondary school preparing graduates for
              tertiary study, entrepreneurship, and responsible citizenship.
            </p>
          </div>
        </div>
      </section>

      <section className="section-pad pt-0">
        <div className="site-container">
          <p className="eyebrow">What guides us</p>
          <h2 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-[var(--brand-blue-deep)]">
            Three promises we keep daily.
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              {
                title: "Excellence",
                copy: "High expectations in every subject, with support that meets students where they are.",
              },
              {
                title: "Discipline",
                copy: "Clear routines and respectful conduct that free students to focus on learning.",
              },
              {
                title: "Peace",
                copy: "Empathy, conflict resolution, and community service woven into school life.",
              },
            ].map((item) => (
              <article
                key={item.title}
                className="rounded-[1.5rem] border border-[var(--line)] bg-white p-7 shadow-[0_16px_36px_rgba(16,24,40,0.05)]"
              >
                <h3 className="font-display text-2xl font-bold text-[var(--brand-blue-deep)]">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
                  {item.copy}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-pad pt-0">
        <div className="site-container max-w-3xl rounded-[1.75rem] bg-[var(--brand-blue-wash)] p-8 sm:p-12">
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-[var(--brand-blue-deep)] sm:text-4xl">
            Leadership &amp; campus life
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">
            Led by an experienced principal and academic team committed to clear
            communication with parents. Our Abeokuta campus includes classrooms,
            science laboratories, a library, sports field, and spaces for debate,
            STEM, and cultural arts.
          </p>
          <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">
            Session 2025/2026 continues our focus on continuous assessment and
            holistic development for every student in Junior and Senior Secondary.
          </p>
        </div>
      </section>
    </>
  );
}
