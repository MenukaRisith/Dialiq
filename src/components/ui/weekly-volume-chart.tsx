import type { WeeklyVolumePoint } from "@/lib/types";

export function WeeklyVolumeChart({
  points,
}: {
  points: WeeklyVolumePoint[];
}) {
  const maxCalls = Math.max(...points.map((point) => point.calls), 1);

  return (
    <div className="grid gap-4 sm:grid-cols-7">
      {points.map((point) => (
        <div
          key={point.day}
          className="rounded-[22px] border border-[color:var(--border)] bg-white/60 p-4"
        >
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
            <span>{point.day}</span>
            <span>{point.calls}</span>
          </div>
          <div className="mt-6 flex h-36 items-end gap-3">
            <div
              className="w-full rounded-t-2xl bg-[linear-gradient(180deg,var(--accent),#e2a96d)]"
              style={{ height: `${(point.calls / maxCalls) * 100}%` }}
            />
            <div
              className="w-full rounded-t-2xl bg-[rgba(24,32,41,0.82)]"
              style={{ height: `${(point.bookings / maxCalls) * 100}%` }}
            />
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-[var(--muted)]">
            <span>Calls</span>
            <span>{point.bookings} bookings</span>
          </div>
        </div>
      ))}
    </div>
  );
}
