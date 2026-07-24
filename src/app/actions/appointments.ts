"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { appointments, clinicMembers, patients } from "@/db/schema";
import { requireContext } from "@/lib/session";
import { assertCan } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { zonedToUtc } from "@/lib/dates";
import { findConflict } from "@/lib/scheduling";

export type AppointmentFormState = { error?: string };

type ParsedForm = {
  patientId: string | null;
  doctorUserId: string;
  date: string;
  time: string;
  duration: number;
  reason: string | null;
  room: string | null;
};

function parseForm(formData: FormData): ParsedForm | string {
  const doctorUserId = String(formData.get("doctorUserId") ?? "");
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const duration = Number(formData.get("duration") ?? 30);

  if (!doctorUserId) return "Επιλέξτε ιατρό.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Συμπληρώστε έγκυρη ημερομηνία.";
  if (!/^\d{2}:\d{2}$/.test(time)) return "Συμπληρώστε έγκυρη ώρα.";
  if (!Number.isFinite(duration) || duration < 5 || duration > 480) return "Μη έγκυρη διάρκεια.";

  return {
    patientId: String(formData.get("patientId") ?? "") || null,
    doctorUserId,
    date,
    time,
    duration,
    reason: String(formData.get("reason") ?? "").trim() || null,
    room: String(formData.get("room") ?? "").trim() || null,
  };
}

/** The doctor must belong to the active clinic — never trust the posted id. */
async function assertDoctorInClinic(clinicId: string, doctorUserId: string) {
  const member = await db.query.clinicMembers.findFirst({
    where: and(eq(clinicMembers.clinicId, clinicId), eq(clinicMembers.userId, doctorUserId)),
  });
  if (!member) throw new Error("Ο ιατρός δεν ανήκει στο ιατρείο.");
}

export async function createAppointment(
  _prev: AppointmentFormState,
  formData: FormData,
): Promise<AppointmentFormState> {
  const ctx = await requireContext();
  assertCan(ctx.role, "appointments.write");

  const parsed = parseForm(formData);
  if (typeof parsed === "string") return { error: parsed };
  await assertDoctorInClinic(ctx.clinic.id, parsed.doctorUserId);

  const startsAt = zonedToUtc(parsed.date, parsed.time);
  const endsAt = new Date(startsAt.getTime() + parsed.duration * 60_000);

  const conflict = await findConflict({
    clinicId: ctx.clinic.id,
    doctorUserId: parsed.doctorUserId,
    startsAt,
    endsAt,
  });
  if (conflict) {
    return { error: `Ο ιατρός έχει ήδη ραντεβού ${conflict.label}. Επιλέξτε άλλη ώρα.` };
  }

  const [a] = await db
    .insert(appointments)
    .values({
      clinicId: ctx.clinic.id,
      patientId: parsed.patientId,
      doctorUserId: parsed.doctorUserId,
      startsAt,
      endsAt,
      status: "confirmed",
      source: "staff",
      reason: parsed.reason,
      room: parsed.room,
    })
    .returning();

  await logAudit({
    clinicId: ctx.clinic.id,
    userId: ctx.user.id,
    action: "appointment.create",
    entityType: "appointment",
    entityId: a.id,
  });
  redirect(`/appointments?view=day&date=${parsed.date}`);
}

