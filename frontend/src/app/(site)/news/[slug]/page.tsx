import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  getPublicNewsBySlug,
  getPublicNewsSlugs,
} from "@/lib/websiteContent";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const slugs = await getPublicNewsSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = await getPublicNewsBySlug(slug);
  if (!item) return { title: "News" };
  return {
    title: item.title,
    description: item.excerpt,
  };
}

export default async function NewsDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = await getPublicNewsBySlug(slug);
  if (!item) notFound();

  return (
    <article>
      <section className="relative min-h-[42vh] overflow-hidden bg-[var(--brand-green-deep)] text-white">
        {item.image ? (
          <Image
            src={item.image}
            alt=""
            fill
            priority
            className="object-cover opacity-45"
            sizes="100vw"
            unoptimized={item.image.startsWith("/media/")}
          />
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,53,117,0.35)_0%,rgba(11,53,117,0.85)_100%)]" />
        <div className="site-container relative flex min-h-[42vh] flex-col justify-end py-14">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-pink-soft)]">
            {item.category} ·{" "}
            {new Date(item.date).toLocaleDateString("en-NG", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            {item.title}
          </h1>
        </div>
      </section>

      <section className="section-pad">
        <div className="site-container max-w-3xl">
          <Link
            href="/news"
            className="text-sm font-bold text-[var(--brand-blue)] hover:text-[var(--brand-pink)]"
          >
            ← Back to news
          </Link>
          <div className="mt-8 space-y-5 text-base leading-relaxed text-[var(--muted)]">
            {item.body.split("\n\n").map((paragraph) => (
              <p key={paragraph.slice(0, 24)}>{paragraph}</p>
            ))}
          </div>
        </div>
      </section>
    </article>
  );
}
