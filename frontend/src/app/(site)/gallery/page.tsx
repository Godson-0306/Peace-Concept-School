import type { Metadata } from "next";
import Image from "next/image";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Campus life and events at Peace Concept School.",
};

type GalleryItem =
  | { kind: "image"; src: string; label: string }
  | { kind: "gradient"; title: string; gradient: string };

const gallery: GalleryItem[] = [
  {
    kind: "image",
    src: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=1200&q=80",
    label: "Morning assembly",
  },
  {
    kind: "image",
    src: "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1200&q=80",
    label: "Classroom learning",
  },
  {
    kind: "image",
    src: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=80",
    label: "Sports day",
  },
  {
    kind: "image",
    src: "https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=1200&q=80",
    label: "Parent forum",
  },
  {
    kind: "image",
    src: "https://images.unsplash.com/photo-1523050854058-8bc2c4e4cd81?auto=format&fit=crop&w=1200&q=80",
    label: "Graduation rehearsal",
  },
  {
    kind: "image",
    src: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1200&q=80",
    label: "Library corner",
  },
  {
    kind: "gradient",
    title: "Science practicals",
    gradient: "from-[#0A2F6E] to-[#2F74D0]",
  },
  {
    kind: "gradient",
    title: "Cultural day",
    gradient: "from-[#1450A3] to-[#E83D7A]",
  },
];

export default function GalleryPage() {
  return (
    <>
      <PageHero
        eyebrow="Gallery"
        title="Life on campus, in colour"
        description="Learning, sport, and celebration — glimpses of Peace Concept School."
        image="https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1800&q=80"
      />

      <section className="section-pad">
        <div className="site-container grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gallery.map((item, index) => {
            const key = item.kind === "image" ? item.src : item.title;
            const caption = item.kind === "image" ? item.label : item.title;

            return (
              <figure
                key={key}
                className={`relative overflow-hidden rounded-[1.5rem] ${
                  index % 5 === 0
                    ? "sm:col-span-2 sm:aspect-[21/9]"
                    : "aspect-[4/3]"
                }`}
              >
                {item.kind === "image" ? (
                  <Image
                    src={item.src}
                    alt={item.label}
                    fill
                    className="object-cover transition-transform duration-700 hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : (
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${item.gradient}`}
                  />
                )}
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 pb-4 pt-12 text-sm font-bold text-white">
                  {caption}
                </figcaption>
              </figure>
            );
          })}
        </div>
      </section>
    </>
  );
}
