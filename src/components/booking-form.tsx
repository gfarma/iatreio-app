"use client";

import { useActionState, useState } from "react";
import { publicBook, type BookingState } from "@/app/actions/booking";
import { Button, Field, Input } from "./ui";

export function BookingForm({
  clinicSlug,
  doctorUserId,
  date,
  slots,
}: {
  clinicSlug: string;
  doctorUserId: string;
  date: string;
  slots: string[];
}) {
  const [time, setTime] = useState<string | null>(null);
  const [state, action, pending] = useActionState<BookingState, FormData>(publicBook, {});

  if (state.success) {
    return (
      <div className="py-8 text-center">
        <p className="font-display text-5xl">✓</p>
        <h3 className="mt-3 font-display text-xl font-semibold text-pine">
          Η κράτησή σας καταχωρήθηκε!
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-mist">
          Το ιατρείο θα επιβεβαιώσει το ραντεβού σας τηλεφωνικά ή με μήνυμα. Ευχαριστούμε!
        </p>
        {state.manageUrl ? (
          <a
            href={state.manageUrl}
            className="mt-4 inline-block rounded-lg bg-sage px-4 py-2 text-sm font-semibold text-pine-deep hover:bg-pine hover:text-surface"
          >
            Προβολή / διαχείριση ραντεβού →
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {slots.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setTime(s)}
            className={`rounded-lg border px-4 py-2 font-display text-sm font-bold transition-colors ${
              time === s
                ? "border-pine bg-pine text-surface"
                : "border-line bg-surface text-ink hover:border-pine hover:text-pine"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {time ? (
        <form action={action} className="mt-6 space-y-4 border-t border-line pt-5">
          <input type="hidden" name="clinicSlug" value={clinicSlug} />
          <input type="hidden" name="doctorUserId" value={doctorUserId} />
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="time" value={time} />
          {/* Honeypot */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

          <p className="text-sm font-semibold text-ink">
            Ραντεβού στις <span className="text-pine">{time}</span> — συμπληρώστε τα στοιχεία σας:
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ονοματεπώνυμο">
              <Input name="name" required autoComplete="name" />
            </Field>
            <Field label="Τηλέφωνο">
              <Input name="phone" type="tel" required autoComplete="tel" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email (προαιρετικό)">
              <Input name="email" type="email" autoComplete="email" />
            </Field>
            <Field label="Λόγος επίσκεψης (προαιρετικό)">
              <Input name="reason" />
            </Field>
          </div>
          <label className="flex items-start gap-2 text-xs text-mist">
            <input type="checkbox" name="consent" required className="mt-0.5 accent-pine" />
            <span>
              Συναινώ στην επεξεργασία των στοιχείων μου αποκλειστικά για τον προγραμματισμό του
              ραντεβού μου.
            </span>
          </label>
          {state.error ? (
            <p className="rounded-lg bg-clay/10 px-3 py-2 text-sm text-clay">{state.error}</p>
          ) : null}
          <Button type="submit" disabled={pending} className="w-full sm:w-auto">
            {pending ? "Καταχώρηση…" : "Επιβεβαίωση κράτησης"}
          </Button>
        </form>
      ) : (
        <p className="mt-4 text-xs text-mist">Επιλέξτε ώρα για να συνεχίσετε.</p>
      )}
    </div>
  );
}
