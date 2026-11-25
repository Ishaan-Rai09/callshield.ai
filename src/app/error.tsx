"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, ShieldAlert } from "lucide-react";

/**
 * Route-level boundary for unexpected rendering or data errors. The message is
 * intentionally generic so server details never reach the browser; the digest
 * is safe to share when reporting a problem.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[route-error]", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-[620px] flex-col items-center justify-center px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-paper">
        <ShieldAlert className="h-5 w-5 text-ink/70" strokeWidth={1.8} />
      </span>
      <h1 className="mt-5 text-[26px] font-semibold tracking-[-0.03em]">
        Something went wrong on this screen.
      </h1>
      <p className="mt-2 max-w-[440px] text-[12.5px] leading-relaxed text-muted">
        Your saved calls and settings are untouched. Try loading the screen again, or return to the
        dashboard.
      </p>
      {error.digest ? (
        <p className="mt-3 font-mono text-[10px] text-muted">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[11.5px] font-medium text-ivory transition-opacity hover:opacity-90"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Try again
        </button>
        <Link
          href="/app"
          className="rounded-full border border-line bg-paper px-4 py-2 text-[11.5px] font-medium text-ink/80 transition-colors hover:border-ink/25"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
