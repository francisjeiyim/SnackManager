import { useEffect, useState } from "react";
import { cn } from "../lib/cn";
import { toastBus, type ToastMessage } from "../lib/toastBus";

const TTL = 3800;

const styles: Record<ToastMessage["kind"], string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-rose-200 bg-rose-50 text-rose-800",
  info: "border-stone-200 bg-white text-stone-800",
};
const icons: Record<ToastMessage["kind"], string> = {
  success: "✓",
  error: "!",
  info: "i",
};

/** Mount once near the app root. Renders toasts pushed via `toastBus`. */
export function ToastHost(): JSX.Element {
  const [items, setItems] = useState<ToastMessage[]>([]);

  useEffect(() => {
    return toastBus.subscribe((t) => {
      setItems((cur) => [...cur, t]);
      window.setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== t.id)), TTL);
    });
  }, []);

  const dismiss = (id: number): void => setItems((cur) => cur.filter((x) => x.id !== id));

  return (
    <div className="pointer-events-none fixed right-3 top-3 z-[60] flex w-[calc(100%-1.5rem)] max-w-sm flex-col gap-2">
      {items.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={cn(
            "pointer-events-auto flex animate-fade-in items-start gap-2 rounded-xl border px-3.5 py-2.5 text-left text-sm shadow-panel",
            styles[t.kind],
          )}
        >
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/70 text-[11px] font-bold">
            {icons[t.kind]}
          </span>
          <span className="flex-1">{t.text}</span>
        </button>
      ))}
    </div>
  );
}
