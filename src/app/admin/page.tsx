import { Panel } from "@/components/ui/panel";
import { SectionIntro } from "@/components/ui/section-intro";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAdminSnapshot } from "@/lib/platform";

export default async function AdminOverviewPage() {
  const snapshot = await getAdminSnapshot();

  return (
    <>
      <SectionIntro
        eyebrow="Platform operations"
        title="Internal control over providers, tenants, and system safety."
        description="The admin console is separated from customer workspaces so credentials, usage, feature flags, and audit visibility can be handled with the right level of control."
        aside={
          <Panel className="p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              Secure by default
            </p>
            <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">
              Masked keys, provider validation, and audit-first operations.
            </p>
          </Panel>
        }
      />

      <section className="grid gap-4 xl:grid-cols-4">
        {snapshot.metrics.map((metric, index) => (
          <MetricCard key={metric.label} {...metric} index={index} />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Provider health
          </p>
          {snapshot.providers.slice(0, 4).map((provider) => (
            <div
              key={provider.id}
              className="rounded-[24px] border border-[color:var(--border)] bg-white/60 p-5"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {provider.provider}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{provider.purpose}</p>
                </div>
                <StatusBadge status={provider.status} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-black/4 px-3 py-1 text-xs font-mono text-[var(--muted-strong)]">
                  {provider.maskedValue}
                </span>
                <span className="rounded-full bg-black/4 px-3 py-1 text-xs font-medium text-[var(--muted-strong)]">
                  Next rotation {provider.nextRotation}
                </span>
              </div>
            </div>
          ))}
        </Panel>

        <div className="space-y-6">
          <Panel className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              Feature flags
            </p>
            {snapshot.featureFlags.map((flag) => (
              <div
                key={flag.id}
                className="rounded-[22px] border border-[color:var(--border)] bg-white/58 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-semibold text-[var(--foreground)]">{flag.name}</p>
                  <StatusBadge
                    status={
                      flag.state === "enabled"
                        ? "healthy"
                        : flag.state === "gradual"
                          ? "warning"
                          : "inactive"
                    }
                    label={flag.state}
                  />
                </div>
                <p className="mt-2 text-sm leading-7 text-[var(--muted-strong)]">
                  {flag.description}
                </p>
              </div>
            ))}
          </Panel>

          <Panel className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              Recent audit trail
            </p>
            {snapshot.audit.map((event) => (
              <div
                key={event.id}
                className="rounded-[22px] border border-[color:var(--border)] bg-white/58 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-semibold text-[var(--foreground)]">{event.action}</p>
                  <StatusBadge status={event.status} />
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">{event.actor}</p>
                <p className="mt-3 text-sm leading-7 text-[var(--muted-strong)]">
                  {event.target}
                </p>
                <p className="mt-3 text-xs font-mono uppercase tracking-[0.14em] text-[var(--muted)]">
                  {event.occurredAt}
                </p>
              </div>
            ))}
          </Panel>
        </div>
      </section>
    </>
  );
}
