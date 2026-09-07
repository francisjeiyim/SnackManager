import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  computeGuestCharge,
  computeTicketTotals,
  elapsedMs,
  type BillingSettings,
} from "@snackmanager/shared";
import { Badge, Button, Card, IconButton, SectionTitle, Skeleton } from "../../components/ui";
import { EditableText } from "../../components/EditableText";
import { duration, yen } from "../../lib/format";
import { storedLocale } from "../../i18n";
import { useNow } from "../../lib/useNow";
import { usePermissions } from "../../lib/permissions";
import { printReceipt } from "../../lib/printReceipt";
import { toastBus } from "../../lib/toastBus";
import {
  useCloseTicket,
  useRenameGuest,
  useSeatOutGuest,
  useSettings,
  useTicket,
  useVoidItem,
} from "../../data/queries";
import type { TicketView } from "../../data/repository";
import { PosGridModal } from "./PosGridModal";
import { PayModal } from "./PayModal";
import { MergeModal } from "./MergeModal";
import { SplitModal } from "./SplitModal";
import { MoveGuestModal } from "./MoveGuestModal";

const statusTone = { OPEN: "emerald", CLOSED: "amber", PAID: "sky", VOID: "rose" } as const;

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
  const perms = usePermissions();
  const ticketQ = useTicket(ticketId);
  const settingsQ = useSettings();
  const closeTicket = useCloseTicket();
  const voidItem = useVoidItem(ticketId);
  const seatOut = useSeatOutGuest();
  const rename = useRenameGuest();

  const [modal, setModal] = useState<null | "pos" | "pay" | "merge" | "split">(null);
  const [moveGuest, setMoveGuest] = useState<TicketView["guests"][number] | null>(null);

  if (ticketQ.isLoading || settingsQ.isLoading) {
    return (
      <Card className="flex h-full flex-col gap-3 p-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="mt-auto h-11 w-full" />
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
  const oldest = ticket.guests.reduce(
    (min, g) => Math.min(min, Date.parse(g.arrivalAt)),
    Number.POSITIVE_INFINITY,
  );

  return (
    <Card className="flex h-full flex-col">
      {/* header */}
      <div className="flex items-center gap-2 border-b border-stone-100 px-3 py-2.5">
        <span className="font-semibold text-stone-800">
          {t("ticket.title", { n: ticket.number })}
        </span>
        <Badge tone={statusTone[ticket.status]} dot>
          {t(`ticket.status.${ticket.status}`)}
        </Badge>
        {Number.isFinite(oldest) ? (
          <span className="text-xs tabular-nums text-stone-400">
            ⏱ {duration(elapsedMs(new Date(oldest), now))}
          </span>
        ) : null}
        <IconButton label="close" className="ml-auto" onClick={onClose}>
          ✕
        </IconButton>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {/* guests */}
        <section className="space-y-1.5">
          <SectionTitle>{t("ticket.guests")}</SectionTitle>
          <ul className="space-y-1.5">
            {ticket.guests.map((g, i) => {
              const charge = computeGuestCharge(g, settings, now);
              const seated = g.status === "SEATED";
              const ms =
                g.status === "CLOSED" && g.closedAt
                  ? elapsedMs(new Date(g.arrivalAt), new Date(g.closedAt))
                  : elapsedMs(new Date(g.arrivalAt), now);
              return (
                <li key={g.id} className={cnRow(seated)}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-200 text-xs font-semibold text-stone-600">
                    {(g.displayName ?? String(i + 1)).slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <EditableText
                        value={g.displayName}
                        placeholder={`${t("seatIn.guest")} ${i + 1}`}
                        disabled={!perms.canServe}
                        className="text-sm font-medium text-stone-700"
                        onCommit={(name) => rename.mutate({ guestId: g.id, displayName: name })}
                      />
                      {g.seatLabel ? (
                        <span className="rounded bg-stone-100 px-1 text-[10px] font-medium text-stone-500">
                          {g.seatLabel}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 text-xs tabular-nums text-stone-400">
                      <span>{duration(ms)}</span>
                      <span className="font-medium text-stone-600">
                        {yen(charge.timeChargeYen, locale)}
                      </span>
                    </div>
                  </div>
                  {isOpen && seated && perms.canServe ? (
                    <div className="flex shrink-0 gap-0.5">
                      <IconButton label={t("ticket.move")} onClick={() => setMoveGuest(g)}>
                        ⇄
                      </IconButton>
                      <IconButton
                        label={t("ticket.leave")}
                        className="hover:text-rose-600"
                        disabled={seatOut.isPending}
                        onClick={() => seatOut.mutate(g.id)}
                      >
                        ⏻
                      </IconButton>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>

        {/* items */}
        <section className="space-y-1.5">
          <SectionTitle>{t("ticket.items")}</SectionTitle>
          <ul className="space-y-1">
            {ticket.items.map((it) => (
              <li
                key={it.id}
                className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm ${
                  it.voided ? "text-stone-300 line-through" : "text-stone-700"
                }`}
              >
                <span>
                  {it.nameSnapshot} <span className="text-stone-400">×{it.quantity}</span>
                </span>
                <span className="flex items-center gap-2 tabular-nums">
                  {yen(it.unitPriceYen * it.quantity, locale)}
                  {isOpen && !it.voided ? (
                    <IconButton
                      label={t("ticket.void")}
                      className="h-6 w-6 hover:text-rose-600"
                      onClick={() => voidItem.mutate(it.id)}
                    >
                      ×
                    </IconButton>
                  ) : null}
                </span>
              </li>
            ))}
            {isOpen && perms.canServe ? (
              <li>
                <button
                  onClick={() => setModal("pos")}
                  className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-stone-300 py-2 text-sm font-medium text-stone-500 hover:border-accent hover:text-accent"
                >
                  ＋ {t("ticket.addProduct")}
                </button>
              </li>
            ) : ticket.items.length === 0 ? (
              <li className="px-2.5 py-1.5 text-sm text-stone-300">—</li>
            ) : null}
          </ul>
        </section>

        {/* totals */}
        <section className="rounded-xl bg-accent-50 p-3 text-sm">
          <Row label={t("ticket.time")} value={yen(totals.timeYen, locale)} />
          <Row label={t("ticket.products")} value={yen(totals.productsYen, locale)} />
          {totals.discountYen ? (
            <Row label={t("ticket.discount")} value={`-${yen(totals.discountYen, locale)}`} />
          ) : null}
          <div className="my-1 border-t border-accent-100" />
          <Row label={t("ticket.total")} value={yen(totals.totalYen, locale)} strong />
          {ticket.paidYen > 0 ? (
            <>
              <Row label={t("ticket.paid")} value={yen(ticket.paidYen, locale)} />
              <Row label={t("ticket.balance")} value={yen(balance, locale)} strong />
            </>
          ) : null}
        </section>
      </div>

      {/* action bar */}
      <div className="border-t border-stone-100 p-3">
        {isOpen && perms.canServe ? (
          <div className="flex gap-2">
            {perms.canCashier ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={() => setModal("merge")}
                >
                  {t("ticket.merge")}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={() => setModal("split")}
                >
                  {t("ticket.split")}
                </Button>
                <Button
                  variant="success"
                  size="sm"
                  className="flex-1"
                  loading={closeTicket.isPending}
                  onClick={() =>
                    closeTicket.mutate(
                      { id: ticket.id },
                      { onSuccess: () => toastBus.success(t("ticket.closed")) },
                    )
                  }
                >
                  {t("ticket.close")}
                </Button>
              </>
            ) : (
              <Button className="flex-1" onClick={() => setModal("pos")}>
                ＋ {t("ticket.addProduct")}
              </Button>
            )}
          </div>
        ) : null}
        {ticket.status === "CLOSED" ? (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => printReceipt(ticket, locale)}>
              {t("ticket.print")}
            </Button>
            {perms.canCashier ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={() => setModal("split")}
                >
                  {t("ticket.split")}
                </Button>
                <Button size="sm" className="flex-1" onClick={() => setModal("pay")}>
                  {t("ticket.pay")}
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
        {ticket.status === "PAID" ? (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => printReceipt(ticket, locale)}
          >
            {t("ticket.print")}
          </Button>
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
      {moveGuest ? <MoveGuestModal guest={moveGuest} onClose={() => setMoveGuest(null)} /> : null}
    </Card>
  );
}

function cnRow(seated: boolean): string {
  return `flex items-center gap-2.5 rounded-lg bg-stone-50 px-2 py-1.5 ${seated ? "" : "opacity-60"}`;
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
    <div className="flex justify-between py-0.5">
      <span className="text-stone-500">{label}</span>
      <span className={strong ? "font-bold text-stone-900" : "tabular-nums text-stone-700"}>
        {value}
      </span>
    </div>
  );
}
