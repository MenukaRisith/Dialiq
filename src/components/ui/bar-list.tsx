export function BarList({
  items,
}: {
  items: Array<{ label: string; value: number; detail: string }>;
}) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.label} className="space-y-2">
          <div className="flex items-center justify-between gap-4 text-sm">
            <div>
              <p className="font-semibold text-[var(--foreground)]">{item.label}</p>
              <p className="text-[var(--muted)]">{item.detail}</p>
            </div>
            <p className="font-mono text-xs text-[var(--muted-strong)]">{item.value}%</p>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-black/5">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),#d89c5a)]"
              style={{ width: `${(item.value / maxValue) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
