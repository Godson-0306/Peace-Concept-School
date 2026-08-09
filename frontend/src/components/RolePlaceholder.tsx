type RolePlaceholderProps = {
  role: string;
  title: string;
  description: string;
  highlights: string[];
};

export default function RolePlaceholder({
  role,
  title,
  description,
  highlights,
}: RolePlaceholderProps) {
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-gold)]">
        {role} workspace
      </p>
      <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--brand-green)]">
        {title}
      </h1>
      <p className="mt-3 text-base leading-relaxed text-[var(--muted)]">{description}</p>

      <div className="mt-8 border border-[var(--line)] bg-white/70 p-6">
        <p className="text-sm font-semibold text-[var(--brand-green)]">
          Planned modules (placeholder)
        </p>
        <ul className="mt-4 space-y-2 text-sm text-[var(--muted)]">
          {highlights.map((item) => (
            <li key={item} className="border-t border-[var(--line)] pt-2 first:border-0 first:pt-0">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
