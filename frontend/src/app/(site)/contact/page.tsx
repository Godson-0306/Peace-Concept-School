import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import EnquiryForm from "@/components/EnquiryForm";
import ApplicationForm from "@/components/ApplicationForm";
import SchoolMap, { MAP_DIRECTIONS_URL } from "@/components/SchoolMap";
import {
  SCHOOL_ADDRESS_LINE,
  SCHOOL_EMAIL,
  SCHOOL_HOURS,
  SCHOOL_NAME,
  SCHOOL_PHONE,
} from "@/lib/brand";
import { CAMPUS } from "@/lib/campusPhotos";

export const metadata: Metadata = {
  title: "Contact",
  description: `Contact ${SCHOOL_NAME} — find us on the map, enquire online, or apply for admission.`,
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="We would love to welcome your family"
        description="Reach the school office for visits, fee enquiries, or admissions support — from Day Care through SS3."
        image={CAMPUS.primaryClass}
      />

      <section className="section-pad">
        <div className="site-container">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Find us</p>
              <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-[var(--brand-blue-deep)]">
                Visit our campus
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
                {SCHOOL_NAME} — {SCHOOL_ADDRESS_LINE}
              </p>
            </div>
            <a
              href={MAP_DIRECTIONS_URL}
              target="_blank"
              rel="noreferrer"
              className="btn-outline"
            >
              Open in Google Maps
            </a>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-[1.35fr_0.85fr]">
            <SchoolMap className="min-h-[320px] h-[420px] sm:h-[480px]" />

            <div className="flex flex-col justify-between gap-5 rounded-[1.75rem] bg-[linear-gradient(160deg,var(--brand-blue-deep)_0%,#163f8a_55%,var(--brand-pink)_140%)] p-8 text-white sm:p-10">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/70">
                  School office
                </p>
                <h3 className="mt-3 font-display text-3xl font-semibold tracking-tight">
                  Come see us
                </h3>
                <address className="mt-5 space-y-3 text-sm not-italic leading-relaxed text-white/85">
                  <p className="font-semibold text-white">{SCHOOL_NAME}</p>
                  <p>{SCHOOL_ADDRESS_LINE}</p>
                  <p>
                    Phone:{" "}
                    <a
                      href={`tel:${SCHOOL_PHONE.replace(/\s/g, "")}`}
                      className="font-semibold text-white underline-offset-2 hover:underline"
                    >
                      {SCHOOL_PHONE}
                    </a>
                  </p>
                  <p>
                    Email:{" "}
                    <a
                      href={`mailto:${SCHOOL_EMAIL}`}
                      className="font-semibold text-white underline-offset-2 hover:underline"
                    >
                      {SCHOOL_EMAIL}
                    </a>
                  </p>
                  <p>Office hours: {SCHOOL_HOURS}</p>
                </address>
              </div>

              <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                <p className="text-sm font-semibold text-white">Planning a visit?</p>
                <p className="mt-1 text-sm text-white/75">
                  Send an enquiry below and our office will help you schedule a
                  campus tour.
                </p>
                <a
                  href="#enquiry"
                  className="mt-4 inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[var(--brand-blue-deep)] transition hover:bg-white/90"
                >
                  Make an enquiry
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-pad pt-0">
        <div className="site-container grid gap-6 lg:grid-cols-1">
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
