export function SectionIntro({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow: string;
  title: string;
  description: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
          {eyebrow}
        </p>
        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--foreground)] md:text-5xl">
          {title}
        </h1>
        <p className="max-w-2xl text-base leading-8 text-[var(--muted-strong)] md:text-lg">
          {description}
        </p>
      </div>
      {aside ? <div className="lg:max-w-sm">{aside}</div> : null}
    </div>
  );
}
