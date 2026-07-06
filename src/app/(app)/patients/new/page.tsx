import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { specialtyTemplates } from "@/db/schema";
import { requireContext } from "@/lib/session";
import { assertCan } from "@/lib/rbac";
import { createPatient } from "@/app/actions/patients";
import { Card, PageTitle } from "@/components/ui";
import { PatientForm } from "@/components/patient-form";

export const metadata = { title: "Νέος ασθενής" };

export default async function NewPatientPage() {
  const ctx = await requireContext();
  assertCan(ctx.role, "patients.write");

  const templates = await db.query.specialtyTemplates.findMany({
    where: and(
      eq(specialtyTemplates.clinicId, ctx.clinic.id),
      eq(specialtyTemplates.target, "patient"),
    ),
  });

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title="Νέος ασθενής" subtitle={ctx.clinic.name} />
      <Card className="p-6">
        <PatientForm
          action={createPatient}
          templateFields={templates.flatMap((t) => t.fields)}
          submitLabel="Δημιουργία ασθενή"
        />
      </Card>
    </div>
  );
}
