type SchoolMapProps = {
  className?: string;
  title?: string;
};

const MAP_EMBED_SRC =
  "https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d841.560257750101!2d6.991745034862992!3d4.854520074522954!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sng!4v1786384234962!5m2!1sen!2sng";

export const MAP_DIRECTIONS_URL =
  "https://www.google.com/maps?q=4.854520074522954,6.991745034862992";

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
