import Link from "next/link";

import { Panel } from "@/components/ui/panel";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <Panel className="max-w-xl space-y-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
          Page not found
        </p>
        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
          This route is outside the current Dialiq MVP surface.
        </h1>
        <p className="text-sm leading-7 text-[var(--muted-strong)]">
          Use the workspace or admin console to review the implemented product areas.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            href="/workspace"
            className="rounded-full bg-[var(--foreground)] px-5 py-3 text-sm font-semibold text-white"
          >
            Open workspace
          </Link>
          <Link
            href="/admin"
            className="rounded-full border border-[color:var(--border-strong)] bg-white/80 px-5 py-3 text-sm font-semibold text-[var(--foreground)]"
          >
            Open admin
          </Link>
        </div>
      </Panel>
    </div>
  );
}
