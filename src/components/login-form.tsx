"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, type AuthState } from "@/app/actions/auth";
import { Button, Field, Input } from "@/components/ui";

export function LoginForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(login, {});

  return (
    <main className="grain flex min-h-screen flex-col items-center justify-center px-4">
      <Link href="/" className="mb-8 font-display text-3xl font-bold tracking-tight text-pine">
        Iatreio<span className="text-ochre">.</span>
      </Link>
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8 shadow-card">
        <h1 className="font-display text-xl font-semibold">Σύνδεση</h1>
        <p className="mb-6 mt-1 text-sm text-mist">Καλώς ήρθατε πίσω.</p>
        <form action={action} className="space-y-4">
          <Field label="Email">
            <Input name="email" type="email" autoComplete="email" placeholder="you@example.gr" required />
          </Field>
          <Field label="Κωδικός">
            <Input name="password" type="password" autoComplete="current-password" required />
          </Field>
          {state.error ? (
            <p className="rounded-lg bg-clay/10 px-3 py-2 text-sm text-clay">{state.error}</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Σύνδεση…" : "Σύνδεση"}
          </Button>
        </form>
        <div className="mt-6 rounded-lg bg-sage px-3 py-2.5 text-xs leading-relaxed text-pine-deep">
          <strong>Demo λογαριασμοί</strong> (κωδικός: <code>demo1234</code>)
          <br />
          owner@demo.gr · doctor@demo.gr · staff@demo.gr
        </div>
      </div>
    </main>
  );
}
