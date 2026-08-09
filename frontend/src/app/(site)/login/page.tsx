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
      <div className="site-container grid min-h-[60vh] place-items-center">
        <div className="w-full max-w-md rounded-sm border border-[var(--line)] bg-[rgba(255,255,255,0.8)] p-7 sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-gold)]">
            Staff &amp; portal access
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--brand-green)]">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Use your Peace Concept School account email and password. Registration
            is managed by the school administrator.
          </p>
          <div className="mt-7">
            <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading form...</p>}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>
    </section>
  );
}
