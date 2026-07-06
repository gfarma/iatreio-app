import type { patients, TemplateField } from "@/db/schema";
import { Button, Field, Input, Textarea } from "./ui";
import { TemplateFieldInputs } from "./template-fields";

type Patient = typeof patients.$inferSelect;

export function PatientForm({
  action,
  patient,
  templateFields,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  patient?: Patient;
  templateFields: TemplateField[];
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Επώνυμο">
          <Input name="lastName" defaultValue={patient?.lastName} required />
        </Field>
        <Field label="Όνομα">
          <Input name="firstName" defaultValue={patient?.firstName} required />
        </Field>
        <Field label="Ημ. γέννησης">
          <Input name="birthDate" type="date" defaultValue={patient?.birthDate ?? ""} />
        </Field>
        <Field label="ΑΜΚΑ" hint="Προαιρετικό — 11 ψηφία">
          <Input name="amka" defaultValue={patient?.amka ?? ""} pattern="\d{11}" />
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

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
