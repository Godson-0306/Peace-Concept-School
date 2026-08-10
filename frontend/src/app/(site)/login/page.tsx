import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";
import { SCHOOL_NAME, SCHOOL_SHORT } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Login",
  description: `Sign in to the ${SCHOOL_NAME} management portal.`,
};

export default function LoginPage() {
  return (
    <section className="relative min-h-[calc(100svh-4.6rem)] overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src="https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=2200&q=80"
          alt=""
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[linear-gradient(118deg,rgba(12,47,109,0.92)_0%,rgba(22,73,160,0.78)_45%,rgba(226,59,120,0.55)_100%)]" />
      </div>

      <div className="site-container relative grid min-h-[calc(100svh-4.6rem)] items-center gap-10 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-16">
        <div className="animate-fade-up text-white">
          <Image
            src="/pcims-logo.jpeg"
            alt={`${SCHOOL_NAME} logo`}
            width={72}
            height={72}
            className="h-[4.5rem] w-[4.5rem] rounded-full bg-white object-contain p-1 shadow-sm"
            priority
          />
          <p className="mt-7 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            {SCHOOL_SHORT}
          </p>
          <p className="mt-2 text-lg font-medium text-white/85 sm:text-xl">
            International Mission Schools
          </p>
          <span
            aria-hidden
            className="animate-gold-line mt-6 block h-1 w-20 rounded-full bg-[var(--brand-pink-soft)]"
          />
          <p className="mt-6 max-w-md text-base leading-relaxed text-white/80 sm:text-lg">
            Sign in to your portal — students with Student ID, staff with the
            username created at registration.
          </p>
          <p className="mt-8 text-sm text-white/65">
            Need an account? Contact the school office.{" "}
            <Link href="/contact" className="font-semibold text-white underline-offset-4 hover:underline">
              Get in touch
            </Link>
          </p>
        </div>

        <div className="animate-fade-up-delay w-full max-w-md justify-self-center lg:justify-self-end">
          <div className="rounded-[1.4rem] border border-white/20 bg-white/95 p-7 shadow-[0_28px_60px_rgba(12,47,109,0.28)] backdrop-blur-sm sm:p-9">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-blue)]">
              Portal access
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-[var(--brand-blue-deep)] sm:text-4xl">
              Sign in
            </h1>
            <p className="mt-3 text-sm text-[var(--muted)]">
              Accounts are created by {SCHOOL_NAME} administrators only — there
              is no public signup.
            </p>
            <div className="mt-7">
              <Suspense
                fallback={
                  <p className="text-sm text-[var(--muted)]">Loading form...</p>
                }
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
