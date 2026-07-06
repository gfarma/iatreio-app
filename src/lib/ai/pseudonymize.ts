export type PatientIdentity = {
  firstName?: string | null;
  lastName?: string | null;
  amka?: string | null;
  phone?: string | null;
  email?: string | null;
};

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Strip direct identifiers from free text before it is sent to any AI
 * provider. Removes the specific patient's name/ΑΜΚΑ/phone/email plus generic
 * patterns (11-digit ΑΜΚΑ, 10-digit phones, emails). Only the clinical
 * free-text survives.
 */
export function pseudonymize(text: string, identity: PatientIdentity = {}): string {
  let out = text;

  for (const name of [identity.firstName, identity.lastName]) {
    if (name && name.trim().length >= 2) {
      out = out.replace(new RegExp(escapeRegExp(name.trim()), "gi"), "ΑΣΘΕΝΗΣ");
    }
  }
  for (const [value, tag] of [
    [identity.amka, "[ΑΜΚΑ]"],
    [identity.phone, "[ΤΗΛΕΦΩΝΟ]"],
    [identity.email, "[EMAIL]"],
  ] as const) {
    if (value && value.trim().length >= 5) {
      out = out.replace(new RegExp(escapeRegExp(value.trim()), "gi"), tag);
    }
  }

  // Generic patterns, regardless of stored fields
  out = out.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[EMAIL]");
  out = out.replace(/\b\d{11}\b/g, "[ΑΜΚΑ]");
  out = out.replace(/\b(?:\+30\s?)?\d{10}\b/g, "[ΤΗΛΕΦΩΝΟ]");

  return out;
}
