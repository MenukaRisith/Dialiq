import { Panel } from "@/components/ui/panel";
import { SectionIntro } from "@/components/ui/section-intro";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getWorkspaceSnapshot } from "@/lib/platform";
import { formatPercent, formatSeconds } from "@/lib/utils";

export default async function WorkspaceOverviewPage() {
  const snapshot = await getWorkspaceSnapshot();
  const spotlightCall = snapshot.calls[0];

  return (
    <>
      <SectionIntro
        eyebrow="Workspace overview"
        title="Launch and monitor a trustworthy inbound voice agent."
        description="The business-facing workspace keeps setup clear, operational status obvious, and every customer-facing action inspectable."
        aside={
          <Panel className="p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              Tenant mode
            </p>
            <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">
              Hybrid product + service
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
              Phone and WhatsApp calling are connected. AI actions stay within trusted catalog data and verified calendar slots.
            </p>
          </Panel>
        }
      />

      <section className="grid gap-4 xl:grid-cols-4">
        {snapshot.metrics.map((metric, index) => (
          <MetricCard key={metric.label} {...metric} index={index} />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                First-working-agent checklist
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                Setup that leads directly to a safe first call.
              </h2>
            </div>
            <StatusBadge status="healthy" label="2 channels live" />
          </div>

          <div className="space-y-4">
            {snapshot.onboarding.map((item, index) => (
              <div
                key={item.title}
                className="rise-in rounded-[24px] border border-[color:var(--border)] bg-white/60 p-5"
                style={{ ["--delay" as string]: index }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">{item.title}</p>
                    <p className="mt-2 text-sm leading-7 text-[var(--muted-strong)]">
                      {item.description}
                    </p>
                  </div>
                  <StatusBadge
                    status={
                      item.status === "done"
                        ? "healthy"
                        : item.status === "in-progress"
                          ? "warning"
                          : "inactive"
                    }
                    label={item.status.replace("-", " ")}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                Call spotlight
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                A grounded product inquiry handled end to end.
              </h2>
            </div>
            <StatusBadge status="healthy" label={spotlightCall.outcome} />
          </div>

          <div className="grid gap-4 rounded-[26px] border border-[color:var(--border)] bg-[rgba(24,32,41,0.95)] p-5 text-white">
            <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.16em] text-white/55">
              <span>{spotlightCall.id}</span>
              <span>{spotlightCall.caller}</span>
              <span>{formatSeconds(spotlightCall.durationSeconds)}</span>
              <span>{formatPercent(spotlightCall.confidence * 100)} confidence</span>
            </div>
            <p className="text-lg font-semibold tracking-[-0.03em]">{spotlightCall.summary}</p>
            <div className="space-y-3">
              {spotlightCall.transcript.map((turn) => (
                <div
                  key={`${spotlightCall.id}-${turn.timestamp}-${turn.speaker}`}
                  className="rounded-[22px] border border-white/10 bg-white/6 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/54">
                      {turn.speaker}
                    </p>
                    <p className="text-xs font-mono text-white/54">{turn.timestamp}</p>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-white/84">{turn.text}</p>
                  {turn.tool ? (
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[rgba(255,196,143,0.88)]">
                      {turn.tool}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Pipeline health
          </p>
          <div className="grid gap-4">
            {snapshot.pipeline.map((stage) => (
              <div
                key={stage.id}
                className="rounded-[24px] border border-[color:var(--border)] bg-white/60 p-5"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">{stage.name}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{stage.provider}</p>
                  </div>
                  <StatusBadge status={stage.status} />
                </div>
                <p className="mt-3 text-sm leading-7 text-[var(--muted-strong)]">
                  {stage.description}
                </p>
                <p className="mt-3 text-sm font-medium text-[var(--foreground)]">
                  Guardrail:
                  <span className="font-normal text-[var(--muted-strong)]">
                    {" "}
                    {stage.reliabilityRule}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              Latest bookings
            </p>
            {snapshot.bookings.map((booking) => (
              <div
                key={booking.id}
                className="rounded-[22px] border border-[color:var(--border)] bg-white/58 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">{booking.customer}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{booking.type}</p>
                  </div>
                  <StatusBadge
                    status={booking.status === "confirmed" ? "healthy" : "warning"}
                    label={booking.status.replace("-", " ")}
                  />
                </div>
                <p className="mt-3 text-sm text-[var(--foreground)]">{booking.slot}</p>
              </div>
            ))}
          </Panel>

          <Panel className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              Lead queue
            </p>
            {snapshot.leads.map((lead) => (
              <div
                key={lead.id}
                className="rounded-[22px] border border-[color:var(--border)] bg-white/58 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">{lead.customer}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{lead.interest}</p>
                  </div>
                  <StatusBadge
                    status={
                      lead.status === "qualified"
                        ? "healthy"
                        : lead.status === "handoff"
                          ? "warning"
                          : "inactive"
                    }
                    label={lead.status}
                  />
                </div>
                <p className="mt-3 text-sm text-[var(--foreground)]">
                  Owner: <span className="text-[var(--muted-strong)]">{lead.owner}</span>
                </p>
              </div>
            ))}
          </Panel>
        </div>
      </section>
    </>
  );
}
