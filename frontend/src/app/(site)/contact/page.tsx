import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import EnquiryForm from "@/components/EnquiryForm";
import ApplicationForm from "@/components/ApplicationForm";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact Peace Concept School — online enquiry and admission application forms.",
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="We would love to hear from you"
        description="Reach the school office for visits, fee enquiries, or admissions support. You may also submit an online enquiry or application below."
      />

      <section className="section-pad">
        <div className="site-container grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="font-display text-3xl font-semibold text-[var(--brand-green)]">
              School office
            </h2>
            <address className="mt-5 space-y-3 text-sm not-italic leading-relaxed text-[var(--muted)]">
              <p>Peace Concept School Campus</p>
              <p>Along Unity Road, Abeokuta, Ogun State, Nigeria</p>
              <p>
                Phone:{" "}
                <a
                  href="tel:+2348012345678"
                  className="font-medium text-[var(--brand-green)] hover:underline"
                >
                  +234 801 234 5678
                </a>
              </p>
              <p>
                Email:{" "}
                <a
                  href="mailto:info@peaceconceptschool.ng"
                  className="font-medium text-[var(--brand-green)] hover:underline"
                >
                  info@peaceconceptschool.ng
                </a>
              </p>
              <p>Office hours: Mon–Fri, 8:00 a.m. – 3:30 p.m.</p>
            </address>
          </div>

          <div
            id="enquiry"
            className="rounded-sm border border-[var(--line)] bg-[rgba(255,255,255,0.7)] p-6 sm:p-8"
          >
            <h2 className="font-display text-3xl font-semibold text-[var(--brand-green)]">
              Online enquiry
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Ask about admissions, visits, or general school information.
            </p>
            <div className="mt-6">
              <EnquiryForm />
            </div>
          </div>
        </div>
      </section>

      <section
        id="application"
        className="border-t border-[var(--line)] bg-[rgba(255,255,255,0.45)] section-pad"
      >
        <div className="site-container max-w-3xl">
          <h2 className="font-display text-3xl font-semibold text-[var(--brand-green)] sm:text-4xl">
            Admission application
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
            Apply for JSS1–SSS3 for the 2025/2026 academic session. Fields marked
            as required must be completed for the admissions office to process
            your request.
          </p>
          <div className="mt-8 rounded-sm border border-[var(--line)] bg-white/80 p-6 sm:p-8">
            <ApplicationForm />
          </div>
        </div>
      </section>
    </>
  );
}
