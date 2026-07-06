/**
 * Demo seed — ΠΛΑΣΤΑ δεδομένα μόνο. Τρέχει τοπικά (PGlite) ή σε Neon μέσω
 * DATABASE_URL. Αν το demo ιατρείο υπάρχει ήδη, δεν κάνει τίποτα.
 *
 *   npm run db:seed
 */
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  appointments,
  availabilityRules,
  clinicMembers,
  clinics,
  invoices,
  patients,
  specialtyTemplates,
  users,
  visits,
} from "./schema";
import { zonedToUtc, addDaysStr, todayStr } from "../lib/dates";

const PASSWORD = "demo1234";

async function main() {
  const existing = await db.query.clinics.findFirst({ where: eq(clinics.slug, "demo-derma") });
  if (existing) {
    console.log("Το demo ιατρείο υπάρχει ήδη — δεν χρειάζεται seed.");
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // --- Clinics ---------------------------------------------------------
  const [derma] = await db
    .insert(clinics)
    .values({
      name: "Δερματολογικό Ιατρείο Δρ. Παπαδοπούλου",
      slug: "demo-derma",
      afm: "999999999",
      address: "Λεωφ. Κηφισίας 128, Αθήνα",
      phone: "2101234567",
      email: "info@demo-derma.gr",
      specialties: ["Δερματολογία"],
      bookingInfo:
        "Δεχόμαστε με ραντεβού. Για επείγοντα περιστατικά καλέστε στο ιατρείο. Παρακαλούμε προσέλθετε 10 λεπτά νωρίτερα στο πρώτο σας ραντεβού.",
    })
    .returning();

  const [physio] = await db
    .insert(clinics)
    .values({
      name: "Φυσικοθεραπευτήριο «Κίνηση»",
      slug: "demo-physio",
      afm: "888888888",
      address: "Εθν. Αντιστάσεως 45, Χαλάνδρι",
      phone: "2107654321",
      email: "info@demo-physio.gr",
      specialties: ["Φυσικοθεραπεία"],
      bookingInfo: "Συνεδρίες 45 λεπτών κατόπιν ραντεβού.",
    })
    .returning();

  // --- Users -----------------------------------------------------------
  const [owner] = await db
    .insert(users)
    .values({ name: "Γιώργος Οικονόμου", email: "owner@demo.gr", passwordHash })
    .returning();
  const [doctor] = await db
    .insert(users)
    .values({ name: "Δρ. Ελένη Παπαδοπούλου", email: "doctor@demo.gr", passwordHash })
    .returning();
  const [staff] = await db
    .insert(users)
    .values({ name: "Μαρία Αντωνίου", email: "staff@demo.gr", passwordHash })
    .returning();

  await db.insert(clinicMembers).values([
    { clinicId: derma.id, userId: owner.id, role: "owner" },
    { clinicId: derma.id, userId: doctor.id, role: "doctor", specialty: "Δερματολόγος", calendarColor: "#0f6b62" },
    { clinicId: derma.id, userId: staff.id, role: "staff" },
    { clinicId: physio.id, userId: owner.id, role: "owner" },
    { clinicId: physio.id, userId: doctor.id, role: "doctor", specialty: "Φυσικοθεραπεύτρια", calendarColor: "#8a5a2b" },
  ]);

  // --- Specialty templates ----------------------------------------------
  await db.insert(specialtyTemplates).values([
    {
      clinicId: derma.id,
      name: "Δερματολογικός φάκελος",
      target: "patient",
      fields: [
        { key: "fototypos", label: "Φωτότυπος δέρματος", type: "select", options: ["I", "II", "III", "IV", "V", "VI"] },
        { key: "allergies", label: "Αλλεργίες", type: "text" },
        { key: "chronic", label: "Χρόνιες παθήσεις", type: "textarea" },
      ],
    },
    {
      clinicId: derma.id,
      name: "Δερματολογική επίσκεψη",
      target: "visit",
      fields: [
        { key: "findings", label: "Κλινικά ευρήματα", type: "textarea" },
        { key: "treatment", label: "Θεραπεία / Αγωγή", type: "textarea" },
        { key: "followup", label: "Επανέλεγχος σε (εβδομάδες)", type: "number" },
      ],
    },
    {
      clinicId: physio.id,
      name: "Φάκελος φυσικοθεραπείας",
      target: "patient",
      fields: [
        { key: "diagnosis_ref", label: "Παραπεμπτική διάγνωση", type: "text" },
        { key: "sessions_total", label: "Εγκεκριμένες συνεδρίες", type: "number" },
      ],
    },
  ]);

  // --- Availability (public booking) ------------------------------------
  const rules = [];
  for (const weekday of [1, 2, 3, 4, 5]) {
    rules.push({ clinicId: derma.id, doctorUserId: doctor.id, weekday, startTime: "09:00", endTime: "14:00", slotMinutes: 30 });
  }
  for (const weekday of [2, 4]) {
    rules.push({ clinicId: derma.id, doctorUserId: doctor.id, weekday, startTime: "17:00", endTime: "20:30", slotMinutes: 30 });
  }
  for (const weekday of [1, 3, 5]) {
    rules.push({ clinicId: physio.id, doctorUserId: doctor.id, weekday, startTime: "10:00", endTime: "13:00", slotMinutes: 45 });
  }
  await db.insert(availabilityRules).values(rules);

  // --- Patients (fake) ---------------------------------------------------
  const patientData = [
    ["Κώστας", "Δημητρίου", "1985-03-12", "6941111111", { fototypos: "III", allergies: "Πενικιλίνη" }],
    ["Άννα", "Βασιλείου", "1992-07-25", "6942222222", { fototypos: "II" }],
    ["Νίκος", "Παππάς", "1978-11-03", "6943333333", { chronic: "Ψωρίαση από το 2015" }],
    ["Σοφία", "Καραγιάννη", "2001-01-18", "6944444444", { fototypos: "I", allergies: "—" }],
    ["Δημήτρης", "Αλεξίου", "1965-09-30", "6945555555", { chronic: "Σακχαρώδης διαβήτης τύπου 2" }],
    ["Ελένη", "Μακρή", "1988-05-14", "6946666666", {}],
    ["Γιάννης", "Στεφανίδης", "1995-12-08", "6947777777", { fototypos: "IV" }],
    ["Κατερίνα", "Λάμπρου", "1983-04-22", "6948888888", { allergies: "Λάτεξ" }],
    ["Πέτρος", "Νικολάου", "1970-08-17", "6949999999", {}],
    ["Μαρίνα", "Χρήστου", "1999-02-27", "6940000000", { fototypos: "II" }],
  ] as const;

  const insertedPatients = [];
  for (const [firstName, lastName, birthDate, phone, customFields] of patientData) {
    const [p] = await db
      .insert(patients)
      .values({
        clinicId: derma.id,
        firstName,
        lastName,
        birthDate,
        phone,
        email: `${lastName.toLowerCase()}@example.com`,
        customFields: customFields as Record<string, unknown>,
        consentGivenAt: new Date(),
        consentVersion: "v1.0",
      })
      .returning();
    insertedPatients.push(p);
  }

  // --- Appointments around today ----------------------------------------
  const today = todayStr();
  type ApptSeed = { day: number; time: string; patient: number; status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show"; reason: string };
  const apptSeeds: ApptSeed[] = [
    { day: -21, time: "09:30", patient: 0, status: "completed", reason: "Έλεγχος σπίλων" },
    { day: -21, time: "10:00", patient: 1, status: "completed", reason: "Ακμή" },
    { day: -14, time: "11:00", patient: 2, status: "completed", reason: "Ψωρίαση — επανέλεγχος" },
    { day: -14, time: "12:30", patient: 3, status: "no_show", reason: "Πρώτη επίσκεψη" },
    { day: -7, time: "09:00", patient: 4, status: "completed", reason: "Δερματίτιδα" },
    { day: -7, time: "10:30", patient: 3, status: "no_show", reason: "Πρώτη επίσκεψη (επαναπρογρ.)" },
    { day: -3, time: "13:00", patient: 5, status: "completed", reason: "Έλεγχος σπίλων" },
    { day: -1, time: "09:30", patient: 6, status: "cancelled", reason: "Εξάνθημα" },
    { day: 0, time: "09:00", patient: 7, status: "confirmed", reason: "Αφαίρεση σπίλου — συζήτηση" },
    { day: 0, time: "10:00", patient: 8, status: "confirmed", reason: "Ετήσιος έλεγχος" },
    { day: 0, time: "11:30", patient: 9, status: "pending", reason: "Ακμή — πρώτη επίσκεψη" },
    { day: 1, time: "09:30", patient: 0, status: "confirmed", reason: "Επανέλεγχος" },
    { day: 2, time: "10:00", patient: 2, status: "pending", reason: "Ψωρίαση — αγωγή" },
    { day: 3, time: "12:00", patient: 5, status: "pending", reason: "Αποτελέσματα βιοψίας" },
    { day: 7, time: "09:00", patient: 1, status: "pending", reason: "Επανέλεγχος ακμής" },
  ];

  const insertedAppts = [];
  for (const s of apptSeeds) {
    const dateStr = addDaysStr(today, s.day);
    const startsAt = zonedToUtc(dateStr, s.time);
    const endsAt = new Date(startsAt.getTime() + 30 * 60_000);
    const [a] = await db
      .insert(appointments)
      .values({
        clinicId: derma.id,
        patientId: insertedPatients[s.patient].id,
        doctorUserId: doctor.id,
        startsAt,
        endsAt,
        status: s.status,
        source: "staff",
        reason: s.reason,
      })
      .returning();
    insertedAppts.push(a);
  }

  // --- Visits for completed appointments ---------------------------------
  const visitNotes: [number, string, string[]][] = [
    [0, "Έλεγχος σπίλων ράχης. Δύο σπίλοι προς παρακολούθηση, φωτογραφήθηκαν. Σύσταση για ετήσιο έλεγχο και αντηλιακή προστασία.", ["D22.5"]],
    [1, "Ακμή προσώπου μέτριας βαρύτητας. Έναρξη τοπικής αγωγής με ρετινοειδές βράδυ + ήπιο καθαριστικό. Επανέλεγχος σε 8 εβδομάδες.", ["L70.0"]],
    [2, "Ψωρίαση κατά πλάκας — βελτίωση 60% με τοπική αγωγή. Συνέχιση σχήματος, συζητήθηκε φωτοθεραπεία αν υποτροπή.", ["L40.0"]],
    [4, "Ατοπική δερματίτιδα αντιβραχίων. Ενυδάτωση + κορτικοειδές χαμηλής ισχύος για 7 ημέρες.", ["L20.9"]],
    [6, "Έλεγχος σπίλων — χωρίς ύποπτες βλάβες. Επόμενος έλεγχος σε 12 μήνες.", ["Z12.83"]],
  ];
  const insertedVisits = [];
  for (const [apptIdx, notes, icd] of visitNotes) {
    const appt = insertedAppts[apptIdx];
    const [v] = await db
      .insert(visits)
      .values({
        clinicId: derma.id,
        patientId: appt.patientId!,
        doctorUserId: doctor.id,
        appointmentId: appt.id,
        visitDate: appt.startsAt,
        notes,
        icd10Codes: icd,
        customFields: { followup: 8 },
      })
      .returning();
    insertedVisits.push(v);
  }

  // --- Invoices -----------------------------------------------------------
  let number = 1;
  for (const v of insertedVisits.slice(0, 4)) {
    await db.insert(invoices).values({
      clinicId: derma.id,
      patientId: v.patientId,
      visitId: v.id,
      number: number++,
      series: "Α",
      issueDate: v.visitDate,
      items: [{ description: "Δερματολογική εξέταση", quantity: 1, unitPrice: 50 }],
      total: "50.00",
      paymentMethod: number % 2 === 0 ? "card" : "cash",
    });
  }

  console.log("Seed ολοκληρώθηκε ✅");
  console.log("Λογαριασμοί demo (κωδικός: demo1234):");
  console.log("  owner@demo.gr  — Διαχειριστής (2 ιατρεία)");
  console.log("  doctor@demo.gr — Ιατρός");
  console.log("  staff@demo.gr  — Γραμματεία");
  console.log("Δημόσια σελίδα κράτησης: /demo-derma/booking");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
