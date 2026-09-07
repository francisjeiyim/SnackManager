export type ToastKind = "success" | "error" | "info";
export interface ToastMessage {
  id: number;
  kind: ToastKind;
  text: string;
}

type Listener = (t: ToastMessage) => void;
const listeners = new Set<Listener>();
let seq = 0;

function push(kind: ToastKind, text: string): void {
  const t = { id: ++seq, kind, text };
  for (const l of listeners) l(t);
}

/** Fire toasts from anywhere (incl. non-component code like query mutations). */
export const toastBus = {
  success: (text: string) => push("success", text),
  error: (text: string) => push("error", text),
  info: (text: string) => push("info", text),
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
