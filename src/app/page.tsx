import {
  ArrowRight,
  Bot,
  CalendarCheck2,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  Waypoints,
} from "lucide-react";

import { ButtonLink } from "@/components/ui/button-link";
import { Panel } from "@/components/ui/panel";
import { SectionIntro } from "@/components/ui/section-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import { integrations, voicePipeline } from "@/lib/mock-data";

const businessModes = [
  {
    title: "Product-selling businesses",
    description:
      "Use connected catalogs, FAQs, product pages, and trusted docs to answer product questions without inventing prices or features.",
    bullets: [
      "Structured fields for price, variations, and key features",
      "Natural voice answers grounded in the knowledge layer",
      "Lead capture instead of guessing when the data is incomplete",
    ],
  },
  {
    title: "Service businesses",
    description:
      "Handle service questions, surface verified availability, and book confirmed appointments into Google Calendar.",
    bullets: [
      "Booking slots offered only from connected calendars",
      "One follow-up at a time for clean call flow",
      "Human handoff when requests exceed verified service rules",
    ],
  },
];

const reliabilityPrinciples = [
  "Never invent facts, prices, stock, or delivery promises.",
  "Keep answers short, clear, and appropriate for a business phone call.",
  "Confirm every action before writing to Google Calendar or CRM.",
  "Escalate low-confidence or custom requests instead of overreaching.",
];

const productAreas = [
  "Overview / Dashboard",
  "Calls",
  "Knowledge Base",
  "Integrations",
  "AI Agent Settings",
  "Calendar / Actions",
  "Analytics",
  "Team / Workspace",
  "Admin Panel",
];

