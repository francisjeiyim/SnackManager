import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { cn } from "../lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-white shadow-sm ring-1 ring-inset ring-white/15 hover:bg-accent-600 hover:shadow-md hover:-translate-y-px disabled:bg-accent-200 disabled:ring-0 disabled:shadow-none disabled:translate-y-0",
  secondary:
    "bg-white text-stone-700 border border-stone-300 shadow-sm hover:bg-stone-50 hover:border-stone-400 hover:-translate-y-px disabled:opacity-60",
  ghost: "bg-transparent text-stone-600 hover:bg-stone-100 hover:text-stone-800",
  danger:
    "bg-rose-600 text-white shadow-sm ring-1 ring-inset ring-white/15 hover:bg-rose-500 hover:shadow-md hover:-translate-y-px disabled:bg-rose-300",
  success:
    "bg-emerald-600 text-white shadow-sm ring-1 ring-inset ring-white/15 hover:bg-emerald-500 hover:shadow-md hover:-translate-y-px disabled:bg-emerald-300",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-7 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, disabled, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/25 active:scale-[0.97]",
        "disabled:cursor-not-allowed disabled:active:scale-100 disabled:hover:translate-y-0",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner className="h-4 w-4 border-white/40 border-t-white" /> : null}
      {children}
    </button>
  );
});

export function IconButton({
  label,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }): JSX.Element {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full text-stone-500 transition-colors",
        "hover:bg-stone-100 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/25",
        "active:scale-95",
        className,
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div
      className={cn(
        "rounded-2xl border border-stone-200/70 bg-white shadow-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-stone-400">
      {children}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-11 w-full rounded-xl border border-stone-300 bg-white px-3.5 text-sm text-stone-800 outline-none transition-shadow",
          "placeholder:text-stone-400 focus:border-accent focus:ring-4 focus:ring-accent/15",
          className,
        )}
        {...props}
      />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          "h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-800 outline-none transition-shadow",
          "focus:border-accent focus:ring-4 focus:ring-accent/15",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}): JSX.Element {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-stone-500">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-stone-400">{hint}</span> : null}
    </label>
  );
}

type Tone = "slate" | "stone" | "accent" | "emerald" | "amber" | "rose" | "sky";
const badgeTones: Record<Tone, string> = {
  slate: "bg-stone-100 text-stone-600 ring-stone-500/10",
  stone: "bg-stone-100 text-stone-600 ring-stone-500/10",
  accent: "bg-accent-100 text-accent-700 ring-accent-500/15",
  emerald: "bg-emerald-100 text-emerald-700 ring-emerald-500/15",
  amber: "bg-amber-100 text-amber-800 ring-amber-500/15",
  rose: "bg-rose-100 text-rose-700 ring-rose-500/15",
  sky: "bg-sky-100 text-sky-700 ring-sky-500/15",
};
const dotTones: Record<Tone, string> = {
  slate: "bg-stone-400",
  stone: "bg-stone-400",
  accent: "bg-accent",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  sky: "bg-sky-500",
};

export function Badge({
  children,
  tone = "stone",
  dot,
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
}): JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        badgeTones[tone],
      )}
    >
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full", dotTones[tone])} /> : null}
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }): JSX.Element {
  return (
    <div
      className={cn(
        "h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-accent",
        className,
      )}
    />
  );
}

export function Skeleton({ className }: { className?: string }): JSX.Element {
  return <div className={cn("animate-pulse rounded-lg bg-stone-200/70", className)} />;
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: ReactNode }>;
  size?: "sm" | "md";
}): JSX.Element {
  return (
    <div className="inline-flex rounded-full border border-stone-200 bg-stone-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full font-semibold transition-all duration-150",
            size === "sm" ? "px-3 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
            value === o.value
              ? "bg-white text-stone-900 shadow-sm"
              : "text-stone-500 hover:text-stone-800",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}): JSX.Element | null {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/30 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          "flex max-h-[92vh] w-full flex-col overflow-hidden bg-white shadow-panel",
          "animate-sheet-up rounded-t-3xl sm:animate-pop sm:rounded-3xl",
          wide ? "sm:max-w-2xl" : "sm:max-w-md",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3.5">
          <h2 className="text-base font-bold text-stone-800">{title}</h2>
          <IconButton label="close" onClick={onClose}>
            ✕
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-stone-100 bg-stone-50/60 px-5 py-3.5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function EmptyState({
  icon = "○",
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-2.5 px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-50 text-2xl text-accent-400">
        {icon}
      </div>
      <div className="text-sm font-semibold text-stone-700">{title}</div>
      {hint ? <div className="max-w-xs text-xs text-stone-400">{hint}</div> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
