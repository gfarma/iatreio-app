"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiInteractionLogs, patients } from "@/db/schema";
import { requireContext } from "@/lib/session";
import { assertCan } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { aiEnabled, aiModel, chatComplete } from "@/lib/ai/provider";
import { pseudonymize } from "@/lib/ai/pseudonymize";

export type AiResult =
  | { ok: true; output: string; logId: string }
  | { ok: false; error: string };

const STRUCTURE_SYSTEM = `Είσαι διοικητικός βοηθός ιατρείου. Λαμβάνεις πρόχειρες/τηλεγραφικές σημειώσεις ιατρού από επίσκεψη και τις ΔΟΜΕΙΣ σε καθαρό ελληνικό κείμενο με ενότητες:

Αιτίαση:
Ιστορικό:
Κλινική εικόνα / Ευρήματα:
Σχέδιο / Οδηγίες:

ΑΥΣΤΗΡΟΙ ΚΑΝΟΝΕΣ:
- ΜΗΝ προσθέτεις πληροφορίες, διαγνώσεις, φάρμακα ή συστάσεις που δεν υπάρχουν στις σημειώσεις.
- ΜΗΝ ερμηνεύεις ή αξιολογείς κλινικά ευρήματα. Μόνο αναδιατύπωση και οργάνωση.
- Αν μια ενότητα δεν έχει υλικό, γράψε "—".
- Επίστρεψε ΜΟΝΟ το δομημένο κείμενο.`;

const ICD_SYSTEM = `Είσαι διοικητικός βοηθός κωδικοποίησης. Με βάση κείμενο ιατρικής επίσκεψης, πρότεινε 2-3 πιθανούς κωδικούς ICD-10 ΜΟΝΟ ως διοικητική διευκόλυνση — ο ιατρός αποφασίζει.
Επίστρεψε ΑΥΣΤΗΡΑ JSON array της μορφής: [{"code":"L70.0","label":"Σύντομη ελληνική περιγραφή"}] χωρίς άλλο κείμενο.`;

async function guardAi() {
  const ctx = await requireContext();
  assertCan(ctx.role, "ai.use");
  assertCan(ctx.role, "visits.write");
  if (!aiEnabled()) {
    return { ctx, error: "Οι λειτουργίες AI είναι απενεργοποιημένες σε αυτό το περιβάλλον." };
  }
  return { ctx, error: null };
}

/** AI feature 1: structure telegraphic notes. Doctor must accept before save. */
export async function structureNotes(patientId: string, rawText: string): Promise<AiResult> {
  const { ctx, error } = await guardAi();
  if (error) return { ok: false, error };
  if (!rawText.trim()) return { ok: false, error: "Γράψτε πρώτα σημειώσεις." };

  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.clinicId, ctx.clinic.id)),
  });
  if (!patient) return { ok: false, error: "Ο ασθενής δεν βρέθηκε." };

  // Strip direct identifiers before anything leaves the app
  const clean = pseudonymize(rawText, patient);

  try {
    const output = await chatComplete({ system: STRUCTURE_SYSTEM, user: clean });
    const [log] = await db
      .insert(aiInteractionLogs)
      .values({
        clinicId: ctx.clinic.id,
        userId: ctx.user.id,
        feature: "structure_notes",
        inputPseudonymized: clean,
        output,
        model: aiModel(),
      })
      .returning({ id: aiInteractionLogs.id });
    await logAudit({
      clinicId: ctx.clinic.id,
      userId: ctx.user.id,
      action: "ai.structure_notes",
      entityType: "patient",
      entityId: patientId,
      meta: { aiLogId: log.id },
    });
    return { ok: true, output, logId: log.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Σφάλμα AI." };
  }
}

export type IcdSuggestion = { code: string; label: string };

/** AI feature 2: suggest ICD-10 codes — the doctor picks, nothing is imposed. */
export async function suggestIcd10(
  patientId: string,
  text: string,
): Promise<{ ok: true; suggestions: IcdSuggestion[] } | { ok: false; error: string }> {
  const { ctx, error } = await guardAi();
  if (error) return { ok: false, error };
  if (!text.trim()) return { ok: false, error: "Γράψτε πρώτα σημειώσεις." };

  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.clinicId, ctx.clinic.id)),
  });
  if (!patient) return { ok: false, error: "Ο ασθενής δεν βρέθηκε." };

  const clean = pseudonymize(text, patient);
  try {
    const raw = await chatComplete({ system: ICD_SYSTEM, user: clean, temperature: 0 });
    const jsonText = raw.replace(/```json?|```/g, "").trim();
    const parsed = JSON.parse(jsonText) as IcdSuggestion[];
    const suggestions = parsed
      .filter((s) => typeof s.code === "string" && typeof s.label === "string")
      .slice(0, 3);
    await db.insert(aiInteractionLogs).values({
      clinicId: ctx.clinic.id,
      userId: ctx.user.id,
      feature: "icd10_suggest",
      inputPseudonymized: clean,
      output: JSON.stringify(suggestions),
      model: aiModel(),
    });
    await logAudit({
      clinicId: ctx.clinic.id,
      userId: ctx.user.id,
      action: "ai.icd10_suggest",
      entityType: "patient",
      entityId: patientId,
    });
    return { ok: true, suggestions };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Σφάλμα AI." };
  }
}

/** Human-in-the-loop bookkeeping when the doctor rejects an AI draft. */
export async function rejectAiDraft(logId: string) {
  const ctx = await requireContext();
  await db
    .update(aiInteractionLogs)
    .set({ reviewedByDoctor: true, accepted: false })
    .where(and(eq(aiInteractionLogs.id, logId), eq(aiInteractionLogs.clinicId, ctx.clinic.id)));
}
