"use client";

import { useActionState, useState } from "react";
import type { patients, TemplateField } from "@/db/schema";
import type { PatientFormState } from "@/app/actions/patients";
import { validateAmka, birthDateFromAmka } from "@/lib/amka";
import { Button, Field, Input, Textarea } from "./ui";
import { TemplateFieldInputs } from "./template-fields";

type Patient = typeof patients.$inferSelect;

export function PatientForm({
  action,
  patient,
  templateFields,
  submitLabel,
}: {
  action: (prev: PatientFormState, formData: FormData) => Promise<PatientFormState>;
  patient?: Patient;
  templateFields: TemplateField[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<PatientFormState, FormData>(action, {});
  const [amka, setAmka] = useState(patient?.amka ?? "");
  const [birthDate, setBirthDate] = useState(patient?.birthDate ?? "");

  // Live feedback while typing — the server validates again on submit.
  const amkaCheck = amka.length === 11 ? validateAmka(amka) : null;
  const derivedBirth = amkaCheck?.valid ? birthDateFromAmka(amka) : null;

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Επώνυμο">
          <Input name="lastName" defaultValue={patient?.lastName} required />
        </Field>
        <Field label="Όνομα">
          <Input name="firstName" defaultValue={patient?.firstName} required />
        </Field>
        <Field label="Ημ. γέννησης">
          <Input
            name="birthDate"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
        </Field>
        <Field
          label="ΑΜΚΑ"
          hint={
            amkaCheck && !amkaCheck.valid ? (
              <span className="text-clay">{amkaCheck.error}</span>
            ) : derivedBirth && derivedBirth !== birthDate ? (
              <button
                type="button"
                onClick={() => setBirthDate(derivedBirth)}
                className="font-semibold text-pine hover:underline"
              >
                Συμπλήρωση ημ. γέννησης {derivedBirth.split("-").reverse().join("/")} από το ΑΜΚΑ →
              </button>
            ) : (
              "Προαιρετικό — 11 ψηφία"
            )
          }
        >
          <Input
            name="amka"
            inputMode="numeric"
            value={amka}
            onChange={(e) => setAmka(e.target.value.replace(/\D/g, "").slice(0, 11))}
            className={amkaCheck && !amkaCheck.valid ? "border-clay" : ""}
          />
        </Field>
        <Field label="Τηλέφωνο">
          <Input name="phone" defaultValue={patient?.phone ?? ""} />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" defaultValue={patient?.email ?? ""} />
        </Field>
      </div>
      <Field label="Διεύθυνση">
        <Input name="address" defaultValue={patient?.address ?? ""} />
      </Field>
      <Field label="Γενικές σημειώσεις">
        <Textarea name="generalNotes" rows={3} defaultValue={patient?.generalNotes ?? ""} />
      </Field>

      {templateFields.length > 0 ? (
        <fieldset className="rounded-xl border border-line bg-cream/40 p-4">
          <legend className="px-2 text-xs font-bold uppercase tracking-wide text-mist">
            Πεδία ειδικότητας
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <TemplateFieldInputs fields={templateFields} values={patient?.customFields ?? {}} />
          </div>
        </fieldset>
      ) : null}

      {!patient ? (
        <label className="flex items-start gap-2 rounded-lg bg-sage px-3 py-2.5 text-sm text-pine-deep">
          <input type="checkbox" name="consent" className="mt-0.5 accent-pine" defaultChecked />
          <span>
            Ο ασθενής ενημερώθηκε και συναινεί στην επεξεργασία των δεδομένων του (GDPR, έκδοση
            πολιτικής v1.0).
          </span>
        </label>
      ) : null}

      {state.error ? (
        <p className="rounded-lg bg-clay/10 px-3 py-2 text-sm text-clay">{state.error}</p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Αποθήκευση…" : submitLabel}
      </Button>
    </form>
  );
}
