import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { requireContext } from "@/lib/session";
import { formatDateGr } from "@/lib/dates";
import { can } from "@/lib/rbac";
import { voidInvoice } from "@/app/actions/invoices";
import { Button, ButtonLink, Card, Input } from "@/components/ui";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Απόδειξη" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  const { id } = await params;

  const inv = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, id), eq(invoices.clinicId, ctx.clinic.id)),
    with: { patient: true, clinic: true },
  });
  if (!inv) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="no-print mb-4 flex justify-between">
        <ButtonLink href="/invoices" variant="secondary">
          ← Πίσω
        </ButtonLink>
        <PrintButton />
      </div>

      {inv.voidedAt ? (
        <div className="mb-4 rounded-xl border border-clay/40 bg-clay/10 px-4 py-3 text-sm text-clay">
          <strong>Ακυρωμένο παραστατικό</strong> — {inv.voidReason}
        </div>
      ) : null}

      <Card className="p-8">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">{inv.clinic.name}</h1>
            <p className="mt-1 text-sm text-mist">
              {inv.clinic.address}
              <br />
              ΑΦΜ: {inv.clinic.afm ?? "—"} · Τηλ: {inv.clinic.phone ?? "—"}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-lg font-bold text-pine">
              Απόδειξη {inv.series}-{String(inv.number).padStart(4, "0")}
            </p>
            <p className="text-sm text-mist">{formatDateGr(inv.issueDate)}</p>
          </div>
        </div>

        <div className="mb-6 rounded-lg bg-cream/60 px-4 py-3 text-sm">
          <span className="text-mist">Πελάτης: </span>
          <strong>
            {inv.patient ? `${inv.patient.lastName} ${inv.patient.firstName}` : "Ανώνυμος"}
          </strong>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-ink text-left">
              <th className="py-2">Περιγραφή</th>
              <th className="py-2 text-right">Ποσότητα</th>
              <th className="py-2 text-right">Τιμή μον.</th>
              <th className="py-2 text-right">Σύνολο</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((it, i) => (
              <tr key={i} className="border-b border-line">
                <td className="py-2.5">{it.description}</td>
                <td className="py-2.5 text-right">{it.quantity}</td>
                <td className="py-2.5 text-right">{it.unitPrice.toFixed(2)} €</td>
                <td className="py-2.5 text-right font-semibold">
                  {(it.quantity * it.unitPrice).toFixed(2)} €
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="py-3 text-right font-bold">
                Γενικό σύνολο
              </td>
              <td className="py-3 text-right font-display text-lg font-bold text-pine">
                {Number(inv.total).toFixed(2)} €
              </td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-8 text-xs text-mist">
          {inv.mydataUid
            ? `myDATA UID: ${inv.mydataUid}`
            : "Δεν έχει διαβιβαστεί στο myDATA (διαθέσιμο στη Φάση 2)."}
        </p>
      </Card>

      {!inv.voidedAt && can(ctx.role, "invoices.write") ? (
        <Card className="no-print mt-6 p-5">
          <h3 className="font-display text-base font-semibold">Ακύρωση παραστατικού</h3>
          <p className="mb-3 mt-1 text-xs leading-relaxed text-mist">
            Το παραστατικό δεν διαγράφεται — σημειώνεται ως ακυρωμένο ώστε να μη σπάσει η
            αρίθμηση της σειράς.
          </p>
          <form action={voidInvoice} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={inv.id} />
            <Input name="reason" placeholder="Αιτία ακύρωσης" className="w-56" />
            <Button variant="danger" type="submit" className="text-xs">
              Ακύρωση
            </Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
