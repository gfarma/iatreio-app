"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiInteractionLogs, patients, specialtyTemplates, visits } from "@/db/schema";
import { requireContext } from "@/lib/session";
import { assertCan } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

export type VisitFormState = { error?: string };

async function collectCustomFields(clinicId: string, formData: FormData) {
  const templates = await db.query.specialtyTemplates.findMany({
    where: and(eq(specialtyTemplates.clinicId, clinicId), eq(specialtyTemplates.target, "visit")),
  });
  const customFields: Record<string, unknown> = {};
  for (const t of templates) {
    for (const f of t.fields) {
      const raw = formData.get(`cf_${f.key}`);
      if (raw === null) continue;
      if (f.type === "checkbox") customFields[f.key] = raw === "on";
      else if (f.type === "number" && raw !== "") customFields[f.key] = Number(raw);
      else if (raw !== "") customFields[f.key] = String(raw);
    }
  }
  return customFields;
}

function parseIcd(formData: FormData): string[] {
  return String(formData.get("icd10") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createVisit(
  _prev: VisitFormState,
  formData: FormData,
): Promise<VisitFormState> {
  const ctx = await requireContext();
  assertCan(ctx.role, "visits.write");

  const patientId = String(formData.get("patientId") ?? "");
  const appointmentId = String(formData.get("appointmentId") ?? "") || null;
  const notes = String(formData.get("notes") ?? "").trim();
  const aiStructured = formData.get("aiStructured") === "true";
  const aiLogId = String(formData.get("aiLogId") ?? "") || null;

  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.clinicId, ctx.clinic.id)),
  });
  if (!patient) return { error: "Ο ασθενής δεν βρέθηκε." };
  if (!notes) return { error: "Οι σημειώσεις είναι υποχρεωτικές." };

  const [v] = await db
    .insert(visits)
    .values({
      clinicId: ctx.clinic.id,
      patientId,
      doctorUserId: ctx.user.id,
      appointmentId,
      notes,
      icd10Codes: parseIcd(formData),
      customFields: await collectCustomFields(ctx.clinic.id, formData),
      aiStructured,
    })
    .returning();

  // Human-in-the-loop: the AI output was explicitly accepted by the doctor
  if (aiLogId) {
    await db
      .update(aiInteractionLogs)
      .set({ reviewedByDoctor: true, accepted: true })
      .where(eq(aiInteractionLogs.id, aiLogId));
  }

  await logAudit({
    clinicId: ctx.clinic.id,
    userId: ctx.user.id,
    action: "visit.create",
    entityType: "visit",
    entityId: v.id,
    meta: { aiStructured },
  });
  redirect(`/patients/${patientId}`);
}

/**
 * Amend an existing visit. Medical records must be correctable, but the change
 * has to leave a trail: the previous text is stored in the audit log so the
 * original wording can always be recovered.
 */
export async function updateVisit(
  visitId: string,
  _prev: VisitFormState,
  formData: FormData,
): Promise<VisitFormState> {
  const ctx = await requireContext();
  assertCan(ctx.role, "visits.write");

  const existing = await db.query.visits.findFirst({
    where: and(eq(visits.id, visitId), eq(visits.clinicId, ctx.clinic.id)),
  });
  if (!existing) return { error: "Η επίσκεψη δεν βρέθηκε." };

  const notes = String(formData.get("notes") ?? "").trim();
  if (!notes) return { error: "Οι σημειώσεις είναι υποχρεωτικές." };

  const icd10Codes = parseIcd(formData);
  const customFields = await collectCustomFields(ctx.clinic.id, formData);

  await db
    .update(visits)
    .set({
      notes,
      icd10Codes,
      customFields: { ...existing.customFields, ...customFields },
    })
    .where(and(eq(visits.id, visitId), eq(visits.clinicId, ctx.clinic.id)));

  await logAudit({
    clinicId: ctx.clinic.id,
    userId: ctx.user.id,
    action: "visit.amend",
    entityType: "visit",
    entityId: visitId,
    meta: {
      previousNotes: existing.notes,
      previousIcd10: existing.icd10Codes,
    },
  });
  redirect(`/patients/${existing.patientId}`);
}
