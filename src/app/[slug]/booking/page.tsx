import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { appointments, availabilityRules, clinicMembers, clinics, timeOff } from "@/db/schema";
import { computeFreeSlots, isBlockedDay } from "@/lib/slots";
import { addDaysStr, formatDateGr, todayStr, zonedToUtc, weekdayOfDateStr } from "@/lib/dates";
import { BookingForm } from "@/components/booking-form";
import { ChatWidget } from "@/components/chat-widget";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const clinic = await db.query.clinics.findFirst({ where: eq(clinics.slug, slug) });
  if (!clinic) return {};
  return {
    title: `Κράτηση ραντεβού — ${clinic.name}`,
    description: `Κλείστε online ραντεβού στο ${clinic.name}${clinic.address ? `, ${clinic.address}` : ""}. Επιλέξτε ημέρα και ώρα άμεσα, χωρίς τηλέφωνο.`,
    openGraph: { title: `Κράτηση ραντεβού — ${clinic.name}`, type: "website" },
  };
}

const WEEKDAYS_GR = ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"];

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ date?: string; doctor?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const clinic = await db.query.clinics.findFirst({
    where: and(eq(clinics.slug, slug), eq(clinics.bookingEnabled, true)),
  });
  if (!clinic) notFound();

  const doctors = await db.query.clinicMembers.findMany({
    where: and(eq(clinicMembers.clinicId, clinic.id), eq(clinicMembers.role, "doctor")),
    with: { user: { columns: { id: true, name: true } } },
  });
  const doctorId =
    sp.doctor && doctors.some((d) => d.user.id === sp.doctor)
      ? sp.doctor
      : doctors[0]?.user.id;

  const today = todayStr();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") && sp.date! >= today ? sp.date! : today;
  const days = Array.from({ length: 14 }, (_, i) => addDaysStr(today, i));

  let slots: { label: string }[] = [];
  let offRanges: { startDate: string; endDate: string }[] = [];
  if (doctorId) {
    const [rules, busy, off] = await Promise.all([
      db.query.availabilityRules.findMany({
        where: and(
          eq(availabilityRules.clinicId, clinic.id),
          eq(availabilityRules.doctorUserId, doctorId),
        ),
      }),
      db.query.appointments.findMany({
        where: and(
          eq(appointments.clinicId, clinic.id),
          eq(appointments.doctorUserId, doctorId),
          inArray(appointments.status, ["pending", "confirmed", "completed"]),
          gte(appointments.startsAt, zonedToUtc(date, "00:00")),
          lt(appointments.startsAt, zonedToUtc(addDaysStr(date, 1), "00:00")),
        ),
        columns: { startsAt: true, endsAt: true },
      }),
      db.query.timeOff.findMany({
        where: and(eq(timeOff.clinicId, clinic.id), eq(timeOff.doctorUserId, doctorId)),
        columns: { startDate: true, endDate: true },
      }),
    ]);
    offRanges = off;
    slots = computeFreeSlots(date, rules, busy, new Date(), offRanges);
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalClinic",
    name: clinic.name,
    address: clinic.address ?? undefined,
    telephone: clinic.phone ?? undefined,
    medicalSpecialty: clinic.specialties,
  };

  const qs = (overrides: Record<string, string>) =>
    `/${slug}/booking?${new URLSearchParams({ date, ...(doctorId ? { doctor: doctorId } : {}), ...overrides })}`;

  return (
    <main className="grain min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="border-b border-line bg-surface/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <span className="font-display text-lg font-bold text-pine">
            {clinic.name}
          </span>
          <Link href="/" className="text-xs font-semibold text-mist hover:text-pine">
            powered by Iatreio.
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-10">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ochre">
          Online κράτηση
        </p>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink">
          Κλείστε ραντεβού
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-mist">
          {clinic.bookingInfo ?? "Επιλέξτε ημέρα και ώρα που σας εξυπηρετεί."}
          {clinic.address ? (
            <>
              <br />
              📍 {clinic.address} {clinic.phone ? `· ☎ ${clinic.phone}` : ""}
            </>
          ) : null}
        </p>

        {doctors.length > 1 ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {doctors.map((d) => (
              <Link
                key={d.user.id}
                href={qs({ doctor: d.user.id })}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${
                  doctorId === d.user.id
                    ? "border-pine bg-pine text-surface"
                    : "border-line bg-surface text-mist hover:border-pine"
                }`}
              >
                {d.user.name}
              </Link>
            ))}
          </div>
        ) : null}

        <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
          {days.map((d) => {
            const active = d === date;
            const blocked = isBlockedDay(d, offRanges);
            return (
              <Link
                key={d}
                href={qs({ date: d })}
                title={blocked ?? undefined}
                className={`flex min-w-16 flex-col items-center rounded-xl border px-3 py-2 ${
                  active
                    ? "border-pine bg-pine text-surface"
                    : blocked
                      ? "border-line bg-paper text-mist/50"
                      : "border-line bg-surface hover:border-pine"
                }`}
              >
                <span className={`text-[10px] font-bold uppercase ${active ? "text-surface/70" : "text-mist"}`}>
                  {WEEKDAYS_GR[weekdayOfDateStr(d)].slice(0, 3)}
                </span>
                <span className="font-display text-lg font-bold">{Number(d.slice(8))}</span>
                <span className={`text-[10px] ${active ? "text-surface/70" : "text-mist"}`}>
                  {blocked ? "αργία" : d.slice(5, 7)}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mt-6 rounded-2xl border border-line bg-surface p-6 shadow-card">
          <h2 className="mb-1 font-display text-lg font-semibold">
            {formatDateGr(zonedToUtc(date, "12:00"), { weekday: "long" })}
          </h2>
          {slots.length === 0 ? (
            <p className="py-6 text-sm text-mist">
              Δεν υπάρχουν διαθέσιμες ώρες για αυτή την ημέρα — δοκιμάστε άλλη ημερομηνία.
            </p>
          ) : (
            <BookingForm clinicSlug={slug} doctorUserId={doctorId!} date={date} slots={slots.map((s) => s.label)} />
          )}
        </div>

        <p className="mt-6 text-center text-xs text-mist">
          Η κράτηση επιβεβαιώνεται από το ιατρείο. Τα στοιχεία σας χρησιμοποιούνται αποκλειστικά
          για τον προγραμματισμό του ραντεβού (GDPR).
        </p>
      </div>

      <ChatWidget clinicSlug={slug} />
    </main>
  );
}
