import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  computeGuestCharge,
  computeTicketTotals,
  elapsedMs,
  type BillingSettings,
} from "@snackmanager/shared";
import { Badge, Button, Card, Spinner } from "../../components/ui";
import { duration, yen } from "../../lib/format";
import { storedLocale } from "../../i18n";
import { useNow } from "../../lib/useNow";
import { useCloseTicket, useSettings, useTicket, useVoidItem } from "../../data/queries";
import type { TicketView } from "../../data/repository";
import { PosGridModal } from "./PosGridModal";
import { PayModal } from "./PayModal";
import { MergeModal } from "./MergeModal";
import { SplitModal } from "./SplitModal";

const statusTone = {
  OPEN: "emerald",
  CLOSED: "amber",
  PAID: "sky",
  VOID: "rose",
} as const;

export function TicketPanel({
  ticketId,
  onClose,
}: {
  ticketId: string;
  onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const locale = storedLocale();
  const now = useNow(1000);
  const ticketQ = useTicket(ticketId);
  const settingsQ = useSettings();
  const closeTicket = useCloseTicket();
  const voidItem = useVoidItem(ticketId);

  const [modal, setModal] = useState<null | "pos" | "pay" | "merge" | "split" | "close">(null);

  if (ticketQ.isLoading || settingsQ.isLoading) {
    return (
      <Card className="flex h-full items-center justify-center p-6">
        <Spinner />
      </Card>
    );
  }
  if (!ticketQ.data || !settingsQ.data) {
    return <Card className="p-6 text-sm text-rose-600">{t("common.error")}</Card>;
  }

  const ticket: TicketView = ticketQ.data;
  const settings = settingsQ.data as BillingSettings;
  const isOpen = ticket.status === "OPEN";

  const totals = isOpen
    ? computeTicketTotals({ ticket, guests: ticket.guests, items: ticket.items }, settings, now)
    : ticket.live;
  const balance = ticket.totalYen - ticket.paidYen;

  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 p-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800">
            {t("ticket.title", { n: ticket.number })}
          </span>
          <Badge tone={statusTone[ticket.status]}>{t(`ticket.status.${ticket.status}`)}</Badge>
        </div>
        <button className="text-slate-400 hover:text-slate-600" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        <section>
          <div className="mb-1 text-xs font-medium uppercase text-slate-400">
            {t("ticket.guests")}
          </div>
          <ul className="space-y-1">
            {ticket.guests.map((g, i) => {
              const charge = computeGuestCharge(g, settings, now);
              const ms =
                g.status === "CLOSED" && g.closedAt
                  ? elapsedMs(new Date(g.arrivalAt), new Date(g.closedAt))
                  : elapsedMs(new Date(g.arrivalAt), now);
              return (
                <li
                  key={g.id}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm"
                >
                  <span className="text-slate-700">{g.displayName ?? `#${i + 1}`}</span>
                  <span className="flex items-center gap-3 tabular-nums text-slate-500">
                    <span>{duration(ms)}</span>
                    <span className="font-medium text-slate-700">
                      {yen(charge.timeChargeYen, locale)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <div className="mb-1 text-xs font-medium uppercase text-slate-400">
            {t("ticket.items")}
          </div>
          <ul className="space-y-1">
            {ticket.items.map((it) => (
              <li
                key={it.id}
                className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm ${
                  it.voided ? "text-slate-300 line-through" : "text-slate-700"
                }`}
              >
                <span>
                  {it.nameSnapshot} ×{it.quantity}
                </span>
                <span className="flex items-center gap-2 tabular-nums">
                  {yen(it.unitPriceYen * it.quantity, locale)}
                  {isOpen && !it.voided ? (
                    <button
                      className="text-xs text-rose-500 hover:underline"
                      onClick={() => voidItem.mutate(it.id)}
                    >
                      {t("ticket.void")}
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
            {ticket.items.length === 0 ? (
              <li className="px-2.5 py-1.5 text-sm text-slate-300">—</li>
            ) : null}
          </ul>
        </section>

        <section className="space-y-1 border-t border-slate-200 pt-3 text-sm">
          <Row label={t("ticket.time")} value={yen(totals.timeYen, locale)} />
          <Row label={t("ticket.products")} value={yen(totals.productsYen, locale)} />
          {totals.discountYen ? (
            <Row label={t("ticket.discount")} value={`-${yen(totals.discountYen, locale)}`} />
          ) : null}
          <Row label={t("ticket.total")} value={yen(totals.totalYen, locale)} strong />
          {ticket.paidYen > 0 ? (
            <>
              <Row label={t("ticket.paid")} value={yen(ticket.paidYen, locale)} />
              <Row label={t("ticket.balance")} value={yen(balance, locale)} strong />
            </>
          ) : null}
        </section>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-slate-200 p-3">
        {isOpen ? (
          <>
            <Button size="sm" onClick={() => setModal("pos")}>
              {t("ticket.addProduct")}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setModal("merge")}>
              {t("ticket.merge")}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setModal("split")}>
              {t("ticket.split")}
            </Button>
            <Button
              size="sm"
              variant="success"
              disabled={closeTicket.isPending}
              onClick={() =>
                closeTicket.mutate({ id: ticket.id }, { onSuccess: () => setModal(null) })
              }
            >
              {t("ticket.close")}
            </Button>
          </>
        ) : null}
        {ticket.status === "CLOSED" ? (
          <>
            <Button size="sm" variant="secondary" onClick={() => setModal("split")}>
              {t("ticket.split")}
            </Button>
            <Button size="sm" variant="success" onClick={() => setModal("pay")}>
              {t("ticket.pay")}
            </Button>
          </>
        ) : null}
      </div>

      {modal === "pos" ? (
        <PosGridModal ticketId={ticket.id} onClose={() => setModal(null)} />
      ) : null}
      {modal === "pay" ? (
        <PayModal ticketId={ticket.id} balanceYen={balance} onClose={() => setModal(null)} />
      ) : null}
      {modal === "merge" ? (
        <MergeModal
          ticketId={ticket.id}
          onClose={() => setModal(null)}
          onDone={() => setModal(null)}
        />
      ) : null}
      {modal === "split" ? (
        <SplitModal ticket={ticket} onClose={() => setModal(null)} onDone={() => setModal(null)} />
      ) : null}
    </Card>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}): JSX.Element {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={strong ? "font-semibold text-slate-900" : "tabular-nums text-slate-700"}>
        {value}
      </span>
    </div>
  );
}
