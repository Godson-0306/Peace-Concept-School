import { SCHOOL_ADDRESS_LINE } from "@/lib/brand";

type SchoolMapProps = {
  className?: string;
  title?: string;
};

const MAP_QUERY = encodeURIComponent(SCHOOL_ADDRESS_LINE);

const MAP_EMBED_SRC = `https://maps.google.com/maps?q=${MAP_QUERY}&z=17&output=embed`;

export const MAP_DIRECTIONS_URL = `https://www.google.com/maps/search/?api=1&query=${MAP_QUERY}`;

export default function SchoolMap({
  className = "",
  title = "School location map",
}: SchoolMapProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-[1.75rem] border border-[var(--line)] bg-[var(--brand-blue-wash)] shadow-[0_20px_50px_rgba(26,34,51,0.08)] ${className}`}
    >
      <iframe
        src={MAP_EMBED_SRC}
        title={title}
        className="absolute inset-0 h-full w-full border-0"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/35 to-transparent"
      />
    </div>
  );
}
