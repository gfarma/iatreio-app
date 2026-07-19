"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { appointments } from "@/db/schema";
import { logAudit } from "@/lib/audit";

/** Patient self-service via tokenized link — no login involved. */
async function setStatusByToken(token: string, status: "confirmed" | "cancelled") {
  const appt = await db.query.appointments.findFirst({
    where: eq(appointments.manageToken, token),
    columns: { id: true, clinicId: true, startsAt: true, status: true },
  });
  if (!appt) return;
  // Only future, still-active appointments can be self-managed
  if (appt.startsAt <= new Date()) return;
  if (!["pending", "confirmed"].includes(appt.status)) return;

  await db
    .update(appointments)
    .set({ status, updatedAt: new Date() })
    .where(
      and(
        eq(appointments.id, appt.id),
        inArray(appointments.status, ["pending", "confirmed"]),
      ),
    );
  await logAudit({
    clinicId: appt.clinicId,
    action: `appointment.patient_${status === "confirmed" ? "confirm" : "cancel"}`,
    entityType: "appointment",
    entityId: appt.id,
    meta: { via: "manage_token" },
  });
  revalidatePath(`/r/${token}`);
}

export async function patientConfirm(formData: FormData) {
  await setStatusByToken(String(formData.get("token") ?? ""), "confirmed");
}

export async function patientCancel(formData: FormData) {
  await setStatusByToken(String(formData.get("token") ?? ""), "cancelled");
}
