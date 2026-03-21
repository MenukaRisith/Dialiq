import { DataTable } from "@/components/ui/data-table";
import { Panel } from "@/components/ui/panel";
import { SectionIntro } from "@/components/ui/section-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import { bookings, bookingTypes } from "@/lib/mock-data";

export default function CalendarPage() {
  return (
    <>
      <SectionIntro
        eyebrow="Calendar and actions"
        title="Bookings are simple, confirm-first, and clearly logged."
        description="The MVP focuses on Google Calendar as the first operational tool. The AI can read availability, offer slots, and create bookings only after explicit confirmation."
      />

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <DataTable
          caption="Bookable call types"
          headers={["Type", "Duration", "Availability", "Confirmation"]}
          rows={bookingTypes.map((booking) => [
            <div key={`${booking.id}-name`} className="space-y-1">
              <p className="font-semibold text-[var(--foreground)]">{booking.name}</p>
              <StatusBadge status={booking.status} />
            </div>,
            <p key={`${booking.id}-duration`} className="text-[var(--foreground)]">
              {booking.durationMinutes} min
            </p>,
            <p key={`${booking.id}-availability`} className="text-[var(--muted-strong)]">
              {booking.availability}
            </p>,
            <p key={`${booking.id}-rule`} className="max-w-sm leading-7 text-[var(--muted-strong)]">
              {booking.confirmationRule}
            </p>,
          ])}
        />

        <Panel className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Booking action flow
          </p>
          {[
            "Check verified availability from Google Calendar.",
            "Offer two or three slots, never an open-ended list.",
            "Repeat the selected slot and wait for explicit confirmation.",
            "Create the event, then speak the final confirmation back to the caller.",
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
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Upcoming bookings
          </p>
          {bookings.map((booking) => (
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
            Safe tool execution rules
          </p>
          {[
            "Calendar writes are logged before the spoken confirmation is generated.",
            "No bookings are created from inferred availability or stale cached slots.",
            "If the calendar connection is down, the agent offers a callback instead of promising a time.",
            "Future CRM syncs should follow the same confirm-first pattern as bookings.",
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
