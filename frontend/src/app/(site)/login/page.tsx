import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";
import { SCHOOL_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Login",
  description: `Sign in to the ${SCHOOL_NAME} management portal.`,
};

export default function LoginPage() {
  return (
    <section className="section-pad">
      <div className="site-container grid min-h-[65vh] place-items-center">
        <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[0_22px_50px_rgba(26,34,51,0.08)]">
          <div className="bg-[linear-gradient(120deg,var(--brand-blue),var(--brand-pink))] px-7 py-6 text-white sm:px-9">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/80">
              Staff &amp; family portal
            </p>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">
              Sign in
            </h1>
          </div>
          <div className="p-7 sm:p-9">
            <p className="text-sm text-[var(--muted)]">
              Use your {SCHOOL_NAME} account. New accounts are created by the
              school administrator only.
            </p>
            <div className="mt-7">
              <Suspense
                fallback={<p className="text-sm text-[var(--muted)]">Loading form...</p>}
              >
                <LoginForm />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
