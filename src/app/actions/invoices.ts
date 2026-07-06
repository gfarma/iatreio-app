"use server";

import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { invoices, patients, type InvoiceItem } from "@/db/schema";
import { requireContext } from "@/lib/session";
import { assertCan } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

export async function createInvoice(formData: FormData) {
  const ctx = await requireContext();
  assertCan(ctx.role, "invoices.write");

  const patientId = String(formData.get("patientId") ?? "") || null;
  const paymentMethod = String(formData.get("paymentMethod") ?? "cash");

  if (patientId) {
    const patient = await db.query.patients.findFirst({
      where: and(eq(patients.id, patientId), eq(patients.clinicId, ctx.clinic.id)),
    });
    if (!patient) throw new Error("Ο ασθενής δεν βρέθηκε.");
  }

  const items: InvoiceItem[] = [];
  for (let i = 0; i < 5; i++) {
    const description = String(formData.get(`item_desc_${i}`) ?? "").trim();
    const quantity = Number(formData.get(`item_qty_${i}`) ?? 0);
    const unitPrice = Number(formData.get(`item_price_${i}`) ?? 0);
    if (description && quantity > 0 && unitPrice >= 0) {
      items.push({ description, quantity, unitPrice });
    }
  }
  if (items.length === 0) throw new Error("Προσθέστε τουλάχιστον μία γραμμή.");

  const total = items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);

  // Per-clinic sequential numbering
  const last = await db.query.invoices.findFirst({
    where: and(eq(invoices.clinicId, ctx.clinic.id), eq(invoices.series, "Α")),
    orderBy: [desc(invoices.number)],
    columns: { number: true },
  });

  const [inv] = await db
    .insert(invoices)
    .values({
      clinicId: ctx.clinic.id,
      patientId,
      number: (last?.number ?? 0) + 1,
      series: "Α",
      items,
      total: total.toFixed(2),
      paymentMethod,
    })
    .returning();

  await logAudit({
    clinicId: ctx.clinic.id,
    userId: ctx.user.id,
    action: "invoice.create",
    entityType: "invoice",
    entityId: inv.id,
    meta: { total: total.toFixed(2) },
  });
  redirect(`/invoices/${inv.id}`);
}
