import Link from "next/link";
import React from "react";

/**
 * The shared shell. Every page previously invented its own header — two
 * competing idioms, four different root wrappers, three subtitle sizes — so
 * layout drifted page to page. These are deliberately plain: a heading, a rule,
 * and the data.
 */

export function Page({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-8">{children}</div>;
}

export function PageHeader({
  title,
  description,
  meta,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="border-b border-border pb-5">
      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      {description && (
        <p className="mt-2 text-base text-muted max-w-2xl leading-relaxed">{description}</p>
      )}
      {meta && <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">{meta}</div>}
      {children && <div className="mt-4">{children}</div>}
    </header>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      {(title || actions) && (
        <div className="flex items-baseline justify-between gap-4">
          <div>
            {title && (
              <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
            )}
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** A bordered surface. Replaces 54 copies of the old `glass` recipe. */
export function Card({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "article" | "li";
}) {
  return (
    <Tag className={`bg-surface border border-border rounded-md ${className}`}>{children}</Tag>
  );
}

/**
 * Compact label/value figures. The old stat tiles spent ~150px each on a single
 * number; this puts the same four figures in one band.
 */
export function StatList({
  items,
  className = "",
}: {
  items: { label: string; value: React.ReactNode; hint?: string }[];
  className?: string;
}) {
  return (
    <dl
      className={`grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border rounded-md overflow-hidden ${className}`}
    >
      {items.map((it) => (
        <div key={it.label} className="bg-surface px-4 py-3">
          <dt className="text-xs text-muted">{it.label}</dt>
          <dd className="mt-0.5 text-xl font-semibold text-foreground tnum">{it.value}</dd>
          {it.hint && <p className="mt-0.5 text-xs text-muted">{it.hint}</p>}
        </div>
      ))}
    </dl>
  );
}

type Tone = "neutral" | "accent" | "enacted" | "failed" | "progress" | "verified" | "demo" | "ai";

const TONES: Record<Tone, string> = {
  neutral: "text-muted bg-surface-sunken border-border",
  accent: "text-accent bg-accent-wash border-accent/20",
  enacted: "text-enacted bg-enacted-wash border-enacted/20",
  failed: "text-failed bg-failed-wash border-failed/20",
  progress: "text-progress bg-progress-wash border-border",
  verified: "text-verified bg-verified-wash border-verified/20",
  demo: "text-demo bg-demo-wash border-demo/20",
  ai: "text-ai bg-ai-wash border-ai/20",
};

export function Badge({
  tone = "neutral",
  children,
  title,
  className = "",
}: {
  tone?: Tone;
  children: React.ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded-sm border whitespace-nowrap ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * Magnitude, not judgement. The old strength bar ran green→red, which inverted
 * the bill-status palette where green means enacted and red means failed.
 * A single ramp removes that contradiction.
 */
export function Meter({ value, label }: { value: number | null; label?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round((value ?? 0) * 100)));
  return (
    <span className="inline-flex items-center gap-2" title={label}>
      <span
        className="h-1 w-16 rounded-sm bg-surface-sunken overflow-hidden"
        role="img"
        aria-label={label ? `${label}: ${pct}%` : `${pct}%`}
      >
        <span className="block h-full bg-accent" style={{ width: `${pct}%` }} />
      </span>
      <span className="text-xs text-muted tnum">{pct}%</span>
    </span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted py-6">{children}</p>;
}

export function A({
  href,
  children,
  className = "",
  ...rest
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  prefetch?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`text-accent hover:text-accent-hover underline underline-offset-2 decoration-accent/30 hover:decoration-accent ${className}`}
      {...rest}
    >
      {children}
    </Link>
  );
}
