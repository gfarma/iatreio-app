import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { patients } from "@/db/schema";
import { requireContext } from "@/lib/session";
import { assertCan } from "@/lib/rbac";
import { createInvoice } from "@/app/actions/invoices";
import { Button, Card, Field, Input, PageTitle, Select } from "@/components/ui";

export const metadata = { title: "Νέα απόδειξη" };

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string }>;
}) {
  const ctx = await requireContext();
  assertCan(ctx.role, "invoices.write");
  const sp = await searchParams;

  const patientRows = await db.query.patients.findMany({
    where: and(eq(patients.clinicId, ctx.clinic.id), isNull(patients.archivedAt)),
    columns: { id: true, firstName: true, lastName: true },
    orderBy: (p, { asc }) => [asc(p.lastName)],
  });

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title="Νέα απόδειξη" subtitle={ctx.clinic.name} />
      <Card className="p-6">
        <form action={createInvoice} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ασθενής / Πελάτης">
              <Select name="patientId" defaultValue={sp.patientId ?? ""}>
                <option value="">— Ανώνυμη απόδειξη —</option>
                {patientRows.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.lastName} {p.firstName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Τρόπος πληρωμής">
              <Select name="paymentMethod" defaultValue="cash">
                <option value="cash">Μετρητά</option>
                <option value="card">Κάρτα</option>
                <option value="transfer">Έμβασμα</option>
              </Select>
            </Field>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-mist">
              Γραμμές παραστατικού
            </p>
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="grid grid-cols-[1fr_5rem_7rem] gap-2">
                  <Input
                    name={`item_desc_${i}`}
                    placeholder={i === 0 ? "π.χ. Ιατρική εξέταση" : "…"}
                    defaultValue={i === 0 ? "Ιατρική εξέταση" : ""}
                  />
                  <Input name={`item_qty_${i}`} type="number" min="0" defaultValue={i === 0 ? 1 : ""} placeholder="Ποσ." />
                  <Input name={`item_price_${i}`} type="number" min="0" step="0.01" defaultValue={i === 0 ? "50" : ""} placeholder="Τιμή €" />
                </div>
              ))}
            </div>
          </div>

          <p className="rounded-lg bg-cream px-3 py-2 text-xs text-mist">
            Το παραστατικό καταχωρείται εσωτερικά. Η διαβίβαση στο myDATA θα ενεργοποιηθεί στη
            Φάση 2 μέσω αδειοδοτημένου παρόχου.
          </p>

          <Button type="submit">Έκδοση απόδειξης</Button>
        </form>
      </Card>
    </div>
  );
}
