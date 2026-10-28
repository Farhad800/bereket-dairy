import Link from "next/link";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ComponentProps, ReactNode } from "react";

export const cn = (...c: Parameters<typeof clsx>) => twMerge(clsx(c));

const buttonStyles = {
  primary: "bg-black text-white hover:bg-neutral-800 disabled:bg-neutral-400",
  secondary: "border border-line bg-surface text-ink hover:bg-surface-2",
  danger: "border-2 border-black bg-white text-black hover:bg-black hover:text-white",
  ghost: "text-ink hover:bg-surface-2",
};

type ButtonProps = ComponentProps<"button"> & { variant?: keyof typeof buttonStyles; size?: "sm" | "md" };

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed",
        size === "md" ? "min-h-11 px-4 text-sm" : "min-h-9 px-3 text-xs", // 44px tap targets for gloves/phones
        buttonStyles[variant],
        className,
      )}
    />
  );
}

export function LinkButton({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof buttonStyles }) {
  return (
    <Link
      {...props}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors",
        buttonStyles[variant],
        className,
      )}
    />
  );
}

export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section {...props} className={cn("rounded-2xl border border-line bg-surface p-4 sm:p-5", className)} />;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Field({
  label,
  name,
  error,
  hint,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={name} className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-semibold text-ink" role="alert">⚠ {error}</span>}
    </label>
  );
}

const inputCls =
  "block w-full min-h-11 rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted focus:border-black focus:outline-none disabled:bg-surface-2 disabled:text-muted";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input id={props.name} {...props} className={cn(inputCls, className)} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea id={props.name} rows={3} {...props} className={cn(inputCls, "py-2", className)} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select id={props.name} {...props} className={cn(inputCls, className)} />;
}

/** Black-and-white design: tones are told apart by weight and fill, never by color. */
const badgeTones = {
  gray: "border border-line bg-surface-2 text-muted",
  blue: "border border-black bg-white text-black",
  green: "bg-black text-white",
  amber: "border border-dashed border-black bg-white text-black",
  red: "bg-black text-white ring-2 ring-black ring-offset-1",
  purple: "bg-neutral-700 text-white",
};
export type Tone = keyof typeof badgeTones;

export function Badge({ tone = "gray", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap", badgeTones[tone], className)}>
      {children}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">{children}</div>;
}

/** Messages in black and white: a problem has a thick black edge and an icon; success and notes are plain. */
export function Alert({ tone = "red", children }: { tone?: "red" | "green" | "amber" | "blue"; children: ReactNode }) {
  const tones = {
    red: "border-2 border-black border-s-8 bg-white font-medium text-black",
    green: "border border-black bg-white text-black",
    amber: "border border-dashed border-black bg-white text-black",
    blue: "border border-line bg-surface-2 text-ink",
  };
  const mark = { red: "✕", green: "✓", amber: "!", blue: "i" }[tone];
  return (
    <div role={tone === "red" ? "alert" : "status"} className={cn("flex gap-2 rounded-lg px-3 py-2 text-sm", tones[tone])}>
      <span aria-hidden className="font-bold">{mark}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** The official Bereket Dairy logo, exactly as supplied (604 × 583), on white — its own background. */
export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/bereket-dairy-logo.jpg"
      alt="Bereket Dairy"
      width={size}
      height={Math.round((size * 583) / 604)}
      className={cn("logo-tile rounded-xl object-contain", className)}
    />
  );
}
