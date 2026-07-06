import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { patients, specialtyTemplates } from "@/db/schema";
import { requireContext } from "@/lib/session";
import { assertCan } from "@/lib/rbac";
import { aiEnabled } from "@/lib/ai/provider";
import { Card, PageTitle } from "@/components/ui";
import { VisitEditor } from "@/components/visit-editor";

export const metadata = { title: "Νέα επίσκεψη" };

export default async function NewVisitPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string; appointmentId?: string }>;
}) {
  const ctx = await requireContext();
  assertCan(ctx.role, "visits.write");
  const sp = await searchParams;
  if (!sp.patientId) notFound();

  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, sp.patientId), eq(patients.clinicId, ctx.clinic.id)),
  });
  if (!patient) notFound();

  const templates = await db.query.specialtyTemplates.findMany({
    where: and(
      eq(specialtyTemplates.clinicId, ctx.clinic.id),
      eq(specialtyTemplates.target, "visit"),
    ),
  });

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle
        title="Νέα επίσκεψη"
        subtitle={`Ασθενής: ${patient.lastName} ${patient.firstName}`}
      />
      <Card className="p-6">
        <VisitEditor
          patientId={patient.id}
          appointmentId={sp.appointmentId}
          templateFields={templates.flatMap((t) => t.fields)}
          aiAvailable={aiEnabled()}
        />
      </Card>
    </div>
  );
}
