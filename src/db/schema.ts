import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const memberRoleEnum = pgEnum("member_role", ["owner", "doctor", "staff"]);

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
]);

export const appointmentSourceEnum = pgEnum("appointment_source", ["staff", "public"]);

export const templateTargetEnum = pgEnum("template_target", ["patient", "visit"]);

// ---------------------------------------------------------------------------
// Clinics & Users
// ---------------------------------------------------------------------------

export const clinics = pgTable("clinics", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  afm: text("afm"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  specialties: text("specialties").array().notNull().default([]),
  bookingEnabled: boolean("booking_enabled").notNull().default(true),
  bookingInfo: text("booking_info"), // free text shown on the public booking page
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clinicMembers = pgTable(
  "clinic_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull(),
    specialty: text("specialty"), // for doctors
    calendarColor: text("calendar_color"), // hex color in the calendar UI
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("clinic_member_unique").on(t.clinicId, t.userId)],
);

// ---------------------------------------------------------------------------
// Patients
// ---------------------------------------------------------------------------

export const patients = pgTable(
  "patients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    birthDate: text("birth_date"), // ISO date string (YYYY-MM-DD)
    amka: text("amka"),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    generalNotes: text("general_notes"),
    customFields: jsonb("custom_fields").$type<Record<string, unknown>>().notNull().default({}),
    consentGivenAt: timestamp("consent_given_at", { withTimezone: true }),
    consentVersion: text("consent_version"),
    // GDPR: soft-archive instead of hard delete so invoices/audit stay intact;
    // the erasure tool anonymizes the row.
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("patients_clinic_idx").on(t.clinicId)],
);

// Configurable extra fields per specialty (no migration needed per clinic).
export const specialtyTemplates = pgTable("specialty_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id")
    .notNull()
    .references(() => clinics.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  target: templateTargetEnum("target").notNull().default("patient"),
  // [{ key, label, type: "text"|"textarea"|"number"|"select"|"checkbox", options?: string[] }]
  fields: jsonb("fields").$type<TemplateField[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TemplateField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "checkbox";
  options?: string[];
};

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

// Weekly recurring availability per doctor — drives the public booking slots.
export const availabilityRules = pgTable("availability_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id")
    .notNull()
    .references(() => clinics.id, { onDelete: "cascade" }),
  doctorUserId: uuid("doctor_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  weekday: integer("weekday").notNull(), // 0 = Sunday … 6 = Saturday
  startTime: text("start_time").notNull(), // "09:00"
  endTime: text("end_time").notNull(), // "14:30"
  slotMinutes: integer("slot_minutes").notNull().default(30),
});

// Vacation / off-days per doctor — blocks public booking slots.
export const timeOff = pgTable("time_off", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id")
    .notNull()
    .references(() => clinics.id, { onDelete: "cascade" }),
  doctorUserId: uuid("doctor_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  startDate: text("start_date").notNull(), // inclusive, "YYYY-MM-DD"
  endDate: text("end_date").notNull(), // inclusive
  reason: text("reason"),
});

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Public self-service token: the patient can confirm/cancel via /r/<token>
    manageToken: uuid("manage_token").notNull().defaultRandom().unique(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "cascade" }),
    // Nullable: public bookings arrive with contact details only and get linked
    // to a patient record by staff afterwards (avoids junk/duplicate patients).
    patientId: uuid("patient_id").references(() => patients.id, { onDelete: "set null" }),
    doctorUserId: uuid("doctor_user_id")
      .notNull()
      .references(() => users.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: appointmentStatusEnum("status").notNull().default("pending"),
    source: appointmentSourceEnum("source").notNull().default("staff"),
    room: text("room"),
    reason: text("reason"),
    // Contact details for public bookings not yet linked to a patient.
    contactName: text("contact_name"),
    contactPhone: text("contact_phone"),
    contactEmail: text("contact_email"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("appointments_clinic_time_idx").on(t.clinicId, t.startsAt),
    index("appointments_doctor_time_idx").on(t.doctorUserId, t.startsAt),
  ],
);

// ---------------------------------------------------------------------------
// Clinical records
// ---------------------------------------------------------------------------

