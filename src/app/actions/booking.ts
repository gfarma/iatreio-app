"use server";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { appointments, availabilityRules, clinics } from "@/db/schema";
import { computeFreeSlots } from "@/lib/slots";
import { zonedToUtc, addDaysStr, todayStr } from "@/lib/dates";
import { logAudit } from "@/lib/audit";

export type BookingState = { error?: string; success?: boolean };

// Naive in-memory rate limit (per serverless instance) — good enough to slow
// down casual abuse on the public form; a real deployment adds an edge limiter.
const recent = new Map<string, number[]>();
function rateLimited(key: string, limit = 5, windowMs = 10 * 60_000): boolean {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  recent.set(key, hits);
  return hits.length > limit;
}

export async function publicBook(_prev: BookingState, formData: FormData): Promise<BookingState> {
  // Honeypot: bots fill every field
  if (String(formData.get("website") ?? "") !== "") return { success: true };

  const slug = String(formData.get("clinicSlug") ?? "");
  const doctorUserId = String(formData.get("doctorUserId") ?? "");
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const consent = formData.get("consent") === "on";

  if (!name || !phone) return { error: "Συμπληρώστε όνομα και τηλέφωνο." };
  if (!consent) return { error: "Απαιτείται η συναίνεση για την επεξεργασία των στοιχείων σας." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return { error: "Μη έγκυρη ημερομηνία ή ώρα." };
  }
  if (date < todayStr() || date > addDaysStr(todayStr(), 60)) {
    return { error: "Επιλέξτε ημερομηνία εντός των επόμενων 60 ημερών." };
  }
  if (rateLimited(`book:${phone}`)) {
    return { error: "Πολλές προσπάθειες — δοκιμάστε ξανά αργότερα." };
  }

  const clinic = await db.query.clinics.findFirst({
    where: and(eq(clinics.slug, slug), eq(clinics.bookingEnabled, true)),
  });
  if (!clinic) return { error: "Το ιατρείο δεν βρέθηκε." };

  // Recompute availability server-side — the requested slot must be genuinely free
  const rules = await db.query.availabilityRules.findMany({
    where: and(
      eq(availabilityRules.clinicId, clinic.id),
      eq(availabilityRules.doctorUserId, doctorUserId),
    ),
  });
  if (rules.length === 0) return { error: "Ο ιατρός δεν δέχεται online κρατήσεις." };

  const dayStart = zonedToUtc(date, "00:00");
  const dayEnd = zonedToUtc(addDaysStr(date, 1), "00:00");
  const busy = await db.query.appointments.findMany({
    where: and(
      eq(appointments.clinicId, clinic.id),
      eq(appointments.doctorUserId, doctorUserId),
      inArray(appointments.status, ["pending", "confirmed", "completed"]),
    ),
    columns: { startsAt: true, endsAt: true },
  });
  const busyToday = busy.filter((b) => b.startsAt >= dayStart && b.startsAt < dayEnd);

  const slots = computeFreeSlots(date, rules, busyToday);
  const slot = slots.find((s) => s.label === time);
  if (!slot) return { error: "Η ώρα που επιλέξατε μόλις κλείστηκε. Επιλέξτε άλλη ώρα." };

  const [a] = await db
    .insert(appointments)
    .values({
      clinicId: clinic.id,
      doctorUserId,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      status: "pending",
      source: "public",
      reason: reason || null,
      contactName: name,
      contactPhone: phone,
      contactEmail: email || null,
    })
    .returning();

  await logAudit({
    clinicId: clinic.id,
    action: "appointment.public_booking",
    entityType: "appointment",
    entityId: a.id,
  });

  // TODO Phase 2: send SMS/email confirmation via the notification abstraction
  return { success: true };
}
