import { createRoot } from "react-dom/client";
import { Receipt } from "../features/ticket/Receipt";
import type { TicketView } from "../data/repository";

/** Render a receipt into the print-only area and open the browser print dialog. */
export function printReceipt(ticket: TicketView, locale: string): void {
  let el = document.getElementById("print-area");
  if (!el) {
    el = document.createElement("div");
    el.id = "print-area";
    document.body.appendChild(el);
  }
  const root = createRoot(el);
  root.render(<Receipt ticket={ticket} locale={locale} />);

  // Let the DOM lay out before printing, then tear the tree down.
  window.setTimeout(() => {
    window.print();
    window.setTimeout(() => root.unmount(), 300);
  }, 80);
}
