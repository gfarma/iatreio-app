import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { requireContext } from "@/lib/session";
import { assertCan } from "@/lib/rbac";
import { formatDateTimeGr } from "@/lib/dates";
import { Badge, Card, EmptyState, PageTitle } from "@/components/ui";

export const metadata = { title: "Αρχείο ενεργειών" };

export default async function AuditPage() {
  const ctx = await requireContext();
  assertCan(ctx.role, "settings.manage");

  const rows = await db.query.auditLogs.findMany({
    where: eq(auditLogs.clinicId, ctx.clinic.id),
    orderBy: (a, { desc }) => [desc(a.createdAt)],
    limit: 200,
  });

  const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))] as string[];
  const users = userIds.length
    ? await db.query.users.findMany({
        where: (u, { inArray }) => inArray(u.id, userIds),
        columns: { id: true, name: true },
      })
    : [];
  const nameOf = new Map(users.map((u) => [u.id, u.name]));

  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle
        title="Αρχείο ενεργειών"
        subtitle="Καταγραφή κάθε πρόσβασης και τροποποίησης σε δεδομένα ασθενών (GDPR) — τελευταίες 200 εγγραφές"
      />
      <Card>
        {rows.length === 0 ? (
          <EmptyState>Δεν υπάρχουν εγγραφές.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 px-5 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-mono text-xs font-bold text-pine">{r.action}</span>
                    <span className="ml-2 text-mist">
                      {r.userId ? (nameOf.get(r.userId) ?? "—") : "δημόσιος επισκέπτης"}
                    </span>
                  </p>
                  <p className="truncate text-xs text-mist">
                    {r.entityType}
                    {r.entityId ? ` · ${r.entityId.slice(0, 8)}…` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {r.action.startsWith("ai.") ? <Badge tone="info">AI</Badge> : null}
                  <span className="text-xs text-mist">{formatDateTimeGr(r.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
