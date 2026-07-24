import { db } from "@/db";
import { auditLogs } from "@/db/schema";

type AuditEntry = {
  /** null for clinic-independent events such as sign-in. */
  clinicId: string | null;
  userId?: string | null;
  action: string; // e.g. "patient.read", "visit.create", "ai.structure_notes"
  entityType: string;
  entityId?: string | null;
  meta?: Record<string, unknown>;
};

/**
 * GDPR audit trail — recorded on every read/write of Patient/Visit data and on
 * every AI interaction. Failures are swallowed so logging never breaks the app,
 * but are printed for ops visibility.
 */
export async function logAudit(entry: AuditEntry) {
  try {
    await db.insert(auditLogs).values({
      clinicId: entry.clinicId,
      userId: entry.userId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      meta: entry.meta ?? {},
    });
  } catch (e) {
    console.error("[audit] failed to record entry", entry.action, e);
  }
}
