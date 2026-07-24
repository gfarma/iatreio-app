import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { appointments, patients } from "@/db/schema";
import { requireContext } from "@/lib/session";
import { assertCan } from "@/lib/rbac";
import {
  createPatientFromAppointment,
  linkAppointmentToPatient,
} from "@/app/actions/appointments";
import { foldGreek } from "@/lib/greek";
import { formatDateTimeGr } from "@/lib/dates";
import { Button, Card, CardHeader, EmptyState, PageTitle } from "@/components/ui";

export const metadata = { title: "Σύνδεση κράτησης με ασθενή" };

export default async function LinkBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  assertCan(ctx.role, "appointments.write");
  const { id } = await params;

  const appt = await db.query.appointments.findFirst({
    where: and(eq(appointments.id, id), eq(appointments.clinicId, ctx.clinic.id)),
    with: { doctor: { columns: { name: true } } },
  });
  if (!appt) notFound();

  // Already linked — nothing to do here.
  if (appt.patientId) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageTitle title="Η κράτηση είναι ήδη συνδεδεμένη" />
        <Card className="p-6">
          <Link href={`/patients/${appt.patientId}`} className="font-semibold text-pine hover:underline">
            Άνοιγμα φακέλου ασθενή →
          </Link>
        </Card>
      </div>
    );
  }

  // Suggest likely matches: same phone, or a name that folds to the same text.
  const all = await db.query.patients.findMany({
    where: and(eq(patients.clinicId, ctx.clinic.id), isNull(patients.archivedAt)),
    columns: { id: true, firstName: true, lastName: true, phone: true, email: true },
  });
  const digits = (s: string | null) => (s ?? "").replace(/\D/g, "");
  const contactDigits = digits(appt.contactPhone);
  const contactName = foldGreek(appt.contactName ?? "");
  const matches = all
    .map((p) => {
      const samePhone = contactDigits.length >= 9 && digits(p.phone) === contactDigits;
      const nameHit =
        contactName.length >= 3 &&
        contactName
          .split(" ")
          .filter((w) => w.length >= 3)
          .some((w) => foldGreek(`${p.firstName} ${p.lastName}`).includes(w));
      return { p, score: (samePhone ? 2 : 0) + (nameHit ? 1 : 0), samePhone };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageTitle
        title="Σύνδεση online κράτησης"
        subtitle="Συνδέστε την κράτηση με υπάρχοντα φάκελο ή δημιουργήστε νέο"
      />

      <Card className="p-5">
        <h3 className="mb-3 font-display text-base font-semibold">Στοιχεία κράτησης</h3>
        <dl className="space-y-1.5 text-sm">
          <Row label="Όνομα" value={appt.contactName ?? "—"} />
          <Row label="Τηλέφωνο" value={appt.contactPhone ?? "—"} />
          <Row label="Email" value={appt.contactEmail ?? "—"} />
          <Row label="Ραντεβού" value={`${formatDateTimeGr(appt.startsAt)} · ${appt.doctor.name}`} />
          {appt.reason ? <Row label="Αιτία" value={appt.reason} /> : null}
        </dl>
      </Card>

      <Card>
        <CardHeader
          title="Πιθανές αντιστοιχίσεις"
          subtitle="Υπάρχοντες ασθενείς με ίδιο τηλέφωνο ή παρόμοιο όνομα"
        />
        {matches.length === 0 ? (
          <EmptyState>Δεν βρέθηκε υπάρχων φάκελος που να ταιριάζει.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {matches.map(({ p, samePhone }) => (
              <li key={p.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div>
                  <p className="text-sm font-semibold">
                    {p.lastName} {p.firstName}
                    {samePhone ? (
                      <span className="ml-2 rounded-full bg-sage px-2 py-0.5 text-xs font-semibold text-pine-deep">
                        ίδιο τηλέφωνο
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-mist">{[p.phone, p.email].filter(Boolean).join(" · ")}</p>
                </div>
                <form action={linkAppointmentToPatient}>
                  <input type="hidden" name="appointmentId" value={appt.id} />
                  <input type="hidden" name="patientId" value={p.id} />
                  <Button type="submit" variant="secondary" className="text-xs">
                    Σύνδεση
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="font-display text-base font-semibold">Νέος ασθενής</h3>
        <p className="mb-3 mt-1 text-sm text-mist">
          Δημιουργεί φάκελο με τα στοιχεία της κράτησης και τον συνδέει με το ραντεβού.
          Θα μεταφερθείτε στην επεξεργασία για να συμπληρώσετε τα υπόλοιπα στοιχεία.
        </p>
        <form action={createPatientFromAppointment}>
          <input type="hidden" name="appointmentId" value={appt.id} />
          <Button type="submit">+ Δημιουργία νέου φακέλου</Button>
        </form>
      </Card>
    </div>
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
