import { requireContext } from "@/lib/session";
import { can, ROLE_LABELS, type Permission } from "@/lib/rbac";
import { AppShell } from "@/components/app-shell";

const NAV: { href: string; label: string; perm: Permission | null }[] = [
  { href: "/dashboard", label: "Επισκόπηση", perm: null },
  { href: "/appointments", label: "Ραντεβού", perm: "appointments.read" },
  { href: "/patients", label: "Ασθενείς", perm: "patients.read" },
  { href: "/invoices", label: "Τιμολόγηση", perm: "invoices.read" },
  { href: "/settings", label: "Ρυθμίσεις", perm: "settings.manage" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext();

  return (
    <AppShell
      nav={NAV.filter((n) => !n.perm || can(ctx.role, n.perm)).map(({ href, label }) => ({ href, label }))}
      userName={ctx.user.name}
      roleLabel={ROLE_LABELS[ctx.role]}
      clinicId={ctx.clinic.id}
      clinicName={ctx.clinic.name}
      memberships={ctx.memberships.map((m) => ({ clinicId: m.clinicId, clinicName: m.clinic.name }))}
    >
      {children}
    </AppShell>
  );
}
