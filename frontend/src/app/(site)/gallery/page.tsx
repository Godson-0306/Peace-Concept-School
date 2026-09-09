import type { Metadata } from "next";
import Image from "next/image";
import PageHero from "@/components/PageHero";
import { CAMPUS } from "@/lib/campusPhotos";
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
        image={CAMPUS.studentSmile}
      />

      <section className="section-pad">
        <div className="site-container grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gallery.map((item, index) => (
            <figure
              key={item.id}
              className={`relative overflow-hidden rounded-[1.5rem] ${
                index % 7 === 0
                  ? "sm:col-span-2 aspect-[4/5] sm:aspect-[5/4]"
                  : "aspect-[3/4]"
              }`}
            >
              <Image
                src={item.src}
                alt={item.label}
                fill
                className="object-cover object-[center_18%] transition-transform duration-700 hover:scale-105"
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
