import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Admissions",
  description:
    "Admissions information for Peace Concept School — JSS1 to SSS3, session 2025/2026.",
};

const steps = [
  {
    title: "Enquire or visit",
    copy: "Contact the school office or send an online enquiry to learn about available classes.",
  },
  {
    title: "Submit application",
    copy: "Complete the online application form with student and guardian details.",
  },
  {
    title: "Assessment & interview",
    copy: "Selected applicants sit a short entrance test and meet with the admissions team.",
  },
  {
    title: "Offer & registration",
    copy: "Successful candidates receive an offer letter and complete fee payment to secure a place.",
  },
];

export default function AdmissionsPage() {
  return (
    <>
      <PageHero
        eyebrow="Admissions 2025/2026"
        title="Join Peace Concept School"
        description="We welcome applications into JSS1–JSS3 and SSS1–SSS3 for the new academic session. Places are limited and filled on a rolling basis."
      />

      <section className="section-pad">
        <div className="site-container">
          <h2 className="font-display text-3xl font-semibold text-[var(--brand-green)] sm:text-4xl">
            How admission works
          </h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-2">
            {steps.map((step, index) => (
              <li key={step.title} className="border-t border-[var(--line)] pt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-gold)]">
                  Step {index + 1}
                </p>
                <h3 className="mt-2 font-display text-2xl font-semibold text-[var(--brand-green)]">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
                  {step.copy}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-y border-[var(--line)] bg-[rgba(255,255,255,0.45)] section-pad">
        <div className="site-container grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-semibold text-[var(--brand-green)]">
              Entry requirements
            </h2>
            <ul className="mt-5 space-y-3 text-sm leading-relaxed text-[var(--muted)]">
              <li>Completed application form with accurate bio-data</li>
              <li>Birth certificate or age declaration</li>
              <li>Last two term reports from previous school (where applicable)</li>
              <li>Passport photographs of student and guardian</li>
              <li>Transfer certificate for mid-stream admissions</li>
            </ul>
          </div>
          <div>
            <h2 className="font-display text-3xl font-semibold text-[var(--brand-green)]">
              Classes open
            </h2>
            <p className="mt-5 text-sm leading-relaxed text-[var(--muted)]">
              Applications are accepted for <strong className="text-[var(--ink)]">JSS1, JSS2, JSS3, SSS1, SSS2, and SSS3</strong>.
              Transfer students may be assessed for class placement based on prior
              performance and age.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
              Fee schedules and scholarship enquiries are available from the
              bursary office after a provisional offer is issued.
            </p>
          </div>
        </div>
      </section>

      <section className="section-pad">
        <div className="site-container flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-3xl font-semibold text-[var(--brand-green)]">
              Ready to begin?
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--muted)]">
              Submit an application online or send an enquiry — our admissions
              team responds within two working days.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/contact#application" className="btn-primary">
              Apply online
            </Link>
            <Link href="/contact#enquiry" className="btn-outline">
              Make an enquiry
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
