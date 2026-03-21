import type { HealthStatus } from "@/lib/types";
import { cn, titleCase } from "@/lib/utils";

const toneMap: Record<HealthStatus, string> = {
  healthy: "bg-[var(--green-soft)] text-[var(--green)]",
  warning: "bg-[var(--amber-soft)] text-[var(--amber)]",
  critical: "bg-[var(--red-soft)] text-[var(--red)]",
  inactive: "bg-black/5 text-[var(--muted)]",
};

const dotMap: Record<HealthStatus, string> = {
  healthy: "bg-[var(--green)]",
  warning: "bg-[var(--amber)]",
  critical: "bg-[var(--red)]",
  inactive: "bg-[var(--muted)]",
};

export function StatusBadge({
  status,
  label,
}: {
  status: HealthStatus;
  label?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em]",
        toneMap[status],
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", dotMap[status])} />
      {label ?? titleCase(status)}
    </span>
  );
}
