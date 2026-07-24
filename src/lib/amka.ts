/**
 * ΑΜΚΑ validation.
 *
 * Format: DDMMYY + 4 serial digits + 1 check digit (11 digits total).
 * The check digit is the Luhn checksum of the first 10 digits.
 * We validate structure + birth date plausibility + Luhn — that catches the
 * vast majority of typos without rejecting legitimate edge cases.
 */

function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

export type AmkaCheck = { valid: boolean; error?: string };

export function validateAmka(input: string): AmkaCheck {
  const amka = input.trim();
  if (!/^\d{11}$/.test(amka)) return { valid: false, error: "Το ΑΜΚΑ πρέπει να έχει 11 ψηφία." };

  const day = Number(amka.slice(0, 2));
  const month = Number(amka.slice(2, 4));
  if (day < 1 || day > 31 || month < 1 || month > 12) {
    return { valid: false, error: "Τα πρώτα 6 ψηφία του ΑΜΚΑ πρέπει να είναι ημερομηνία γέννησης (ΗΗΜΜΕΕ)." };
  }
  if (!luhnValid(amka)) {
    return { valid: false, error: "Το ΑΜΚΑ δεν είναι έγκυρο (λάθος ψηφίο ελέγχου) — ελέγξτε για τυπογραφικό." };
  }
  return { valid: true };
}

/** Birth date encoded in the ΑΜΚΑ, as "YYYY-MM-DD", when it looks plausible. */
export function birthDateFromAmka(amka: string, today = new Date()): string | null {
  if (!/^\d{11}$/.test(amka)) return null;
  const dd = amka.slice(0, 2);
  const mm = amka.slice(2, 4);
  const yy = Number(amka.slice(4, 6));
  const currentYY = today.getFullYear() % 100;
  // Two-digit year: assume nobody registered is older than ~100 years.
  const century = yy > currentYY ? 1900 : 2000;
  const year = century + yy;
  const iso = `${year}-${mm}-${dd}`;
  const parsed = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.getUTCDate() !== Number(dd) || parsed.getUTCMonth() + 1 !== Number(mm)) return null;
  return iso;
}
