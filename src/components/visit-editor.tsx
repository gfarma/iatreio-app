"use client";

import { useActionState, useState, useTransition } from "react";
import type { TemplateField } from "@/db/schema";
import type { VisitFormState } from "@/app/actions/visits";
import { rejectAiDraft, structureNotes, suggestIcd10, type IcdSuggestion } from "@/app/actions/ai";
import { Button, Field, Textarea } from "./ui";
import { TemplateFieldInputs } from "./template-fields";

export function VisitEditor({
  action,
  patientId,
  appointmentId,
  templateFields,
  aiAvailable,
  initial,
  submitLabel = "Αποθήκευση επίσκεψης",
}: {
  action: (prev: VisitFormState, formData: FormData) => Promise<VisitFormState>;
  patientId: string;
  appointmentId?: string;
  templateFields: TemplateField[];
  aiAvailable: boolean;
  initial?: { notes: string; icd10Codes: string[]; customFields: Record<string, unknown> };
  submitLabel?: string;
}) {
  const [state, formAction, saving] = useActionState<VisitFormState, FormData>(action, {});
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [draft, setDraft] = useState<{ output: string; logId: string } | null>(null);
  const [aiAccepted, setAiAccepted] = useState<string | null>(null); // logId when accepted
  const [icd, setIcd] = useState<string[]>(initial?.icd10Codes ?? []);
  const [suggestions, setSuggestions] = useState<IcdSuggestion[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const runStructure = () =>
    startTransition(async () => {
      setAiError(null);
      const res = await structureNotes(patientId, notes);
      if (res.ok) setDraft({ output: res.output, logId: res.logId });
      else setAiError(res.error);
    });

  const runIcd = () =>
    startTransition(async () => {
      setAiError(null);
      const res = await suggestIcd10(patientId, notes);
      if (res.ok) setSuggestions(res.suggestions);
      else setAiError(res.error);
    });

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="patientId" value={patientId} />
      {appointmentId ? <input type="hidden" name="appointmentId" value={appointmentId} /> : null}
      <input type="hidden" name="icd10" value={icd.join(",")} />
      <input type="hidden" name="aiStructured" value={aiAccepted ? "true" : "false"} />
      {aiAccepted ? <input type="hidden" name="aiLogId" value={aiAccepted} /> : null}

      <Field
        label="Σημειώσεις επίσκεψης"
        hint="Γράψτε ελεύθερα ή τηλεγραφικά — μπορείτε μετά να τις δομήσετε με AI."
      >
        <Textarea
          name="notes"
          rows={8}
          required
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="π.χ. κνησμός 2 εβδ, εξάνθημα αντιβράχιο, όχι πυρετός, οικ. ιστορικό ατοπίας…"
        />
      </Field>

      {aiAvailable ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={runStructure} disabled={pending || !notes.trim()}>
            {pending ? "Επεξεργασία…" : "✦ Δόμηση με AI"}
          </Button>
          <Button type="button" variant="secondary" onClick={runIcd} disabled={pending || !notes.trim()}>
            ✦ Πρόταση ICD-10
          </Button>
        </div>
      ) : (
        <p className="rounded-lg bg-cream px-3 py-2 text-xs text-mist">
          Οι λειτουργίες AI είναι απενεργοποιημένες σε αυτό το περιβάλλον (ENABLE_AI_FEATURES).
        </p>
      )}

      {aiError ? <p className="rounded-lg bg-clay/10 px-3 py-2 text-sm text-clay">{aiError}</p> : null}

      {draft ? (
        <div className="rounded-xl border-2 border-dashed border-pine/40 bg-sage/40 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-pine-deep">
            Πρόταση AI — απαιτείται έγκριση ιατρού πριν αποθηκευτεί
          </p>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink">
            {draft.output}
          </pre>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              onClick={() => {
                setNotes(draft.output);
                setAiAccepted(draft.logId);
                setDraft(null);
              }}
            >
              ✓ Αποδοχή
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void rejectAiDraft(draft.logId);
                setDraft(null);
              }}
            >
              ✕ Απόρριψη
            </Button>
          </div>
        </div>
      ) : null}

      {suggestions.length > 0 ? (
        <div className="rounded-xl border border-line bg-cream/50 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-mist">
            Προτεινόμενοι κωδικοί ICD-10 (επιλέξτε όσους ισχύουν)
          </p>
          <div className="space-y-1.5">
            {suggestions.map((s) => (
              <label key={s.code} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-pine"
                  checked={icd.includes(s.code)}
                  onChange={(e) =>
                    setIcd((prev) =>
                      e.target.checked ? [...prev, s.code] : prev.filter((c) => c !== s.code),
                    )
                  }
                />
                <span className="font-mono font-semibold text-pine">{s.code}</span>
                <span className="text-mist">{s.label}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {icd.length > 0 ? (
        <p className="flex flex-wrap items-center gap-2 text-sm text-mist">
          Κωδικοί:
          {icd.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setIcd((prev) => prev.filter((x) => x !== c))}
              title="Αφαίρεση"
              className="rounded-full bg-sage px-2 py-0.5 text-xs font-semibold text-pine-deep hover:bg-clay hover:text-surface"
            >
              {c} ✕
            </button>
          ))}
        </p>
      ) : null}

      {templateFields.length > 0 ? (
        <fieldset className="rounded-xl border border-line bg-cream/40 p-4">
          <legend className="px-2 text-xs font-bold uppercase tracking-wide text-mist">
            Πεδία ειδικότητας
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <TemplateFieldInputs fields={templateFields} values={initial?.customFields ?? {}} />
          </div>
        </fieldset>
      ) : null}

      {state.error ? (
        <p className="rounded-lg bg-clay/10 px-3 py-2 text-sm text-clay">{state.error}</p>
      ) : null}

      <Button type="submit" disabled={pending || saving}>
        {saving ? "Αποθήκευση…" : submitLabel}
      </Button>
    </form>
  );
}
