import Image from "next/image";
import { CAMPUS } from "@/lib/campusPhotos";

type PageHeroProps = {
  eyebrow?: string;
  title: string;
  description: string;
  image?: string;
  imageClassName?: string;
};

export default function PageHero({
  eyebrow,
  title,
  description,
  image = CAMPUS.hero,
  imageClassName = "object-cover object-[center_22%]",
}: PageHeroProps) {
  return (
    <section className="relative overflow-hidden text-white">
      <div className="absolute inset-0">
        <Image
          src={image}
          alt=""
          fill
          priority
          className={`animate-soft-zoom ${imageClassName}`}
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[linear-gradient(118deg,rgba(12,47,109,0.9)_0%,rgba(22,73,160,0.72)_50%,rgba(226,59,120,0.5)_100%)]" />
      </div>

      <div className="site-container relative py-20 sm:py-24">
        {eyebrow ? <p className="animate-fade-up eyebrow text-[var(--brand-pink-soft)]">{eyebrow}</p> : null}
        <h1 className="animate-fade-up-delay mt-4 max-w-3xl font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl md:text-[3.4rem]">
          {title}
        </h1>
        <span
          aria-hidden
          className="animate-gold-line mt-6 block h-1 w-20 rounded-full bg-[var(--brand-pink-soft)]"
        />
        <p className="animate-fade-up-delay-2 mt-5 max-w-2xl text-base leading-relaxed text-white/85 sm:text-lg">
          {description}
        </p>
      </div>
    </section>
  );
}
