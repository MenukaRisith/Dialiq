import { DataTable } from "@/components/ui/data-table";
import { Panel } from "@/components/ui/panel";
import { SectionIntro } from "@/components/ui/section-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import { recentCalls } from "@/lib/mock-data";
import { formatPercent, formatSeconds } from "@/lib/utils";

export default function CallsPage() {
  const handoffCalls = recentCalls.filter((call) => call.outcome === "handoff");

  return (
    <>
      <SectionIntro
        eyebrow="Calls"
        title="Transparent call handling with transcripts, outcomes, and fallback visibility."
        description="Businesses should be able to see what the AI heard, what it said, which tools were touched, and where human escalation stepped in."
      />

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <DataTable
          caption="Recent inbound conversations"
          headers={["Call", "Outcome", "Confidence", "Summary"]}
          rows={recentCalls.map((call) => [
            <div key={`${call.id}-call`} className="space-y-1">
              <p className="font-semibold text-[var(--foreground)]">{call.id}</p>
              <p className="text-[var(--muted)]">
                {call.caller} - {call.channel} - {formatSeconds(call.durationSeconds)}
              </p>
            </div>,
            <StatusBadge key={`${call.id}-outcome`} status={call.outcome === "handoff" ? "warning" : "healthy"} label={call.outcome} />,
            <p key={`${call.id}-confidence`} className="font-medium text-[var(--foreground)]">
              {formatPercent(call.confidence * 100)}
            </p>,
            <p key={`${call.id}-summary`} className="max-w-xl leading-7 text-[var(--muted-strong)]">
              {call.summary}
            </p>,
          ])}
        />

        <Panel className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Transcript spotlights
          </p>
          {recentCalls.slice(0, 2).map((call) => (
            <div
              key={call.id}
              className="rounded-[24px] border border-[color:var(--border)] bg-[rgba(24,32,41,0.95)] p-5 text-white"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">{call.caller}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/55">
                    {call.id} - {call.capturedAt}
                  </p>
                </div>
                <StatusBadge
                  status={call.outcome === "handoff" ? "warning" : "healthy"}
                  label={call.outcome}
                />
              </div>
              <div className="mt-4 space-y-3">
                {call.transcript.map((turn) => (
                  <div
                    key={`${call.id}-${turn.timestamp}-${turn.speaker}`}
                    className="rounded-[20px] border border-white/10 bg-white/6 p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
                        {turn.speaker}
                      </p>
                      <p className="text-xs font-mono text-white/50">{turn.timestamp}</p>
                    </div>
                    <p className="mt-2 text-sm leading-7 text-white/84">{turn.text}</p>
                    {turn.tool ? (
                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[rgba(255,196,143,0.88)]">
                        {turn.tool}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Human handoff posture
          </p>
          {handoffCalls.map((call) => (
            <div
              key={call.id}
              className="rounded-[22px] border border-[color:var(--border)] bg-white/58 p-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">{call.caller}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{call.handoffTarget}</p>
                </div>
                <StatusBadge status="warning" label="handoff" />
              </div>
              <p className="mt-3 text-sm leading-7 text-[var(--muted-strong)]">{call.summary}</p>
            </div>
          ))}
        </Panel>

        <Panel className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Voice behavior guidelines
          </p>
          {[
            "Keep spoken answers short so callers can interrupt naturally.",
            "Confirm only one important detail at a time before moving forward.",
            "Never claim inventory, delivery, or live availability without a connected source.",
            "When confidence drops, explain the limit clearly and transfer or capture a lead.",
          ].map((rule) => (
            <div
              key={rule}
              className="rounded-[22px] border border-[color:var(--border)] bg-white/58 px-5 py-4 text-sm leading-7 text-[var(--foreground)]"
            >
              {rule}
            </div>
          ))}
        </Panel>
      </section>
    </>
  );
}
