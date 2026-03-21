import { Panel } from "@/components/ui/panel";
import { SectionIntro } from "@/components/ui/section-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAgentSnapshot } from "@/lib/platform";

export default async function AgentPage() {
  const snapshot = await getAgentSnapshot();

  return (
    <>
      <SectionIntro
        eyebrow="Agent settings"
        title="Voice behavior stays constrained, calm, and business-appropriate."
        description="The agent should feel natural on the phone without becoming chatty, improvisational, or overconfident. Settings focus on guardrails rather than gimmicks."
      />

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Agent posture
          </p>
          <div className="rounded-[24px] border border-[color:var(--border)] bg-[rgba(24,32,41,0.95)] p-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/54">
              Greeting style
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
              Short, welcoming, and immediately useful.
            </h2>
            <p className="mt-4 text-sm leading-7 text-white/78">
              {`"${snapshot.profile.voiceGreeting ?? "Thanks for calling. How can I help today?"}"`}
            </p>
          </div>

          {snapshot.rules.map((rule) => (
            <div
              key={rule.title}
              className="rounded-[22px] border border-[color:var(--border)] bg-white/58 p-4"
            >
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-semibold text-[var(--foreground)]">{rule.title}</p>
                <StatusBadge status={rule.status} />
              </div>
              <p className="mt-3 text-sm leading-7 text-[var(--muted-strong)]">
                {rule.description}
              </p>
            </div>
          ))}
        </Panel>

        <Panel className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Escalation and tone settings
          </p>
          <div className="grid gap-4">
            {[
              {
                title: "Tone",
                detail:
                  "Professional, calm, and concise. No exaggerated warmth, no excessive apology loops, and no chatbot-style paragraphs.",
              },
              {
                title: "Action gating",
                detail:
                  "Bookings, lead saves, and human transfers are narrated clearly and only after the caller confirms the next step.",
              },
              {
                title: "Handoff policy",
                detail:
                  "Unknown pricing, custom quotes, unsupported integrations, or unclear caller identity trigger human fallback instead of approximation.",
              },
              {
                title: "Interruption handling",
                detail:
                  "The agent can be interrupted mid-sentence, stops cleanly, and answers the latest user turn rather than finishing canned copy.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-[24px] border border-[color:var(--border)] bg-white/60 p-5"
              >
                <p className="text-sm font-semibold text-[var(--foreground)]">{item.title}</p>
                <p className="mt-3 text-sm leading-7 text-[var(--muted-strong)]">{item.detail}</p>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Good behavior
          </p>
          {[
            "Answer with only the details that are actually verified.",
            "Offer one clear next step: more detail, booking, callback, or transfer.",
            "Keep spoken responses brief enough to feel like a natural phone interaction.",
          ].map((rule) => (
            <div
              key={rule}
              className="rounded-[22px] border border-[color:var(--border)] bg-white/58 px-5 py-4 text-sm leading-7 text-[var(--foreground)]"
            >
              {rule}
            </div>
          ))}
        </Panel>

        <Panel className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Bad behavior
          </p>
          {[
            "Inventing stock, shipping times, or custom quote terms.",
            "Speaking in long monologues that feel like a chatbot instead of a phone operator.",
            "Trying to complete every request autonomously when a safe handoff is the right move.",
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
