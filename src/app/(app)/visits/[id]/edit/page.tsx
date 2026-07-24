import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { specialtyTemplates, visits } from "@/db/schema";
import { requireContext } from "@/lib/session";
import { assertCan } from "@/lib/rbac";
import { aiEnabled } from "@/lib/ai/provider";
import { updateVisit } from "@/app/actions/visits";
import { formatDateGr } from "@/lib/dates";
import { Card, PageTitle } from "@/components/ui";
import { VisitEditor } from "@/components/visit-editor";

export const metadata = { title: "Διόρθωση επίσκεψης" };

export default async function EditVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  assertCan(ctx.role, "visits.write");
  const { id } = await params;

  const visit = await db.query.visits.findFirst({
    where: and(eq(visits.id, id), eq(visits.clinicId, ctx.clinic.id)),
    with: { patient: { columns: { id: true, firstName: true, lastName: true } } },
  });
  if (!visit) notFound();

  const templates = await db.query.specialtyTemplates.findMany({
    where: and(
      eq(specialtyTemplates.clinicId, ctx.clinic.id),
      eq(specialtyTemplates.target, "visit"),
    ),
  });

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle
        title="Διόρθωση επίσκεψης"
        subtitle={`${visit.patient.lastName} ${visit.patient.firstName} · ${formatDateGr(visit.visitDate)}`}
      />
      <p className="mb-4 rounded-lg bg-cream px-3 py-2 text-xs text-mist">
        Η διόρθωση καταγράφεται στο αρχείο ενεργειών μαζί με το προηγούμενο κείμενο, ώστε να
        διατηρείται πλήρες ιστορικό του φακέλου.
      </p>
      <Card className="p-6">
        <VisitEditor
          action={updateVisit.bind(null, visit.id)}
          patientId={visit.patientId}
          templateFields={templates.flatMap((t) => t.fields)}
          aiAvailable={aiEnabled()}
          initial={{
            notes: visit.notes ?? "",
            icd10Codes: visit.icd10Codes,
            customFields: visit.customFields,
          }}
          submitLabel="Αποθήκευση διόρθωσης"
        />
      </Card>
    </div>
  );
}
