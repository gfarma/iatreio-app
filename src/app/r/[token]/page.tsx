import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appointments } from "@/db/schema";
import { formatDateGr, utcToLocalTimeStr } from "@/lib/dates";
import { patientCancel, patientConfirm } from "@/app/actions/rsvp";
import { StatusBadge } from "@/components/ui";

export const metadata: Metadata = {
  title: "Το ραντεβού σας",
  robots: { index: false, follow: false },
};

export default async function ManageAppointmentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/.test(token)) notFound();

  const appt = await db.query.appointments.findFirst({
    where: eq(appointments.manageToken, token),
    with: {
      clinic: { columns: { name: true, address: true, phone: true, slug: true } },
      doctor: { columns: { name: true } },
      patient: { columns: { firstName: true, lastName: true } },
    },
  });
  if (!appt) notFound();

  const displayName = appt.patient
    ? `${appt.patient.firstName} ${appt.patient.lastName}`
    : (appt.contactName ?? "");
  const isFuture = appt.startsAt > new Date();
  const active = ["pending", "confirmed"].includes(appt.status);

  return (
    <main className="grain flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <p className="mb-6 font-display text-2xl font-bold tracking-tight text-pine">
        {appt.clinic.name}
      </p>
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-7 shadow-card">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h1 className="font-display text-xl font-semibold">Το ραντεβού σας</h1>
          <StatusBadge status={appt.status} />
        </div>

        <dl className="space-y-2.5 text-sm">
          {displayName ? (
            <Row label="Ονοματεπώνυμο" value={displayName} />
          ) : null}
          <Row label="Ημερομηνία" value={formatDateGr(appt.startsAt, { weekday: "long" })} />
          <Row label="Ώρα" value={utcToLocalTimeStr(appt.startsAt)} />
          <Row label="Ιατρός" value={appt.doctor.name} />
          {appt.clinic.address ? <Row label="Διεύθυνση" value={appt.clinic.address} /> : null}
        </dl>

        {isFuture && active ? (
          <div className="mt-6 space-y-2.5 border-t border-line pt-5">
            {appt.status === "pending" ? (
              <form action={patientConfirm}>
                <input type="hidden" name="token" value={token} />
                <button className="w-full rounded-lg bg-pine px-4 py-2.5 text-sm font-bold text-surface hover:bg-pine-deep">
                  ✓ Επιβεβαιώνω το ραντεβού
                </button>
              </form>
            ) : (
              <p className="rounded-lg bg-sage px-3 py-2.5 text-center text-sm font-semibold text-pine-deep">
                ✓ Το ραντεβού σας είναι επιβεβαιωμένο
              </p>
            )}
            <form
              action={patientCancel}
            >
              <input type="hidden" name="token" value={token} />
              <button className="w-full rounded-lg border border-clay/40 px-4 py-2.5 text-sm font-semibold text-clay hover:bg-clay hover:text-surface">
                Ακύρωση ραντεβού
              </button>
            </form>
            <p className="text-center text-xs text-mist">
              Η ώρα που θα ελευθερωθεί γίνεται αυτόματα διαθέσιμη για άλλους ασθενείς.
            </p>
          </div>
        ) : appt.status === "cancelled" ? (
          <div className="mt-6 border-t border-line pt-5 text-center">
            <p className="text-sm text-mist">
              Το ραντεβού ακυρώθηκε.{" "}
              <a href={`/${appt.clinic.slug}/booking`} className="font-semibold text-pine hover:underline">
                Κλείστε νέο ραντεβού →
              </a>
            </p>
          </div>
        ) : null}

        {appt.clinic.phone ? (
          <p className="mt-5 text-center text-xs text-mist">
            Για οποιαδήποτε αλλαγή: ☎ {appt.clinic.phone}
          </p>
        ) : null}
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-mist">{label}</dt>
      <dd className="text-right font-semibold text-ink">{value}</dd>
    </div>
  );
}
