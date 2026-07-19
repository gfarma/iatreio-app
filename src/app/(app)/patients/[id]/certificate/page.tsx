import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clinics, patients } from "@/db/schema";
import { requireContext } from "@/lib/session";
import { assertCan } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { CertificateEditor } from "@/components/certificate-editor";
import { PageTitle } from "@/components/ui";

export const metadata = { title: "Ιατρική βεβαίωση" };

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  assertCan(ctx.role, "visits.write"); // only doctors/owners issue certificates
  const { id } = await params;

  const [patient, clinic] = await Promise.all([
    db.query.patients.findFirst({
      where: and(eq(patients.id, id), eq(patients.clinicId, ctx.clinic.id)),
    }),
    db.query.clinics.findFirst({ where: eq(clinics.id, ctx.clinic.id) }),
  ]);
  if (!patient || !clinic) notFound();

  await logAudit({
    clinicId: ctx.clinic.id,
    userId: ctx.user.id,
    action: "patient.certificate",
    entityType: "patient",
    entityId: patient.id,
  });

  const fullName = `${patient.firstName} ${patient.lastName}`;
  const defaultBody = `Βεβαιώνεται ότι ο/η ${fullName}${
    patient.birthDate ? `, γεννηθείς/-είσα ${patient.birthDate.split("-").reverse().join("/")}` : ""
  }${patient.amka ? ` (ΑΜΚΑ: ${patient.amka})` : ""}, εξετάστηκε σήμερα στο ιατρείο μας.

Από τον κλινικό έλεγχο δεν διαπιστώθηκε εύρημα που να αποτελεί αντένδειξη για __________________________.

Η παρούσα χορηγείται κατόπιν αιτήσεώς του/της για κάθε νόμιμη χρήση.`;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="no-print">
        <PageTitle
          title="Ιατρική βεβαίωση"
          subtitle={`Ασθενής: ${patient.lastName} ${patient.firstName}`}
        />
      </div>
      <CertificateEditor
        clinic={{ name: clinic.name, address: clinic.address, phone: clinic.phone, afm: clinic.afm }}
        doctorName={ctx.user.name}
        defaultBody={defaultBody}
      />
    </div>
  );
}