export const visits = pgTable(
  "visits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    doctorUserId: uuid("doctor_user_id")
      .notNull()
      .references(() => users.id),
    appointmentId: uuid("appointment_id").references(() => appointments.id, {
      onDelete: "set null",
    }),
    visitDate: timestamp("visit_date", { withTimezone: true }).notNull().defaultNow(),
    notes: text("notes"),
    customFields: jsonb("custom_fields").$type<Record<string, unknown>>().notNull().default({}),
    icd10Codes: text("icd10_codes").array().notNull().default([]),
    aiStructured: boolean("ai_structured").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("visits_patient_idx").on(t.patientId)],
);

// ---------------------------------------------------------------------------
// Billing (myDATA-ready placeholders, no real submission in MVP)
// ---------------------------------------------------------------------------

export type InvoiceItem = { description: string; quantity: number; unitPrice: number };

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id").references(() => patients.id, { onDelete: "set null" }),
    visitId: uuid("visit_id").references(() => visits.id, { onDelete: "set null" }),
    number: integer("number").notNull(), // per-clinic sequential number
    series: text("series").notNull().default("Α"),
    issueDate: timestamp("issue_date", { withTimezone: true }).notNull().defaultNow(),
    items: jsonb("items").$type<InvoiceItem[]>().notNull().default([]),
    total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
    paymentMethod: text("payment_method").notNull().default("cash"), // cash | card | transfer
    // Phase 2: myDATA integration fields (kept empty for now)
    mydataStatus: text("mydata_status"),
    mydataUid: text("mydata_uid"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("invoice_number_unique").on(t.clinicId, t.series, t.number)],
);

// ---------------------------------------------------------------------------
// Compliance & AI logs
// ---------------------------------------------------------------------------

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id").references(() => clinics.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(), // e.g. patient.read, visit.create, ai.structure_notes
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_clinic_time_idx").on(t.clinicId, t.createdAt)],
);

export const aiInteractionLogs = pgTable("ai_interaction_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").references(() => clinics.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  feature: text("feature").notNull(), // structure_notes | icd10_suggest | reception_chat
  inputPseudonymized: text("input_pseudonymized").notNull(),
  output: text("output").notNull(),
  model: text("model").notNull(),
  reviewedByDoctor: boolean("reviewed_by_doctor").notNull().default(false),
  accepted: boolean("accepted"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Relations (for db.query.*)
// ---------------------------------------------------------------------------

export const clinicsRelations = relations(clinics, ({ many }) => ({
  members: many(clinicMembers),
  patients: many(patients),
  appointments: many(appointments),
}));

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(clinicMembers),
}));

export const clinicMembersRelations = relations(clinicMembers, ({ one }) => ({
  clinic: one(clinics, { fields: [clinicMembers.clinicId], references: [clinics.id] }),
  user: one(users, { fields: [clinicMembers.userId], references: [users.id] }),
}));

export const patientsRelations = relations(patients, ({ one, many }) => ({
  clinic: one(clinics, { fields: [patients.clinicId], references: [clinics.id] }),
  visits: many(visits),
  appointments: many(appointments),
  invoices: many(invoices),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  clinic: one(clinics, { fields: [appointments.clinicId], references: [clinics.id] }),
  patient: one(patients, { fields: [appointments.patientId], references: [patients.id] }),
  doctor: one(users, { fields: [appointments.doctorUserId], references: [users.id] }),
}));

export const visitsRelations = relations(visits, ({ one }) => ({
  clinic: one(clinics, { fields: [visits.clinicId], references: [clinics.id] }),
  patient: one(patients, { fields: [visits.patientId], references: [patients.id] }),
  doctor: one(users, { fields: [visits.doctorUserId], references: [users.id] }),
  appointment: one(appointments, {
    fields: [visits.appointmentId],
    references: [appointments.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  clinic: one(clinics, { fields: [invoices.clinicId], references: [clinics.id] }),
  patient: one(patients, { fields: [invoices.patientId], references: [patients.id] }),
  visit: one(visits, { fields: [invoices.visitId], references: [visits.id] }),
}));

export const availabilityRulesRelations = relations(availabilityRules, ({ one }) => ({
  clinic: one(clinics, { fields: [availabilityRules.clinicId], references: [clinics.id] }),
  doctor: one(users, { fields: [availabilityRules.doctorUserId], references: [users.id] }),
}));

export const timeOffRelations = relations(timeOff, ({ one }) => ({
  clinic: one(clinics, { fields: [timeOff.clinicId], references: [clinics.id] }),
  doctor: one(users, { fields: [timeOff.doctorUserId], references: [users.id] }),
}));
