export default function Loading() {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="rounded-[28px] border border-[color:var(--border)] bg-white/70 px-8 py-6 text-center shadow-[var(--shadow-card)] backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
          Dialiq
        </p>
        <p className="mt-3 text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">
          Preparing the workspace...
        </p>
      </div>
    </div>
  );
}
