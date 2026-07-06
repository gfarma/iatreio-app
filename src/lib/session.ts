import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clinicMembers, users } from "@/db/schema";
import { getSessionUserId } from "./auth";
import type { Role } from "./rbac";

const ACTIVE_CLINIC_COOKIE = "iatreio_active_clinic";

export type Membership = {
  clinicId: string;
  role: Role;
  specialty: string | null;
  calendarColor: string | null;
  clinic: { id: string; name: string; slug: string };
};

export type SessionContext = {
  user: { id: string; name: string; email: string };
  memberships: Membership[];
  clinic: { id: string; name: string; slug: string };
  role: Role;
};

/** Load the logged-in user with memberships, or null. Cached per request. */
export const getCurrentUser = cache(async () => {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, name: true, email: true },
  });
  if (!user) return null;
  const memberships = (await db.query.clinicMembers.findMany({
    where: eq(clinicMembers.userId, userId),
    with: { clinic: { columns: { id: true, name: true, slug: true } } },
  })) as unknown as Membership[];
  return { user, memberships };
});

/**
 * The core multi-tenancy guard: every in-app page/action goes through this.
 * Resolves the active clinic (cookie, validated against memberships) and the
 * user's role in it. Redirects to /login when unauthenticated.
 */
export async function requireContext(): Promise<SessionContext> {
  const current = await getCurrentUser();
  if (!current || current.memberships.length === 0) redirect("/login");
  const jar = await cookies();
  const wanted = jar.get(ACTIVE_CLINIC_COOKIE)?.value;
  const membership =
    current.memberships.find((m) => m.clinicId === wanted) ?? current.memberships[0];
  return {
    user: current.user,
    memberships: current.memberships,
    clinic: membership.clinic,
    role: membership.role,
  };
}

export async function setActiveClinic(clinicId: string) {
  const jar = await cookies();
  jar.set(ACTIVE_CLINIC_COOKIE, clinicId, { path: "/", sameSite: "lax" });
}
