import { Panel } from "@/components/ui/panel";

export function MetricCard({
  label,
  value,
  change,
  detail,
  index = 0,
}: {
  label: string;
  value: string;
  change: string;
  detail: string;
  index?: number;
}) {
  return (
    <div className="rise-in" style={{ ["--delay" as string]: index }}>
      <Panel className="p-5" accent={index === 0}>
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[var(--muted)]">{label}</p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
                {value}
              </p>
            </div>
            <span className="rounded-full bg-[var(--green-soft)] px-3 py-1 text-xs font-semibold text-[var(--green)]">
              {change}
            </span>
          </div>
          <p className="text-sm leading-6 text-[var(--muted-strong)]">{detail}</p>
        </div>
      </Panel>
    </div>
  );
}
