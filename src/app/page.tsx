import Link from "next/link";
import { ButtonLink } from "@/components/ui";

const FEATURES = [
  {
    title: "Ραντεβού χωρίς τηλέφωνα",
    body: "Ημερολόγιο ανά ιατρό, online κρατήσεις από τους ασθενείς σας, αυτόματος έλεγχος διαθεσιμότητας.",
  },
  {
    title: "Φάκελος για κάθε ειδικότητα",
    body: "Προσαρμοσμένα πεδία ανά ειδικότητα — δερματολογείο, φυσικοθεραπευτήριο, παιδιατρείο — χωρίς custom development.",
  },
  {
    title: "AI διοικητικός βοηθός",
    body: "Δόμηση σημειώσεων, πρόταση κωδικών ICD-10, εκτίμηση πιθανότητας no-show. Πάντα με τελικό λόγο τον ιατρό — ποτέ διάγνωση.",
  },
  {
    title: "GDPR από σχεδιασμού",
    body: "Καταγραφή κάθε πρόσβασης στον φάκελο, συναίνεση ασθενή, εξαγωγή και διαγραφή δεδομένων με ένα κλικ.",
  },
];

export default function Home() {
  return (
    <main className="grain flex-1">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="font-display text-2xl font-bold tracking-tight text-pine">
          Iatreio<span className="text-ochre">.</span>
        </span>
        <nav className="flex items-center gap-3">
          <Link href="/demo-derma/booking" className="text-sm font-semibold text-mist hover:text-pine">
            Demo κράτηση
          </Link>
          <ButtonLink href="/login" variant="secondary">
            Σύνδεση
          </ButtonLink>
        </nav>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-20 pt-16">
        <p className="mb-4 inline-block rounded-full border border-pine/20 bg-sage px-3 py-1 text-xs font-semibold uppercase tracking-widest text-pine-deep">
          Για ιατρεία κάθε ειδικότητας
        </p>
        <h1 className="max-w-3xl font-display text-5xl font-semibold leading-[1.1] tracking-tight text-ink md:text-6xl">
          Το ιατρείο σας, <em className="text-pine not-italic underline decoration-ochre/50 decoration-4 underline-offset-8">οργανωμένο</em>.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-mist">
          Ραντεβού, ηλεκτρονικός φάκελος ασθενή, τιμολόγηση και δημόσια σελίδα κρατήσεων —
          σε μία εφαρμογή σχεδιασμένη για την ελληνική ιατρική πρακτική, με έξυπνη
          διοικητική υποστήριξη AI.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/login" className="px-6 py-3 text-base">
            Δοκιμάστε το demo
          </ButtonLink>
          <ButtonLink href="/demo-derma/booking" variant="secondary" className="px-6 py-3 text-base">
            Δείτε τη σελίδα κράτησης →
          </ButtonLink>
        </div>
      </section>

      <section className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-5xl gap-px overflow-hidden px-6 py-16 md:grid-cols-2">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="p-6">
              <span className="font-display text-sm font-bold text-ochre">0{i + 1}</span>
              <h2 className="mt-2 font-display text-xl font-semibold text-ink">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-mist">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-line px-6 py-8 text-center text-xs text-mist">
        Iatreio · Demo περιβάλλον — μόνο πλαστά δεδομένα. Το AI βοηθά διοικητικά και δεν
        παρέχει ιατρικές συμβουλές.
      </footer>
    </main>
  );
}
