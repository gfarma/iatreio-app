"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { appointments, clinicMembers } from "@/db/schema";
import { requireContext } from "@/lib/session";
import { assertCan } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { zonedToUtc } from "@/lib/dates";

export async function createAppointment(formData: FormData) {
  const ctx = await requireContext();
  assertCan(ctx.role, "appointments.write");

  const patientId = String(formData.get("patientId") ?? "");
  const doctorUserId = String(formData.get("doctorUserId") ?? "");
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const duration = Number(formData.get("duration") ?? 30);
  const reason = String(formData.get("reason") ?? "").trim() || null;
  const room = String(formData.get("room") ?? "").trim() || null;

  if (!doctorUserId || !date || !time) throw new Error("Συμπληρώστε ιατρό, ημερομηνία και ώρα.");

  // Doctor must belong to the active clinic
  const member = await db.query.clinicMembers.findFirst({
    where: and(
      eq(clinicMembers.clinicId, ctx.clinic.id),
      eq(clinicMembers.userId, doctorUserId),
    ),
  });
  if (!member) throw new Error("Ο ιατρός δεν ανήκει στο ιατρείο.");

  const startsAt = zonedToUtc(date, time);
  const endsAt = new Date(startsAt.getTime() + duration * 60_000);

  const [a] = await db
    .insert(appointments)
    .values({
      clinicId: ctx.clinic.id,
      patientId: patientId || null,
      doctorUserId,
      startsAt,
      endsAt,
      status: "confirmed",
      source: "staff",
      reason,
      room,
    })
    .returning();

  await logAudit({
    clinicId: ctx.clinic.id,
    userId: ctx.user.id,
    action: "appointment.create",
    entityType: "appointment",
    entityId: a.id,
  });
  redirect(`/appointments?view=day&date=${date}`);
}

const ALLOWED_STATUSES = ["pending", "confirmed", "completed", "cancelled", "no_show"] as const;

export async function setAppointmentStatus(formData: FormData) {
  const ctx = await requireContext();
  assertCan(ctx.role, "appointments.write");

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as (typeof ALLOWED_STATUSES)[number];
  if (!ALLOWED_STATUSES.includes(status)) throw new Error("Μη έγκυρη κατάσταση.");

  const result = await db
    .update(appointments)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(appointments.id, id), eq(appointments.clinicId, ctx.clinic.id)))
    .returning({ id: appointments.id });
  if (result.length === 0) throw new Error("Το ραντεβού δεν βρέθηκε.");

  await logAudit({
    clinicId: ctx.clinic.id,
    userId: ctx.user.id,
    action: `appointment.status.${status}`,
    entityType: "appointment",
    entityId: id,
  });
  revalidatePath("/appointments");
  revalidatePath("/dashboard");
}
