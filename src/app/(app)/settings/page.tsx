import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { availabilityRules, clinicMembers, clinics, specialtyTemplates, timeOff } from "@/db/schema";
import { requireContext } from "@/lib/session";
import { assertCan, ROLE_LABELS } from "@/lib/rbac";
import {
  addAvailabilityRule,
  addTimeOff,
  deleteAvailabilityRule,
  deleteTimeOff,
  updateClinic,
} from "@/app/actions/settings";
import { formatDateGr } from "@/lib/dates";
import { Badge, Button, Card, CardHeader, Field, Input, PageTitle, Select, Textarea } from "@/components/ui";

export const metadata = { title: "Ρυθμίσεις" };

const WEEKDAYS_GR = ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"];

export default async function SettingsPage() {
  const ctx = await requireContext();
  assertCan(ctx.role, "settings.manage");

  const [clinic, members, rules, templates, offRows] = await Promise.all([
    db.query.clinics.findFirst({ where: eq(clinics.id, ctx.clinic.id) }),
    db.query.clinicMembers.findMany({
      where: eq(clinicMembers.clinicId, ctx.clinic.id),
      with: { user: { columns: { id: true, name: true, email: true } } },
    }),
    db.query.availabilityRules.findMany({
      where: eq(availabilityRules.clinicId, ctx.clinic.id),
      with: { doctor: { columns: { name: true } } },
      orderBy: (r, { asc }) => [asc(r.weekday), asc(r.startTime)],
    }),
    db.query.specialtyTemplates.findMany({
      where: eq(specialtyTemplates.clinicId, ctx.clinic.id),
    }),
    db.query.timeOff.findMany({
      where: eq(timeOff.clinicId, ctx.clinic.id),
      with: { doctor: { columns: { name: true } } },
      orderBy: (t, { asc }) => [asc(t.startDate)],
    }),
  ]);
  if (!clinic) return null;
  const doctors = members.filter((m) => m.role === "doctor");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageTitle
        title="Ρυθμίσεις"
        subtitle={clinic.name}
        action={
          <Link href="/audit" className="text-sm font-semibold text-pine hover:underline">
            Αρχείο ενεργειών (audit log) →
          </Link>
        }
      />

      <Card>
        <CardHeader title="Στοιχεία ιατρείου" subtitle="Εμφανίζονται στη δημόσια σελίδα και στις αποδείξεις" />
        <form action={updateClinic} className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Επωνυμία">
            <Input name="name" defaultValue={clinic.name} required />
          </Field>
          <Field label="ΑΦΜ">
            <Input name="afm" defaultValue={clinic.afm ?? ""} />
          </Field>
          <Field label="Διεύθυνση">
            <Input name="address" defaultValue={clinic.address ?? ""} />
          </Field>
          <Field label="Τηλέφωνο">
            <Input name="phone" defaultValue={clinic.phone ?? ""} />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" defaultValue={clinic.email ?? ""} />
          </Field>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="bookingEnabled" defaultChecked={clinic.bookingEnabled} className="accent-pine" />
              Ενεργή δημόσια σελίδα κράτησης (/{clinic.slug}/booking)
            </label>
          </div>
          <div className="sm:col-span-2">
            <Field label="Κείμενο στη σελίδα κράτησης">
              <Textarea name="bookingInfo" rows={2} defaultValue={clinic.bookingInfo ?? ""} />
            </Field>
          </div>
          <div>
            <Button type="submit">Αποθήκευση</Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title="Ομάδα" subtitle="Μέλη του ιατρείου και ρόλοι" />
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-sm font-semibold">{m.user.name}</p>
                <p className="text-xs text-mist">{m.user.email}{m.specialty ? ` · ${m.specialty}` : ""}</p>
              </div>
              <Badge tone={m.role === "owner" ? "completed" : m.role === "doctor" ? "info" : "neutral"}>
                {ROLE_LABELS[m.role]}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader
          title="Διαθεσιμότητα για online κρατήσεις"
          subtitle="Εβδομαδιαία ωράρια ανά ιατρό — καθορίζουν τα διαθέσιμα ραντεβού στη δημόσια σελίδα"
        />
        <ul className="divide-y divide-line">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center justify-between px-5 py-2.5">
              <p className="text-sm">
                <strong>{WEEKDAYS_GR[r.weekday]}</strong> {r.startTime}–{r.endTime}
                <span className="text-mist"> · ανά {r.slotMinutes}′ · {r.doctor.name}</span>
              </p>
              <form action={deleteAvailabilityRule}>
                <input type="hidden" name="id" value={r.id} />
                <button className="text-xs font-semibold text-clay hover:underline">Διαγραφή</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addAvailabilityRule} className="flex flex-wrap items-end gap-3 border-t border-line p-5">
          <Field label="Ιατρός">
            <Select name="doctorUserId" className="w-44">
              {doctors.map((d) => (
                <option key={d.user.id} value={d.user.id}>
                  {d.user.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ημέρα">
            <Select name="weekday" className="w-32">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <option key={d} value={d}>
                  {WEEKDAYS_GR[d]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Από">
            <Input name="startTime" type="time" defaultValue="09:00" className="w-28" />
          </Field>
          <Field label="Έως">
            <Input name="endTime" type="time" defaultValue="14:00" className="w-28" />
          </Field>
          <Field label="Διάρκεια">
            <Select name="slotMinutes" defaultValue="30" className="w-24">
              {[15, 20, 30, 45, 60].map((m) => (
                <option key={m} value={m}>
                  {m}′
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" variant="secondary">
            + Προσθήκη
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Άδειες / απουσίες ιατρών"
          subtitle="Στις ημέρες αυτές (και στις επίσημες αργίες, αυτόματα) δεν προσφέρονται online ραντεβού"
        />
        <ul className="divide-y divide-line">
          {offRows.map((t) => (
            <li key={t.id} className="flex items-center justify-between px-5 py-2.5">
              <p className="text-sm">
                <strong>
                  {formatDateGr(new Date(t.startDate + "T12:00:00Z"), { day: "numeric", month: "short" })}
                  {t.endDate !== t.startDate
                    ? ` — ${formatDateGr(new Date(t.endDate + "T12:00:00Z"), { day: "numeric", month: "short", year: "numeric" })}`
                    : ""}
                </strong>
                <span className="text-mist"> · {t.doctor.name}{t.reason ? ` · ${t.reason}` : ""}</span>
              </p>
              <form action={deleteTimeOff}>
                <input type="hidden" name="id" value={t.id} />
                <button className="text-xs font-semibold text-clay hover:underline">Διαγραφή</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addTimeOff} className="flex flex-wrap items-end gap-3 border-t border-line p-5">
          <Field label="Ιατρός">
            <Select name="doctorUserId" className="w-44">
              {doctors.map((d) => (
                <option key={d.user.id} value={d.user.id}>
                  {d.user.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Από">
            <Input name="startDate" type="date" required className="w-40" />
          </Field>
          <Field label="Έως (προαιρετικό)">
            <Input name="endDate" type="date" className="w-40" />
          </Field>
          <Field label="Λόγος">
            <Input name="reason" placeholder="π.χ. Άδεια" className="w-36" />
          </Field>
          <Button type="submit" variant="secondary">
            + Προσθήκη
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Πρότυπα ειδικότητας"
          subtitle="Προσαρμοσμένα πεδία για φάκελο ασθενή και επισκέψεις"
        />
        <ul className="divide-y divide-line">
          {templates.map((t) => (
            <li key={t.id} className="px-5 py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{t.name}</p>
                <Badge tone="neutral">{t.target === "patient" ? "Φάκελος" : "Επίσκεψη"}</Badge>
              </div>
              <p className="mt-1 text-xs text-mist">
                {t.fields.map((f) => f.label).join(" · ") || "Χωρίς πεδία"}
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
