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
        title="Let’s talk about your child’s next step"
        description="Visit the school office, call us, or submit an online enquiry / application below."
        image="https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1800&q=80"
      />

      <section className="section-pad">
        <div className="site-container grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[1.75rem] bg-[var(--brand-blue-deep)] p-8 text-white sm:p-10">
            <h2 className="font-display text-3xl font-extrabold tracking-tight">
              School office
            </h2>
            <address className="mt-5 space-y-3 text-sm not-italic leading-relaxed text-white/80">
              <p>Peace Concept School Campus</p>
              <p>Along Unity Road, Abeokuta, Ogun State, Nigeria</p>
              <p>
                Phone:{" "}
                <a href="tel:+2348012345678" className="font-semibold text-white hover:underline">
                  +234 801 234 5678
                </a>
              </p>
              <p>
                Email:{" "}
                <a
                  href="mailto:info@peaceconceptschool.ng"
                  className="font-semibold text-white hover:underline"
                >
                  info@peaceconceptschool.ng
                </a>
              </p>
              <p>Office hours: Mon–Fri, 8:00 a.m. – 3:30 p.m.</p>
            </address>
          </div>

          <div
            id="enquiry"
            className="rounded-[1.75rem] border border-[var(--line)] bg-white p-6 shadow-[0_16px_36px_rgba(16,24,40,0.05)] sm:p-8"
          >
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-[var(--brand-blue-deep)]">
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

      <section id="application" className="section-pad pt-0">
        <div className="site-container max-w-3xl">
          <p className="eyebrow">Admissions</p>
          <h2 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-[var(--brand-blue-deep)]">
            Admission application
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
            Apply for JSS1–SSS3 for the 2025/2026 academic session. Required
            fields must be completed for the admissions office to process your
            request.
          </p>
          <div className="mt-8 rounded-[1.75rem] border border-[var(--line)] bg-white p-6 shadow-[0_16px_36px_rgba(16,24,40,0.05)] sm:p-8">
            <ApplicationForm />
          </div>
        </div>
      </section>
    </>
  );
}
