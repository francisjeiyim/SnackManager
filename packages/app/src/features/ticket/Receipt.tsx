import { elapsedMs } from "@snackmanager/shared";
import { duration, setLabel, yen } from "../../lib/format";
import type { TicketView } from "../../data/repository";

interface Props {
  ticket: TicketView;
  locale: string;
  shopName?: string;
}

/** Thermal-receipt-styled view. Only visible via the print stylesheet. */
export function Receipt({ ticket, locale, shopName = "SnackManager" }: Props): JSX.Element {
  const t = ticket.live;
  const balance = ticket.totalYen - ticket.paidYen;
  const closedOrNow = ticket.closedAt ?? new Date().toISOString();

  return (
    <div className="receipt">
      <style>{`
        .receipt { width: 72mm; margin: 0 auto; padding: 4mm 2mm; color: #000;
          font: 12px/1.45 ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; }
        .receipt h1 { font-size: 15px; text-align: center; margin: 0 0 2mm; }
        .receipt .muted { color: #333; }
        .receipt hr { border: none; border-top: 1px dashed #000; margin: 2mm 0; }
        .receipt .row { display: flex; justify-content: space-between; gap: 8px; }
        .receipt .row.big { font-weight: 700; font-size: 14px; }
        .receipt .center { text-align: center; }
      `}</style>
      <h1>{shopName}</h1>
      <div className="center muted">
        {new Date(closedOrNow).toLocaleString(locale === "ja" ? "ja-JP" : "en-US")}
      </div>
      <div className="center muted">No. {ticket.number}</div>
      <hr />

      {ticket.guests.map((g, i) => {
        const ms = g.closedAt
          ? elapsedMs(new Date(g.arrivalAt), new Date(g.closedAt))
          : elapsedMs(new Date(g.arrivalAt), new Date());
        return (
          <div className="row" key={g.id}>
            <span>
              {g.displayName ?? `#${i + 1}`}
              {g.seatLabel ? ` [${g.seatLabel}]` : ""} ·{" "}
              {(() => {
                const sets = (g.timeChargeYen ?? 0) > 0 ? 1 : 0;
                return sets
                  ? `${setLabel(sets, g.extensionSets, g.extensionHalfSets, locale)} (${duration(ms)})`
                  : duration(ms);
              })()}
            </span>
            <span>{yen(g.timeChargeYen ?? 0, locale)}</span>
          </div>
        );
      })}

      {ticket.items.filter((it) => !it.voided).length > 0 ? <hr /> : null}
      {ticket.items
        .filter((it) => !it.voided)
        .map((it) => (
          <div className="row" key={it.id}>
            <span>
              {it.nameSnapshot} ×{it.quantity}
            </span>
            <span>{yen(it.unitPriceYen * it.quantity, locale)}</span>
          </div>
        ))}

      <hr />
      <div className="row">
        <span>TIME</span>
        <span>{yen(t.timeYen, locale)}</span>
      </div>
      <div className="row">
        <span>ITEMS</span>
        <span>{yen(t.productsYen, locale)}</span>
      </div>
      {t.discountYen ? (
        <div className="row">
          <span>DISCOUNT</span>
          <span>-{yen(t.discountYen, locale)}</span>
        </div>
      ) : null}
      <div className="row big">
        <span>TOTAL</span>
        <span>{yen(t.totalYen, locale)}</span>
      </div>

      {ticket.payments.length > 0 ? (
        <>
          <hr />
          {ticket.payments.map((p) => (
            <div className="row" key={p.id}>
              <span>{p.method}</span>
              <span>{yen(p.amountYen, locale)}</span>
            </div>
          ))}
          <div className="row">
            <span>BALANCE</span>
            <span>{yen(balance, locale)}</span>
          </div>
        </>
      ) : null}

      <hr />
      <div className="center muted">ありがとうございました / Thank you</div>
    </div>
  );
}
