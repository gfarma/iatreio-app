import Link from "next/link";

export const metadata = { title: "Δεν βρέθηκε" };

export default function NotFound() {
  return (
    <main className="grain flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="font-display text-6xl text-line">404</p>
      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">Η σελίδα δεν βρέθηκε</h1>
      <p className="mt-2 max-w-sm text-sm text-mist">
        Ο σύνδεσμος μπορεί να έχει αλλάξει ή η εγγραφή να έχει διαγραφεί.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-pine px-4 py-2 text-sm font-semibold text-surface hover:bg-pine-deep"
      >
        Αρχική
      </Link>
    </main>
  );
}
