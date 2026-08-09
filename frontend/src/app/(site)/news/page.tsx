import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import PageHero from "@/components/PageHero";
import { newsItems } from "@/lib/news";

export const metadata: Metadata = {
  title: "News & Events",
  description:
    "Latest news, announcements, and events from Peace Concept School.",
};

export default function NewsPage() {
  return (
    <>
      <PageHero
        eyebrow="News & Events"
        title="Stay connected with school life"
        description="Announcements, academic updates, and community events across the 2025/2026 session."
      />

      <section className="section-pad">
        <div className="site-container grid gap-10 md:grid-cols-2">
          {newsItems.map((item) => (
            <article key={item.slug} className="group border-t border-[var(--line)] pt-6">
              <div className="relative mb-5 aspect-[16/9] overflow-hidden rounded-sm bg-[var(--brand-green)]">
                {item.image ? (
                  <Image
                    src={item.image}
                    alt=""
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                ) : null}
              </div>
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                {item.category} ·{" "}
                {new Date(item.date).toLocaleDateString("en-NG", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <h2 className="mt-2 font-display text-3xl font-semibold text-[var(--brand-green)]">
                <Link href={`/news/${item.slug}`} className="hover:underline">
                  {item.title}
                </Link>
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
                {item.excerpt}
              </p>
              <Link
                href={`/news/${item.slug}`}
                className="mt-4 inline-block text-sm font-semibold text-[var(--brand-green)] underline-offset-4 hover:underline"
              >
                Read more
              </Link>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
