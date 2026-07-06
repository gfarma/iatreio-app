import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-line bg-surface shadow-card ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm text-mist">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine disabled:opacity-50 disabled:pointer-events-none";

const buttonVariants = {
  primary: "bg-pine text-surface hover:bg-pine-deep px-4 py-2",
  secondary: "border border-line bg-surface text-ink hover:bg-cream px-4 py-2",
  ghost: "text-pine hover:bg-sage px-3 py-1.5",
  danger: "border border-clay/40 text-clay hover:bg-clay hover:text-surface px-4 py-2",
} as const;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof buttonVariants }) {
  return (
    <button className={`${buttonBase} ${buttonVariants[variant]} ${className}`} {...props} />
  );
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof buttonVariants }) {
  return <Link className={`${buttonBase} ${buttonVariants[variant]} ${className}`} {...props} />;
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return (
    <input
      className={`w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-mist/60 focus:border-pine focus:outline-none focus:ring-1 focus:ring-pine ${className}`}
      {...props}
    />
  );
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={`w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-mist/60 focus:border-pine focus:outline-none focus:ring-1 focus:ring-pine ${className}`}
      {...props}
    />
  );
}

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return (
    <select
      className={`w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-pine focus:outline-none focus:ring-1 focus:ring-pine ${className}`}
      {...props}
    />
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-mist">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-mist">{hint}</span> : null}
    </label>
  );
}

const badgeTones = {
  pending: "bg-cream text-ochre border-ochre/30",
  confirmed: "bg-sage text-pine-deep border-pine/30",
  completed: "bg-pine text-surface border-pine",
  cancelled: "bg-paper text-mist border-line",
  no_show: "bg-clay/10 text-clay border-clay/30",
  neutral: "bg-paper text-mist border-line",
  info: "bg-sage text-pine-deep border-pine/20",
} as const;

export const STATUS_LABELS: Record<string, string> = {
  pending: "Σε αναμονή",
  confirmed: "Επιβεβαιωμένο",
  completed: "Ολοκληρωμένο",
  cancelled: "Ακυρωμένο",
  no_show: "Δεν προσήλθε",
};

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof badgeTones;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeTones[tone]}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone = (status in badgeTones ? status : "neutral") as keyof typeof badgeTones;
  return <Badge tone={tone}>{STATUS_LABELS[status] ?? status}</Badge>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="px-5 py-10 text-center text-sm text-mist">
      <span className="mb-2 block font-display text-2xl text-line">◦ ◦ ◦</span>
      {children}
    </div>
  );
}

export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-mist">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
