/**
 * Ελληνικές επίσημες αργίες — σταθερές + κινητές (Ορθόδοξο Πάσχα).
 * Χρησιμοποιούνται για να ΜΗΝ προσφέρονται online ραντεβού σε αργίες.
 */

/** Orthodox Easter Sunday (Gregorian calendar) — Meeus Julian algorithm +13d for 1900-2099. */
export function orthodoxEaster(year: number): string {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31); // Julian month
  const day = ((d + e + 114) % 31) + 1; // Julian day
  // Convert Julian -> Gregorian (+13 days for 1900-2099)
  const julian = Date.UTC(year, month - 1, day);
  const gregorian = new Date(julian + 13 * 24 * 60 * 60 * 1000);
  return gregorian.toISOString().slice(0, 10);
}

function shift(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Map of "YYYY-MM-DD" -> holiday name for a given year. */
export function greekHolidays(year: number): Map<string, string> {
  const easter = orthodoxEaster(year);
  const map = new Map<string, string>([
    [`${year}-01-01`, "Πρωτοχρονιά"],
    [`${year}-01-06`, "Θεοφάνεια"],
    [shift(easter, -48), "Καθαρά Δευτέρα"],
    [`${year}-03-25`, "25η Μαρτίου"],
    [shift(easter, -2), "Μεγάλη Παρασκευή"],
    [easter, "Κυριακή του Πάσχα"],
    [shift(easter, 1), "Δευτέρα του Πάσχα"],
    [`${year}-05-01`, "Πρωτομαγιά"],
    [shift(easter, 50), "Αγίου Πνεύματος"],
    [`${year}-08-15`, "Δεκαπενταύγουστος"],
    [`${year}-10-28`, "28η Οκτωβρίου"],
    [`${year}-12-25`, "Χριστούγεννα"],
    [`${year}-12-26`, "Σύναξη Θεοτόκου"],
  ]);
  return map;
}

const cache = new Map<number, Map<string, string>>();

/** Returns the holiday name for a date, or null. */
export function holidayName(dateStr: string): string | null {
  const year = Number(dateStr.slice(0, 4));
  if (!cache.has(year)) cache.set(year, greekHolidays(year));
  return cache.get(year)!.get(dateStr) ?? null;
}