export default function Home() {
  return (
    <div className="px-4 py-4 md:px-6">
      <div className="mx-auto max-w-[var(--max-width)] space-y-6">
        <header className="flex flex-col gap-4 rounded-[30px] border border-[color:var(--border)] bg-white/60 px-6 py-4 backdrop-blur xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-[20px] bg-[var(--foreground)] text-sm font-bold uppercase tracking-[0.28em] text-white">
              DQ
            </span>
            <div>
              <p className="text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                Dialiq
              </p>
              <p className="text-sm text-[var(--muted)]">
                Voice-first AI agents for trusted business calls
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink href="/workspace" variant="secondary">
              Workspace demo
            </ButtonLink>
            <ButtonLink href="/admin">Admin console</ButtonLink>
          </div>
        </header>

        <Panel className="dialiq-grid overflow-hidden px-6 py-8 md:px-10 md:py-12" accent>
          <div className="grid gap-10 xl:grid-cols-[1.3fr_0.9fr] xl:items-end">
            <SectionIntro
              eyebrow="Inbound voice MVP"
              title="AI voice agents businesses can trust on real customer calls."
              description="Dialiq is a modern SaaS platform for inbound phone and WhatsApp calling, with grounded product and service answers, simple booking actions, lead capture, and reliable human fallback."
              aside={
                <div className="rounded-[26px] border border-[color:var(--border)] bg-white/78 p-5 shadow-[var(--shadow-soft)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                    MVP boundaries
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusBadge status="healthy" label="English only" />
                    <StatusBadge status="healthy" label="Voice only" />
                    <StatusBadge status="healthy" label="Inbound only" />
                    <StatusBadge status="warning" label="Trusted data only" />
                  </div>
                </div>
              }
            />

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  label: "Channel path",
                  value: "Twilio phone + WhatsApp calling",
                  icon: PhoneCall,
                },
                {
                  label: "Reasoning",
                  value: "OpenRouter routed to gpt-5.4-mini",
                  icon: Bot,
                },
                {
                  label: "Actions",
                  value: "Google Calendar bookings and CRM lead capture",
                  icon: CalendarCheck2,
                },
                {
                  label: "Reliability",
                  value: "Logs, confidence gates, and human escalation",
                  icon: ShieldCheck,
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="rounded-[26px] border border-[color:var(--border)] bg-white/76 p-5 shadow-[var(--shadow-soft)]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="rounded-2xl bg-[var(--accent-soft)] p-2 text-[var(--accent)]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <p className="text-sm font-semibold text-[var(--foreground)]">{item.label}</p>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-[var(--muted-strong)]">
                      {item.value}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </Panel>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Panel className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                  Voice pipeline
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                  Production-minded, modular, and easy to inspect.
                </h2>
              </div>
              <Sparkles className="h-5 w-5 text-[var(--accent)]" />
            </div>

            <div className="grid gap-4">
              {voicePipeline.map((stage, index) => (
                <div
                  key={stage.id}
                  className="rise-in rounded-[24px] border border-[color:var(--border)] bg-white/60 p-5"
                  style={{ ["--delay" as string]: index }}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">{stage.name}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{stage.provider}</p>
                    </div>
                    <StatusBadge status={stage.status} />
                  </div>
                  <p className="mt-4 text-sm leading-7 text-[var(--muted-strong)]">
                    {stage.description}
                  </p>
                  <p className="mt-3 text-sm font-medium text-[var(--foreground)]">
                    Reliability rule: <span className="font-normal text-[var(--muted-strong)]">{stage.reliabilityRule}</span>
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <div className="space-y-6">
            <Panel className="space-y-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                Business flows
              </p>
              {businessModes.map((mode) => (
                <div key={mode.title} className="rounded-[24px] border border-[color:var(--border)] bg-white/58 p-5">
                  <h3 className="text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                    {mode.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted-strong)]">
                    {mode.description}
                  </p>
                  <ul className="mt-4 space-y-3 text-sm text-[var(--foreground)]">
                    {mode.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-3">
                        <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </Panel>

            <Panel className="space-y-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                Product surfaces
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {productAreas.map((area) => (
                  <div
                    key={area}
                    className="rounded-[22px] border border-[color:var(--border)] bg-white/60 px-4 py-3 text-sm font-medium text-[var(--foreground)]"
                  >
                    {area}
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Panel className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              Reliability principles
            </p>
            {reliabilityPrinciples.map((principle, index) => (
              <div
                key={principle}
                className="rounded-[22px] border border-[color:var(--border)] bg-white/58 px-5 py-4"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  0{index + 1}
                </p>
                <p className="mt-2 text-sm leading-7 text-[var(--foreground)]">{principle}</p>
              </div>
            ))}
          </Panel>

          <Panel className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              Connected provider stack
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {integrations.map((integration) => (
                <div
                  key={integration.id}
                  className="rounded-[24px] border border-[color:var(--border)] bg-white/60 p-5"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {integration.name}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{integration.detail}</p>
                    </div>
                    <StatusBadge status={integration.status} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {integration.scopes.map((scope) => (
                      <span
                        key={scope}
                        className="rounded-full bg-black/4 px-3 py-1 text-xs font-mono text-[var(--muted-strong)]"
                      >
                        {scope}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Panel className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              Workspace preview
            </p>
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
              A clean business dashboard focused on setup, calls, knowledge, and bookings.
            </h2>
            <p className="text-sm leading-7 text-[var(--muted-strong)]">
              Businesses can onboard quickly, connect trusted data, monitor what the AI said, and review every booking or handoff without digging through complex enterprise tooling.
            </p>
            <ButtonLink href="/workspace" className="gap-2">
              Open workspace
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          </Panel>

          <Panel className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              Admin preview
            </p>
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
              Internal controls for tenants, provider credentials, and platform safety.
            </h2>
            <p className="text-sm leading-7 text-[var(--muted-strong)]">
              The internal console separates platform operations from customer workspaces so keys, logs, flags, and rollout risk can be managed securely.
            </p>
            <ButtonLink href="/admin" variant="secondary" className="gap-2">
              Open admin
              <Waypoints className="h-4 w-4" />
            </ButtonLink>
          </Panel>
        </section>
      </div>
    </div>
  );
}
