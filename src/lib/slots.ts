import { zonedToUtc, weekdayOfDateStr, utcToLocalTimeStr } from "./dates";

export type Rule = {
  weekday: number;
  startTime: string; // "09:00"
  endTime: string; // "14:00"
  slotMinutes: number;
};

export type BusyInterval = { startsAt: Date; endsAt: Date };

export type Slot = { startsAt: Date; endsAt: Date; label: string };

/**
 * Compute free bookable slots for one doctor on one local (Athens) date,
 * given their weekly availability rules and existing (non-cancelled)
 * appointments. Slots in the past are excluded.
 */
export function computeFreeSlots(
  dateStr: string,
  rules: Rule[],
  busy: BusyInterval[],
  now: Date = new Date(),
): Slot[] {
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
