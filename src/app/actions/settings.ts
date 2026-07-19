"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { availabilityRules, clinicMembers, clinics, timeOff } from "@/db/schema";
import { requireContext } from "@/lib/session";
import { assertCan } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

export async function updateClinic(formData: FormData) {
  const ctx = await requireContext();
  assertCan(ctx.role, "settings.manage");

  await db
    .update(clinics)
    .set({
      name: String(formData.get("name") ?? "").trim() || ctx.clinic.name,
      afm: String(formData.get("afm") ?? "").trim() || null,
      address: String(formData.get("address") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      bookingInfo: String(formData.get("bookingInfo") ?? "").trim() || null,
      bookingEnabled: formData.get("bookingEnabled") === "on",
    })
    .where(eq(clinics.id, ctx.clinic.id));

  await logAudit({
    clinicId: ctx.clinic.id,
    userId: ctx.user.id,
    action: "clinic.update",
    entityType: "clinic",
    entityId: ctx.clinic.id,
  });
  revalidatePath("/settings");
}

export async function addAvailabilityRule(formData: FormData) {
  const ctx = await requireContext();
  assertCan(ctx.role, "settings.manage");

  const doctorUserId = String(formData.get("doctorUserId") ?? "");
  const weekday = Number(formData.get("weekday"));
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");
  const slotMinutes = Number(formData.get("slotMinutes") ?? 30);

  const member = await db.query.clinicMembers.findFirst({
    where: and(eq(clinicMembers.clinicId, ctx.clinic.id), eq(clinicMembers.userId, doctorUserId)),
  });
  if (!member) throw new Error("Ο ιατρός δεν ανήκει στο ιατρείο.");
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) || startTime >= endTime) {
    throw new Error("Μη έγκυρο ωράριο.");
  }
  if (weekday < 0 || weekday > 6 || ![15, 20, 30, 45, 60].includes(slotMinutes)) {
    throw new Error("Μη έγκυρα στοιχεία.");
  }

  await db.insert(availabilityRules).values({
    clinicId: ctx.clinic.id,
    doctorUserId,
    weekday,
    startTime,
    endTime,
    slotMinutes,
  });
  revalidatePath("/settings");
}

export async function addTimeOff(formData: FormData) {
  const ctx = await requireContext();
  assertCan(ctx.role, "settings.manage");

  const doctorUserId = String(formData.get("doctorUserId") ?? "");
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "") || startDate;
  const reason = String(formData.get("reason") ?? "").trim() || null;

  const member = await db.query.clinicMembers.findFirst({
    where: and(eq(clinicMembers.clinicId, ctx.clinic.id), eq(clinicMembers.userId, doctorUserId)),
  });
  if (!member) throw new Error("Ο ιατρός δεν ανήκει στο ιατρείο.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < startDate) {
    throw new Error("Μη έγκυρες ημερομηνίες.");
  }

  await db.insert(timeOff).values({ clinicId: ctx.clinic.id, doctorUserId, startDate, endDate, reason });
  revalidatePath("/settings");
}

export async function deleteTimeOff(formData: FormData) {
  const ctx = await requireContext();
  assertCan(ctx.role, "settings.manage");
  const id = String(formData.get("id") ?? "");
  await db
    .delete(timeOff)
    .where(and(eq(timeOff.id, id), eq(timeOff.clinicId, ctx.clinic.id)));
  revalidatePath("/settings");
}

export async function deleteAvailabilityRule(formData: FormData) {
  const ctx = await requireContext();
  assertCan(ctx.role, "settings.manage");
  const id = String(formData.get("id") ?? "");
  await db
    .delete(availabilityRules)
    .where(and(eq(availabilityRules.id, id), eq(availabilityRules.clinicId, ctx.clinic.id)));
  revalidatePath("/settings");
}
