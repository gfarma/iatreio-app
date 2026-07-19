"use client";

import { useState } from "react";
import { Button, Field, Input, Textarea } from "./ui";

export function CertificateEditor({
  clinic,
  doctorName,
  defaultBody,
}: {
  clinic: { name: string; address: string | null; phone: string | null; afm: string | null };
  doctorName: string;
  defaultBody: string;
}) {
  const [title, setTitle] = useState("ΙΑΤΡΙΚΗ ΒΕΒΑΙΩΣΗ");
  const [body, setBody] = useState(defaultBody);
  const today = new Intl.DateTimeFormat("el-GR", { dateStyle: "long" }).format(new Date());

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="no-print space-y-4 rounded-xl border border-line bg-surface p-5 shadow-card">
        <Field label="Τίτλος εγγράφου">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Κείμενο" hint="Επεξεργαστείτε ελεύθερα πριν την εκτύπωση.">
          <Textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <Button type="button" onClick={() => window.print()}>
          🖨 Εκτύπωση
        </Button>
      </div>

      {/* Print preview / printable area */}
      <div className="rounded-xl border border-line bg-white p-10 shadow-card print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <div className="border-b-2 border-ink pb-4 text-center">
          <p className="font-display text-xl font-bold text-ink">{clinic.name}</p>
          <p className="mt-1 text-xs text-mist">
            {[clinic.address, clinic.phone ? `Τηλ: ${clinic.phone}` : null, clinic.afm ? `ΑΦΜ: ${clinic.afm}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <h2 className="mt-8 text-center font-display text-lg font-bold tracking-wide text-ink">
          {title}
        </h2>
        <p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-ink">{body}</p>
        <div className="mt-14 flex items-end justify-between text-sm text-ink">
          <p>{today}</p>
          <div className="text-center">
            <p className="mb-14">Ο/Η θεράπων ιατρός</p>
            <p className="border-t border-ink pt-1 font-semibold">{doctorName}</p>
            <p className="text-xs text-mist">(υπογραφή — σφραγίδα)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
