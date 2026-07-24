"use client";

import { useActionState } from "react";
import type { AppointmentFormState } from "@/app/actions/appointments";
import { Button, Field, Input, Select } from "./ui";

type Option = { id: string; label: string };

export function AppointmentForm({
  action,
  doctors,
  patients,
  defaults,
  submitLabel,
}: {
  action: (prev: AppointmentFormState, formData: FormData) => Promise<AppointmentFormState>;
  doctors: Option[];
  patients: Option[];
  defaults: {
    patientId?: string | null;
    doctorUserId?: string;
    date: string;
    time: string;
    duration: number;
    reason?: string | null;
    room?: string | null;
  };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<AppointmentFormState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Ασθενής" hint="Προαιρετικό — μπορεί να συνδεθεί αργότερα">
        <Select name="patientId" defaultValue={defaults.patientId ?? ""}>
          <option value="">— Χωρίς σύνδεση —</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Ιατρός">
        <Select name="doctorUserId" required defaultValue={defaults.doctorUserId ?? doctors[0]?.id}>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Ημερομηνία">
          <Input name="date" type="date" defaultValue={defaults.date} required />
        </Field>
        <Field label="Ώρα">
          <Input name="time" type="time" defaultValue={defaults.time} required />
        </Field>
        <Field label="Διάρκεια">
          <Select name="duration" defaultValue={String(defaults.duration)}>
            {[15, 20, 30, 45, 60, 90].map((m) => (
              <option key={m} value={m}>
                {m}′
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Αιτία επίσκεψης">
          <Input name="reason" defaultValue={defaults.reason ?? ""} placeholder="π.χ. Έλεγχος σπίλων" />
        </Field>
        <Field label="Χώρος / Αίθουσα">
          <Input name="room" defaultValue={defaults.room ?? ""} placeholder="π.χ. Εξεταστήριο 1" />
        </Field>
      </div>

      {state.error ? (
        <p className="rounded-lg bg-clay/10 px-3 py-2 text-sm text-clay">{state.error}</p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Αποθήκευση…" : submitLabel}
      </Button>
    </form>
  );
}
