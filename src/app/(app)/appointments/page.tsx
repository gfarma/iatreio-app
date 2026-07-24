import Link from "next/link";
import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { appointments, clinicMembers } from "@/db/schema";
import { requireContext } from "@/lib/session";
import {
  addDaysStr,
  formatDateGr,
  todayStr,
  utcToLocalDateStr,
  utcToLocalTimeStr,
  weekdayOfDateStr,
  zonedToUtc,
} from "@/lib/dates";
import { setAppointmentStatus } from "@/app/actions/appointments";
import { ButtonLink, Card, EmptyState, PageTitle, StatusBadge, STATUS_LABELS } from "@/components/ui";
import { CopyLinkButton } from "@/components/copy-link-button";

export const metadata = { title: "Ραντεβού" };

type View = "day" | "week" | "month";
const WEEKDAYS_GR = ["Δευ", "Τρί", "Τετ", "Πέμ", "Παρ", "Σάβ", "Κυρ"];

function rangeFor(view: View, date: string): { start: string; end: string } {
  if (view === "day") return { start: date, end: addDaysStr(date, 1) };
  if (view === "week") {
    const wd = weekdayOfDateStr(date); // 0=Sun
    const monday = addDaysStr(date, wd === 0 ? -6 : 1 - wd);
    return { start: monday, end: addDaysStr(monday, 7) };
  }
  const monthStart = `${date.slice(0, 7)}-01`;
  const nextMonth = addDaysStr(addDaysStr(monthStart, 31), 0).slice(0, 7) + "-01";
  return { start: monthStart, end: nextMonth };
}

