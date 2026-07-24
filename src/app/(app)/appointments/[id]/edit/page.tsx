import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { appointments, clinicMembers, patients } from "@/db/schema";
import { requireContext } from "@/lib/session";
import { assertCan } from "@/lib/rbac";
import { rescheduleAppointment } from "@/app/actions/appointments";
import { utcToLocalDateStr, utcToLocalTimeStr, formatDateTimeGr } from "@/lib/dates";
import { Card, PageTitle } from "@/components/ui";
import { AppointmentForm } from "@/components/appointment-form";

export const metadata = { title: "Αλλαγή ραντεβού" };

export default async function EditAppointmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireContext();
  assertCan(ctx.role, "appointments.write");
  const { id } = await params;

  const appt = await db.query.appointments.findFirst({
    where: and(eq(appointments.id, id), eq(appointments.clinicId, ctx.clinic.id)),
  });
  if (!appt) notFound();

  const [doctors, patientRows] = await Promise.all([
    db.query.clinicMembers.findMany({
      where: and(eq(clinicMembers.clinicId, ctx.clinic.id), eq(clinicMembers.role, "doctor")),
      with: { user: { columns: { id: true, name: true } } },
    }),
    db.query.patients.findMany({
      where: and(eq(patients.clinicId, ctx.clinic.id), isNull(patients.archivedAt)),
      columns: { id: true, firstName: true, lastName: true },
      orderBy: (p, { asc }) => [asc(p.lastName)],
    }),
  ]);

  const durationMin = Math.round((appt.endsAt.getTime() - appt.startsAt.getTime()) / 60_000);

  return (
    <div className="mx-auto max-w-xl">
      <PageTitle
        title="Αλλαγή ραντεβού"
        subtitle={`Τρέχον: ${formatDateTimeGr(appt.startsAt)}${appt.contactName ? ` · ${appt.contactName}` : ""}`}
      />
      <Card className="p-6">
        <AppointmentForm
          action={rescheduleAppointment.bind(null, appt.id)}
          doctors={doctors.map((d) => ({ id: d.user.id, label: d.user.name }))}
          patients={patientRows.map((p) => ({ id: p.id, label: `${p.lastName} ${p.firstName}` }))}
          defaults={{
            patientId: appt.patientId,
            doctorUserId: appt.doctorUserId,
            date: utcToLocalDateStr(appt.startsAt),
            time: utcToLocalTimeStr(appt.startsAt),
            duration: durationMin,
            reason: appt.reason,
            room: appt.room,
          }}
          submitLabel="Αποθήκευση αλλαγών"
        />
      </Card>
    </div>
  );
}
