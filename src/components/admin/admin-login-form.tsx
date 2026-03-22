"use client";

import { useActionState } from "react";

import { loginAdminAction } from "@/app/login/actions";
import { initialAdminLoginActionState } from "@/app/login/state";
import { Panel } from "@/components/ui/panel";

export function AdminLoginForm({
  next,
  error,
}: {
  next: string;
  error: string | null;
}) {
  const [state, formAction] = useActionState(
    loginAdminAction,
    initialAdminLoginActionState,
  );

  return (
    <Panel className="w-full max-w-xl space-y-6 p-8 md:p-10">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          Admin access
        </p>
        <h1 className="text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
          Sign in to the Dialiq control room.
        </h1>
        <p className="text-sm leading-7 text-[var(--muted-strong)]">
          Platform credentials, provider routing, and tenant safety controls now require an
          authenticated admin session.
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />

        <label className="grid gap-2">
          <span className="text-sm font-medium text-[var(--foreground)]">Email</span>
          <input
            type="email"
            name="email"
            defaultValue="menuka.dialq@gmail.com"
            className="w-full rounded-[18px] border border-[color:var(--border)] bg-white/80 px-4 py-3 text-sm text-[var(--foreground)] outline-none"
            required
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-[var(--foreground)]">Password</span>
          <input
            type="password"
            name="password"
            className="w-full rounded-[18px] border border-[color:var(--border)] bg-white/80 px-4 py-3 text-sm text-[var(--foreground)] outline-none"
            required
          />
        </label>

        {error ? (
          <div className="rounded-[18px] bg-[var(--amber-soft)] px-4 py-3 text-sm text-[var(--amber)]">
            {error}
          </div>
        ) : null}

        {state.message ? (
          <div className="rounded-[18px] bg-[var(--red-soft)] px-4 py-3 text-sm text-[var(--red)]">
            {state.message}
          </div>
        ) : null}

        <button
          type="submit"
          className="inline-flex w-full items-center justify-center rounded-full bg-[var(--foreground)] px-5 py-3 text-sm font-semibold text-white"
        >
          Sign in
        </button>
      </form>
    </Panel>
  );
}
