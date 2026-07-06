import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { patients } from "@/db/schema";
import { requireContext } from "@/lib/session";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

/** GDPR right of access: full export of one patient's data as JSON. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  const { id } = await params;

  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, id), eq(patients.clinicId, ctx.clinic.id)),
    with: {
      visits: can(ctx.role, "visits.read") ? true : undefined,
      appointments: true,
      invoices: true,
    },
  });
  if (!patient) return NextResponse.json({ error: "not found" }, { status: 404 });

  await logAudit({
    clinicId: ctx.clinic.id,
    userId: ctx.user.id,
    action: "patient.export",
    entityType: "patient",
    entityId: id,
    meta: { format: "json" },
  });

  return new NextResponse(JSON.stringify(patient, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="patient-${id}.json"`,
    },
  });
}
