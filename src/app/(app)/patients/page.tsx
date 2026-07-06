import Link from "next/link";
import { and, eq, ilike, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { patients } from "@/db/schema";
import { requireContext } from "@/lib/session";
import { ButtonLink, Card, EmptyState, Input, PageTitle } from "@/components/ui";

export const metadata = { title: "Ασθενείς" };

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await requireContext();
  const { q } = await searchParams;

  const rows = await db.query.patients.findMany({
    where: and(
      eq(patients.clinicId, ctx.clinic.id),
      isNull(patients.archivedAt),
      q
        ? or(
            ilike(patients.lastName, `%${q}%`),
            ilike(patients.firstName, `%${q}%`),
            ilike(patients.phone, `%${q}%`),
            ilike(patients.amka, `%${q}%`),
          )
        : undefined,
    ),
    orderBy: (p, { asc }) => [asc(p.lastName), asc(p.firstName)],
    limit: 100,
  });

  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle
        title="Ασθενείς"
        subtitle={`${rows.length} αποτελέσματα`}
        action={<ButtonLink href="/patients/new">+ Νέος ασθενής</ButtonLink>}
      />

      <form className="mb-4">
        <Input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Αναζήτηση με επώνυμο, όνομα, τηλέφωνο ή ΑΜΚΑ…"
        />
      </form>

      <Card>
        {rows.length === 0 ? (
          <EmptyState>Δεν βρέθηκαν ασθενείς.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/patients/${p.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-cream/60"
                >
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {p.lastName} {p.firstName}
                    </p>
                    <p className="text-xs text-mist">
                      {[p.phone, p.email, p.birthDate].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <span className="text-mist">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
