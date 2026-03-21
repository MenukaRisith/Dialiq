import { ProviderCredentialsManager } from "@/components/admin/provider-credentials-manager";
import { Panel } from "@/components/ui/panel";
import { SectionIntro } from "@/components/ui/section-intro";
import { listProviderCredentialsDashboard } from "@/lib/repositories/provider-credentials";

export default async function AdminProvidersPage() {
  const providerDashboard = await listProviderCredentialsDashboard();

  return (
    <>
      <SectionIntro
        eyebrow="Providers"
        title="Secure provider credentials, model routing, and validation."
        description="The internal admin area keeps raw secrets out of normal workspace views. Operators can inspect health, rotate credentials, and manage routing without exposing sensitive values."
        aside={
          <Panel className="space-y-3 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              Source priority
            </p>
            <p className="text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">
              MySQL-managed secrets override environment fallbacks.
            </p>
            <p className="text-sm leading-7 text-[var(--muted-strong)]">
              This keeps provider operations manageable from the admin panel without losing a safe env-based bootstrap path.
            </p>
          </Panel>
        }
      />

      <ProviderCredentialsManager
        credentials={providerDashboard.credentials}
        database={providerDashboard.database}
      />

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Model routing
          </p>
          <div className="rounded-[24px] border border-[color:var(--border)] bg-[rgba(24,32,41,0.95)] p-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/54">
              Default inference route
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
              OpenRouter to gpt-5.4-mini
            </h2>
            <p className="mt-4 text-sm leading-7 text-white/78">
              Reasoning sits behind the application layer so the model can classify intent and decide on tool usage, but all real-world actions remain enforced by backend policy, provider-specific validation, and credential source precedence.
            </p>
          </div>
        </Panel>

        <Panel className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Credential handling rules
          </p>
          {[
            "Store provider credentials securely and never expose raw values in workspace UI.",
            "Allow operators to validate, rotate, enable, and disable credentials intentionally.",
            "Keep provider status visible so failures in STT, TTS, telephony, or calendar access are obvious.",
            "Separate platform provider keys from tenant-specific OAuth connections and integrations.",
            "Use environment variables for bootstrap and MySQL-backed encrypted secrets for day-two operations.",
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
