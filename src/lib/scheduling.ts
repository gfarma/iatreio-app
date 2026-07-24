import { and, eq, gt, inArray, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { appointments } from "@/db/schema";
import { utcToLocalTimeStr } from "./dates";

/** Statuses that actually occupy the doctor's calendar. */
export const BLOCKING_STATUSES = ["pending", "confirmed", "completed"] as const;

export type Conflict = { id: string; label: string };

/**
 * Returns the first appointment that overlaps [startsAt, endsAt) for the same
 * doctor, or null. Used by both staff booking and rescheduling so the two paths
 * can never disagree — the public booking path does the same check in
 * actions/booking.ts before inserting.
 */
export async function findConflict(opts: {
  clinicId: string;
  doctorUserId: string;
  startsAt: Date;
  endsAt: Date;
  excludeAppointmentId?: string;
}): Promise<Conflict | null> {
  const clash = await db.query.appointments.findFirst({
    where: and(
      eq(appointments.clinicId, opts.clinicId),
      eq(appointments.doctorUserId, opts.doctorUserId),
      inArray(appointments.status, [...BLOCKING_STATUSES]),
      // overlap test: existing.start < new.end AND existing.end > new.start
      lt(appointments.startsAt, opts.endsAt),
      gt(appointments.endsAt, opts.startsAt),
      opts.excludeAppointmentId ? ne(appointments.id, opts.excludeAppointmentId) : undefined,
    ),
    columns: { id: true, startsAt: true, endsAt: true },
    with: { patient: { columns: { firstName: true, lastName: true } } },
  });
  if (!clash) return null;

  const who = clash.patient
    ? `${clash.patient.lastName} ${clash.patient.firstName}`
    : "άλλο ραντεβού";
  return {
    id: clash.id,
    label: `${utcToLocalTimeStr(clash.startsAt)}–${utcToLocalTimeStr(clash.endsAt)} (${who})`,
  };
}
