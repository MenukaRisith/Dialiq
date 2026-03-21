import { DataTable } from "@/components/ui/data-table";
import { Panel } from "@/components/ui/panel";
import { SectionIntro } from "@/components/ui/section-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import { getIntegrationSnapshot } from "@/lib/platform";

export default async function IntegrationsPage() {
  const snapshot = await getIntegrationSnapshot();

  return (
    <>
      <SectionIntro
        eyebrow="Integrations"
        title="Every provider connection stays visible and intentionally scoped."
        description="Voice routing, transcription, model access, calendar actions, and CRM capture are represented as explicit integrations so businesses can see what is connected and what is not."
      />

      <section className="grid gap-4 xl:grid-cols-3">
        {snapshot.integrations.map((integration) => (
          <Panel key={integration.id} className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">{integration.name}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{integration.category}</p>
              </div>
              <StatusBadge status={integration.status} />
            </div>
            <p className="text-sm leading-7 text-[var(--muted-strong)]">{integration.detail}</p>
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              Last checked {integration.lastChecked}
            </p>
            <div className="flex flex-wrap gap-2">
              {integration.scopes.map((scope) => (
                <span
                  key={scope}
                  className="rounded-full bg-black/4 px-3 py-1 text-xs font-mono text-[var(--muted-strong)]"
                >
                  {scope}
                </span>
              ))}
            </div>
          </Panel>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Voice route map
          </p>
          {[
            "Twilio receives the inbound phone or WhatsApp voice call and resolves the tenant.",
            "Deepgram Flux streams transcripts and turn-taking signals into the application layer.",
            "OpenRouter sends the call state to gpt-5.4-mini with tool permissions constrained by backend policy.",
            "Google Calendar and CRM actions are executed only after confirmation and then logged.",
            "ElevenLabs returns the final short spoken answer back to the caller.",
          ].map((step, index) => (
            <div
              key={step}
              className="rounded-[22px] border border-[color:var(--border)] bg-white/58 p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                Step 0{index + 1}
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--foreground)]">{step}</p>
            </div>
          ))}
        </Panel>

        <DataTable
          caption="Booking-capable tools"
          headers={["Booking type", "Duration", "Availability", "Rule"]}
          rows={snapshot.bookingTypes.map((booking) => [
            <p key={`${booking.id}-name`} className="font-semibold text-[var(--foreground)]">
              {booking.name}
            </p>,
            <p key={`${booking.id}-duration`} className="text-[var(--foreground)]">
              {booking.durationMinutes} min
            </p>,
            <p key={`${booking.id}-availability`} className="text-[var(--muted-strong)]">
              {booking.availability}
            </p>,
            <div key={`${booking.id}-rule`} className="space-y-2">
              <StatusBadge status={booking.status} />
              <p className="max-w-sm leading-7 text-[var(--muted-strong)]">
                {booking.confirmationRule}
              </p>
            </div>,
          ])}
        />
      </section>
    </>
  );
}
