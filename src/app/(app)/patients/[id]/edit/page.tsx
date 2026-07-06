import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { patients, specialtyTemplates } from "@/db/schema";
import { requireContext } from "@/lib/session";
import { assertCan } from "@/lib/rbac";
import { updatePatient } from "@/app/actions/patients";
import { Card, PageTitle } from "@/components/ui";
import { PatientForm } from "@/components/patient-form";

export const metadata = { title: "Επεξεργασία ασθενή" };

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  assertCan(ctx.role, "patients.write");
  const { id } = await params;

  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, id), eq(patients.clinicId, ctx.clinic.id)),
  });
  if (!patient) notFound();

  const templates = await db.query.specialtyTemplates.findMany({
    where: and(
      eq(specialtyTemplates.clinicId, ctx.clinic.id),
      eq(specialtyTemplates.target, "patient"),
    ),
  });

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title={`Επεξεργασία: ${patient.lastName} ${patient.firstName}`} />
      <Card className="p-6">
        <PatientForm
          action={updatePatient.bind(null, patient.id)}
          patient={patient}
          templateFields={templates.flatMap((t) => t.fields)}
          submitLabel="Αποθήκευση αλλαγών"
        />
      </Card>
    </div>
  );
}
