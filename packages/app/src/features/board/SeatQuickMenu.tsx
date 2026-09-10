import { useTranslation } from "react-i18next";
import { computeGuestCharge, elapsedMs, type Guest, type Settings } from "@snackmanager/shared";
import { Button, Modal } from "../../components/ui";
import { duration, setLabel, yen } from "../../lib/format";
import { storedLocale } from "../../i18n";
import { useNow } from "../../lib/useNow";
import { usePermissions } from "../../lib/permissions";
import { toastBus } from "../../lib/toastBus";
import {
  useExtendGuest,
  useQuickSettle,
  useTicket,
  useUndoExtension,
} from "../../data/queries";

/**
 * Compact per-seat actions straight from the Floor — extend (Set / Half-set) a
 * guest and collect payment + free the seat, all in one tap, without opening
 * the full invoice. "Open invoice" is still there for split / card / discount.
 */
export function SeatQuickMenu({
  seatLabel,
  guests,
  unpaidTicketId,
  settings,
  onClose,
  onOpenTicket,
}: {
  seatLabel: string;
  guests: Guest[];
  unpaidTicketId: string | null;
  settings: Settings;
  onClose: () => void;
  onOpenTicket: (ticketId: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const locale = storedLocale();
  const now = useNow(1000);
  const perms = usePermissions();
  const extend = useExtendGuest();
  const undo = useUndoExtension();
  const settle = useQuickSettle();

  const ticketId = guests[0]?.ticketId ?? unpaidTicketId ?? null;
  const ticketQ = useTicket(ticketId);
  const tk = ticketQ.data;
  const balance = tk
    ? (tk.status === "OPEN" ? tk.live.totalYen : tk.totalYen) - tk.paidYen
    : 0;

  const leadMinutes = settings.hourWarningMinutes ?? 0;

  const doSettle = (): void => {
    if (!ticketId) return;
    settle.mutate(
      { ticketId },
      {
        onSuccess: () => {
          toastBus.success(t("board.quickSettled", { amount: yen(Math.max(0, balance), locale) }));
          onClose();
        },
      },
    );
  };

  return (
    <Modal open title={seatLabel} onClose={onClose}>
      {guests.length > 0 ? (
        <ul className="space-y-2.5">
          {guests.map((g, i) => {
            const charge = computeGuestCharge(g, settings, now);
            const ms = elapsedMs(new Date(g.arrivalAt), now);
            const minsLeft = charge.paidUntilMinutes - ms / 60_000;
            const overdue = charge.overdueMinutes > 0;
            const near =
              charge.sets > 0 && !overdue && leadMinutes > 0 && minsLeft <= leadMinutes;
            const hasExt = charge.extensionSets + charge.extensionHalfSets > 0;
            return (
              <li key={g.id} className="rounded-xl bg-stone-50 p-2.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold text-stone-700">
                    {g.displayName ?? `${t("seatIn.guest")} ${i + 1}`}
                  </span>
                  <span className="tabular-nums text-stone-500">
                    {duration(ms)} · {yen(charge.timeChargeYen, locale)}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-stone-400">
                  {setLabel(charge.sets, charge.extensionSets, charge.extensionHalfSets, locale)}
                  {overdue ? (
                    <span className="ml-2 font-semibold text-rose-600">
                      {t("ticket.overdue", { n: charge.overdueMinutes })}
                    </span>
                  ) : near ? (
                    <span className="ml-2 font-semibold text-amber-700">
                      {t("ticket.nearEnd", { n: Math.max(1, Math.ceil(minsLeft)) })}
                    </span>
                  ) : null}
                </div>
                {perms.canServe ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={overdue ? "danger" : "secondary"}
                      disabled={extend.isPending}
                      onClick={() => extend.mutate({ guestId: g.id, kind: "SET" })}
                    >
                      {t("ticket.extendSet")}
                    </Button>
                    <Button
                      size="sm"
                      variant={overdue ? "danger" : "secondary"}
                      disabled={extend.isPending}
                      onClick={() => extend.mutate({ guestId: g.id, kind: "HALF" })}
                    >
                      {t("ticket.extendHalf")}
                    </Button>
                    {hasExt ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={undo.isPending}
                        onClick={() => undo.mutate({ guestId: g.id })}
                      >
                        ↶ {t("ticket.undoExtension")}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : unpaidTicketId ? (
        <p className="text-sm text-stone-600">
          {t("board.quickUnpaidBody", { amount: yen(Math.max(0, balance), locale) })}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2">
        {perms.canCashier && ticketId ? (
          <Button
            variant="success"
            size="lg"
            className="w-full"
            loading={settle.isPending}
            disabled={ticketQ.isLoading}
            onClick={doSettle}
          >
            {t("board.quickSettle")} {balance > 0 ? yen(balance, locale) : ""}
          </Button>
        ) : null}
        {ticketId ? (
          <Button variant="ghost" size="sm" className="w-full" onClick={() => onOpenTicket(ticketId)}>
            {t("board.quickOpenInvoice")}
          </Button>
        ) : null}
      </div>
    </Modal>
  );
}
