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
    copy: "Successful candidates receive an offer letter and complete registration to secure a place.",
  },
];

export default function AdmissionsPage() {
  return (
    <>
      <PageHero
        eyebrow="Admissions 2025/2026"
        title="Your next chapter starts here"
        description="Applications are open for JSS1–JSS3 and SSS1–SSS3. Places are limited and filled on a rolling basis."
        image="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1800&q=80"
      />

      <section className="section-pad">
        <div className="site-container">
          <p className="eyebrow">Process</p>
          <h2 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-[var(--brand-blue-deep)]">
            How admission works
          </h2>
          <ol className="mt-10 grid gap-5 md:grid-cols-2">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className="rounded-[1.5rem] border border-[var(--line)] bg-white p-7 shadow-[0_16px_36px_rgba(16,24,40,0.05)]"
              >
                <p className="font-display text-4xl font-extrabold text-[var(--brand-pink)]">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-3 font-display text-2xl font-bold text-[var(--brand-blue-deep)]">
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

      <section className="section-pad pt-0">
        <div className="site-container grid gap-5 lg:grid-cols-2">
          <div className="rounded-[1.75rem] bg-[var(--brand-blue-deep)] p-8 text-white sm:p-10">
            <h2 className="font-display text-3xl font-extrabold tracking-tight">
              Entry requirements
            </h2>
            <ul className="mt-5 space-y-3 text-sm leading-relaxed text-white/80">
              <li>Completed application form with accurate bio-data</li>
              <li>Birth certificate or age declaration</li>
              <li>Last two term reports from previous school</li>
              <li>Passport photographs of student and guardian</li>
              <li>Transfer certificate for mid-stream admissions</li>
            </ul>
          </div>
          <div className="rounded-[1.75rem] bg-[var(--brand-pink-wash)] p-8 sm:p-10">
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-[var(--brand-blue-deep)]">
              Classes open
            </h2>
            <p className="mt-5 text-sm leading-relaxed text-[var(--muted)]">
              Applications are accepted for{" "}
              <strong className="text-[var(--ink)]">
                JSS1, JSS2, JSS3, SSS1, SSS2, and SSS3
              </strong>
              . Transfer students may be assessed for class placement based on
              prior performance and age.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
              Fee schedules and scholarship enquiries are available from the
              bursary after a provisional offer is issued.
            </p>
          </div>
        </div>
      </section>

      <section className="section-pad pt-0">
        <div className="site-container flex flex-col items-start gap-6 rounded-[1.75rem] border border-[var(--line)] bg-white p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
          <div>
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-[var(--brand-blue-deep)]">
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
