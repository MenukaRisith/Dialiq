"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  saveProviderCredentialAction,
  toggleProviderCredentialAction,
} from "@/app/admin/providers/actions";
import { initialCredentialActionState } from "@/app/admin/providers/state";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  providerCatalog,
  providerFieldCatalog,
} from "@/lib/provider-catalog";
import type { ProviderCredential } from "@/lib/types";

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="rounded-full bg-[var(--foreground)] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
    >
      {pending ? "Saving..." : "Save config"}
    </button>
  );
}

export function ProviderCredentialsManager({
  credentials,
  database,
}: {
  credentials: ProviderCredential[];
  database: {
    configured: boolean;
    reachable: boolean;
    mode: "database" | "fallback";
    error: string | null;
  };
}) {
  const [state, formAction] = useActionState(
    saveProviderCredentialAction,
    initialCredentialActionState,
  );
  const databaseBacked = credentials.filter(
    (credential) => credential.source === "database",
  ).length;
  const environmentBacked = credentials.filter(
    (credential) => credential.source === "environment",
  ).length;
  const healthy = credentials.filter(
    (credential) => credential.status === "healthy",
  ).length;
  const coverage = `${healthy}/${credentials.length}`;

  return (
    <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        <Panel accent className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                Credential store
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                Admin-managed provider runtime config
              </h2>
            </div>
            <StatusBadge
              status={
                database.configured
                  ? database.reachable
                    ? "healthy"
                    : "critical"
                  : "warning"
              }
              label={
                database.configured
                  ? database.reachable
                    ? "mysql live"
                    : "mysql unreachable"
                  : "mysql not configured"
              }
            />
          </div>
          <p className="text-sm leading-7 text-[var(--muted-strong)]">
            Dialiq now stores provider runtime fields in MySQL per config key, so Twilio, Google, OpenRouter, Deepgram, ElevenLabs, and CRM values can be overridden from the admin panel without redeploying the app.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[20px] bg-white/72 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                Healthy coverage
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                {coverage}
              </p>
            </div>
            <div className="rounded-[20px] bg-white/72 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                MySQL managed
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                {databaseBacked}
              </p>
            </div>
            <div className="rounded-[20px] bg-white/72 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                Env fallback
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                {environmentBacked}
              </p>
            </div>
          </div>
          {database.error ? (
            <div className="rounded-[22px] border border-[color:var(--border)] bg-[var(--red-soft)] px-4 py-3 text-sm text-[var(--red)]">
              Database status: {database.error}
            </div>
          ) : null}
        </Panel>

        <div className="grid gap-4">
          {credentials.map((credential) => (
            <Panel key={credential.id} className="space-y-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                    {credential.provider}
                  </p>
                  <p className="mt-1 font-mono text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    {credential.configKey}
                  </p>
                  <p className="mt-2 text-sm text-[var(--muted)]">{credential.purpose}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={credential.status} />
                  <span className="rounded-full bg-black/4 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-strong)]">
                    {credential.source ?? "database"}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 text-sm text-[var(--muted-strong)] md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    Masked value
                  </p>
                  <p className="mt-2 font-mono text-[var(--foreground)]">{credential.maskedValue}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    Environment
                  </p>
                  <p className="mt-2 text-[var(--foreground)]">{credential.environment}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    Last validated
                  </p>
                  <p className="mt-2 text-[var(--foreground)]">{credential.lastValidated}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    Next rotation
                  </p>
                  <p className="mt-2 text-[var(--foreground)]">{credential.nextRotation}</p>
                </div>
              </div>

              {credential.validationMessage ? (
                <div className="rounded-[18px] bg-[var(--amber-soft)] px-4 py-3 text-sm text-[var(--amber)]">
                  {credential.validationMessage}
                </div>
              ) : null}

              {credential.source === "database" ? (
                <form action={toggleProviderCredentialAction} className="pt-2">
                  <input type="hidden" name="id" value={credential.id} />
                  <input
                    type="hidden"
                    name="enabled"
                    value={credential.isEnabled ? "false" : "true"}
                  />
                  <button
                    type="submit"
                    className="rounded-full border border-[color:var(--border-strong)] bg-white/80 px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
                  >
                    {credential.isEnabled ? "Disable key" : "Enable key"}
                  </button>
                </form>
              ) : (
                <div className="rounded-[18px] border border-dashed border-[color:var(--border)] px-4 py-3 text-sm text-[var(--muted-strong)]">
                  This provider is currently resolved from environment variables. Save a MySQL credential below to override runtime env configuration from the admin panel.
                </div>
              )}
            </Panel>
          ))}
        </div>
      </div>

      <Panel className="space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Save or rotate provider config
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
            Update env-style provider values from the admin panel
          </h2>
        </div>

        <form action={formAction} className="space-y-4">
          <div className="grid gap-4">
            <label className="space-y-2 text-sm font-medium text-[var(--foreground)]">
              <span>Provider</span>
              <select
                name="provider"
                className="w-full rounded-[18px] border border-[color:var(--border)] bg-white/80 px-4 py-3 text-sm outline-none"
                defaultValue="OPENROUTER"
              >
                {providerCatalog.map((provider) => (
                  <option key={provider.value} value={provider.value}>
                    {provider.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium text-[var(--foreground)]">
              <span>Config key</span>
              <select
                name="configKey"
                className="w-full rounded-[18px] border border-[color:var(--border)] bg-white/80 px-4 py-3 text-sm outline-none"
                defaultValue="OPENROUTER_API_KEY"
              >
                {providerFieldCatalog.map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.providerLabel} • {field.key}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium text-[var(--foreground)]">
              <span>Environment</span>
              <input
                name="environment"
                defaultValue="Production"
                className="w-full rounded-[18px] border border-[color:var(--border)] bg-white/80 px-4 py-3 text-sm outline-none"
              />
            </label>

            <label className="space-y-2 text-sm font-medium text-[var(--foreground)]">
              <span>Purpose</span>
              <input
                name="purpose"
                placeholder="Optional. Defaults to the config field purpose."
                className="w-full rounded-[18px] border border-[color:var(--border)] bg-white/80 px-4 py-3 text-sm outline-none"
              />
            </label>

            <label className="space-y-2 text-sm font-medium text-[var(--foreground)]">
              <span>Value</span>
              <input
                name="value"
                type="password"
                placeholder="Leave blank to keep the current stored value"
                className="w-full rounded-[18px] border border-[color:var(--border)] bg-white/80 px-4 py-3 text-sm outline-none"
              />
            </label>

            <label className="space-y-2 text-sm font-medium text-[var(--foreground)]">
              <span>Next rotation date</span>
              <input
                name="nextRotationAt"
                type="date"
                className="w-full rounded-[18px] border border-[color:var(--border)] bg-white/80 px-4 py-3 text-sm outline-none"
              />
            </label>

            <label className="flex items-center gap-3 rounded-[18px] border border-[color:var(--border)] bg-white/70 px-4 py-3 text-sm font-medium text-[var(--foreground)]">
              <input type="hidden" name="enabled" value="false" />
              <input type="checkbox" name="enabled" value="true" defaultChecked />
              Enable this credential immediately
            </label>
          </div>

          {state.message ? (
            <div
              className={`rounded-[18px] px-4 py-3 text-sm ${
                state.status === "error"
                  ? "bg-[var(--red-soft)] text-[var(--red)]"
                  : "bg-[var(--green-soft)] text-[var(--green)]"
              }`}
            >
              {state.message}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-4">
            <p className="max-w-sm text-xs leading-6 text-[var(--muted)]">
              Stored values are encrypted before they hit MySQL, never rendered back raw in the UI, and take precedence over env-based runtime fallbacks. Host bootstrap values like `DATABASE_URL` and `APP_ENCRYPTION_KEY` still stay outside the admin panel.
            </p>
            <SaveButton />
          </div>
        </form>
      </Panel>
    </section>
  );
}
