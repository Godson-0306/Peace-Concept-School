import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to the Peace Concept School management portal.",
};

export default function LoginPage() {
  return (
    <section className="section-pad">
      <div className="site-container grid min-h-[65vh] place-items-center">
        <div className="w-full max-w-md overflow-hidden rounded-[1.75rem] border border-[var(--line)] bg-white shadow-[0_24px_60px_rgba(16,24,40,0.08)]">
          <div className="bg-[linear-gradient(120deg,var(--brand-blue),var(--brand-pink))] px-7 py-6 text-white sm:px-9">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/80">
              Staff &amp; family portal
            </p>
            <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">
              Sign in
            </h1>
          </div>
          <div className="p-7 sm:p-9">
            <p className="text-sm text-[var(--muted)]">
              Use your Peace Concept School account. New accounts are created by
              the school administrator only.
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
