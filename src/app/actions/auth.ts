"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, destroySession } from "@/lib/auth";
import { requireContext, setActiveClinic } from "@/lib/session";

export type AuthState = { error?: string };

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Συμπληρώστε email και κωδικό." };

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Λάθος στοιχεία σύνδεσης." };
  }
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function switchClinic(formData: FormData) {
  const clinicId = String(formData.get("clinicId") ?? "");
  const ctx = await requireContext();
  if (ctx.memberships.some((m) => m.clinicId === clinicId)) {
    await setActiveClinic(clinicId);
  }
  redirect("/dashboard");
}
