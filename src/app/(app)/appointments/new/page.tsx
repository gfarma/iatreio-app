import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { clinicMembers, patients } from "@/db/schema";
import { requireContext } from "@/lib/session";
import { assertCan } from "@/lib/rbac";
import { createAppointment } from "@/app/actions/appointments";
import { todayStr } from "@/lib/dates";
import { Card, PageTitle } from "@/components/ui";
import { AppointmentForm } from "@/components/appointment-form";

export const metadata = { title: "Νέο ραντεβού" };

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; time?: string; patientId?: string }>;
}) {
  const ctx = await requireContext();
  assertCan(ctx.role, "appointments.write");
  const sp = await searchParams;

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

  return (
    <div className="mx-auto max-w-xl">
      <PageTitle title="Νέο ραντεβού" subtitle={ctx.clinic.name} />
      <Card className="p-6">
        <AppointmentForm
          action={createAppointment}
          doctors={doctors.map((d) => ({ id: d.user.id, label: d.user.name }))}
          patients={patientRows.map((p) => ({ id: p.id, label: `${p.lastName} ${p.firstName}` }))}
          defaults={{
            patientId: sp.patientId,
            date: sp.date ?? todayStr(),
            time: sp.time ?? "09:00",
            duration: 30,
          }}
          submitLabel="Καταχώρηση ραντεβού"
        />
      </Card>
    </div>
  );
}
