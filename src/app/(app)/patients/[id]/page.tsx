import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { appointments, patients, specialtyTemplates } from "@/db/schema";
import { requireContext } from "@/lib/session";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { erasePatient } from "@/app/actions/patients";
import { noShowRisk } from "@/lib/noshow";
import { formatDateGr, formatDateTimeGr } from "@/lib/dates";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  StatusBadge,
} from "@/components/ui";
import { TemplateFieldValues } from "@/components/template-fields";

export const metadata = { title: "Φάκελος ασθενή" };

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  const { id } = await params;

  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, id), eq(patients.clinicId, ctx.clinic.id)),
    with: {
      visits: {
        with: { doctor: { columns: { name: true } } },
        orderBy: (v, { desc }) => [desc(v.visitDate)],
      },
      appointments: { orderBy: (a, { desc }) => [desc(a.startsAt)], limit: 10 },
      invoices: { orderBy: (i, { desc }) => [desc(i.issueDate)], limit: 5 },
    },
  });
  if (!patient) notFound();

  // GDPR: record that this file was opened
  await logAudit({
    clinicId: ctx.clinic.id,
    userId: ctx.user.id,
    action: "patient.read",
    entityType: "patient",
    entityId: patient.id,
  });

  const templates = await db.query.specialtyTemplates.findMany({
    where: and(
      eq(specialtyTemplates.clinicId, ctx.clinic.id),
      eq(specialtyTemplates.target, "patient"),
    ),
  });

  const history = await db.query.appointments.findMany({
    where: and(eq(appointments.patientId, patient.id), eq(appointments.clinicId, ctx.clinic.id)),
    columns: { status: true },
  });
  const risk = noShowRisk(history);

  const canSeeVisits = can(ctx.role, "visits.read");
  const eraseWithId = erasePatient.bind(null, patient.id);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {patient.lastName} {patient.firstName}
          </h1>
          <p className="mt-1 text-sm text-mist">
            {[
              patient.birthDate ? `Γεν. ${formatDateGr(new Date(patient.birthDate + "T12:00:00Z"))}` : null,
              patient.amka ? `ΑΜΚΑ ${patient.amka}` : null,
              patient.phone,
              patient.email,
            ]
              .filter(Boolean)
              .join(" · ") || "Χωρίς στοιχεία επικοινωνίας"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {patient.consentGivenAt ? (
              <Badge tone="info">Συναίνεση {patient.consentVersion}</Badge>
            ) : (
              <Badge tone="no_show">Χωρίς συναίνεση GDPR</Badge>
            )}
            <Badge tone={risk.label === "υψηλός" ? "no_show" : risk.label === "μέτριος" ? "pending" : "neutral"}>
              Κίνδυνος no-show: {risk.label}
              {risk.sample > 0 ? ` (${Math.round(risk.score * 100)}%)` : ""}
            </Badge>
            {patient.archivedAt ? <Badge tone="cancelled">Διαγραμμένος (GDPR)</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {can(ctx.role, "patients.write") && !patient.archivedAt ? (
            <ButtonLink href={`/patients/${patient.id}/edit`} variant="secondary">
              Επεξεργασία
            </ButtonLink>
          ) : null}
          {canSeeVisits && !patient.archivedAt ? (
            <>
              <ButtonLink href={`/patients/${patient.id}/certificate`} variant="secondary">
                📄 Βεβαίωση
              </ButtonLink>
              <ButtonLink href={`/visits/new?patientId=${patient.id}`}>+ Νέα επίσκεψη</ButtonLink>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {canSeeVisits ? (
            <Card>
              <CardHeader title="Ιστορικό επισκέψεων" subtitle={`${patient.visits.length} επισκέψεις`} />
              {patient.visits.length === 0 ? (
                <EmptyState>Δεν έχουν καταγραφεί επισκέψεις.</EmptyState>
              ) : (
                <ul className="divide-y divide-line">
                  {patient.visits.map((v) => (
                    <li key={v.id} className="px-5 py-4">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-pine">
                          {formatDateGr(v.visitDate)}
                        </p>
                        <div className="flex gap-1.5">
                          {v.aiStructured ? <Badge tone="info">AI δόμηση</Badge> : null}
                          {v.icd10Codes.map((c) => (
                            <Badge key={c} tone="neutral">
                              {c}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                        {v.notes ?? "—"}
                      </p>
                      <p className="mt-1.5 text-xs text-mist">{v.doctor.name}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : (
            <Card className="p-5 text-sm text-mist">
              Οι κλινικές σημειώσεις είναι ορατές μόνο σε ιατρούς.
            </Card>
          )}

          <Card>
            <CardHeader title="Ραντεβού" />
            {patient.appointments.length === 0 ? (
              <EmptyState>Κανένα ραντεβού.</EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {patient.appointments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium">{formatDateTimeGr(a.startsAt)}</p>
                      <p className="text-xs text-mist">{a.reason ?? "—"}</p>
                    </div>
                    <StatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="mb-3 font-display text-base font-semibold">Στοιχεία ειδικότητας</h3>
            <TemplateFieldValues
              fields={templates.flatMap((t) => t.fields)}
              values={patient.customFields}
            />
            {patient.generalNotes ? (
              <p className="mt-3 border-t border-line pt-3 text-sm text-mist">{patient.generalNotes}</p>
            ) : null}
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 font-display text-base font-semibold">GDPR</h3>
            <div className="space-y-2">
              <a
                href={`/api/patients/${patient.id}/export`}
                className="block text-sm font-semibold text-pine hover:underline"
              >
                ⇩ Εξαγωγή δεδομένων (JSON)
              </a>
              {can(ctx.role, "patients.erase") && !patient.archivedAt ? (
                <form action={eraseWithId}>
                  <Button variant="danger" type="submit" className="w-full text-xs">
                    Οριστική ανωνυμοποίηση (δικαίωμα διαγραφής)
                  </Button>
                </form>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
