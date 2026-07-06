export type Role = "owner" | "doctor" | "staff";

export type Permission =
  | "patients.read"
  | "patients.write"
  | "patients.erase"
  | "visits.read" // clinical notes — staff must NOT have this
  | "visits.write"
  | "appointments.read"
  | "appointments.write"
  | "invoices.read"
  | "invoices.write"
  | "settings.manage"
  | "ai.use";

const PERMISSIONS: Record<Role, Permission[]> = {
  owner: [
    "patients.read",
    "patients.write",
    "patients.erase",
    "visits.read",
    "visits.write",
    "appointments.read",
    "appointments.write",
    "invoices.read",
    "invoices.write",
    "settings.manage",
    "ai.use",
  ],
  doctor: [
    "patients.read",
    "patients.write",
    "visits.read",
    "visits.write",
    "appointments.read",
    "appointments.write",
    "invoices.read",
    "invoices.write",
    "ai.use",
  ],
  // Staff handle the front desk: appointments, demographics, billing —
  // but never clinical notes (visits.*).
  staff: [
    "patients.read",
    "patients.write",
    "appointments.read",
    "appointments.write",
    "invoices.read",
    "invoices.write",
  ],
};

export function can(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role].includes(permission);
}

export function assertCan(role: Role, permission: Permission) {
  if (!can(role, permission)) {
    throw new Error(`Δεν έχετε δικαίωμα για αυτή την ενέργεια (${permission}).`);
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Διαχειριστής",
  doctor: "Ιατρός",
  staff: "Γραμματεία",
};
