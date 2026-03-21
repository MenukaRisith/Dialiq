import { BarList } from "@/components/ui/bar-list";
import { MetricCard } from "@/components/ui/metric-card";
import { Panel } from "@/components/ui/panel";
import { SectionIntro } from "@/components/ui/section-intro";
import { WeeklyVolumeChart } from "@/components/ui/weekly-volume-chart";
import { getAnalyticsSnapshot } from "@/lib/platform";

export default async function AnalyticsPage() {
  const snapshot = await getAnalyticsSnapshot();

  return (
    <>
      <SectionIntro
        eyebrow="Analytics"
        title="Visibility into containment, bookings, and caller intent."
        description="Analytics in the MVP stay practical: what kinds of calls arrived, how many were contained safely, and how often the agent produced a verified business outcome."
      />

      <section className="grid gap-4 xl:grid-cols-4">
        {snapshot.metrics.map((metric, index) => (
          <MetricCard key={metric.label} {...metric} index={index} />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Panel className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Intent mix
          </p>
          <BarList items={snapshot.intentMix} />
        </Panel>

        <Panel className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Weekly volume
          </p>
          <WeeklyVolumeChart points={snapshot.weeklyVolume} />
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        {[
          {
            title: "Calls answered safely",
            detail:
              "The primary KPI is not volume, but the percentage of calls answered or actioned without crossing the trust boundary.",
          },
          {
            title: "Bookings that stuck",
            detail:
              "Completed bookings should reflect confirmed, actually-created events, not verbal agreements that never hit the calendar.",
          },
          {
            title: "Escalations with context",
            detail:
              "Escalations are useful when they arrive with transcripts, intent, and lead details so a human can continue the conversation quickly.",
          },
        ].map((item) => (
          <Panel key={item.title} className="space-y-3 p-5">
            <p className="text-sm font-semibold text-[var(--foreground)]">{item.title}</p>
            <p className="text-sm leading-7 text-[var(--muted-strong)]">{item.detail}</p>
          </Panel>
        ))}
      </section>
    </>
  );
}
