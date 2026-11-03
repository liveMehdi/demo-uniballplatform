import type { ReactNode } from "react";
import { Link } from "react-router";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-svh grid-rows-[auto_1fr] bg-surface text-sm md:grid-cols-2 md:grid-rows-1">
      <aside className="flex min-w-0 flex-col justify-between gap-12 border-b border-line bg-raised p-6 md:border-r md:border-b-0 md:p-10 lg:p-16">
        <Link
          to="/events"
          className="flex items-center gap-3 font-serif font-semibold no-underline"
        >
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-md border border-accent/60 font-sans text-xs tracking-wider"
          >
            UE
          </span>
          University Events
        </Link>
        <div className="max-md:hidden">
          <p className="mb-3 text-xs font-medium tracking-widest text-muted uppercase">
            University Balls & Formal Events{" "}
          </p>
          <h2 className="max-w-sm text-3xl leading-tight tracking-tight max-sm:text-2xl">
            Evenings to look forward to.
          </h2>
          <p className="max-w-sm text-muted">
            See upcoming university events and balls, book tickets and keep
            everything in one place.
          </p>
          <Link
            to="/events"
            className="inline-flex items-center gap-2 text-sm no-underline hover:underline"
          >
            Explore events <span aria-hidden="true">→</span>
          </Link>
        </div>
      </aside>

      <section
        className="flex min-w-0 items-center p-6 md:p-10 lg:p-16"
        aria-labelledby="auth-heading"
      >
        <div className="mx-auto w-full max-w-md">{children}</div>
      </section>
    </main>
  );
}
