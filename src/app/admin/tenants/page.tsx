import { DataTable } from "@/components/ui/data-table";
import { Panel } from "@/components/ui/panel";
import { SectionIntro } from "@/components/ui/section-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import { tenantRecords } from "@/lib/mock-data";

export default function AdminTenantsPage() {
  return (
    <>
      <SectionIntro
        eyebrow="Tenants"
        title="Track workspace rollout, risk, and channel readiness across the platform."
        description="Tenant operations should make it easy to understand which businesses are live, which ones are still onboarding, and where reliability risk needs intervention."
      />

      <DataTable
        caption="Businesses / tenants"
        headers={["Business", "Plan", "Channels", "Call volume", "Risk"]}
        rows={tenantRecords.map((tenant) => [
          <div key={`${tenant.id}-tenant`} className="space-y-1">
            <p className="font-semibold text-[var(--foreground)]">{tenant.name}</p>
            <p className="text-[var(--muted)]">{tenant.mode}</p>
          </div>,
          <p key={`${tenant.id}-plan`} className="text-[var(--foreground)]">
            {tenant.plan}
          </p>,
          <div key={`${tenant.id}-channels`} className="space-y-1">
            <p className="text-[var(--foreground)]">{tenant.channels}</p>
            <p className="text-xs text-[var(--muted)]">{tenant.onboarding}</p>
          </div>,
          <p key={`${tenant.id}-volume`} className="text-[var(--foreground)]">
            {tenant.callVolume}
          </p>,
          <StatusBadge key={`${tenant.id}-risk`} status={tenant.riskLevel} />,
        ])}
      />

      <section className="grid gap-6 xl:grid-cols-3">
        {[
          {
            title: "Live tenants",
            detail:
              "Businesses that have a connected channel, knowledge coverage, and either a configured action tool or a safe fallback path.",
          },
          {
            title: "Onboarding risk",
            detail:
              "Tenants without structured data or with pending OAuth refresh issues should be visible before they take live traffic.",
          },
          {
            title: "Expansion path",
            detail:
              "The same multi-tenant shape can later support billing, usage-based plans, and CRM-specific connectors without redesigning the data model.",
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