function nav(view: View, date: string, dir: 1 | -1): string {
  if (view === "day") return addDaysStr(date, dir);
  if (view === "week") return addDaysStr(date, 7 * dir);
  const d = new Date(`${date.slice(0, 7)}-15T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + dir);
  return d.toISOString().slice(0, 10);
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string; doctor?: string }>;
}) {
  const ctx = await requireContext();
  const sp = await searchParams;
  const view: View = sp.view === "week" || sp.view === "month" ? sp.view : "day";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : todayStr();

  const { start, end } = rangeFor(view, date);

  const doctors = await db.query.clinicMembers.findMany({
    where: and(eq(clinicMembers.clinicId, ctx.clinic.id), eq(clinicMembers.role, "doctor")),
    with: { user: { columns: { id: true, name: true } } },
  });

  const doctorFilter = sp.doctor && doctors.some((d) => d.user.id === sp.doctor) ? sp.doctor : null;

  const rows = await db.query.appointments.findMany({
    where: and(
      eq(appointments.clinicId, ctx.clinic.id),
      gte(appointments.startsAt, zonedToUtc(start, "00:00")),
      lt(appointments.startsAt, zonedToUtc(end, "00:00")),
      doctorFilter ? eq(appointments.doctorUserId, doctorFilter) : undefined,
    ),
    with: {
      patient: { columns: { id: true, firstName: true, lastName: true } },
      doctor: { columns: { name: true } },
    },
    orderBy: (a, { asc }) => [asc(a.startsAt)],
  });

  const byDay = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = utcToLocalDateStr(r.startsAt);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(r);
  }

  const qs = (overrides: Record<string, string>) => {
    const params = new URLSearchParams({ view, date, ...(doctorFilter ? { doctor: doctorFilter } : {}), ...overrides });
    return `/appointments?${params}`;
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageTitle
        title="Ραντεβού"
        subtitle={formatDateGr(zonedToUtc(date, "12:00"))}
        action={<ButtonLink href={`/appointments/new?date=${date}`}>+ Νέο ραντεβού</ButtonLink>}
      />

      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-line bg-surface p-0.5">
          {(["day", "week", "month"] as const).map((v) => (
            <Link
              key={v}
              href={qs({ view: v })}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                view === v ? "bg-pine text-surface" : "text-mist hover:text-ink"
              }`}
            >
              {v === "day" ? "Ημέρα" : v === "week" ? "Εβδομάδα" : "Μήνας"}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Link href={qs({ date: nav(view, date, -1) })} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm hover:bg-cream">←</Link>
          <Link href={qs({ date: todayStr() })} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-semibold hover:bg-cream">Σήμερα</Link>
          <Link href={qs({ date: nav(view, date, 1) })} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm hover:bg-cream">→</Link>
        </div>

        {doctors.length > 1 ? (
          <div className="flex flex-wrap gap-1.5">
            <Link
              href={qs({ doctor: "" })}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${!doctorFilter ? "border-pine bg-sage text-pine-deep" : "border-line bg-surface text-mist"}`}
            >
              Όλοι
            </Link>
            {doctors.map((d) => (
              <Link
                key={d.user.id}
                href={qs({ doctor: d.user.id })}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${doctorFilter === d.user.id ? "border-pine bg-sage text-pine-deep" : "border-line bg-surface text-mist"}`}
              >
                {d.user.name}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {view === "month" ? (
        <MonthGrid start={start} byDay={byDay} current={date} />
      ) : (
        <div className={view === "week" ? "grid gap-4 lg:grid-cols-2 xl:grid-cols-3" : ""}>
          {(view === "day" ? [date] : Array.from({ length: 7 }, (_, i) => addDaysStr(start, i))).map(
            (day) => (
              <Card key={day}>
                <div className="border-b border-line px-5 py-3">
                  <h3 className="font-display text-sm font-bold text-ink">
                    {WEEKDAYS_GR[(weekdayOfDateStr(day) + 6) % 7]}{" "}
                    <span className="text-mist">{day.slice(8)}/{day.slice(5, 7)}</span>
                    {day === todayStr() ? <span className="ml-2 text-xs font-semibold text-ochre">σήμερα</span> : null}
                  </h3>
                </div>
                {(byDay.get(day) ?? []).length === 0 ? (
                  <EmptyState>Κενό</EmptyState>
                ) : (
                  <ul className="divide-y divide-line">
                    {byDay.get(day)!.map((a) => (
                      <li key={a.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">
                              <span className="font-display text-pine">{utcToLocalTimeStr(a.startsAt)}</span>{" "}
                              {a.patient ? (
                                <Link href={`/patients/${a.patient.id}`} className="hover:text-pine">
                                  {a.patient.lastName} {a.patient.firstName}
                                </Link>
                              ) : (
                                <>
                                  {a.contactName ?? "—"}{" "}
                                  <Link
                                    href={`/appointments/${a.id}/link`}
                                    className="text-xs font-normal text-ochre underline decoration-dotted hover:text-pine"
                                  >
                                    (online — σύνδεση με φάκελο)
                                  </Link>
                                </>
                              )}
                            </p>
                            <p className="truncate text-xs text-mist">
                              {[a.reason, a.room, a.doctor.name].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          <StatusBadge status={a.status} />
                        </div>
                        <form action={setAppointmentStatus} className="no-print mt-2 flex items-center gap-1.5">
                          <input type="hidden" name="id" value={a.id} />
                          <select
                            name="status"
                            defaultValue={a.status}
                            className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-xs"
                          >
                            {Object.entries(STATUS_LABELS).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            ))}
                          </select>
                          <button className="rounded-md bg-cream px-2 py-0.5 text-xs font-semibold text-ink hover:bg-line">
                            OK
                          </button>
                          {["pending", "confirmed"].includes(a.status) ? (
                            <CopyLinkButton path={`/r/${a.manageToken}`} />
                          ) : null}
                        </form>
                        <div className="no-print mt-1.5 flex items-center gap-3">
                          {!["completed", "cancelled"].includes(a.status) ? (
                            <Link
                              href={`/appointments/${a.id}/edit`}
                              className="text-xs font-semibold text-mist hover:text-pine"
                            >
                              ✎ Αλλαγή ώρας
                            </Link>
                          ) : null}
                          {a.patient && a.status === "completed" ? (
                            <Link
                              href={`/visits/new?patientId=${a.patient.id}&appointmentId=${a.id}`}
                              className="ml-auto text-xs font-semibold text-pine hover:underline"
                            >
                              + Επίσκεψη
                            </Link>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function MonthGrid({
  start,
  byDay,
  current,
}: {
  start: string;
  byDay: Map<string, { id: string; status: string }[]>;
  current: string;
}) {
  const firstWd = (weekdayOfDateStr(start) + 6) % 7; // 0=Mon
  const monthNum = start.slice(5, 7);
  const cells: (string | null)[] = Array(firstWd).fill(null);
  for (let d = start; d.slice(5, 7) === monthNum; d = addDaysStr(d, 1)) cells.push(d);

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b border-line bg-cream/60">
        {WEEKDAYS_GR.map((w) => (
          <div key={w} className="px-2 py-2 text-center text-xs font-bold uppercase text-mist">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => (
          <div key={i} className={`min-h-24 border-b border-r border-line p-1.5 ${day === todayStr() ? "bg-sage/50" : ""}`}>
            {day ? (
              <Link href={`/appointments?view=day&date=${day}`} className="block h-full">
                <span className={`text-xs font-semibold ${day === current ? "text-pine" : "text-mist"}`}>
                  {Number(day.slice(8))}
                </span>
                <div className="mt-1 space-y-0.5">
                  {(byDay.get(day) ?? []).slice(0, 3).map((a) => (
                    <div key={a.id} className={`h-1.5 rounded-full ${a.status === "cancelled" || a.status === "no_show" ? "bg-line" : "bg-pine/70"}`} />
                  ))}
                  {(byDay.get(day)?.length ?? 0) > 3 ? (
                    <span className="text-[10px] text-mist">+{byDay.get(day)!.length - 3}</span>
                  ) : null}
                </div>
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}
