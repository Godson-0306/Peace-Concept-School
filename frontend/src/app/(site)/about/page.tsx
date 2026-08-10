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
        eyebrow="About"
        title="A secondary school rooted in peace and purpose"
        description="Peace Concept School serves Nigerian families seeking rigorous Junior and Senior Secondary education within a disciplined, values-driven community."
      />

      <section className="section-pad">
        <div className="site-container grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-semibold text-[var(--brand-green)] sm:text-4xl">
              Our mission
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">
              We exist to form confident learners who pursue academic excellence,
              practise integrity, and contribute peaceably to their communities.
              From JSS1 through SSS3, teaching is intentional, assessment is
              continuous, and every child is known by name.
            </p>
          </div>
          <div>
            <h2 className="font-display text-3xl font-semibold text-[var(--brand-green)] sm:text-4xl">
              Our vision
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">
              To be a trusted Nigerian secondary school where scholarship and
              character grow together — preparing graduates for tertiary study,
              entrepreneurship, and responsible citizenship.
            </p>
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--line)] bg-[rgba(255,255,255,0.45)] section-pad">
        <div className="site-container">
          <h2 className="font-display text-3xl font-semibold text-[var(--brand-green)] sm:text-4xl">
            What guides us
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
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
                copy: "Conflict resolution, empathy, and community service woven into school life.",
              },
            ].map((item) => (
              <article key={item.title} className="border-t border-[var(--brand-gold)] pt-5">
                <h3 className="font-display text-2xl font-semibold text-[var(--brand-green)]">
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

      <section className="section-pad">
        <div className="site-container max-w-3xl">
          <h2 className="font-display text-3xl font-semibold text-[var(--brand-green)] sm:text-4xl">
            Leadership &amp; campus life
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">
            The school is led by an experienced principal and academic team
            committed to transparent communication with parents. Our campus in
            Abeokuta includes classrooms, science laboratories, a library,
            sports field, and spaces for clubs ranging from debate to STEM and
            cultural arts.
          </p>
          <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">
            Session 2025/2026 continues our commitment to small-group attention,
            continuous assessment, and holistic development for every student in
            Junior and Senior Secondary.
          </p>
        </div>
      </section>
    </>
  );
}
