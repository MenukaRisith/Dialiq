"use client";

import { useEffect } from "react";

export default function GlobalErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("app.error_boundary", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <html lang="en">
      <body className="grid min-h-screen place-items-center px-6">
        <div className="max-w-xl rounded-[28px] border border-[color:var(--border)] bg-white/80 p-8 text-center shadow-[var(--shadow-card)] backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
            Unexpected error
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
            A route crashed before it could recover safely.
          </h1>
          <p className="mt-4 text-sm leading-7 text-[var(--muted-strong)]">
            Dialiq keeps the failure isolated and exposes a retry path instead of leaving the UI in an undefined state.
          </p>
          <button
            onClick={() => unstable_retry()}
            className="mt-6 rounded-full bg-[var(--foreground)] px-5 py-3 text-sm font-semibold text-white"
          >
            Retry segment
          </button>
        </div>
      </body>
    </html>
  );
}
