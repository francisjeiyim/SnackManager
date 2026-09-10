import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, EmptyState, Modal, Select, Skeleton } from "../../components/ui";
import { dateTime, setLabel, yen } from "../../lib/format";
import { storedLocale } from "../../i18n";
import { printReceipt } from "../../lib/printReceipt";
import { usePermissions } from "../../lib/permissions";
import { toastBus } from "../../lib/toastBus";
import { useTicketHistory, useWriteOffTicket } from "../../data/queries";
import type { TicketView } from "../../data/repository";
import { PayModal } from "../ticket/PayModal";

const STATUSES = ["", "OPEN", "CLOSED", "PAID", "UNPAID", "VOID"] as const;

const tone = {
  OPEN: "emerald",
  CLOSED: "amber",
  PAID: "sky",
  UNPAID: "rose",
  VOID: "stone",
} as const;

const balanceOf = (tk: TicketView): number => tk.totalYen - tk.paidYen;
const owes = (tk: TicketView): boolean =>
  (tk.status === "CLOSED" || tk.status === "UNPAID") && balanceOf(tk) > 0;

export function InvoicesPage(): JSX.Element {
  const { t } = useTranslation();
  const locale = storedLocale();
  const perms = usePermissions();
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const historyQ = useTicketHistory(status || undefined);
  const writeOff = useWriteOffTicket();
  const [detail, setDetail] = useState<TicketView | null>(null);
  const [payFor, setPayFor] = useState<TicketView | null>(null);

  // Local calendar day (YYYY-MM-DD) of an ISO timestamp — matches the column the
  // operator reads, not the internal accounting "service day".
  const localDay = (iso: string): string => new Date(iso).toLocaleDateString("en-CA");
  const rows = (historyQ.data ?? []).filter((tk) => {
    if (!from && !to) return true;
    const d = localDay(tk.openedAt);
    const dc = tk.closedAt ? localDay(tk.closedAt) : d;
    if (from && d < from && dc < from) return false;
    if (to && d > to && dc > to) return false;
    return true;
  });

  const dateInput =
    "rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-700 focus:border-accent focus:outline-none";

  const doWriteOff = (tk: TicketView): void => {
    if (!window.confirm(t("ticket.markUnpaidConfirm"))) return;
    writeOff.mutate(
      { id: tk.id },
      {
        onSuccess: () => {
          toastBus.success(t("ticket.recordedUnpaid"));
          setDetail(null);
        },
      },
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-lg font-semibold text-stone-800">{t("invoices.title")}</h1>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-0.5 text-xs text-stone-400">
            {t("invoices.from")}
            <input
              type="date"
              className={dateInput}
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-0.5 text-xs text-stone-400">
            {t("invoices.to")}
            <input
              type="date"
              className={dateInput}
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          {from || to ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFrom("");
                setTo("");
              }}
            >
              {t("invoices.clearDates")}
            </Button>
          ) : null}
          <div className="w-40">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s ? t(`ticket.status.${s}`) : t("invoices.all")}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <Card>
        {historyQ.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon="▤" title={t("invoices.empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="border-b border-stone-200 text-left text-xs uppercase text-stone-400">
                <tr>
                  <th className="p-3">{t("invoices.number")}</th>
                  <th className="p-3">{t("invoices.opened")}</th>
                  <th className="p-3">{t("invoices.closed")}</th>
                  <th className="p-3 text-right">{t("invoices.total")}</th>
                  <th className="p-3">{t("invoices.status")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((tk) => (
                  <tr
                    key={tk.id}
                    onClick={() => setDetail(tk)}
                    className="cursor-pointer border-b border-stone-100 last:border-0 hover:bg-stone-50"
                  >
                    <td className="p-3 font-medium">#{tk.number}</td>
                    <td className="p-3 text-stone-500">{dateTime(tk.openedAt, locale)}</td>
                    <td className="p-3 text-stone-500">
                      {tk.closedAt ? dateTime(tk.closedAt, locale) : "—"}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {yen(tk.totalYen, locale)}
                      {owes(tk) ? (
                        <span className="ml-1 font-semibold text-rose-600">
                          ({t("ticket.balance")} {yen(balanceOf(tk), locale)})
                        </span>
                      ) : null}
                    </td>
                    <td className="p-3">
                      <Badge tone={tone[tk.status]}>{t(`ticket.status.${tk.status}`)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {detail ? (
        <Modal
          open
          onClose={() => setDetail(null)}
          title={t("ticket.title", { n: detail.number })}
          wide
          footer={
            <>
              <Button variant="ghost" onClick={() => printReceipt(detail, locale)}>
                {t("ticket.print")}
              </Button>
              {perms.canCashier && detail.status === "CLOSED" && balanceOf(detail) > 0 ? (
                <Button
                  variant="danger"
                  loading={writeOff.isPending}
                  onClick={() => doWriteOff(detail)}
                >
                  {t("ticket.markUnpaid")}
                </Button>
              ) : null}
              {perms.canCashier && owes(detail) ? (
                <Button variant="success" onClick={() => setPayFor(detail)}>
                  {t("ticket.pay")}
                </Button>
              ) : null}
            </>
          }
        >
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={tone[detail.status]}>{t(`ticket.status.${detail.status}`)}</Badge>
              <span className="text-stone-400">{dateTime(detail.openedAt, locale)}</span>
              {owes(detail) ? (
                <span className="ml-auto rounded-lg bg-rose-100 px-2 py-1 text-xs font-bold text-rose-700">
                  {t("ticket.balance")} {yen(balanceOf(detail), locale)}
                </span>
              ) : null}
            </div>
            <div>
              <div className="mb-1 text-xs uppercase text-stone-400">{t("ticket.guests")}</div>
              {detail.guests.map((g, i) => (
                <div key={g.id} className="flex justify-between">
                  <span>
                    {g.displayName ?? `#${i + 1}`}
                    {g.seatLabel ? (
                      <span className="ml-1 text-xs text-stone-400">· {g.seatLabel}</span>
                    ) : null}
                  </span>
                  <span className="tabular-nums text-stone-500">
                    {(() => {
                      const sets = (g.timeChargeYen ?? 0) > 0 ? 1 : 0;
                      return `${
                        sets
                          ? setLabel(sets, g.extensionSets, g.extensionHalfSets, locale) + " · "
                          : ""
                      }${g.billedMinutes ?? "—"} min`;
                    })()}{" "}
                    · {yen(g.timeChargeYen ?? 0, locale)}
                  </span>
                </div>
              ))}
            </div>
            <div>
              <div className="mb-1 text-xs uppercase text-stone-400">{t("ticket.items")}</div>
              {detail.items
                .filter((it) => !it.voided)
                .map((it) => (
                  <div key={it.id} className="flex justify-between">
                    <span>
                      {it.nameSnapshot} ×{it.quantity}
                    </span>
                    <span className="tabular-nums text-stone-500">
                      {yen(it.unitPriceYen * it.quantity, locale)}
                    </span>
                  </div>
                ))}
            </div>
            <div className="space-y-1 border-t border-stone-200 pt-2">
              <div className="flex justify-between">
                <span className="text-stone-500">{t("ticket.time")}</span>
                <span className="tabular-nums">{yen(detail.timeYen, locale)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">{t("ticket.products")}</span>
                <span className="tabular-nums">{yen(detail.productsYen, locale)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>{t("ticket.total")}</span>
                <span className="tabular-nums">{yen(detail.totalYen, locale)}</span>
              </div>
              {detail.payments.length > 0 ? (
                <div className="pt-1 text-stone-500">
                  {detail.payments.map((p) => (
                    <div key={p.id} className="flex justify-between">
                      <span>{t(`pay.methods.${p.method}`)}</span>
                      <span className="tabular-nums">{yen(p.amountYen, locale)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {owes(detail) ? (
                <div className="flex justify-between font-bold text-rose-700">
                  <span>{t("ticket.balance")}</span>
                  <span className="tabular-nums">{yen(balanceOf(detail), locale)}</span>
                </div>
              ) : null}
            </div>
          </div>
        </Modal>
      ) : null}

      {payFor ? (
        <PayModal
          ticketId={payFor.id}
          balanceYen={balanceOf(payFor)}
          onClose={() => {
            setPayFor(null);
            setDetail(null);
          }}
        />
      ) : null}
    </div>
  );
}
