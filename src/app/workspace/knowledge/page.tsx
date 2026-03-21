import Link from "next/link";

import { DataTable } from "@/components/ui/data-table";
import { Panel } from "@/components/ui/panel";
import { SectionIntro } from "@/components/ui/section-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  ingestKnowledgeFileAction,
  ingestWebsiteKnowledgeAction,
} from "@/app/workspace/knowledge/actions";
import { getKnowledgeSnapshot } from "@/lib/platform";
import { DEFAULT_TENANT_ID } from "@/lib/repositories/workspace-operations";
import { formatCurrency } from "@/lib/utils";

const inputClassName =
  "w-full rounded-[20px] border border-[color:var(--border)] bg-white/80 px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:rgba(177,90,44,0.14)]";

const submitClassName =
  "inline-flex items-center justify-center rounded-full bg-[var(--foreground)] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--surface-ink)]";

function NoticeBanner({
  tone,
  message,
}: {
  tone: "error" | "success";
  message: string;
}) {
  return (
    <Panel
      className={
        tone === "error"
          ? "border-[color:rgba(194,72,34,0.25)] bg-[linear-gradient(145deg,rgba(255,246,242,0.98),rgba(255,237,230,0.94))]"
          : "border-[color:rgba(60,116,82,0.18)] bg-[linear-gradient(145deg,rgba(246,255,250,0.98),rgba(236,248,240,0.94))]"
      }
    >
      <p className="text-sm font-medium text-[var(--foreground)]">{message}</p>
    </Panel>
  );
}

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const snapshot = await getKnowledgeSnapshot();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const notice =
    typeof resolvedSearchParams?.notice === "string" ? resolvedSearchParams.notice : null;
  const error =
    typeof resolvedSearchParams?.error === "string" ? resolvedSearchParams.error : null;

  return (
    <>
      <SectionIntro
        eyebrow="Knowledge base"
        title="Ingest, verify, and serve trusted business knowledge."
        description="Connect website pages, upload Markdown or PDF documents, and keep the voice agent grounded in approved business material before it ever answers a caller."
      />

      {notice ? <NoticeBanner tone="success" message={notice} /> : null}
      {error ? <NoticeBanner tone="error" message={error} /> : null}

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel accent className="space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              Website ingest
            </p>
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
              Crawl business pages and turn them into grounded call context.
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-[var(--muted-strong)]">
              Dialiq fetches the supplied website, extracts readable page content, chunks it for
              retrieval, and adds it to the trusted knowledge layer used during calls.
            </p>
          </div>

          <form action={ingestWebsiteKnowledgeAction} className="grid gap-4">
            <input type="hidden" name="workspaceSlug" value={DEFAULT_TENANT_ID} />
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                Website URL
              </span>
              <input
                className={inputClassName}
                type="url"
                name="url"
                placeholder="https://www.yourbusiness.com"
                required
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className={submitClassName}>
                Sync Website
              </button>
              <p className="text-xs leading-6 text-[var(--muted)]">
                Best for FAQs, policy pages, service pages, and product landing pages.
              </p>
            </div>
          </form>
        </Panel>

        <Panel className="space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              File upload
            </p>
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
              Add Markdown playbooks or PDF policies directly.
            </h2>
            <p className="text-sm leading-7 text-[var(--muted-strong)]">
              Upload product notes, policy documents, SOPs, and other approved business material.
              The MVP currently accepts `.md` and `.pdf` files up to 8 MB.
            </p>
          </div>

          <form action={ingestKnowledgeFileAction} className="grid gap-4" encType="multipart/form-data">
            <input type="hidden" name="workspaceSlug" value={DEFAULT_TENANT_ID} />
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                Upload file
              </span>
              <input
                className={`${inputClassName} file:mr-4 file:rounded-full file:border-0 file:bg-[var(--foreground)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white`}
                type="file"
                name="knowledgeFile"
                accept=".md,.markdown,application/pdf,text/markdown,text/x-markdown"
                required
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className={submitClassName}>
                Upload Document
              </button>
              <p className="text-xs leading-6 text-[var(--muted)]">
                Good for pricing guides, consultation policies, and internal call scripts.
              </p>
            </div>
          </form>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                Recent knowledge documents
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                What the retrieval layer can actually cite right now.
              </h2>
            </div>
            <StatusBadge
              status={snapshot.documents.length > 0 ? "healthy" : "warning"}
              label={snapshot.documents.length > 0 ? "ready" : "needs content"}
            />
          </div>

          {snapshot.documents.length > 0 ? (
            <DataTable
              caption="Parsed documents"
              headers={["Document", "Type", "Chunks", "Excerpt"]}
              rows={snapshot.documents.map((document) => [
                <div key={`${document.id}-title`} className="space-y-1">
                  <p className="font-semibold text-[var(--foreground)]">{document.title}</p>
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    {document.sourceLabel} • {document.updatedAt}
                  </p>
                  {document.sourceUrl ? (
                    <Link
                      href={document.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-[var(--accent)] underline-offset-4 hover:underline"
                    >
                      Open source
                    </Link>
                  ) : null}
                </div>,
                <p key={`${document.id}-kind`} className="capitalize text-[var(--foreground)]">
                  {document.kind.replace("-", " ")}
                </p>,
                <p key={`${document.id}-chunks`} className="text-[var(--foreground)]">
                  {document.chunkCount}
                </p>,
                <p key={`${document.id}-excerpt`} className="max-w-xl leading-7 text-[var(--muted-strong)]">
                  {document.excerpt}
                </p>,
              ])}
            />
          ) : (
            <div className="rounded-[24px] border border-dashed border-[color:var(--border-strong)] bg-white/55 p-6">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                No parsed website pages or uploaded documents yet.
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--muted-strong)]">
                Add a business website URL or upload a Markdown/PDF file to populate retrieval-backed
                answers for FAQs, policies, services, and other trusted context.
              </p>
            </div>
          )}
        </Panel>

        <Panel className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Grounding posture
          </p>
          {[
            "Structured records still own critical fields like price, service duration, and live booking actions.",
            "Website pages, Markdown documents, and PDFs now become retrievable call context instead of static admin metadata.",
            "If no structured data or trustworthy document evidence exists, the agent falls back or hands off instead of guessing.",
            "Live stock and live calendar promises remain blocked unless the relevant provider is actually connected and current.",
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

      <section className="grid gap-4 xl:grid-cols-4">
        {snapshot.sources.map((source) => (
          <Panel key={source.id} className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">{source.name}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{source.type}</p>
              </div>
              <StatusBadge status={source.status} />
            </div>
            <p className="text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
              {source.coverage}%
            </p>
            <p className="text-sm leading-7 text-[var(--muted-strong)]">
              {source.items} records • Last synced {source.lastSynced}
            </p>
            {source.sourceUrl ? (
              <Link
                href={source.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-[var(--accent)] underline-offset-4 hover:underline"
              >
                View source
              </Link>
            ) : null}
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

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
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
                {service.durationMinutes} min • {service.bookingWindow}
              </p>
            </div>
          ))}
        </Panel>
      </section>
    </>
  );
}
