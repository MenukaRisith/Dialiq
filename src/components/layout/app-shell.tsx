import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";

import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Panel } from "@/components/ui/panel";
import type { NavigationItem } from "@/lib/navigation";

export function AppShell({
  mode,
  navigation,
  title,
  description,
  children,
}: {
  mode: "workspace" | "admin";
  navigation: NavigationItem[];
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const isWorkspace = mode === "workspace";

  return (
    <div className="min-h-screen px-4 py-4 md:px-6">
      <div className="mx-auto grid max-w-[var(--max-width)] gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-6 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
          <Panel className="grain-overlay relative overflow-hidden bg-[linear-gradient(150deg,rgba(24,32,41,0.98),rgba(43,50,61,0.95))] text-white">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <Link href="/" className="inline-flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-sm font-bold uppercase tracking-[0.24em]">
                    DQ
                  </span>
                  <div>
                    <p className="text-lg font-semibold tracking-[-0.03em]">Dialiq</p>
                    <p className="text-xs uppercase tracking-[0.22em] text-white/60">
                      Voice agent SaaS
                    </p>
                  </div>
                </Link>
                <Sparkles className="h-5 w-5 text-[rgba(255,196,143,0.92)]" />
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/56">
                  {isWorkspace ? "Business workspace" : "Internal admin"}
                </p>
                <h2 className="text-2xl font-semibold tracking-[-0.05em]">{title}</h2>
                <p className="text-sm leading-7 text-white/74">{description}</p>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-white/6 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/50">
                  {isWorkspace ? "Current stack" : "Operator focus"}
                </p>
                <p className="mt-2 text-sm leading-6 text-white/82">
                  {isWorkspace
                    ? "Twilio, Deepgram Flux, OpenRouter, ElevenLabs, Google Calendar, CRM handoff."
                    : "Provider health, tenant safety, credential rotation, feature flags, and audit coverage."}
                </p>
              </div>
            </div>
          </Panel>

          <Panel className="p-3">
            <SidebarNav items={navigation} />
          </Panel>

          <Panel className="p-5">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                Reliability posture
              </p>
              <h3 className="text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                Short answers, confirmed actions, full logs.
              </h3>
              <p className="text-sm leading-6 text-[var(--muted-strong)]">
                The product shell prioritizes trusted data reads, explicit booking confirmation, and visible fallback paths.
              </p>
              <Link
                href={isWorkspace ? "/admin/providers" : "/workspace/agent"}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]"
              >
                {isWorkspace ? "Open provider controls" : "Review agent policy"}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </Panel>
        </aside>

        <main className="space-y-6 pb-10">{children}</main>
      </div>
    </div>
  );
}