/** Move / edit an existing appointment — the most common front-desk action. */
export async function rescheduleAppointment(
  appointmentId: string,
  _prev: AppointmentFormState,
  formData: FormData,
): Promise<AppointmentFormState> {
  const ctx = await requireContext();
  assertCan(ctx.role, "appointments.write");

  const existing = await db.query.appointments.findFirst({
    where: and(eq(appointments.id, appointmentId), eq(appointments.clinicId, ctx.clinic.id)),
  });
  if (!existing) return { error: "Το ραντεβού δεν βρέθηκε." };

  const parsed = parseForm(formData);
  if (typeof parsed === "string") return { error: parsed };
  await assertDoctorInClinic(ctx.clinic.id, parsed.doctorUserId);

  const startsAt = zonedToUtc(parsed.date, parsed.time);
  const endsAt = new Date(startsAt.getTime() + parsed.duration * 60_000);

  const conflict = await findConflict({
    clinicId: ctx.clinic.id,
    doctorUserId: parsed.doctorUserId,
    startsAt,
    endsAt,
    excludeAppointmentId: appointmentId,
  });
  if (conflict) {
    return { error: `Ο ιατρός έχει ήδη ραντεβού ${conflict.label}. Επιλέξτε άλλη ώρα.` };
  }

  await db
    .update(appointments)
    .set({
      patientId: parsed.patientId,
      doctorUserId: parsed.doctorUserId,
      startsAt,
      endsAt,
      reason: parsed.reason,
      room: parsed.room,
      updatedAt: new Date(),
    })
    .where(and(eq(appointments.id, appointmentId), eq(appointments.clinicId, ctx.clinic.id)));

  await logAudit({
    clinicId: ctx.clinic.id,
    userId: ctx.user.id,
    action: "appointment.reschedule",
    entityType: "appointment",
    entityId: appointmentId,
    meta: {
      from: existing.startsAt.toISOString(),
      to: startsAt.toISOString(),
    },
  });
  redirect(`/appointments?view=day&date=${parsed.date}`);
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

// ---------------------------------------------------------------------------
// Linking an online (public) booking to a real patient file
// ---------------------------------------------------------------------------

async function loadUnlinked(clinicId: string, appointmentId: string) {
  const appt = await db.query.appointments.findFirst({
    where: and(eq(appointments.id, appointmentId), eq(appointments.clinicId, clinicId)),
  });
  if (!appt) throw new Error("Το ραντεβού δεν βρέθηκε.");
  if (appt.patientId) throw new Error("Το ραντεβού είναι ήδη συνδεδεμένο με ασθενή.");
  return appt;
}

/** Attach the booking to an existing patient file. */
export async function linkAppointmentToPatient(formData: FormData) {
  const ctx = await requireContext();
  assertCan(ctx.role, "appointments.write");

  const appointmentId = String(formData.get("appointmentId") ?? "");
  const patientId = String(formData.get("patientId") ?? "");
  await loadUnlinked(ctx.clinic.id, appointmentId);

  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.clinicId, ctx.clinic.id)),
  });
  if (!patient) throw new Error("Ο ασθενής δεν βρέθηκε.");

  await db
    .update(appointments)
    .set({ patientId, updatedAt: new Date() })
    .where(and(eq(appointments.id, appointmentId), eq(appointments.clinicId, ctx.clinic.id)));

  await logAudit({
    clinicId: ctx.clinic.id,
    userId: ctx.user.id,
    action: "appointment.link_patient",
    entityType: "appointment",
    entityId: appointmentId,
    meta: { patientId },
  });
  redirect(`/patients/${patientId}`);
}

/** Create a fresh patient file out of the booking's contact details. */
export async function createPatientFromAppointment(formData: FormData) {
  const ctx = await requireContext();
  assertCan(ctx.role, "appointments.write");
  assertCan(ctx.role, "patients.write");

  const appointmentId = String(formData.get("appointmentId") ?? "");
  const appt = await loadUnlinked(ctx.clinic.id, appointmentId);

  const raw = (appt.contactName ?? "").trim().replace(/\s+/g, " ");
  const parts = raw.split(" ");
  // Greek convention on booking forms is "Όνομα Επώνυμο".
  const firstName = parts[0] || "—";
  const lastName = parts.slice(1).join(" ") || "—";

  const [patient] = await db
    .insert(patients)
    .values({
      clinicId: ctx.clinic.id,
      firstName,
      lastName,
      phone: appt.contactPhone,
      email: appt.contactEmail,
      // The patient ticked the consent box on the public booking form.
      consentGivenAt: new Date(),
      consentVersion: "v1.0",
    })
    .returning();

  await db
    .update(appointments)
    .set({ patientId: patient.id, updatedAt: new Date() })
    .where(and(eq(appointments.id, appointmentId), eq(appointments.clinicId, ctx.clinic.id)));

  await logAudit({
    clinicId: ctx.clinic.id,
    userId: ctx.user.id,
    action: "patient.create_from_booking",
    entityType: "patient",
    entityId: patient.id,
    meta: { appointmentId },
  });
  redirect(`/patients/${patient.id}/edit`);
}

