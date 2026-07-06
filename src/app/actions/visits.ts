"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiInteractionLogs, patients, specialtyTemplates, visits } from "@/db/schema";
import { requireContext } from "@/lib/session";
import { assertCan } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

export async function createVisit(formData: FormData) {
  const ctx = await requireContext();
  assertCan(ctx.role, "visits.write");

  const patientId = String(formData.get("patientId") ?? "");
  const appointmentId = String(formData.get("appointmentId") ?? "") || null;
  const notes = String(formData.get("notes") ?? "").trim();
  const icd10 = String(formData.get("icd10") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const aiStructured = formData.get("aiStructured") === "true";
  const aiLogId = String(formData.get("aiLogId") ?? "") || null;

  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.clinicId, ctx.clinic.id)),
  });
  if (!patient) throw new Error("Ο ασθενής δεν βρέθηκε.");
  if (!notes) throw new Error("Οι σημειώσεις είναι υποχρεωτικές.");

  const templates = await db.query.specialtyTemplates.findMany({
    where: and(eq(specialtyTemplates.clinicId, ctx.clinic.id), eq(specialtyTemplates.target, "visit")),
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

  const [v] = await db
    .insert(visits)
    .values({
      clinicId: ctx.clinic.id,
      patientId,
      doctorUserId: ctx.user.id,
      appointmentId,
      notes,
      icd10Codes: icd10,
      customFields,
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
