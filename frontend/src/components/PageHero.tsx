import Image from "next/image";

type PageHeroProps = {
  eyebrow?: string;
  title: string;
  description: string;
  image?: string;
};

export default function PageHero({
  eyebrow,
  title,
  description,
  image = "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1800&q=80",
}: PageHeroProps) {
  return (
    <section className="relative overflow-hidden text-white">
      <div className="absolute inset-0">
        <Image
          src={image}
          alt=""
          fill
          priority
          className="animate-soft-zoom object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(10,47,110,0.92)_0%,rgba(20,80,163,0.78)_48%,rgba(232,61,122,0.55)_100%)]" />
      </div>

      <div className="site-container relative py-20 sm:py-24">
        {eyebrow ? (
          <p className="animate-fade-up inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-white backdrop-blur">
            <span className="animate-pulse-dot h-2 w-2 rounded-full bg-[var(--brand-pink-soft)]" />
            {eyebrow}
          </p>
        ) : null}
        <h1 className="animate-fade-up-delay mt-5 max-w-3xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
          {title}
        </h1>
        <p className="animate-fade-up-delay-2 mt-5 max-w-2xl text-base leading-relaxed text-white/85 sm:text-lg">
          {description}
        </p>
      </div>
    </section>
  );
}
