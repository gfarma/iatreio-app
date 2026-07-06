"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { patients, specialtyTemplates } from "@/db/schema";
import { requireContext } from "@/lib/session";
import { assertCan } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

const patientSchema = z.object({
  firstName: z.string().trim().min(1, "Το όνομα είναι υποχρεωτικό"),
  lastName: z.string().trim().min(1, "Το επώνυμο είναι υποχρεωτικό"),
  birthDate: z.string().trim().optional(),
  amka: z
    .string()
    .trim()
    .regex(/^\d{11}$/, "Το ΑΜΚΑ έχει 11 ψηφία")
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().optional(),
  email: z.string().trim().email("Μη έγκυρο email").optional().or(z.literal("")),
  address: z.string().trim().optional(),
  generalNotes: z.string().trim().optional(),
});

async function extractCustomFields(clinicId: string, formData: FormData) {
  const templates = await db.query.specialtyTemplates.findMany({
    where: and(eq(specialtyTemplates.clinicId, clinicId), eq(specialtyTemplates.target, "patient")),
  });
  const custom: Record<string, unknown> = {};
  for (const t of templates) {
    for (const f of t.fields) {
      const raw = formData.get(`cf_${f.key}`);
      if (raw === null) continue;
      if (f.type === "checkbox") custom[f.key] = raw === "on";
      else if (f.type === "number" && raw !== "") custom[f.key] = Number(raw);
      else if (raw !== "") custom[f.key] = String(raw);
    }
  }
  return custom;
}

export async function createPatient(formData: FormData) {
  const ctx = await requireContext();
  assertCan(ctx.role, "patients.write");

  const parsed = patientSchema.parse(Object.fromEntries(formData));
  const customFields = await extractCustomFields(ctx.clinic.id, formData);
  const consent = formData.get("consent") === "on";

  const [p] = await db
    .insert(patients)
    .values({
      clinicId: ctx.clinic.id,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      birthDate: parsed.birthDate || null,
      amka: parsed.amka || null,
      phone: parsed.phone || null,
      email: parsed.email || null,
      address: parsed.address || null,
      generalNotes: parsed.generalNotes || null,
      customFields,
      consentGivenAt: consent ? new Date() : null,
      consentVersion: consent ? "v1.0" : null,
    })
    .returning();

  await logAudit({
    clinicId: ctx.clinic.id,
    userId: ctx.user.id,
    action: "patient.create",
    entityType: "patient",
    entityId: p.id,
  });
  redirect(`/patients/${p.id}`);
}

export async function updatePatient(patientId: string, formData: FormData) {
  const ctx = await requireContext();
  assertCan(ctx.role, "patients.write");

  const existing = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.clinicId, ctx.clinic.id)),
  });
  if (!existing) throw new Error("Ο ασθενής δεν βρέθηκε.");

  const parsed = patientSchema.parse(Object.fromEntries(formData));
  const customFields = await extractCustomFields(ctx.clinic.id, formData);

  await db
    .update(patients)
    .set({
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      birthDate: parsed.birthDate || null,
      amka: parsed.amka || null,
      phone: parsed.phone || null,
      email: parsed.email || null,
      address: parsed.address || null,
      generalNotes: parsed.generalNotes || null,
      customFields: { ...existing.customFields, ...customFields },
      updatedAt: new Date(),
    })
    .where(and(eq(patients.id, patientId), eq(patients.clinicId, ctx.clinic.id)));

  await logAudit({
    clinicId: ctx.clinic.id,
    userId: ctx.user.id,
    action: "patient.update",
    entityType: "patient",
    entityId: patientId,
  });
  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}`);
}

/**
 * GDPR erasure: anonymizes the record in place (invoices & audit history keep
 * referential integrity, personal data is gone).
 */
export async function erasePatient(patientId: string) {
  const ctx = await requireContext();
  assertCan(ctx.role, "patients.erase");

  const existing = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.clinicId, ctx.clinic.id)),
  });
  if (!existing) throw new Error("Ο ασθενής δεν βρέθηκε.");

  await db
    .update(patients)
    .set({
      firstName: "Διαγραμμένος",
      lastName: "Ασθενής",
      birthDate: null,
      amka: null,
      phone: null,
      email: null,
      address: null,
      generalNotes: null,
      customFields: {},
      archivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(patients.id, patientId), eq(patients.clinicId, ctx.clinic.id)));

  await logAudit({
    clinicId: ctx.clinic.id,
    userId: ctx.user.id,
    action: "patient.erase",
    entityType: "patient",
    entityId: patientId,
    meta: { reason: "gdpr_erasure" },
  });
  revalidatePath("/patients");
  redirect("/patients");
}
