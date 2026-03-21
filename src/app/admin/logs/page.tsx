import { Panel } from "@/components/ui/panel";
import { SectionIntro } from "@/components/ui/section-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import { auditEvents, featureFlags } from "@/lib/mock-data";

export default function AdminLogsPage() {
  return (
    <>
      <SectionIntro
        eyebrow="Logs and flags"
        title="Audit every action and make platform safety visible."
        description="Because reliability matters more than flash, the platform needs usable internal visibility into failures, blocked actions, feature rollout state, and provider changes."
      />

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Audit timeline
          </p>
          {auditEvents.map((event) => (
            <div
              key={event.id}
              className="rounded-[22px] border border-[color:var(--border)] bg-white/58 p-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">{event.action}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{event.actor}</p>
                </div>
                <StatusBadge status={event.status} />
              </div>
              <p className="mt-3 text-sm leading-7 text-[var(--muted-strong)]">{event.target}</p>
              <p className="mt-3 text-xs font-mono uppercase tracking-[0.16em] text-[var(--muted)]">
                {event.occurredAt}
              </p>
            </div>
          ))}
        </Panel>

        <Panel className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Feature rollout
          </p>
          {featureFlags.map((flag) => (
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
              <p className="mt-3 text-sm leading-7 text-[var(--muted-strong)]">
                {flag.description}
              </p>
            </div>
          ))}
        </Panel>
      </section>
    </>
  );
}
