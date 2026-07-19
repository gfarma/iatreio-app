import { zonedToUtc, weekdayOfDateStr, utcToLocalTimeStr } from "./dates";
import { holidayName } from "./holidays";

export type Rule = {
  weekday: number;
  startTime: string; // "09:00"
  endTime: string; // "14:00"
  slotMinutes: number;
};

export type BusyInterval = { startsAt: Date; endsAt: Date };

export type TimeOffRange = { startDate: string; endDate: string };

export type Slot = { startsAt: Date; endsAt: Date; label: string };

/** True when the doctor is unavailable that day (vacation or Greek public holiday). */
export function isBlockedDay(dateStr: string, timeOff: TimeOffRange[] = []): string | null {
  const holiday = holidayName(dateStr);
  if (holiday) return holiday;
  const off = timeOff.find((t) => t.startDate <= dateStr && dateStr <= t.endDate);
  return off ? "Άδεια ιατρού" : null;
}

/**
 * Compute free bookable slots for one doctor on one local (Athens) date,
 * given their weekly availability rules, existing (non-cancelled)
 * appointments, and any time-off ranges. Holidays and past slots are excluded.
 */
export function computeFreeSlots(
  dateStr: string,
  rules: Rule[],
  busy: BusyInterval[],
  now: Date = new Date(),
  timeOff: TimeOffRange[] = [],
): Slot[] {
  if (isBlockedDay(dateStr, timeOff)) return [];

  const weekday = weekdayOfDateStr(dateStr);
  const slots: Slot[] = [];

  for (const rule of rules.filter((r) => r.weekday === weekday)) {
    const windowStart = zonedToUtc(dateStr, rule.startTime);
    const windowEnd = zonedToUtc(dateStr, rule.endTime);
    const stepMs = rule.slotMinutes * 60_000;

    for (let t = windowStart.getTime(); t + stepMs <= windowEnd.getTime(); t += stepMs) {
      const start = new Date(t);
      const end = new Date(t + stepMs);
      if (start <= now) continue;
      const overlaps = busy.some((b) => b.startsAt < end && b.endsAt > start);
      if (overlaps) continue;
      slots.push({ startsAt: start, endsAt: end, label: utcToLocalTimeStr(start) });
    }
  }

  return slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}
