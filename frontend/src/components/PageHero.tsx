type PageHeroProps = {
  eyebrow?: string;
  title: string;
  description: string;
};

export default function PageHero({ eyebrow, title, description }: PageHeroProps) {
  return (
    <section className="relative overflow-hidden border-b border-[var(--line)] bg-[linear-gradient(135deg,#0B3D2E_0%,#124F3B_55%,#1A5C45_100%)] text-white">
      <div
        aria-hidden
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(196,163,90,0.35), transparent 40%), radial-gradient(circle at 80% 0%, rgba(255,255,255,0.12), transparent 35%)",
        }}
      />
      <div className="site-container relative py-16 sm:py-20">
        {eyebrow ? (
          <p className="animate-fade-up text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-gold)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="animate-fade-up-delay mt-3 max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          {title}
        </h1>
        <span
          aria-hidden
          className="animate-gold-line mt-5 block h-0.5 w-20 bg-[var(--brand-gold)]"
        />
        <p className="animate-fade-up-delay-2 mt-5 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">
          {description}
        </p>
      </div>
    </section>
  );
}
