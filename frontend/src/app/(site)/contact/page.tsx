import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import EnquiryForm from "@/components/EnquiryForm";
import ApplicationForm from "@/components/ApplicationForm";
import { SCHOOL_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Contact",
  description: `Contact ${SCHOOL_NAME} — online enquiry and admission application forms.`,
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="We would love to welcome your family"
        description="Reach the school office for visits, fee enquiries, or admissions support — from Day Care through SS3."
      />

      <section className="section-pad">
        <div className="site-container grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl bg-[var(--brand-blue-deep)] p-8 text-white sm:p-10">
            <h2 className="font-display text-3xl font-semibold tracking-tight">
              School office
            </h2>
            <address className="mt-5 space-y-3 text-sm not-italic leading-relaxed text-white/80">
              <p>{SCHOOL_NAME}</p>
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
            className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-[0_14px_34px_rgba(26,34,51,0.05)] sm:p-8"
          >
            <h2 className="font-display text-3xl font-semibold tracking-tight text-[var(--brand-blue-deep)]">
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
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-[var(--brand-blue-deep)]">
            Admission application
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
            Apply for Day Care, Nursery, Basic, JSS, or SS for the 2025/2026
            academic session. Required fields must be completed for processing.
          </p>
          <div className="mt-8 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-[0_14px_34px_rgba(26,34,51,0.05)] sm:p-8">
            <ApplicationForm />
          </div>
        </div>
      </section>
    </>
  );
}
