import { Panel } from "@/components/ui/panel";
import { SectionIntro } from "@/components/ui/section-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import { getTeamSnapshot } from "@/lib/platform";

export default async function TeamPage() {
  const snapshot = await getTeamSnapshot();

  return (
    <>
      <SectionIntro
        eyebrow="Team and handoff"
        title="Make human fallback as clear as the AI workflow."
        description="The AI is only reliable when handoff targets, owners, and callback queues are easy to manage. Team visibility belongs inside the same workspace."
      />

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Team members
          </p>
          {snapshot.members.map((member) => (
            <div
              key={member.id}
              className="rounded-[22px] border border-[color:var(--border)] bg-white/58 p-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">{member.name}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{member.role}</p>
                </div>
                <StatusBadge status={member.status} />
              </div>
              <p className="mt-3 text-sm leading-7 text-[var(--muted-strong)]">
                {member.coverage}
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                {member.handoffWindow}
              </p>
            </div>
          ))}
        </Panel>

        <Panel className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Lead routing queue
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
              <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                Captured {lead.capturedAt}
              </p>
            </div>
          ))}
        </Panel>
      </section>
    </>
  );
}
