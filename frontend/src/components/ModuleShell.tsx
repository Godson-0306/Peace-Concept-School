type ModuleShellProps = {
  title: string;
  description: string;
};

export default function ModuleShell({ title, description }: ModuleShellProps) {
  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-pink)]">
        Module
      </p>
      <h1 className="mt-2 font-display text-4xl font-semibold text-[var(--brand-blue-deep)]">
        {title}
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--muted)]">
        {description}
      </p>
      <div className="mt-8 rounded-2xl border border-[var(--line)] bg-white/80 px-6 py-8">
        <p className="text-sm font-semibold text-[var(--brand-blue)]">
          Coming next
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          This module shell is ready in the portal navigation. Full workflows
          will be connected in a following pass.
        </p>
      </div>
    </div>
  );
}
