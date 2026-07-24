import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { requireContext } from "@/lib/session";
import { formatDateGr } from "@/lib/dates";
import { ButtonLink, Card, EmptyState, PageTitle, Badge } from "@/components/ui";

export const metadata = { title: "Τιμολόγηση" };

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Μετρητά",
  card: "Κάρτα",
  transfer: "Έμβασμα",
};

export default async function InvoicesPage() {
  const ctx = await requireContext();

  const rows = await db.query.invoices.findMany({
    where: eq(invoices.clinicId, ctx.clinic.id),
    with: { patient: { columns: { id: true, firstName: true, lastName: true } } },
    orderBy: (i, { desc }) => [desc(i.issueDate)],
    limit: 100,
  });

  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle
        title="Τιμολόγηση"
        subtitle="Αποδείξεις παροχής υπηρεσιών (σύνδεση myDATA: Φάση 2)"
        action={<ButtonLink href="/invoices/new">+ Νέα απόδειξη</ButtonLink>}
      />
      <Card>
        {rows.length === 0 ? (
          <EmptyState>Δεν υπάρχουν παραστατικά.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((inv) => (
              <li key={inv.id}>
                <Link
                  href={`/invoices/${inv.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-cream/60"
                >
                  <div>
                    <p className="text-sm font-semibold">
                      {inv.series}-{String(inv.number).padStart(4, "0")}
                      <span className="ml-2 font-normal text-mist">
                        {inv.patient ? `${inv.patient.lastName} ${inv.patient.firstName}` : "—"}
                      </span>
                    </p>
                    <p className="text-xs text-mist">
                      {formatDateGr(inv.issueDate)} · {PAYMENT_LABELS[inv.paymentMethod] ?? inv.paymentMethod}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {inv.voidedAt ? <Badge tone="no_show">Ακυρωμένο</Badge> : null}
                    {inv.mydataStatus ? <Badge tone="info">myDATA</Badge> : null}
                    <span
                      className={`font-display text-base font-bold ${
                        inv.voidedAt ? "text-mist line-through" : "text-pine"
                      }`}
                    >
                      {Number(inv.total).toFixed(2)} €
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
