import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import PageHero from "@/components/PageHero";
import { CAMPUS } from "@/lib/campusPhotos";
import { getPublicNews } from "@/lib/websiteContent";

export const metadata: Metadata = {
  title: "News & Events",
  description:
    "Latest news, announcements, and events from Peace Concept International Mission Schools.",
};

export default async function NewsPage() {
  const items = await getPublicNews();

  return (
    <>
      <PageHero
        eyebrow="News & Events"
        title="Stay in the campus loop"
        description="Announcements, academic updates, and community events across the 2025/2026 session."
        image={CAMPUS.hero}
      />

      <section className="section-pad">
        <div className="site-container grid gap-6 md:grid-cols-2">
          {items.map((item) => (
            <article
              key={item.slug}
              className="group overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-white shadow-[0_16px_36px_rgba(16,24,40,0.05)]"
            >
              <div className="relative aspect-[16/9] overflow-hidden bg-[var(--brand-blue)]">
                {item.image ? (
                  <Image
                    src={item.image}
                    alt=""
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    unoptimized={item.image.startsWith("/media/")}
                  />
                ) : null}
              </div>
              <div className="p-6">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-pink)]">
                  {item.category} ·{" "}
                  {new Date(item.date).toLocaleDateString("en-NG", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
                <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-[var(--brand-blue-deep)]">
                  <Link
                    href={`/news/${item.slug}`}
                    className="hover:text-[var(--brand-pink)]"
                  >
                    {item.title}
                  </Link>
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
                  {item.excerpt}
                </p>
                <Link
                  href={`/news/${item.slug}`}
                  className="mt-4 inline-flex text-sm font-bold text-[var(--brand-blue)]"
                >
                  Read more →
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
