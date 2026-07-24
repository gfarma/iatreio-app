import Link from "next/link";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { patients } from "@/db/schema";
import { requireContext } from "@/lib/session";
import { foldGreek, sqlFoldExpression } from "@/lib/greek";
import { ButtonLink, Card, EmptyState, Input, PageTitle } from "@/components/ui";

export const metadata = { title: "Ασθενείς" };

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await requireContext();
  const { q } = await searchParams;

  // Accent- and case-insensitive: typing "παππας" must find "Παππάς".
  // LIKE wildcards in the query itself are escaped so they stay literal.
  const term = (q ?? "").trim();
  const needle = `%${foldGreek(term).replace(/[%_\\]/g, "\\$&")}%`;
  const nameSql = sql.raw(sqlFoldExpression("first_name || ' ' || last_name"));
  const nameRevSql = sql.raw(sqlFoldExpression("last_name || ' ' || first_name"));

  const rows = await db.query.patients.findMany({
    where: and(
      eq(patients.clinicId, ctx.clinic.id),
      isNull(patients.archivedAt),
      term
        ? sql`(${nameSql} LIKE ${needle} ESCAPE '\\'
            OR ${nameRevSql} LIKE ${needle} ESCAPE '\\'
            OR coalesce(phone, '') LIKE ${needle} ESCAPE '\\'
            OR coalesce(amka, '') LIKE ${needle} ESCAPE '\\')`
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
