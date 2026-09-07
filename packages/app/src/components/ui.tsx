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
  primary: "bg-accent text-white hover:bg-accent-700 disabled:bg-accent-200 shadow-sm",
  secondary: "bg-white text-stone-800 border border-stone-300 hover:bg-stone-50",
  ghost: "bg-transparent text-stone-600 hover:bg-stone-100",
  danger: "bg-rose-600 text-white hover:bg-rose-500 disabled:bg-rose-300",
  success: "bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-emerald-300 shadow-sm",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-6 text-base",
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
        "inline-flex select-none items-center justify-center gap-2 rounded-lg font-medium transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:active:scale-100",
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
        "inline-flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 transition-colors",
        "hover:bg-stone-100 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
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
    <div className={cn("rounded-xl border border-stone-200/80 bg-white shadow-card", className)}>
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
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
          "h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm outline-none",
          "placeholder:text-stone-400 focus:border-accent focus:ring-2 focus:ring-accent/20",
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
          "h-11 w-full rounded-lg border border-stone-300 bg-white px-2.5 text-sm outline-none",
          "focus:border-accent focus:ring-2 focus:ring-accent/20",
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
    <label className="block space-y-1">
      <span className="text-xs font-medium text-stone-500">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-stone-400">{hint}</span> : null}
    </label>
  );
}

type Tone = "slate" | "stone" | "accent" | "emerald" | "amber" | "rose" | "sky";
const badgeTones: Record<Tone, string> = {
  slate: "bg-stone-100 text-stone-600",
  stone: "bg-stone-100 text-stone-600",
  accent: "bg-accent-100 text-accent-700",
  emerald: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  rose: "bg-rose-100 text-rose-700",
  sky: "bg-sky-100 text-sky-700",
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
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
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
        "h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-stone-700",
        className,
      )}
    />
  );
}

export function Skeleton({ className }: { className?: string }): JSX.Element {
  return <div className={cn("animate-pulse rounded-md bg-stone-200/70", className)} />;
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
    <div className="inline-flex rounded-lg border border-stone-200 bg-stone-100 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md font-medium transition-colors",
            size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          "flex max-h-[92vh] w-full flex-col overflow-hidden bg-white shadow-panel",
          "animate-sheet-up rounded-t-2xl sm:animate-fade-in sm:rounded-2xl",
          wide ? "sm:max-w-2xl" : "sm:max-w-md",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3">
          <h2 className="text-base font-semibold text-stone-800">{title}</h2>
          <IconButton label="close" onClick={onClose}>
            ✕
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-stone-100 px-5 py-3">{footer}</div>
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
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-xl text-stone-400">
        {icon}
      </div>
      <div className="text-sm font-medium text-stone-700">{title}</div>
      {hint ? <div className="max-w-xs text-xs text-stone-400">{hint}</div> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
