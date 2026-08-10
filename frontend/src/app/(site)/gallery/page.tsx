import type { Metadata } from "next";
import Image from "next/image";
import PageHero from "@/components/PageHero";
import { getPublicGallery } from "@/lib/websiteContent";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Campus life and events at Peace Concept International Mission Schools.",
};

export default async function GalleryPage() {
  const gallery = await getPublicGallery();

  return (
    <>
      <PageHero
        eyebrow="Gallery"
        title="Life on campus, in colour"
        description="Learning, sport, and celebration — glimpses of Peace Concept International Mission Schools."
        image="https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1800&q=80"
      />

      <section className="section-pad">
        <div className="site-container grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gallery.map((item, index) => (
            <figure
              key={item.id}
              className={`relative overflow-hidden rounded-[1.5rem] ${
                index % 5 === 0
                  ? "sm:col-span-2 sm:aspect-[21/9]"
                  : "aspect-[4/3]"
              }`}
            >
              <Image
                src={item.src}
                alt={item.label}
                fill
                className="object-cover transition-transform duration-700 hover:scale-105"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                unoptimized={item.src.startsWith("/media/")}
              />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 pb-4 pt-12 text-sm font-bold text-white">
                {item.label}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </>
  );
}
