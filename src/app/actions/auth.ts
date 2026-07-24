"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, destroySession } from "@/lib/auth";
import { requireContext, setActiveClinic } from "@/lib/session";
import { clientIp, rateLimit, rateLimitReset } from "@/lib/ratelimit";
import { logAudit } from "@/lib/audit";

export type AuthState = { error?: string };

const LOGIN_MAX_ATTEMPTS = 8;
const LOGIN_WINDOW_MS = 15 * 60_000;

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Συμπληρώστε email και κωδικό." };

  // Throttle by account AND by origin, so neither a targeted nor a spray
  // attack gets unlimited guesses.
  const ip = clientIp(await headers());
  for (const key of [`login:email:${email}`, `login:ip:${ip}`]) {
    const { allowed, retryAfterSec } = rateLimit(key, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS);
    if (!allowed) {
      return {
        error: `Πολλές αποτυχημένες προσπάθειες. Δοκιμάστε ξανά σε ${Math.ceil(retryAfterSec / 60)} λεπτά.`,
      };
    }
  }

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Λάθος στοιχεία σύνδεσης." };
  }

  rateLimitReset(`login:email:${email}`);
  await createSession(user.id);
  await logAudit({
    clinicId: null,
    userId: user.id,
    action: "auth.login",
    entityType: "user",
    entityId: user.id,
    meta: { ip },
  });
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
