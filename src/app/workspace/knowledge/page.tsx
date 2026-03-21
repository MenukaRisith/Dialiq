import { DataTable } from "@/components/ui/data-table";
import { Panel } from "@/components/ui/panel";
import { SectionIntro } from "@/components/ui/section-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import { getKnowledgeSnapshot } from "@/lib/platform";
import { formatCurrency } from "@/lib/utils";

export default async function KnowledgePage() {
  const snapshot = await getKnowledgeSnapshot();

  return (
    <>
      <SectionIntro
        eyebrow="Knowledge base"
        title="Ground every answer in trusted business data."
        description="The knowledge layer supports both unstructured context and structured records so the AI can sound natural without compromising reliability."
      />

      <section className="grid gap-4 xl:grid-cols-4">
        {snapshot.sources.map((source) => (
          <Panel key={source.id} className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-semibold text-[var(--foreground)]">{source.name}</p>
              <StatusBadge status={source.status} />
            </div>
            <p className="text-sm text-[var(--muted)]">{source.type}</p>
            <p className="text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
              {source.coverage}%
            </p>
            <p className="text-sm leading-7 text-[var(--muted-strong)]">
              {source.items} records - Last synced {source.lastSynced}
            </p>
            <div className="flex flex-wrap gap-2">
              {source.trustedFields.map((field) => (
                <span
                  key={field}
                  className="rounded-full bg-black/4 px-3 py-1 text-xs font-medium text-[var(--muted-strong)]"
                >
                  {field}
                </span>
              ))}
            </div>
          </Panel>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <DataTable
          caption="Structured product records"
          headers={["Product", "Category", "Price", "Trusted fields"]}
          rows={snapshot.products.map((product) => [
            <div key={`${product.id}-name`} className="space-y-1">
              <p className="font-semibold text-[var(--foreground)]">{product.name}</p>
              <p className="text-[var(--muted)]">{product.colors.join(", ")}</p>
            </div>,
            <p key={`${product.id}-category`} className="text-[var(--foreground)]">
              {product.category}
            </p>,
            <p key={`${product.id}-price`} className="font-medium text-[var(--foreground)]">
              {formatCurrency(product.price)}
            </p>,
            <p key={`${product.id}-fields`} className="max-w-sm leading-7 text-[var(--muted-strong)]">
              {product.trustedFields.join(", ")}
            </p>,
          ])}
        />

        <Panel className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Trust model
          </p>
          {[
            "Structured data owns critical fields like price, duration, and bookable service rules.",
            "Unstructured content fills in tone, policy explanations, FAQs, and broader context.",
            "If a critical field is missing, the agent says so clearly and offers a safe next step.",
            "Availability is only spoken when the data source is explicitly connected and current.",
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

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Structured service records
          </p>
          {snapshot.services.map((service) => (
            <div
              key={service.id}
              className="rounded-[22px] border border-[color:var(--border)] bg-white/58 p-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">{service.name}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{service.priceRange}</p>
                </div>
                <StatusBadge status={service.status} />
              </div>
              <p className="mt-3 text-sm leading-7 text-[var(--muted-strong)]">
                {service.description}
              </p>
              <p className="mt-3 text-sm text-[var(--foreground)]">
                {service.durationMinutes} min - {service.bookingWindow}
              </p>
            </div>
          ))}
        </Panel>

        <Panel className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Retrieval posture
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                title: "Product queries",
                detail:
                  "Look up category, price, color, and feature filters against the structured catalog before forming a spoken answer.",
              },
              {
                title: "Service questions",
                detail:
                  "Read structured durations, pricing ranges, and hours first, then use FAQs for additional context.",
              },
              {
                title: "Policy checks",
                detail:
                  "Cite only connected return, delivery, and showroom policies and avoid policy interpolation.",
              },
              {
                title: "Escalation triggers",
                detail:
                  "Route custom quotes, live inventory questions, and unsupported requests to a human queue.",
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
    </>
  );
}
