import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

export const metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-[620px] flex-col items-center justify-center px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-paper">
        <SearchX className="h-5 w-5 text-ink/70" strokeWidth={1.8} />
      </span>
      <p className="mt-5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-muted">
        Error 404
      </p>
      <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.03em]">
        We could not find that page.
      </h1>
      <p className="mt-2 max-w-[440px] text-[12.5px] leading-relaxed text-muted">
        The link may be out of date, or the page may have moved. Everything else is exactly where
        you left it.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[11.5px] font-medium text-ivory transition-opacity hover:opacity-90"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to CallShield
      </Link>
    </main>
  );
}
