"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout, switchClinic } from "@/app/actions/auth";

type NavItem = { href: string; label: string };
type Membership = { clinicId: string; clinicName: string };

export function AppShell({
  nav,
  userName,
  roleLabel,
  clinicId,
  clinicName,
  memberships,
  children,
}: {
  nav: NavItem[];
  userName: string;
  roleLabel: string;
  clinicId: string;
  clinicName: string;
  memberships: Membership[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-5 py-6">
        <Link href="/dashboard" className="font-display text-2xl font-bold tracking-tight">
          Iatreio<span className="text-ochre">.</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setOpen(false)}
            className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              pathname.startsWith(n.href)
                ? "bg-pine text-surface"
                : "text-surface/80 hover:bg-pine hover:text-surface"
            }`}
          >
            {n.label}
          </Link>
        ))}
      </nav>

      <div className="space-y-3 border-t border-surface/10 p-4">
        {memberships.length > 1 ? (
          <form action={switchClinic}>
            <select
              name="clinicId"
              defaultValue={clinicId}
              className="w-full rounded-lg border border-surface/20 bg-pine px-2 py-1.5 text-xs text-surface"
            >
              {memberships.map((m) => (
                <option key={m.clinicId} value={m.clinicId}>
                  {m.clinicName}
                </option>
              ))}
            </select>
            <button className="mt-1.5 w-full rounded-lg bg-surface/10 px-2 py-1 text-xs font-semibold hover:bg-surface/20">
              Αλλαγή ιατρείου
            </button>
          </form>
        ) : (
          <p className="truncate text-xs text-surface/60">{clinicName}</p>
        )}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{userName}</p>
            <p className="text-xs text-surface/60">{roleLabel}</p>
          </div>
          <form action={logout}>
            <button className="rounded-lg px-2 py-1 text-xs text-surface/70 hover:bg-surface/10 hover:text-surface">
              Έξοδος
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Mobile top bar */}
      <header className="no-print sticky top-0 z-40 flex items-center justify-between border-b border-line bg-pine-deep px-4 py-3 text-surface lg:hidden">
        <Link href="/dashboard" className="font-display text-xl font-bold tracking-tight">
          Iatreio<span className="text-ochre">.</span>
        </Link>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Μενού"
          className="rounded-lg border border-surface/20 px-3 py-1.5 text-sm font-bold"
        >
          {open ? "✕" : "☰"}
        </button>
      </header>

      {/* Mobile drawer */}
      {open ? (
        <div className="no-print fixed inset-0 z-50 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-ink/50" />
          <aside
            className="absolute left-0 top-0 h-full w-64 bg-pine-deep text-surface shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebar}
          </aside>
        </div>
      ) : null}

      {/* Desktop sidebar */}
      <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-pine-deep text-surface lg:flex">
        {sidebar}
      </aside>

      <main className="grain min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  );
}
