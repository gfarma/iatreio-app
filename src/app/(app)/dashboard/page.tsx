import Link from "next/link";
import { and, count, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { appointments, patients, visits } from "@/db/schema";
import { requireContext } from "@/lib/session";
import { can } from "@/lib/rbac";
import { todayStr, addDaysStr, zonedToUtc, utcToLocalTimeStr, formatDateGr } from "@/lib/dates";
import { Card, CardHeader, EmptyState, PageTitle, StatusBadge } from "@/components/ui";

export const metadata = { title: "Επισκόπηση" };

export default async function DashboardPage() {
  const ctx = await requireContext();
  const today = todayStr();
  const dayStart = zonedToUtc(today, "00:00");
  const dayEnd = zonedToUtc(addDaysStr(today, 1), "00:00");
  const monthStart = zonedToUtc(`${today.slice(0, 7)}-01`, "00:00");

  const [todays, [patientCount], [monthVisits], pendingPublic] = await Promise.all([
    db.query.appointments.findMany({
      where: and(
        eq(appointments.clinicId, ctx.clinic.id),
        gte(appointments.startsAt, dayStart),
        lt(appointments.startsAt, dayEnd),
      ),
      with: { patient: true, doctor: { columns: { name: true } } },
      orderBy: (a, { asc }) => [asc(a.startsAt)],
    }),
    db
      .select({ value: count() })
      .from(patients)
      .where(and(eq(patients.clinicId, ctx.clinic.id))),
    db
      .select({ value: count() })
      .from(visits)
      .where(and(eq(visits.clinicId, ctx.clinic.id), gte(visits.visitDate, monthStart))),
    db.query.appointments.findMany({
      where: and(
        eq(appointments.clinicId, ctx.clinic.id),
        eq(appointments.status, "pending"),
        eq(appointments.source, "public"),
      ),
      orderBy: (a, { asc }) => [asc(a.startsAt)],
      limit: 5,
    }),
  ]);

  const stats = [
    { label: "Ραντεβού σήμερα", value: todays.length },
    { label: "Επισκέψεις τον μήνα", value: monthVisits.value },
    { label: "Ενεργοί ασθενείς", value: patientCount.value },
    { label: "Νέες online κρατήσεις", value: pendingPublic.length },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle
        title={`Καλημέρα, ${ctx.user.name.split(" ")[0]}`}
        subtitle={`${ctx.clinic.name} · ${formatDateGr(new Date(), { weekday: "long" })}`}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="px-5 py-4">
            <p className="font-display text-3xl font-semibold text-pine">{s.value}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-mist">{s.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Σημερινό πρόγραμμα"
            action={
              <Link href="/appointments" className="text-sm font-semibold text-pine hover:underline">
                Ημερολόγιο →
              </Link>
            }
          />
          {todays.length === 0 ? (
            <EmptyState>Δεν υπάρχουν ραντεβού για σήμερα.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {todays.map((a) => (
                <li key={a.id} className="flex items-center gap-4 px-5 py-3">
                  <span className="w-12 font-display text-sm font-bold text-pine">
                    {utcToLocalTimeStr(a.startsAt)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {a.patient ? (
                        <Link href={`/patients/${a.patient.id}`} className="hover:text-pine">
                          {a.patient.lastName} {a.patient.firstName}
                        </Link>
                      ) : (
                        (a.contactName ?? "—")
                      )}
                    </p>
                    <p className="truncate text-xs text-mist">{a.reason ?? "—"}</p>
                  </div>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Online κρατήσεις" subtitle="Σε αναμονή επιβεβαίωσης" />
          {pendingPublic.length === 0 ? (
            <EmptyState>Καμία νέα κράτηση από τη δημόσια σελίδα.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {pendingPublic.map((a) => (
                <li key={a.id} className="px-5 py-3">
                  <p className="text-sm font-semibold">{a.contactName ?? "—"}</p>
                  <p className="text-xs text-mist">
                    {formatDateGr(a.startsAt, { day: "numeric", month: "short" })} ·{" "}
                    {utcToLocalTimeStr(a.startsAt)} · {a.contactPhone ?? ""}
                  </p>
                  {!a.patientId && can(ctx.role, "patients.write") ? (
                    <Link
                      href={`/appointments/${a.id}/link`}
                      className="mt-1 inline-block text-xs font-semibold text-pine hover:underline"
                    >
                      Σύνδεση με φάκελο ασθενή →
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {can(ctx.role, "appointments.write") && pendingPublic.length > 0 ? (
            <div className="border-t border-line px-5 py-3">
              <Link href="/appointments" className="text-sm font-semibold text-pine hover:underline">
                Διαχείριση στο ημερολόγιο →
              </Link>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
