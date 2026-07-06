export const CLINIC_TZ = "Europe/Athens";

/** Offset of `tz` from UTC (in ms) at the given instant. */
function tzOffsetMs(tz: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(at).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - at.getTime();
}

/** "2026-07-07" + "09:30" in clinic-local time -> UTC Date (DST-safe). */
export function zonedToUtc(dateStr: string, timeStr: string, tz = CLINIC_TZ): Date {
  const naive = new Date(`${dateStr}T${timeStr}:00Z`);
  let offset = tzOffsetMs(tz, naive);
  let result = new Date(naive.getTime() - offset);
  const offset2 = tzOffsetMs(tz, result);
  if (offset2 !== offset) result = new Date(naive.getTime() - offset2);
  return result;
}

/** UTC Date -> "YYYY-MM-DD" in clinic-local time. */
export function utcToLocalDateStr(d: Date, tz = CLINIC_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** UTC Date -> "HH:mm" in clinic-local time. */
export function utcToLocalTimeStr(d: Date, tz = CLINIC_TZ): string {
  return new Intl.DateTimeFormat("el-GR", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function formatDateGr(d: Date, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("el-GR", {
    timeZone: CLINIC_TZ,
    day: "numeric",
    month: "long",
    year: "numeric",
    ...opts,
  }).format(d);
}

export function formatDateTimeGr(d: Date): string {
  return new Intl.DateTimeFormat("el-GR", {
    timeZone: CLINIC_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** Local (Athens) weekday 0=Sunday..6=Saturday for a "YYYY-MM-DD" string. */
export function weekdayOfDateStr(dateStr: string): number {
  // Noon UTC is the same calendar day in Athens year-round.
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

export function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayStr(): string {
  return utcToLocalDateStr(new Date());
}
