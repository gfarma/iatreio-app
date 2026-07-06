import type { TemplateField } from "@/db/schema";
import { Field, Input, Select, Textarea } from "./ui";

/** Renders the configurable specialty fields (SpecialtyTemplate) as inputs. */
export function TemplateFieldInputs({
  fields,
  values = {},
}: {
  fields: TemplateField[];
  values?: Record<string, unknown>;
}) {
  return (
    <>
      {fields.map((f) => {
        const name = `cf_${f.key}`;
        const value = values[f.key];
        switch (f.type) {
          case "textarea":
            return (
              <Field key={f.key} label={f.label}>
                <Textarea name={name} rows={3} defaultValue={(value as string) ?? ""} />
              </Field>
            );
          case "number":
            return (
              <Field key={f.key} label={f.label}>
                <Input name={name} type="number" step="any" defaultValue={(value as number) ?? ""} />
              </Field>
            );
          case "select":
            return (
              <Field key={f.key} label={f.label}>
                <Select name={name} defaultValue={(value as string) ?? ""}>
                  <option value="">—</option>
                  {(f.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </Select>
              </Field>
            );
          case "checkbox":
            return (
              <label key={f.key} className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" name={name} defaultChecked={Boolean(value)} className="accent-pine" />
                {f.label}
              </label>
            );
          default:
            return (
              <Field key={f.key} label={f.label}>
                <Input name={name} defaultValue={(value as string) ?? ""} />
              </Field>
            );
        }
      })}
    </>
  );
}

/** Read-only display of the custom fields on the patient/visit page. */
export function TemplateFieldValues({
  fields,
  values,
}: {
  fields: TemplateField[];
  values: Record<string, unknown>;
}) {
  const present = fields.filter((f) => values[f.key] !== undefined && values[f.key] !== "");
  if (present.length === 0) return null;
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
      {present.map((f) => (
        <div key={f.key}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-mist">{f.label}</dt>
          <dd className="text-sm text-ink">
            {typeof values[f.key] === "boolean" ? (values[f.key] ? "Ναι" : "Όχι") : String(values[f.key])}
          </dd>
        </div>
      ))}
    </dl>
  );
}
