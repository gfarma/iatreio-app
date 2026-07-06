import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { clinicMembers, patients } from "@/db/schema";
import { requireContext } from "@/lib/session";
import { assertCan } from "@/lib/rbac";
import { createAppointment } from "@/app/actions/appointments";
import { todayStr } from "@/lib/dates";
import { Button, Card, Field, Input, PageTitle, Select } from "@/components/ui";

export const metadata = { title: "Νέο ραντεβού" };

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; patientId?: string }>;
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
        <form action={createAppointment} className="space-y-4">
          <Field label="Ασθενής" hint="Προαιρετικό — μπορεί να συνδεθεί αργότερα">
            <Select name="patientId" defaultValue={sp.patientId ?? ""}>
              <option value="">— Χωρίς σύνδεση —</option>
              {patientRows.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.lastName} {p.firstName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ιατρός">
            <Select name="doctorUserId" required defaultValue={doctors[0]?.user.id}>
              {doctors.map((d) => (
                <option key={d.user.id} value={d.user.id}>
                  {d.user.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Ημερομηνία">
              <Input name="date" type="date" defaultValue={sp.date ?? todayStr()} required />
            </Field>
            <Field label="Ώρα">
              <Input name="time" type="time" defaultValue="09:00" required />
            </Field>
            <Field label="Διάρκεια">
              <Select name="duration" defaultValue="30">
                {[15, 20, 30, 45, 60, 90].map((m) => (
                  <option key={m} value={m}>
                    {m}′
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Αιτία επίσκεψης">
              <Input name="reason" placeholder="π.χ. Έλεγχος σπίλων" />
            </Field>
            <Field label="Χώρος / Αίθουσα">
              <Input name="room" placeholder="π.χ. Εξεταστήριο 1" />
            </Field>
          </div>
          <Button type="submit">Καταχώρηση ραντεβού</Button>
        </form>
      </Card>
    </div>
  );
}
