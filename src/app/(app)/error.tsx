"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Friendly fallback for anything that throws inside the app shell — permission
 * checks, validation, database hiccups. Next redacts server error messages in
 * production, so we show guidance rather than a stack trace.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] unhandled error", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="font-display text-5xl text-line">!</p>
      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">Κάτι πήγε στραβά</h1>
      <p className="mt-2 text-sm leading-relaxed text-mist">
        Η ενέργεια δεν ολοκληρώθηκε. Αν συνεχίσει να εμφανίζεται, ελέγξτε αν έχετε δικαίωμα για
        αυτή τη σελίδα ή επικοινωνήστε με τον διαχειριστή του ιατρείου.
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-mist">Κωδικός σφάλματος: {error.digest}</p>
      ) : null}
      <div className="mt-6 flex justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-pine px-4 py-2 text-sm font-semibold text-surface hover:bg-pine-deep"
        >
          Δοκιμή ξανά
        </button>
        <Link
          href="/dashboard"
          className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-cream"
        >
          Επιστροφή στην επισκόπηση
        </Link>
      </div>
    </div>
  );
}
