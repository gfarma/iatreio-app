import Link from "next/link";
import { requireContext } from "@/lib/session";
import { can, ROLE_LABELS } from "@/lib/rbac";
import { logout, switchClinic } from "@/app/actions/auth";

const NAV = [
  { href: "/dashboard", label: "Επισκόπηση", perm: null },
  { href: "/appointments", label: "Ραντεβού", perm: "appointments.read" },
  { href: "/patients", label: "Ασθενείς", perm: "patients.read" },
  { href: "/invoices", label: "Τιμολόγηση", perm: "invoices.read" },
  { href: "/settings", label: "Ρυθμίσεις", perm: "settings.manage" },
] as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext();

  return (
    <div className="flex min-h-screen">
      <aside className="no-print sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-line bg-pine-deep text-surface">
        <div className="px-5 py-6">
          <Link href="/dashboard" className="font-display text-2xl font-bold tracking-tight">
            Iatreio<span className="text-ochre">.</span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {NAV.filter((n) => !n.perm || can(ctx.role, n.perm)).map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-surface/80 transition-colors hover:bg-pine hover:text-surface"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="space-y-3 border-t border-surface/10 p-4">
          {ctx.memberships.length > 1 ? (
            <form action={switchClinic}>
              <select
                name="clinicId"
                defaultValue={ctx.clinic.id}
                className="w-full rounded-lg border border-surface/20 bg-pine px-2 py-1.5 text-xs text-surface"
              >
                {ctx.memberships.map((m) => (
                  <option key={m.clinicId} value={m.clinicId}>
                    {m.clinic.name}
                  </option>
                ))}
              </select>
              <button className="mt-1.5 w-full rounded-lg bg-surface/10 px-2 py-1 text-xs font-semibold hover:bg-surface/20">
                Αλλαγή ιατρείου
              </button>
            </form>
          ) : (
            <p className="truncate text-xs text-surface/60">{ctx.clinic.name}</p>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{ctx.user.name}</p>
              <p className="text-xs text-surface/60">{ROLE_LABELS[ctx.role]}</p>
            </div>
            <form action={logout}>
              <button className="rounded-lg px-2 py-1 text-xs text-surface/70 hover:bg-surface/10 hover:text-surface">
                Έξοδος
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="grain min-w-0 flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
